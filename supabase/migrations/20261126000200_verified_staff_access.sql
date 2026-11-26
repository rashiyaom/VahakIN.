begin;
create table public.ig_staff_grants(email text primary key, role text not null check(role in ('rto_admin','rto_manager','registration_operator','enforcement_officer','device_technician','auditor','national_admin','state_admin','technical_admin')),state text,office text references public.ig_offices(code));
alter table public.ig_staff_grants enable row level security;
revoke all on public.ig_staff_grants from public,anon,authenticated;
grant all on public.ig_staff_grants to service_role;
insert into public.ig_staff_grants values('rashiyaom@gmail.com','rto_admin','Gujarat','GJ-03');
create function public.ig_apply_staff_grant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null then
  update public.ig_profiles p set role=g.role,state=g.state,office=g.office from public.ig_staff_grants g where p.id=new.id and lower(new.email)=g.email;
 end if;
 return new;
end $$;
-- Runs after ig_auth_profile on INSERT; confirmed email is mandatory.
create trigger ig_verified_staff after insert or update of email_confirmed_at,email on auth.users for each row execute function public.ig_apply_staff_grant();
update public.ig_profiles p set role=g.role,state=g.state,office=g.office from public.ig_staff_grants g,auth.users u where p.id=u.id and lower(u.email)=g.email and u.email_confirmed_at is not null;
revoke all on function public.ig_apply_staff_grant() from public,anon,authenticated;
commit;
