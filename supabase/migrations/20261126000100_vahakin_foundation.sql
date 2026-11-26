-- Live application data is separate from the local, credential-gated demo store.
begin;
create extension if not exists pgcrypto with schema extensions;

create table public.ig_offices (
 code text primary key, name text not null, state text not null, district text not null,
 service_area text not null, accepting_applications boolean not null default false
);
insert into public.ig_offices values ('GJ-03','Rajkot RTO','Gujarat','Rajkot','Rajkot city',true);

create table public.ig_profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '', email text not null default '',
 role text not null default 'vehicle_owner' check(role in ('vehicle_owner','rto_admin','rto_manager','registration_operator','enforcement_officer','device_technician','auditor','national_admin','state_admin','technical_admin')),
 state text, office text references public.ig_offices(code), status text not null default 'Active' check(status in ('Active','Suspended')),
 assigned_vehicle_ids text[] not null default '{}', created_at timestamptz not null default now(),
 check(role in ('vehicle_owner','national_admin','state_admin','technical_admin') or office is not null)
);
create function public.ig_create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ig_profiles(id,email,display_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),100)) on conflict(id) do nothing;
 return new;
end $$;
create trigger ig_auth_profile after insert on auth.users for each row execute function public.ig_create_profile();
insert into public.ig_profiles(id,email,display_name) select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'full_name',''),100) from auth.users on conflict do nothing;

create table public.ig_workspace_clock(id boolean primary key default true check(id), version bigint not null default 0);
insert into public.ig_workspace_clock values(true,0);

create table public.ig_applications (
 id text primary key, payload jsonb not null check(jsonb_typeof(payload)='object'),
 owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null references public.ig_profiles(id) on delete cascade,
 status text generated always as (payload->>'status') stored not null check(status in ('Draft','Submitted','Under review','Changes requested','Rejected','Approved')),
 office text generated always as (payload->>'office') stored references public.ig_offices(code),
 version integer generated always as ((payload->>'version')::integer) stored not null check(version>0),
 registration text generated always as (regexp_replace(upper(payload->'fields'->>'registration'),'[^A-Z0-9]','','g')) stored,
 check(payload->>'id'=id), check(status='Draft' or office is not null)
);
create unique index ig_one_open_application on public.ig_applications(owner_id) where status not in ('Approved','Rejected');
create unique index ig_unique_pending_registration on public.ig_applications(registration) where status not in ('Draft','Rejected') and registration<>'';
create index ig_application_queue on public.ig_applications(office,status);

create table public.ig_vehicles (
 id text primary key, payload jsonb not null,
 owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored references public.ig_profiles(id),
 office text generated always as (payload->>'office') stored not null references public.ig_offices(code),
 registration text generated always as (regexp_replace(upper(payload->>'registration'),'[^A-Z0-9]','','g')) stored not null unique,
 check(payload->>'id'=id), check(payload->>'source'='MANUAL')
);
create index ig_vehicle_owner on public.ig_vehicles(owner_id);
create index ig_vehicle_office on public.ig_vehicles(office);
create table public.ig_devices (
 id text primary key, payload jsonb not null, claim_hash text not null check(length(claim_hash)=64),
 application_id text generated always as (payload->>'applicationId') stored unique references public.ig_applications(id) deferrable initially deferred,
 vehicle_id text generated always as (payload->>'assignedVehicleId') stored unique references public.ig_vehicles(id) deferrable initially deferred,
 check(payload->>'id'=id), check(payload->>'source'='HARDWARE'), check(not payload ? 'claimHash')
);
create table public.ig_documents (
 id text primary key, application_id text not null references public.ig_applications(id) on delete cascade,
 payload jsonb not null, check(payload->>'id'=id), check((payload->>'size')::bigint between 1 and 5242880)
);
create index ig_document_application on public.ig_documents(application_id);
create table public.ig_revisions (
 id text primary key, application_id text not null references public.ig_applications(id) on delete cascade, payload jsonb not null,
 revision integer generated always as ((payload->>'number')::integer) stored, unique(application_id,revision)
);
create table public.ig_application_actions (
 id text primary key, application_id text not null references public.ig_applications(id) on delete cascade, payload jsonb not null
);
create index ig_action_application on public.ig_application_actions(application_id);
create function public.ig_immutable_evidence() returns trigger language plpgsql set search_path='' as $$
begin if new.payload<>old.payload or new.application_id<>old.application_id then raise exception 'Submitted evidence is immutable'; end if; return new; end $$;
create trigger ig_revision_immutable before update on public.ig_revisions for each row execute function public.ig_immutable_evidence();
create trigger ig_action_immutable before update on public.ig_application_actions for each row execute function public.ig_immutable_evidence();

create table public.ig_work_items (
 id text primary key, kind text not null check(kind in ('alerts','cases','requests','audit','maintenance','classificationChanges')),
 payload jsonb not null, office text references public.ig_offices(code), vehicle_id text references public.ig_vehicles(id), actor_id uuid references public.ig_profiles(id)
);
create index ig_work_office on public.ig_work_items(office,kind);
create index ig_work_vehicle on public.ig_work_items(vehicle_id);
create table public.ig_rate_limits (key text primary key, attempts integer not null, expires_at timestamptz not null);
create table public.ig_device_credentials (
 device_id text primary key references public.ig_devices(id), secret text not null, last_nonce text, last_contact_at timestamptz
);
create table public.ig_device_nonces (
 device_id text references public.ig_devices(id), nonce text not null, received_at timestamptz not null default now(), primary key(device_id,nonce)
);

