-- Keep merchant editing limited to storefront fields; package entitlement and ownership
-- fields must only be changed by trusted server-side/admin operations.
REVOKE UPDATE ON TABLE public.tenants FROM authenticated;
GRANT UPDATE (business_name, whatsapp_number, slug, is_published, updated_at)
ON TABLE public.tenants TO authenticated;
