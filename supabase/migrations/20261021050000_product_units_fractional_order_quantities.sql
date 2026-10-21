alter table public.products
  add column if not exists unit_type text not null default 'piece',
  add column if not exists unit_label text not null default 'piece',
  add column if not exists quantity_step numeric(12,3) not null default 1,
  add column if not exists min_quantity numeric(12,3) not null default 1;
alter table public.products drop constraint if exists products_unit_type_check;
alter table public.products add constraint products_unit_type_check check (unit_type in ('piece','kg','g','litre','ml','metre','cm','hour','pack','custom'));
alter table public.products drop constraint if exists products_quantity_step_check;
alter table public.products add constraint products_quantity_step_check check (quantity_step > 0 and quantity_step <= 100000);
alter table public.products drop constraint if exists products_min_quantity_check;
alter table public.products add constraint products_min_quantity_check check (min_quantity > 0 and min_quantity <= 100000);
alter table public.orders alter column total_amount type numeric(14,2) using total_amount::numeric(14,2);
drop function if exists public.create_store_order(text,text,text,text,jsonb);
create function public.create_store_order(
 p_slug text, p_customer_name text, p_customer_phone text, p_customer_address text, p_items jsonb
) returns table(order_id uuid, reference_code text, total_amount numeric, store_whatsapp text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_tenant public.tenants%rowtype; v_entry jsonb; v_product_id uuid;
 v_quantity numeric(12,3); v_step numeric(12,3); v_min numeric(12,3);
 v_price integer; v_name text; v_unit text; v_total numeric(14,2):=0;
 v_order_items jsonb:='[]'::jsonb; v_reference text; v_order_id uuid;
begin
 if length(trim(coalesce(p_customer_name,'')))<2 or length(p_customer_name)>120 then raise exception 'Please provide a valid customer name'; end if;
 if length(regexp_replace(coalesce(p_customer_phone,''),'[^0-9+]','','g'))<7 or length(p_customer_phone)>30 then raise exception 'Please provide a valid phone number'; end if;
 if length(trim(coalesce(p_customer_address,'')))<5 or length(p_customer_address)>500 then raise exception 'Please provide a delivery address'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Cart must contain between 1 and 50 items'; end if;
 select * into v_tenant from public.tenants t where t.slug=trim(p_slug) and t.is_published=true and t.is_suspended=false and coalesce(t.is_archived,false)=false limit 1;
 if not found then raise exception 'Store is not available'; end if;
 for v_entry in select value from jsonb_array_elements(p_items) loop
  begin v_product_id:=(v_entry->>'product_id')::uuid; v_quantity:=(v_entry->>'quantity')::numeric;
  exception when others then raise exception 'Cart contains an invalid product or quantity'; end;
  if v_quantity<=0 or v_quantity>100000 or round(v_quantity,3)<>v_quantity then raise exception 'Quantity must be positive and use at most 3 decimal places'; end if;
  select p.price,p.name,coalesce(p.unit_label,p.unit_type,'piece'),p.quantity_step,p.min_quantity into v_price,v_name,v_unit,v_step,v_min
   from public.products p where p.id=v_product_id and p.tenant_id=v_tenant.id and p.is_available=true and coalesce(p.is_archived,false)=false;
  if not found then raise exception 'A product is no longer available'; end if;
  if v_quantity<v_min or mod(round((v_quantity-v_min)*1000)::bigint,round(v_step*1000)::bigint)<>0 then raise exception 'Quantity for % must be at least % and increase by %',v_name,v_min,v_step; end if;
  v_total:=v_total+round(v_price::numeric*v_quantity,2);
  if v_total>2000000000 then raise exception 'Order total is too large'; end if;
  v_order_items:=v_order_items||jsonb_build_array(jsonb_build_object('product_id',v_product_id,'name',v_name,'quantity',v_quantity,'unit',v_unit,'unit_price',v_price,'line_total',round(v_price::numeric*v_quantity,2)));
 end loop;
 v_reference:='GD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.orders(reference_code,tenant_id,customer_name,customer_phone,customer_address,items,total_amount,status)
 values(v_reference,v_tenant.id,trim(p_customer_name),trim(p_customer_phone),trim(p_customer_address),v_order_items,v_total,'pending') returning id into v_order_id;
 return query select v_order_id,v_reference,v_total,v_tenant.whatsapp_number;
end; $$;
revoke all on function public.create_store_order(text,text,text,text,jsonb) from public;
grant execute on function public.create_store_order(text,text,text,text,jsonb) to anon, authenticated, service_role;
