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
  v_active_count integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.platform_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and a.role = 'admin'
  ) then
    raise exception 'Only an active Super Admin can assign store plans'
      using errcode = '42501';
  end if;

  v_plan := initcap(lower(trim(coalesce(p_package_type, ''))));
  v_limit := case v_plan
    when 'Basic' then 6
    when 'Standard' then 15
    when 'Premium' then 30
    else null
  end;

  if v_limit is null then
    raise exception 'Choose a valid plan: Basic, Standard or Premium';
  end if;

  perform 1 from public.tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'Store not found';
  end if;

  select count(*)::integer
    into v_active_count
    from public.products p
   where p.tenant_id = p_tenant_id
     and coalesce(p.is_archived, false) = false
     and coalesce(p.is_available, true) = true;

  if v_active_count > v_limit then
    raise exception 'Store currently has % active products; the selected plan allows %.', v_active_count, v_limit;
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
