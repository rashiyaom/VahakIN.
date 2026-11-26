begin;
-- Tier is inventory metadata, never a selectable privilege from a browser.
update public.ig_devices set payload=payload||'{"tier":"BASIC"}'::jsonb where not payload?'tier';
update public.ig_applications a set payload=a.payload||jsonb_build_object('deviceTier',d.payload->>'tier') from public.ig_devices d where d.application_id=a.id and not a.payload?'deviceTier';
update public.ig_vehicles v set payload=v.payload||jsonb_build_object('deviceTier',d.payload->>'tier') from public.ig_devices d where d.vehicle_id=v.id and not v.payload?'deviceTier';
alter table public.ig_devices add constraint ig_device_tier check(coalesce(payload->>'tier','BASIC') in ('BASIC','PLUS'));
create function public.ig_provision_product(p_id text,p_serial text,p_claim_hash text,p_secret text,p_tier text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_tier not in ('BASIC','PLUS') then raise exception 'Invalid product'; end if;
 perform public.ig_provision_device(p_id,p_serial,p_claim_hash,p_secret);
 update public.ig_devices set payload=payload||jsonb_build_object('tier',p_tier) where id=p_id;
end $$;
create table public.ig_phone_location_events(
 id text primary key, vehicle_id text not null references public.ig_vehicles(id),actor_id uuid not null references public.ig_profiles(id),
 payload jsonb not null, received_at timestamptz not null default now()
);
alter table public.ig_phone_location_events enable row level security;
revoke all on public.ig_phone_location_events from anon,authenticated;
grant all on public.ig_phone_location_events to service_role;
create function public.ig_commit_phone_location(p_actor uuid,p_expected bigint,p_vehicle jsonb,p_event jsonb,p_alerts jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare current_version bigint; v public.ig_vehicles; item jsonb;
begin
 select version into current_version from public.ig_workspace_clock where id for update;
 if current_version<>p_expected then raise exception 'Workspace changed' using errcode='40001'; end if;
 select * into v from public.ig_vehicles where id=p_vehicle->>'id' and owner_id=p_actor;
 if not found or v.payload->>'deviceTier'<>'PLUS' or not exists(select 1 from public.ig_profiles where id=p_actor and role='vehicle_owner' and status='Active') then raise exception 'Owner Plus assignment required'; end if;
 if not exists(select 1 from public.ig_devices d join public.ig_applications a on a.id=d.application_id where d.vehicle_id=v.id and d.payload->>'tier'='PLUS' and a.status='Approved' and a.owner_id=p_actor and a.payload->>'ownerMountedAt' is not null) then raise exception 'Mounted Plus application required'; end if;
 -- This narrow write cannot change ownership, tier, IMU, heartbeat, approval or fence settings.
 if (v.payload-array['phoneLocationSession','gpsStatus','gpsAt','geofence','fenceCandidate','fenceDistanceM','locationSource','lat','lng','accuracy','speed','review']) is distinct from
    (p_vehicle-array['phoneLocationSession','gpsStatus','gpsAt','geofence','fenceCandidate','fenceDistanceM','locationSource','lat','lng','accuracy','speed','review']) then raise exception 'Unsupported phone location change'; end if;
 if p_event->>'action'='sample' then
  if exists(select 1 from public.ig_phone_location_events where id=p_event->>'nonce') then
   if not exists(select 1 from public.ig_phone_location_events where id=p_event->>'nonce' and vehicle_id=v.id and actor_id=p_actor and payload=p_event) then raise exception 'Phone event conflict' using errcode='23505'; end if;
   return;
  end if;
  insert into public.ig_phone_location_events(id,vehicle_id,actor_id,payload) values(p_event->>'nonce',v.id,p_actor,p_event);
 end if;
 update public.ig_vehicles set payload=p_vehicle where id=v.id;
 for item in select value from jsonb_array_elements(p_alerts) loop
  if item->>'vehicleId'<>v.id then raise exception 'Alert scope mismatch'; end if;
  if not exists(select 1 from public.ig_work_items where kind='alerts' and vehicle_id=v.id and payload->>'title'=item->>'title' and payload->>'status'<>'Resolved') then
   insert into public.ig_work_items(id,kind,payload,office,vehicle_id,actor_id) values(item->>'id','alerts',item,v.office,v.id,p_actor) on conflict(id) do nothing;
  end if;
 end loop;
 update public.ig_workspace_clock set version=version+1 where id;
end $$;
revoke all on function public.ig_provision_product(text,text,text,text,text), public.ig_commit_phone_location(uuid,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ig_provision_product(text,text,text,text,text), public.ig_commit_phone_location(uuid,bigint,jsonb,jsonb,jsonb) to service_role;
update public.ig_workspace_clock set version=version+1 where id;
commit;
