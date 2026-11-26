begin;
create table public.ig_hardware_events (
 device_id text not null references public.ig_devices(id), nonce text not null,
 payload jsonb not null, received_at timestamptz not null default now(), primary key(device_id,nonce)
);
alter table public.ig_hardware_events enable row level security;
revoke all on public.ig_hardware_events from anon,authenticated;
grant all on public.ig_hardware_events to service_role;

create function public.ig_hardware_snapshot(p_device text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',(select version from public.ig_workspace_clock where id),
 'device',d.payload,'application',a.payload,'vehicle',v.payload)
 from public.ig_devices d left join public.ig_applications a on a.id=d.application_id
 left join public.ig_vehicles v on v.id=d.vehicle_id where d.id=p_device
$$;

create function public.ig_commit_hardware(p_expected bigint,p_device text,p_nonce text,p_event jsonb,p_vehicle jsonb,p_alerts jsonb)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare current_version bigint; received timestamptz:=clock_timestamp(); d public.ig_devices; item jsonb; prior timestamptz;
begin
 select version into current_version from public.ig_workspace_clock where id for update;
 select received_at into prior from public.ig_hardware_events where device_id=p_device and nonce=p_nonce;
 if found then
  if (select payload from public.ig_hardware_events where device_id=p_device and nonce=p_nonce)<>p_event then raise exception 'Event conflict' using errcode='23505'; end if;
  return prior;
 end if;
 if current_version<>p_expected then raise exception 'Workspace changed' using errcode='40001'; end if;
 select * into d from public.ig_devices where id=p_device;
 if not found then raise exception 'Unknown device'; end if;
 if p_event->>'deviceId'<>p_device or p_event->>'nonce'<>p_nonce then raise exception 'Device mismatch'; end if;
 insert into public.ig_device_nonces(device_id,nonce) values(p_device,p_nonce);
 insert into public.ig_hardware_events(device_id,nonce,payload) values(p_device,p_nonce,p_event);
 update public.ig_devices set payload=payload||jsonb_build_object('lastSetupAt',received,'lastTelemetry',p_event) where id=p_device;
 update public.ig_device_credentials set last_contact_at=received,last_nonce=p_nonce where device_id=p_device;
 if p_vehicle is not null then
  if d.vehicle_id is null or p_vehicle->>'id'<>d.vehicle_id or p_vehicle->>'deviceId'<>p_device then raise exception 'Assignment changed'; end if;
  update public.ig_vehicles set payload=p_vehicle where id=d.vehicle_id;
  for item in select value from jsonb_array_elements(p_alerts) loop
   if item->>'vehicleId'<>d.vehicle_id then raise exception 'Alert scope mismatch'; end if;
   if not exists(select 1 from public.ig_work_items where kind='alerts' and vehicle_id=d.vehicle_id and payload->>'title'=item->>'title' and payload->>'status'<>'Resolved') then
    insert into public.ig_work_items(id,kind,payload,office,vehicle_id) select item->>'id','alerts',item,v.office,v.id from public.ig_vehicles v where v.id=d.vehicle_id on conflict(id) do nothing;
   end if;
  end loop;
 end if;
 update public.ig_workspace_clock set version=version+1 where id;
 delete from public.ig_device_nonces where device_id=p_device and received_at<now()-interval '15 minutes';
 return received;
