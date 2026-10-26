-- Public storefront visibility must be enforced by PostgreSQL as well as the React route.
-- Restrictive policies combine with existing permissive policies, preventing a permissive
-- legacy policy from exposing suspended/unpublished stores or their products to anonymous visitors.
alter table public.tenants enable row level security;
alter table public.products enable row level security;

drop policy if exists "public visitors only see active published stores" on public.tenants;
create policy "public visitors only see active published stores"
on public.tenants as restrictive
for select to anon
using (
  is_published = true
  and coalesce(is_suspended, false) = false
  and coalesce(is_archived, false) = false
);

drop policy if exists "public visitors only see products from active published stores" on public.products;
create policy "public visitors only see products from active published stores"
on public.products as restrictive
for select to anon
using (
  is_available = true
  and coalesce(is_archived, false) = false
  and exists (
    select 1
    from public.tenants t
    where t.id = products.tenant_id
      and t.is_published = true
      and coalesce(t.is_suspended, false) = false
      and coalesce(t.is_archived, false) = false
  )
);

-- Existing create_store_order RPC already checks is_suspended=false and is_published=true
-- before accepting an order. Keep that server-side check as the final order-creation guard.