-- All sensitive writes use the server-only transactional RPC. The publishable key
-- cannot assign roles, forge application states, provision hardware, or list uploads.
do $$ declare t text; begin
 foreach t in array array['ig_offices','ig_profiles','ig_workspace_clock','ig_applications','ig_vehicles','ig_devices','ig_documents','ig_revisions','ig_application_actions','ig_work_items','ig_rate_limits','ig_device_credentials','ig_device_nonces'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.ig_profiles,public.ig_offices,public.ig_applications,public.ig_vehicles to authenticated;
create policy ig_profile_self on public.ig_profiles for select to authenticated using(id=(select auth.uid()));
create policy ig_office_directory on public.ig_offices for select to authenticated using(true);
create policy ig_application_self on public.ig_applications for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.ig_profiles p where p.id=(select auth.uid()) and p.status='Active'));
create policy ig_vehicle_self on public.ig_vehicles for select to authenticated using(owner_id=(select auth.uid()) and payload->>'ownerVerified'='true' and exists(select 1 from public.ig_profiles p where p.id=(select auth.uid()) and p.status='Active'));

create function public.ig_scope(p_actor uuid,p_office text,p_owner uuid,p_vehicle text default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ig_profiles p where p.id=p_actor and p.status='Active' and
 case when p.role='vehicle_owner' then p_owner=p.id
 when p.role in ('national_admin','technical_admin') then true
 when p.role='state_admin' then exists(select 1 from public.ig_offices o where o.code=p_office and o.state=p.state)
 when p.role in ('enforcement_officer','device_technician') then p.office=p_office and p_vehicle=any(p.assigned_vehicle_ids)
 else p.office=p_office end)
$$;

create function public.ig_read_workspace(p_actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with actor as (select * from public.ig_profiles where id=p_actor and status='Active'),
 apps as (select a.* from public.ig_applications a,actor p where a.owner_id=p.id or
   (p.role in ('rto_admin','rto_manager','registration_operator') and p.office=a.office and a.payload->>'submittedAt' is not null)),
 vehicles as (select v.* from public.ig_vehicles v where public.ig_scope(p_actor,v.office,v.owner_id,v.id)),
 devices as (select d.* from public.ig_devices d where d.application_id in(select id from apps) or d.vehicle_id in(select id from vehicles))
 select jsonb_build_object(
  'version',(select version from public.ig_workspace_clock where id),
  'profiles',coalesce((select jsonb_agg(to_jsonb(p)) from public.ig_profiles p where p.id=p_actor or p.id in(select owner_id from apps) or (p.role<>'vehicle_owner' and public.ig_scope(p_actor,p.office,null))), '[]'::jsonb),
  'applications',coalesce((select jsonb_agg(payload) from apps),'[]'::jsonb),
  'vehicles',coalesce((select jsonb_agg(payload) from vehicles),'[]'::jsonb),
  'devices',coalesce((select jsonb_agg(payload||jsonb_build_object('claimHash',claim_hash)) from devices),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('applicationId',application_id,'payload',payload)) from public.ig_documents where application_id in(select id from apps)),'[]'::jsonb),
  'revisions',coalesce((select jsonb_agg(jsonb_build_object('applicationId',application_id,'payload',payload)) from public.ig_revisions where application_id in(select id from apps)),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(jsonb_build_object('applicationId',application_id,'payload',payload)) from public.ig_application_actions where application_id in(select id from apps)),'[]'::jsonb),
  'work',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'payload',payload)) from public.ig_work_items w where w.actor_id=p_actor or w.vehicle_id in(select id from vehicles) or (w.office is not null and public.ig_scope(p_actor,w.office,null,w.vehicle_id))),'[]'::jsonb)
 ) where exists(select 1 from actor)
$$;

create function public.ig_commit_workspace(p_actor uuid,p_expected bigint,p_changes jsonb) returns bigint
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
   if body->>'status'='Approved' and actor.role<>'rto_admin' then raise exception 'Independent RTO approval required'; end if;
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

create function public.ig_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean language plpgsql security definer set search_path='' as $$
declare count_now integer; begin
 insert into public.ig_rate_limits(key,attempts,expires_at) values(p_key,1,now()+make_interval(secs=>p_window))
 on conflict(key) do update set attempts=case when ig_rate_limits.expires_at<now() then 1 else ig_rate_limits.attempts+1 end,
 expires_at=case when ig_rate_limits.expires_at<now() then now()+make_interval(secs=>p_window) else ig_rate_limits.expires_at end
 returning attempts into count_now;
 return count_now<=p_limit;
end $$;

-- Private bucket; downloads and upload commits go through authenticated server routes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vahakin-documents','vahakin-documents',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
revoke all on function public.ig_scope(uuid,text,uuid,text), public.ig_read_workspace(uuid), public.ig_commit_workspace(uuid,bigint,jsonb), public.ig_rate_limit(text,integer,integer), public.ig_create_profile(), public.ig_immutable_evidence() from public,anon,authenticated;
grant execute on function public.ig_read_workspace(uuid), public.ig_commit_workspace(uuid,bigint,jsonb), public.ig_rate_limit(text,integer,integer) to service_role;
commit;