end $$;
revoke all on function public.ig_hardware_snapshot(text), public.ig_commit_hardware(bigint,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ig_hardware_snapshot(text), public.ig_commit_hardware(bigint,text,text,jsonb,jsonb,jsonb) to service_role;

create or replace function public.ig_commit_workspace(p_actor uuid,p_expected bigint,p_changes jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare current_version bigint; actor public.ig_profiles; item jsonb; body jsonb; kind text; existing_device public.ig_devices;
begin
 select * into actor from public.ig_profiles where id=p_actor and status='Active';
 if actor.id is null then raise exception 'Account access revoked'; end if;
 select version into current_version from public.ig_workspace_clock where id for update;
 if current_version<>p_expected then raise exception 'Workspace changed. Refresh and retry.' using errcode='40001'; end if;
 for item in select value from jsonb_array_elements(p_changes) loop
  body:=item->'payload'; kind:=item->>'kind';
  if kind='applications' then
   if not ((actor.role='vehicle_owner' and body->>'ownerId'=actor.id::text) or
     (actor.role in ('rto_admin','rto_manager','registration_operator') and actor.office=body->>'office')) then raise exception 'Application permission denied'; end if;
   if exists(select 1 from public.ig_applications where id=item->>'id' and owner_id::text<>body->>'ownerId') then raise exception 'Applicant identity cannot change'; end if;
   if body->>'status'='Approved' and actor.role<>'rto_admin' then
    -- An owner may only add the dashboard confirmation to their already approved application.
    if actor.role<>'vehicle_owner' or not exists(select 1 from public.ig_applications a where a.id=item->>'id' and a.owner_id=actor.id and a.status='Approved'
     and (a.payload-array['ownerMountedAt','mountingLocation','updatedAt','version'])=(body-array['ownerMountedAt','mountingLocation','updatedAt','version'])
     and a.payload->>'ownerMountedAt' is null and body->>'ownerMountedAt' is not null and body->>'mountingLocation'='Car dashboard') then
     raise exception 'Independent RTO approval required';
    end if;
   end if;
   insert into public.ig_applications(id,payload) values(item->>'id',body) on conflict(id) do update set payload=excluded.payload;
  elsif kind='devices' then
   select * into existing_device from public.ig_devices where id=item->>'id' for update;
   if not found then raise exception 'Device must be provisioned before claiming'; end if;
   if actor.role='vehicle_owner' and (existing_device.payload->>'reservedBy' is not null and existing_device.payload->>'reservedBy'<>actor.id::text) then raise exception 'Device already claimed'; end if;
   if actor.role='vehicle_owner' and body->>'assignedVehicleId' is distinct from existing_device.payload->>'assignedVehicleId' then raise exception 'Only a reviewer may assign a device'; end if;
   update public.ig_devices set payload=body-'claimHash' where id=item->>'id';
  elsif kind='vehicles' then
   if actor.role='vehicle_owner' or not public.ig_scope(actor.id,body->>'office',null,item->>'id') then raise exception 'Vehicle permission denied'; end if;
   insert into public.ig_vehicles(id,payload) values(item->>'id',body) on conflict(id) do update set payload=excluded.payload;
  elsif kind in ('documents','revisions','history') then
   if not exists(select 1 from public.ig_applications a where a.id=item->>'applicationId' and
    ((actor.role='vehicle_owner' and a.owner_id=actor.id) or (actor.office=a.office and actor.role in ('rto_admin','rto_manager','registration_operator')))) then raise exception 'Evidence permission denied'; end if;
   execute format('insert into public.%I(id,application_id,payload) values($1,$2,$3) on conflict(id) do update set payload=excluded.payload',
    case kind when 'documents' then 'ig_documents' when 'revisions' then 'ig_revisions' else 'ig_application_actions' end)
    using item->>'id',item->>'applicationId',body;
  elsif kind='profiles' then
   -- Workflow can update display names only, never roles or jurisdiction.
   if actor.id::text<>item->>'id' and actor.role<>'rto_admin' then raise exception 'Profile permission denied'; end if;
   update public.ig_profiles set display_name=left(body->>'name',100) where id=(item->>'id')::uuid;
  elsif kind in ('alerts','cases','requests','audit','maintenance','classificationChanges') then
   if kind='audit' and exists(select 1 from public.ig_work_items where id=item->>'id') then raise exception 'Audit entries are immutable'; end if;
   insert into public.ig_work_items(id,kind,payload,office,vehicle_id,actor_id)
   values(item->>'id',kind,body,item->>'office',item->>'vehicleId',p_actor)
   on conflict(id) do update set payload=excluded.payload;
  else raise exception 'Unsupported collection'; end if;
 end loop;
 update public.ig_workspace_clock set version=version+1 where id returning version into current_version;
 return current_version;
end $$;


commit;
