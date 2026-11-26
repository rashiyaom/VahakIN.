begin;
create function public.ig_provision_device(p_id text,p_serial text,p_claim_hash text,p_secret text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_id !~ '^IG-[A-Z0-9-]{4,80}$' or length(p_claim_hash)<>64 or length(p_secret)<64 then raise exception 'Invalid device credentials'; end if;
 insert into public.ig_devices(id,claim_hash,payload) values(p_id,p_claim_hash,jsonb_build_object('id',p_id,'serial',p_serial,'reservedBy',null,'applicationId',null,'assignedVehicleId',null,'source','HARDWARE','lastSetupAt',null));
 insert into public.ig_device_credentials(device_id,secret) values(p_id,p_secret);
end $$;
create function public.ig_record_heartbeat(p_device text,p_nonce text) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare received timestamptz:=clock_timestamp();
begin
 -- Same lock order as application commits prevents lost connection updates.
 perform 1 from public.ig_workspace_clock where id for update;
 insert into public.ig_device_nonces(device_id,nonce) values(p_device,p_nonce);
 update public.ig_devices set payload=jsonb_set(payload,'{lastSetupAt}',to_jsonb(received)) where id=p_device;
 if not found then raise exception 'Unknown device'; end if;
 update public.ig_device_credentials set last_contact_at=received,last_nonce=p_nonce where device_id=p_device;
 update public.ig_workspace_clock set version=version+1 where id;
 -- Requests older than five minutes are rejected by the signed HTTP endpoint.
 delete from public.ig_device_nonces where device_id=p_device and received_at<now()-interval '15 minutes';
 return received;
end $$;
create or replace function public.ig_apply_staff_grant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.ig_profiles set email=coalesce(new.email,'') where id=new.id;
 if tg_op='UPDATE' and old.email is distinct from new.email and exists(select 1 from public.ig_staff_grants where email=lower(old.email)) then
  update public.ig_profiles set role='vehicle_owner',state=null,office=null,assigned_vehicle_ids='{}' where id=new.id;
 end if;
 if new.email_confirmed_at is not null then
  update public.ig_profiles p set role=g.role,state=g.state,office=g.office from public.ig_staff_grants g where p.id=new.id and lower(new.email)=g.email;
 end if;
 return new;
end $$;
revoke all on function public.ig_provision_device(text,text,text,text), public.ig_record_heartbeat(text,text) from public,anon,authenticated;
grant execute on function public.ig_provision_device(text,text,text,text), public.ig_record_heartbeat(text,text) to service_role;
commit;
