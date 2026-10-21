-- Store accounts are created only by the platform administrator/service role.
-- Merchants may read their own draft store and update allowed storefront settings,
-- but must not create or delete tenant records themselves.
DROP POLICY IF EXISTS "Users manage own tenant" ON public.tenants;

CREATE POLICY "Users can view their own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()) AND is_suspended = false)
WITH CHECK (user_id = (SELECT auth.uid()) AND is_suspended = false);
