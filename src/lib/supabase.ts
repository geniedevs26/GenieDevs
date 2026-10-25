import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://brjhfhehnlqkzrbkywra.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_0xA3CBSdLRlhO7Vh0F0d0g_JaoScMry';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Tenant {
  id: string;
  user_id?: string;
  tenant_code?: string;
  package_type?: string;
  product_limit?: number;
  whatsapp_number?: string;
  business_name: string;
  slug: string;
  is_published: boolean;
  is_suspended?: boolean;
  is_archived?: boolean;
  contact_phone?: string;
  store_address?: string;
  delivery_mode?: 'all_india' | 'specific' | string;
  delivery_areas?: string[];
  logo_url?: string | null;
  payment_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  tenant_id?: string;
  name: string;
  price: number;
  image_url?: string | null;
  description?: string;
  is_available: boolean;
  is_archived?: boolean;
  created_at?: string;
  unit_type?: string;
  unit_label?: string;
  quantity_step?: number;
  min_quantity?: number;
}

export interface OrderItem {
  id?: string;
  product_id?: string;
  name?: string;
  price?: number;
  qty?: number;
  quantity?: number;
  unit_label?: string;
}

export interface Order {
  id: string;
  reference_code: string;
  tenant_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  items: OrderItem[] | any;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'completed' | 'cancelled' | string;
  created_at: string;
  is_archived?: boolean;
}

export interface PaymentTransaction {
  id: string;
  tenant_id?: string;
  order_id?: string;
  purpose?: string;
  provider?: string;
  amount_paise?: number;
  currency?: string;
  status?: string;
  verified_at?: string | null;
  created_at: string;
}

export interface PlatformUser {
  user_id: string;
  email: string;
  created_at?: string;
  last_sign_in_at?: string;
  updated_at?: string;
  stores?: Tenant[];
  is_suspended?: boolean;
}

export const slugify = (s: string) =>
  String(s || 'store')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'store';

export async function edgeFailureMessage(error: any, data: any): Promise<string> {
  if (data?.error) return data.error;
  if (error?.context) {
    try {
      const r = error.context.clone ? error.context.clone() : error.context;
      const j = await r.json();
      if (j?.error) return j.error;
      if (j?.message) return j.message;
    } catch {
      // ignore
    }
  }
  return error?.message || 'Request failed. Check server configuration.';
}
