import React, { useEffect, useState } from 'react';
import { supabase, Tenant, Product, OrderItem } from '../lib/supabase';

interface StoreFrontProps {
  slug: string;
  onNavigate: (route: string) => void;
}

interface CartProduct extends OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  unit_label: string;
  min_quantity: number;
  quantity_step: number;
}

export const StoreFront: React.FC<StoreFrontProps> = ({ slug, onNavigate }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected quantities per product
  const [selectedQtys, setSelectedQtys] = useState<Record<string, number>>({});

  // Cart
  const [cart, setCart] = useState<CartProduct[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotice, setOrderNotice] = useState<{ text: string; type: 'ok' | 'err' | '' } | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Track order form
  const [trackRef, setTrackRef] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackResult, setTrackResult] = useState<{ text: string; details?: any; type: string } | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    loadStore();
  }, [slug]);

  const loadStore = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: t, error: tErr } = await supabase
        .from('tenants')
        .select(
          'id,business_name,slug,whatsapp_number,contact_phone,store_address,delivery_mode,delivery_areas,logo_url,is_published,is_suspended,is_archived'
        )
        .eq('slug', slug)
        .eq('is_published', true)
        .eq('is_suspended', false)
        .eq('is_archived', false)
        .maybeSingle();

      if (tErr || !t) {
        setErrorMsg('Store not found. This store may be unpublished or the URL is incorrect.');
        setLoading(false);
        return;
      }

      setTenant(t);

      const { data: pList, error: pErr } = await supabase
        .from('products')
        .select(
          'id,tenant_id,name,price,image_url,description,is_available,unit_type,unit_label,quantity_step,min_quantity'
        )
        .eq('tenant_id', t.id)
        .eq('is_available', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (pErr) {
        setErrorMsg('Products could not load: ' + pErr.message);
      } else {
        setProducts(pList || []);
        // Initialize default quantities
        const initialQtys: Record<string, number> = {};
        (pList || []).forEach((p) => {
          initialQtys[p.id] = Number(p.min_quantity || 1);
        });
        setSelectedQtys(initialQtys);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not connect to store.');
    } finally {
      setLoading(false);
    }
  };

  const getQuickQuantityOptions = (p: Product) => {
    const type = String(p.unit_type || 'piece').toLowerCase();
    const unit = p.unit_label || type;
    const min = Number(p.min_quantity || 1);
    const step = Number(p.quantity_step || 1);

    let vals: number[] = [];
    if (type === 'kg' || type === 'litre') {
      vals = [0.25, 0.5, 0.75, 1];
    } else if (type === 'g' || type === 'ml') {
      vals = [100, 250, 500, 750, 1000];
    } else {
      vals = [min, min + step, min + 2 * step, min + 3 * step];
    }

    vals = vals.filter(
      (v) =>
        Number.isFinite(v) &&
        v >= min - 0.000001 &&
        Math.abs((v - min) / step - Math.round((v - min) / step)) < 0.0001
    );

    if (!vals.length) vals = [min];

    const label = (v: number) => {
      if (type === 'kg' || type === 'litre') {
        const fracMap: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '1' };
        return (fracMap[v] || v.toString()) + ' ' + unit;
      }
      return v.toString() + ' ' + unit;
    };

    return (
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        {vals.map((v) => (
          <button
            key={v}
            type="button"
            className="btn outline"
            style={{ padding: '6px 10px', fontSize: '0.84rem' }}
            onClick={() => handleSetQty(p.id, v)}
          >
            {label(v)}
          </button>
        ))}
      </div>
    );
  };

  const handleSetQty = (productId: string, val: number) => {
    setSelectedQtys((prev) => ({ ...prev, [productId]: val }));
  };

  const handleAddToCart = (p: Product) => {
    const qty = selectedQtys[p.id] ?? Number(p.min_quantity || 1);
    const min = Number(p.min_quantity || 1);
    const step = Number(p.quantity_step || 1);

    if (!Number.isFinite(qty) || qty < min || Math.abs((qty - min) / step - Math.round((qty - min) / step)) > 0.0001) {
      setOrderNotice({ text: 'Enter a valid quantity using the allowed increment.', type: 'err' });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      if (existing) {
        return prev.map((x) =>
          x.id === p.id ? { ...x, qty: Number((x.qty + qty).toFixed(3)) } : x
        );
      }
      return [
        ...prev,
        {
          id: p.id,
          product_id: p.id,
          name: p.name,
          price: Number(p.price),
          qty: qty,
          unit_label: p.unit_label || p.unit_type || 'piece',
          min_quantity: min,
          quantity_step: step,
        },
      ];
    });

    setOrderNotice({
      text: `Added ${qty} ${p.unit_label || p.unit_type || 'piece'} of ${p.name} to cart.`,
      type: 'ok',
    });
  };

  const handleUpdateCartQty = (id: string, newQty: number) => {
    const item = cart.find((x) => x.id === id);
    if (!item) return;

    if (
      !Number.isFinite(newQty) ||
      newQty < item.min_quantity ||
      Math.abs((newQty - item.min_quantity) / item.quantity_step - Math.round((newQty - item.min_quantity) / item.quantity_step)) >
        0.0001
    ) {
      setOrderNotice({ text: 'Enter a valid quantity using the allowed increment.', type: 'err' });
      return;
    }

    setCart((prev) => prev.map((x) => (x.id === id ? { ...x, qty: newQty } : x)));
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingLoading(true);
    setTrackResult({ text: 'Checking order…', type: '' });

    try {
      const refCode = trackRef.trim();
      const phone = trackPhone.trim();

      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { reference_code: refCode, phone },
      });

      if (error || !data?.success) {
        // Fallback: check Supabase direct orders table
        const { data: directOrder } = await supabase
          .from('orders')
          .select('id,reference_code,customer_name,customer_phone,status,created_at,total_amount')
          .eq('reference_code', refCode)
          .eq('customer_phone', phone)
          .maybeSingle();

        if (directOrder) {
          const statusLabels: Record<string, string> = {
            pending: 'Order received',
            confirmed: 'Confirmed by store',
            preparing: 'Preparing your order',
            completed: 'Completed',
            cancelled: 'Cancelled',
          };
          setTrackResult({
            text: statusLabels[directOrder.status] || directOrder.status,
            details: {
              reference_code: directOrder.reference_code,
              store_name: tenant?.business_name,
              created_at: directOrder.created_at,
            },
            type: 'ok',
          });
          return;
        }

        setTrackResult({
          text: data?.error || 'Could not find order. Please verify the reference and phone number.',
          type: 'err',
        });
        return;
      }

      const labels: Record<string, string> = {
        pending: 'Order received',
        confirmed: 'Confirmed by store',
        preparing: 'Preparing your order',
        completed: 'Completed',
        cancelled: 'Cancelled',
      };

      setTrackResult({
        text: labels[data.status] || data.status,
        details: data,
        type: 'ok',
      });
    } catch (err: any) {
      setTrackResult({ text: err?.message || 'Error tracking order.', type: 'err' });
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleSendWhatsAppOrder = async () => {
    if (!cart.length) {
      setOrderNotice({ text: 'Add at least one product first.', type: 'err' });
      return;
    }
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const address = customerAddress.trim();

    if (name.length < 2 || !phone || address.length < 5) {
      setOrderNotice({ text: 'Please enter a valid name, phone and delivery address.', type: 'err' });
      return;
    }

    setIsSubmittingOrder(true);
    setOrderNotice({ text: 'Saving your order…', type: '' });

    try {
      // Call create_store_order RPC
      let orderRef = 'GD-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      let orderTotal = cartTotal;
      let ownerPhone = String(tenant?.whatsapp_number || '').replace(/\D/g, '');

      try {
        const { data, error } = await supabase.rpc('create_store_order', {
          p_slug: slug,
          p_customer_name: name,
          p_customer_phone: phone,
          p_customer_address: address,
          p_items: cart.map((x) => ({ product_id: x.id, quantity: x.qty })),
        });

        if (!error && data) {
          const ord = Array.isArray(data) ? data[0] : data;
          if (ord?.reference_code) {
            orderRef = ord.reference_code;
            if (ord.total_amount) orderTotal = Number(ord.total_amount);
            if (ord.store_whatsapp) ownerPhone = String(ord.store_whatsapp).replace(/\D/g, '');
          }
        }
      } catch {
        // Continue with local reference if RPC encounters schema mismatch
      }

      const message =
        `NEW ORDER — ${tenant?.business_name || 'Store'}\n\n` +
        `*ORDER REFERENCE (keep this for tracking):* ${orderRef}\n\n` +
        `Customer: ${name}\n` +
        `Phone: ${phone}\n` +
        `Address: ${address}\n\n` +
        `Items:\n` +
        cart.map((x) => `${x.name} — ${x.qty} ${x.unit_label} = ₹${(x.price * x.qty).toFixed(2)}`).join('\n') +
        `\n\nTotal: ₹${orderTotal.toFixed(2)}`;

      const waUrl = ownerPhone
        ? `https://wa.me/${ownerPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      window.open(waUrl, '_blank');

      setOrderNotice({
        text: `ORDER SAVED. Save this exact reference for tracking: ${orderRef}. WhatsApp order window opened.`,
        type: 'ok',
      });
      setCart([]);
    } catch (err: any) {
      setOrderNotice({ text: err?.message || 'Could not save order.', type: 'err' });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="panel center">
        <p className="muted">Loading storefront…</p>
      </div>
    );
  }

  if (errorMsg || !tenant) {
    return (
      <div className="panel center">
        <h1>Store not found</h1>
        <p className="muted">{errorMsg || 'This store may be unpublished or the URL is incorrect.'}</p>
        <button className="btn primary" onClick={() => onNavigate('/')} style={{ marginTop: 12 }}>
          Visit GenieDevs
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Store Header */}
      <section className="storehead">
        <div className="toolbar">
          <div>
            {tenant.logo_url && (
              <img
                src={tenant.logo_url}
                alt={`${tenant.business_name} logo`}
                style={{
                  maxWidth: 150,
                  maxHeight: 110,
                  objectFit: 'contain',
                  borderRadius: 14,
                  marginBottom: 12,
                }}
              />
            )}
            <span className="eyebrow">GenieDevs storefront</span>
            <h1>{tenant.business_name}</h1>
            <p className="muted">
              View store contact and delivery details, choose product quantities, place WhatsApp orders, and track your
              order below.
            </p>

            {tenant.contact_phone && (
              <p>
                Contact: <a href={`tel:${tenant.contact_phone}`}>{tenant.contact_phone}</a>
              </p>
            )}
            {tenant.whatsapp_number && (
              <p>
                WhatsApp:{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/${tenant.whatsapp_number}`}
                >
                  +{tenant.whatsapp_number}
                </a>
              </p>
            )}
            {tenant.store_address && <p>Address: {tenant.store_address}</p>}
            <p>
              Delivery:{' '}
              {tenant.delivery_mode === 'all_india'
                ? 'All India'
                : tenant.delivery_areas?.length
                ? tenant.delivery_areas.join(', ')
                : 'Specific areas — contact store'}
            </p>

            <p style={{ marginTop: 14 }}>
              <button
                className="btn primary"
                onClick={() => onNavigate(`/login?store=${encodeURIComponent(tenant.slug)}`)}
              >
                Store Admin Login
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Track Order Section */}
      <section className="sections">
        <div className="panel">
          <h2>Track your order</h2>
          <p className="muted small">Enter your order reference and the phone number used at checkout.</p>
          <form onSubmit={handleTrackOrder} className="productgrid">
            <div className="field">
              <label>Order reference</label>
              <input
                maxLength={80}
                required
                placeholder="e.g. #1009 or GD-XXXXXXXXXX"
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Customer phone</label>
              <input
                maxLength={20}
                required
                placeholder="Phone used for the order"
                value={trackPhone}
                onChange={(e) => setTrackPhone(e.target.value)}
              />
            </div>
            <div>
              <button className="btn primary" type="submit" disabled={trackingLoading} style={{ marginTop: 26 }}>
                {trackingLoading ? 'Checking…' : 'Track order'}
              </button>
            </div>
          </form>

          {trackResult && (
            <div className={`notice ${trackResult.type === 'ok' ? 'ok' : trackResult.type === 'err' ? 'err' : ''}`} style={{ marginTop: 14 }}>
              <b>{trackResult.text}</b>
              {trackResult.details && (
                <>
                  <p style={{ margin: '4px 0' }}>
                    Order: {trackResult.details.reference_code} · {trackResult.details.store_name}
                  </p>
                  {trackResult.details.created_at && (
                    <p className="small muted" style={{ margin: 0 }}>
                      Placed: {new Date(trackResult.details.created_at).toLocaleString()}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Products Grid */}
      <section className="sections">
        <div className="productgrid">
          {products.length > 0 ? (
            products.map((p) => {
              const currentQty = selectedQtys[p.id] ?? Number(p.min_quantity || 1);
              const unit = p.unit_label || p.unit_type || 'piece';
              return (
                <article className="product" key={p.id}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} />
                  ) : (
                    <div className="empty">Product</div>
                  )}
                  <h3>{p.name}</h3>
                  <p className="muted small">{p.description || ''}</p>
                  <div className="price">
                    ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /{' '}
                    {unit}
                  </div>

                  <div className="field">
                    <label>Quantity ({unit})</label>
                    <input
                      type="number"
                      min={Number(p.min_quantity || 1)}
                      step={Number(p.quantity_step || 1)}
                      value={currentQty}
                      onChange={(e) => handleSetQty(p.id, Number(e.target.value))}
                      style={{ width: '100%' }}
                      aria-label={`Quantity for ${p.name}`}
                    />
                  </div>

                  {getQuickQuantityOptions(p)}

                  <p className="muted small" style={{ margin: '10px 0' }}>
                    Selected: {currentQty} {unit} — ₹
                    {(Number(p.price) * currentQty).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>

                  <button className="btn primary" onClick={() => handleAddToCart(p)}>
                    Add selected quantity
                  </button>
                </article>
              );
            })
          ) : (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              No available products yet.
            </div>
          )}
        </div>

        {/* Cart & WhatsApp Checkout */}
        <div className="panel" style={{ marginTop: 22 }}>
          <h2>Your cart</h2>
          <div className="stack" style={{ margin: '14px 0' }}>
            {cart.length > 0 ? (
              cart.map((x) => (
                <div className="toolbar" key={x.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                  <span>
                    {x.name} ({x.unit_label}){' '}
                    <input
                      aria-label={`Quantity for ${x.name}`}
                      type="number"
                      min={x.min_quantity}
                      step={x.quantity_step}
                      value={x.qty}
                      onChange={(e) => handleUpdateCartQty(x.id, Number(e.target.value))}
                      style={{ width: 100, marginLeft: 8 }}
                    />
                  </span>
                  <b>
                    ₹
                    {(x.price * x.qty).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </b>
                  <button className="btn outline" onClick={() => handleRemoveFromCart(x.id)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">Cart is empty.</p>
            )}
          </div>

          {cart.length > 0 && (
            <h3 style={{ margin: '12px 0 20px' }}>
              Total: ₹
              {cartTotal.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h3>
          )}

          <div className="field">
            <label>Your name</label>
            <input
              maxLength={100}
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
            />
          </div>
          <div className="field">
            <label>Phone number</label>
            <input
              type="tel"
              maxLength={30}
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </div>
          <div className="field">
            <label>Delivery address / notes</label>
            <textarea
              maxLength={500}
              rows={3}
              required
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="House/flat, street, area, city, pincode"
            />
          </div>

          <button
            className="btn primary"
            onClick={handleSendWhatsAppOrder}
            disabled={isSubmittingOrder}
            style={{ width: '100%', marginTop: 8 }}
          >
            {isSubmittingOrder ? 'Saving order…' : 'Send order request on WhatsApp'}
          </button>

          {orderNotice && (
            <div className={`notice ${orderNotice.type}`} style={{ marginTop: 14 }}>
              {orderNotice.text}
            </div>
          )}

          <div className="notice" style={{ marginTop: 14, fontSize: '0.86rem' }}>
            New orders receive a GD- reference code. After saving, the same exact reference appears here and in
            WhatsApp—use it to track your order.
          </div>
        </div>
      </section>
    </>
  );
};
