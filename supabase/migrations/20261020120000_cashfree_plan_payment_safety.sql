CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_order_unique
ON public.payment_transactions (provider, provider_order_id)
WHERE provider_order_id IS NOT NULL;

DROP POLICY IF EXISTS "Owners can view own payment history" ON public.payment_transactions;
CREATE POLICY "Owners can view own payment history"
ON public.payment_transactions FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT t.id FROM public.tenants t
    WHERE t.user_id = (SELECT auth.uid()) AND t.is_suspended = false
  )
);

CREATE INDEX IF NOT EXISTS payment_transactions_tenant_created_idx
ON public.payment_transactions (tenant_id, created_at DESC);
