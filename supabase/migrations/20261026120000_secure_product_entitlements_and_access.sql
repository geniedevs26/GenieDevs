-- Enforce product entitlements in PostgreSQL, not just in the browser.
-- The tenant row lock serializes concurrent inserts so parallel requests cannot exceed a plan.
create or replace function public.enforce_tenant_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_active_count integer;
begin
  if new.tenant_id is null then
    raise exception 'A product must belong to a store';
  end if;

  -- Serialize product activation/addition for this store.
  perform 1 from public.tenants where id = new.tenant_id for update;
  if not found then
    raise exception 'Store not found';
  end if;

  select coalesce(
    nullif(t.product_limit, 0),
    case lower(coalesce(t.package_type, ''))
      when 'basic' then 5
      when 'standard' then 15
      when 'premium' then 30
      else 0
    end
  )
  into v_limit
  from public.tenants t
  where t.id = new.tenant_id;

  -- A zero/unconfigured entitlement must not accidentally become unlimited.
  if coalesce(v_limit, 0) <= 0 then
    raise exception 'This store has no valid product allowance. Ask Super Admin to assign a plan.';
  end if;

  if coalesce(new.is_archived, false) = false and coalesce(new.is_available, true) = true then
    select count(*)::integer into v_active_count
    from public.products p
    where p.tenant_id = new.tenant_id
      and coalesce(p.is_archived, false) = false
      and coalesce(p.is_available, true) = true
      and (tg_op = 'INSERT' or p.id <> new.id);

    if v_active_count >= v_limit then
      raise exception 'Product limit reached: this plan allows % active products.', v_limit
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_tenant_product_limit_before_write on public.products;
create trigger enforce_tenant_product_limit_before_write
before insert or update of tenant_id, is_available, is_archived
on public.products
for each row execute function public.enforce_tenant_product_limit();

revoke all on function public.enforce_tenant_product_limit() from public, anon, authenticated;

-- Defense in depth: authenticated queries must stay inside the user's tenant
-- or a verified platform-admin role, even if an older permissive policy exists.
alter table public.products enable row level security;

drop policy if exists "restrict product access to tenant or platform admin" on public.products;
create policy "restrict product access to tenant or platform admin"
on public.products as restrictive
for all to authenticated
using (
  exists (
    select 1 from public.tenants t
    where t.id = products.tenant_id
      and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and a.role in ('admin', 'support')
  )
)
with check (
  exists (
    select 1 from public.tenants t
    where t.id = products.tenant_id
      and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and a.role = 'admin'
  )
);

-- Plan assignment is performed through a narrowly scoped, authenticated RPC.
-- Only an active Super Admin can change entitlements; clients cannot set product_limit directly.
create or replace function public.admin_assign_tenant_plan(
  p_tenant_id uuid,
  p_package_type text
)
returns table(package_type text, product_limit integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and a.role = 'admin'
  ) then
    raise exception 'Only an active Super Admin can assign store plans'
      using errcode = '42501';
  end if;

  v_plan := initcap(lower(trim(coalesce(p_package_type, ''))));
  v_limit := case v_plan
    when 'Basic' then 5
    when 'Standard' then 15
    when 'Premium' then 30
    else null
  end;

  if v_limit is null then
    raise exception 'Choose a valid plan: Basic, Standard or Premium';
  end if;

  perform 1 from public.tenants where id = p_tenant_id for update;
  if not found then raise exception 'Store not found'; end if;

  select count(*)::integer into v_count
  from public.products p
  where p.tenant_id = p_tenant_id
    and coalesce(p.is_archived, false) = false
    and coalesce(p.is_available, true) = true;

  if v_count > v_limit then
    raise exception 'Store currently has % active products; the selected plan allows %.', v_count, v_limit;
  end if;

  update public.tenants
  set package_type = v_plan,
      product_limit = v_limit,
      updated_at = now()
  where id = p_tenant_id;

  return query select v_plan, v_limit;
end;
$$;

revoke all on function public.admin_assign_tenant_plan(uuid, text) from public, anon;
grant execute on function public.admin_assign_tenant_plan(uuid, text) to authenticated;
