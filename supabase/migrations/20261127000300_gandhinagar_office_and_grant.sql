begin;

-- Add Gandhinagar RTO office (GJ-21)
insert into public.ig_offices (code, name, state, district, service_area, accepting_applications)
values ('GJ-21', 'Gandhinagar RTO', 'Gujarat', 'Gandhinagar', 'Gandhinagar district', true)
on conflict (code) do nothing;

-- Reassign rashiyaom@gmail.com staff grant from Rajkot (GJ-03) to Gandhinagar (GJ-21)
-- This ensures only Gandhinagar district applications are visible to this account.
update public.ig_staff_grants
  set office = 'GJ-21', state = 'Gujarat'
  where email = 'rashiyaom@gmail.com';

-- If the account already exists and is confirmed, re-apply the grant immediately.
update public.ig_profiles p
  set role = g.role, state = g.state, office = g.office
  from public.ig_staff_grants g, auth.users u
  where p.id = u.id
    and lower(u.email) = g.email
    and u.email_confirmed_at is not null
    and g.email = 'rashiyaom@gmail.com';

commit;
