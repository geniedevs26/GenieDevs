-- Immediately take the three explicitly identified demo/test stores out of public use.
-- Keep their rows and related data archived; do not touch other customer stores.
alter table public.tenants
  add column if not exists is_archived boolean not null default false;

update public.tenants
set is_published = false,
    is_suspended = true,
    is_archived = true,
    updated_at = now()
where slug in ('satya-stores-olzj', 'prasad-stores', 'satya-stores');

-- Defense in depth: public/anonymous visitors can only read live, non-suspended,
-- non-archived stores. Store owners and active platform admins retain authorized access.
alter table public.tenants enable row level security;

drop policy if exists "restrict public reads to active published stores" on public.tenants;
create policy "restrict public reads to active published stores"
on public.tenants as restrictive
for select to anon, authenticated
using (
  (
    is_published = true
    and coalesce(is_suspended, false) = false
    and coalesce(is_archived, false) = false
  )
  or user_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and a.role in ('admin', 'support')
  )
);
