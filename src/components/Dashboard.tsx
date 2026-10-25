import React, { useEffect, useState } from 'react';
import { supabase, Tenant, Product, Order, slugify } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onLogout }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [paywallState, setPaywallState] = useState<'locked' | 'paid_no_store' | null>(null);

  // Settings form
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'all_india' | 'specific'>('specific');
  const [deliveryAreas, setDeliveryAreas] = useState('');
  const [slug, setSlug] = useState('');
  const [manualSlug, setManualSlug] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Add Product form
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pUnit, setPUnit] = useState('piece');
  const [pUnitLabel, setPUnitLabel] = useState('piece');
  const [pMinQty, setPMinQty] = useState('1');
  const [pQtyStep, setPQtyStep] = useState('1');
  const [pDesc, setPDesc] = useState('');
  const [pImage, setPImage] = useState('');
  const [productNotice, setProductNotice] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);

  // Edit Product modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        onNavigate('/login');
        return;
      }

      // Check if user is platform admin
      const { data: pg } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!pg) {
        // Check store access via Cashfree / payments
        const { data: access, error: accessError } = await supabase.functions.invoke('cashfree-payments', {
          body: { action: 'check-store-access' },
        });

        if (!accessError && access?.success) {
          if (!access.paid && !access.admin_assigned) {
            setPaywallState('locked');
            setLoading(false);
            return;
          }
          if (access.paid && !access.has_store) {
            setPaywallState('paid_no_store');
            setLoading(false);
            return;
          }
        }
      }

      // Load tenant
      const { data: ts, error: tErr } = await supabase
        .from('tenants')
        .select(
          'id,user_id,tenant_code,package_type,product_limit,whatsapp_number,business_name,slug,is_published,is_suspended,is_archived,contact_phone,store_address,delivery_mode,delivery_areas,logo_url'
        )
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .limit(1);

      if (tErr) {
        setErrorMsg(tErr.message);
        setLoading(false);
        return;
      }

      if (!ts?.length) {
        // Check if there are any tenants in the db where this user is admin
        setErrorMsg('No store assigned. Only Super Admin can create and assign a store.');
        setLoading(false);
        return;
      }

      const currentTenant = ts[0];
      setTenant(currentTenant);
      setStoreName(currentTenant.business_name || '');
      setPhone(currentTenant.whatsapp_number || '');
      setContactPhone(currentTenant.contact_phone || '');
      setStoreAddress(currentTenant.store_address || '');
      setDeliveryMode((currentTenant.delivery_mode as any) || 'specific');
      setDeliveryAreas((currentTenant.delivery_areas || []).join(', '));
      setSlug(currentTenant.slug || '');

      // Load products
      await loadProducts(currentTenant.id);

      // Load orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select(
          'id,reference_code,customer_name,customer_phone,customer_address,items,total_amount,status,created_at'
        )
        .eq('tenant_id', currentTenant.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(50);

      setOrders(ordersData || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (tenantId: string) => {
    const { data: pList, error: pErr } = await supabase
      .from('products')
      .select(
        'id,tenant_id,name,price,image_url,description,is_available,created_at,unit_type,unit_label,quantity_step,min_quantity'
      )
      .eq('tenant_id', tenantId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (!pErr) {
      setProducts(pList || []);
    }
  };

  const handleUnitChange = (val: string) => {
    setPUnit(val);
    const q = val === 'kg' || val === 'litre' ? '0.25' : val === 'g' || val === 'ml' ? '100' : '1';
    setPMinQty(q);
    setPQtyStep(q);
    if (val !== 'custom') {
      setPUnitLabel(val);
    } else {
      setPUnitLabel('');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSavingSettings(true);
    setSettingsNotice(null);

    try {
      const normalizedSlug = slugify(slug);
      let logoUrl = tenant.logo_url || null;

      if (logoFile) {
        if (logoFile.size > 2 * 1024 * 1024) {
          throw new Error('Logo must be 2 MB or smaller.');
        }
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type)) {
          throw new Error('Upload a PNG, JPG or WebP image.');
        }
        const ext = logoFile.type === 'image/png' ? 'png' : logoFile.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${tenant.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('store-logos').upload(path, logoFile, {
          upsert: true,
          contentType: logoFile.type,
        });
        if (uploadError) {
          throw new Error('Logo upload failed: ' + uploadError.message);
        }
        logoUrl = supabase.storage.from('store-logos').getPublicUrl(path).data.publicUrl;
      }

      const areas =
        deliveryMode === 'all_india'
          ? []
          : deliveryAreas
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean);

      const payload = {
        business_name: storeName.trim(),
        whatsapp_number: phone.replace(/\D/g, ''),
        contact_phone: contactPhone.trim(),
        store_address: storeAddress.trim(),
        delivery_mode: deliveryMode,
        delivery_areas: areas,
        logo_url: logoUrl,
        slug: normalizedSlug,
        updated_at: new Date().toISOString(),
      };

      if (!payload.business_name) {
        throw new Error('Enter a store name.');
      }

      // Check slug uniqueness
      const { data: duplicate } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', normalizedSlug)
        .neq('id', tenant.id)
        .maybeSingle();

      if (duplicate) {
        throw new Error('This Store URL is already in use. Please choose another name.');
      }

      const { data, error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', tenant.id)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message || 'Could not update settings.');
      }

      setTenant((prev) => (prev ? { ...prev, ...payload } : null));
      setSettingsNotice({ text: 'Store settings saved successfully.', type: 'ok' });
    } catch (err: any) {
      setSettingsNotice({ text: err?.message || 'Failed to save settings.', type: 'err' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    const limit = Number(tenant.product_limit || 50);
    const activeProducts = products.filter((p) => p.is_available).length;
    if (activeProducts >= limit) {
      setProductNotice({
        text: `Your package allows up to ${limit} active products. Mark an existing product unavailable or upgrade your package.`,
        type: 'err',
      });
      return;
    }

    setAddingProduct(true);
    setProductNotice(null);

    try {
      const priceNum = Number(pPrice);
      if (!pName.trim() || !Number.isFinite(priceNum) || priceNum < 0) {
        throw new Error('Enter a valid name and price.');
      }

      const payload = {
        tenant_id: tenant.id,
        name: pName.trim(),
        price: priceNum,
        unit_type: pUnit,
        unit_label: pUnit === 'custom' ? pUnitLabel.trim() || 'unit' : pUnit,
        min_quantity: Number(pMinQty) || 1,
        quantity_step: Number(pQtyStep) || 1,
        description: pDesc.trim(),
        image_url: pImage.trim() || null,
        is_available: true,
      };

      const { error } = await supabase.from('products').insert(payload);
      if (error) throw error;

      setPName('');
      setPPrice('');
      setPDesc('');
      setPImage('');
      setProductNotice({ text: 'Product added successfully!', type: 'ok' });
      await loadProducts(tenant.id);
    } catch (err: any) {
      setProductNotice({ text: err?.message || 'Failed to add product.', type: 'err' });
    } finally {
      setAddingProduct(false);
    }
  };

  const handleToggleProduct = async (p: Product) => {
    if (!tenant) return;
    const willActivate = !p.is_available;
    const limit = Number(tenant.product_limit || 50);
    const activeCount = products.filter((x) => x.is_available).length;

    if (willActivate && activeCount >= limit) {
      alert(
        `Your package allows up to ${limit} active products. Mark another product unavailable or upgrade your package.`
      );
      return;
    }

    const { error } = await supabase
      .from('products')
      .update({ is_available: willActivate })
      .eq('id', p.id)
      .eq('tenant_id', tenant.id);

    if (error) {
      alert(error.message);
    } else {
      await loadProducts(tenant.id);
    }
  };

  const handleHideProduct = async (productId: string) => {
    if (!tenant) return;
    if (!confirm('Hide this product from your storefront? Its record and order history will be retained.')) {
      return;
    }
    const { error } = await supabase
      .from('products')
      .update({ is_available: false })
      .eq('id', productId)
      .eq('tenant_id', tenant.id);

    if (error) {
      alert(error.message);
    } else {
      await loadProducts(tenant.id);
    }
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !tenant) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: editingProduct.name.trim(),
          price: Number(editingProduct.price),
          description: editingProduct.description?.trim() || '',
          image_url: editingProduct.image_url?.trim() || null,
        })
        .eq('id', editingProduct.id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      setEditingProduct(null);
      await loadProducts(tenant.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to update product');
    }
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
    if (!tenant) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .eq('tenant_id', tenant.id);

    if (error) {
      alert('Could not update order status: ' + error.message);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
      );
    }
  };

  const handleCopyLink = async () => {
    if (!tenant) return;
    const url = `${window.location.origin}/store/${tenant.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Store link copied to clipboard: ' + url);
    } catch {
      prompt('Copy store link', url);
    }
  };

  if (loading) {
    return (
      <div className="panel center">
        <p className="muted">Loading Merchant Dashboard…</p>
      </div>
    );
  }

  if (paywallState === 'locked') {
    return (
      <section className="panel center" style={{ maxWidth: 650 }}>
        <span className="eyebrow">STORE ADMIN LOCKED</span>
        <h1 style={{ margin: '14px 0 8px' }}>Complete payment to unlock access</h1>
        <p className="muted">
          Choose a package and complete Cashfree payment. This account cannot open the Store Admin dashboard until
          payment is verified. After payment, Super Admin will assign your store.
        </p>
        <div className="pricegrid" style={{ margin: '20px 0' }}>
          <article className="pricecard">
            <h3>Basic</h3>
            <div className="price">₹999</div>
            <button className="btn outline" onClick={() => onNavigate('/#pricing')}>
              View Basic
            </button>
          </article>
          <article className="pricecard">
            <h3>Standard</h3>
            <div className="price">₹1,999</div>
            <button className="btn primary" onClick={() => onNavigate('/#pricing')}>
              View Standard
            </button>
          </article>
          <article className="pricecard">
            <h3>Premium</h3>
            <div className="price">₹2,999</div>
            <button className="btn outline" onClick={() => onNavigate('/#pricing')}>
              View Premium
            </button>
          </article>
        </div>
        <button className="btn outline" onClick={onLogout}>
          Sign out
        </button>
      </section>
    );
  }

  if (paywallState === 'paid_no_store') {
    return (
      <section className="panel center">
        <span className="eyebrow">PAYMENT VERIFIED</span>
        <h1 style={{ margin: '14px 0 8px' }}>Store assignment in progress</h1>
        <p className="muted">
          Your payment is confirmed! Super Admin must now assign your store URL before you can manage products.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn primary" onClick={() => onNavigate('/#support')}>
            Contact Super Admin
          </button>
          <button className="btn outline" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </section>
    );
  }

  if (errorMsg || !tenant) {
    return (
      <div className="panel center">
        <h2>Could not load your store</h2>
        <p className="muted">{errorMsg || 'Store not found or not assigned.'}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn outline" onClick={onLogout}>
            Sign out
          </button>
          <button className="btn primary" onClick={() => onNavigate('/#support')}>
            Contact Support
          </button>
        </div>
      </div>
    );
  }

  const limit = Number(tenant.product_limit || 50);
  const activeProducts = products.filter((p) => p.is_available).length;
  const isLimitReached = activeProducts >= limit;

  return (
    <section className="sections">
      {/* Header Toolbar */}
      <div className="toolbar">
        <div>
          <span className="eyebrow">Merchant dashboard</span>
          <h1 style={{ margin: '8px 0' }}>{tenant.business_name}</h1>
          <p className="muted">Manage your storefront, product catalog and incoming orders.</p>
        </div>
        <div className="row">
          <button className="btn outline" onClick={handleCopyLink}>
            Copy store link
          </button>
          <a
            className="btn primary"
            href={`/store/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View live store ↗
          </a>
          <button className="btn outline" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="featuregrid" style={{ margin: '22px 0' }}>
        <div className="feature">
          <p className="muted">Active products</p>
          <h2 style={{ margin: '8px 0' }}>
            {activeProducts} / {limit}
          </h2>
          <p className="muted small">
            {products.length - activeProducts} unavailable · retained in your catalog
          </p>
        </div>
        <div className="feature">
          <p className="muted">Store status</p>
          <h2 style={{ margin: '8px 0' }}>{tenant.is_published ? 'Published' : 'Draft'}</h2>
          <p className="muted small">Managed by platform admin</p>
        </div>
        <div className="feature">
          <p className="muted">Plan</p>
          <h2 style={{ margin: '8px 0' }}>{tenant.package_type || 'Custom'}</h2>
          <p className="muted small">Product limit: {limit}</p>
        </div>
      </div>

      {isLimitReached && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2>Plan limit reached</h2>
          <p className="muted">
            You have reached your active product limit of {limit}. Mark an existing product unavailable or upgrade
            your plan to add more.
          </p>
          <button className="btn primary" onClick={() => onNavigate('/#pricing')}>
            View upgrade options
          </button>
        </div>
      )}

      {/* Store Settings Panel */}
      <div className="panel">
        <div className="toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Store settings</h2>
            <p className="muted small" style={{ margin: '4px 0' }}>
              Public URL:{' '}
              <a
                href={`/store/${encodeURIComponent(tenant.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--brand)', textDecoration: 'underline' }}
              >
                /store/{tenant.slug}
              </a>
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="productgrid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Business name</label>
            <input
              maxLength={80}
              value={storeName}
              onChange={(e) => {
                setStoreName(e.target.value);
                if (!manualSlug) setSlug(slugify(e.target.value));
              }}
              required
            />
          </div>
          <div className="field">
            <label>WhatsApp number (country code + digits)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="919876543210"
            />
          </div>
          <div className="field">
            <label>Contact phone number</label>
            <input
              maxLength={20}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Customer support phone"
            />
          </div>
          <div className="field">
            <label>Full store address</label>
            <textarea
              maxLength={500}
              rows={3}
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder="Shop/house, street, city, state, PIN code"
            />
          </div>
          <div className="field">
            <label>Delivery coverage</label>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as any)}
            >
              <option value="all_india">All India</option>
              <option value="specific">Specific areas only</option>
            </select>
          </div>
          {deliveryMode === 'specific' && (
            <div className="field">
              <label>Delivery areas (comma separated)</label>
              <textarea
                rows={3}
                maxLength={1500}
                value={deliveryAreas}
                onChange={(e) => setDeliveryAreas(e.target.value)}
                placeholder="e.g. Hyderabad, Secunderabad, 500001"
              />
            </div>
          )}
          <div className="field">
            <label>Store logo (PNG/JPG/WebP, max 2 MB)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            />
            {tenant.logo_url && (
              <img
                src={tenant.logo_url}
                alt="Current store logo"
                style={{
                  maxWidth: 140,
                  maxHeight: 100,
                  objectFit: 'contain',
                  borderRadius: 12,
                  marginTop: 6,
                }}
              />
            )}
          </div>
          <div className="field">
            <label>Store URL name</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setManualSlug(true);
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={48}
              required
            />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
            <button className="btn primary" type="submit" disabled={savingSettings}>
              {savingSettings ? 'Saving settings…' : 'Save settings'}
            </button>
          </div>
        </form>

        {settingsNotice && (
          <div className={`notice ${settingsNotice.type}`} style={{ marginTop: 14 }}>
            {settingsNotice.text}
          </div>
        )}
      </div>

      {/* Add Product Panel */}
      <div className="panel" style={{ marginTop: 22 }}>
        <h2>Add a product</h2>
        <p className="muted small">
          Up to {limit} active products allowed. Currently {activeProducts} active.
        </p>

        <form onSubmit={handleAddProduct} className="productgrid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Product name</label>
            <input
              maxLength={120}
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder="e.g. Handmade Soap"
              required
            />
          </div>
          <div className="field">
            <label>Price per unit (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
              placeholder="199.00"
              required
            />
          </div>
          <div className="field">
            <label>Selling unit</label>
            <select value={pUnit} onChange={(e) => handleUnitChange(e.target.value)}>
              <option value="piece">Piece / number</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="litre">Litre (L)</option>
              <option value="ml">Millilitre (ml)</option>
              <option value="metre">Metre (m)</option>
              <option value="cm">Centimetre (cm)</option>
              <option value="hour">Hour</option>
              <option value="pack">Pack</option>
              <option value="custom">Custom unit</option>
            </select>
          </div>
          <div className="field">
            <label>Custom unit label</label>
            <input
              maxLength={30}
              placeholder="e.g. plate, box, dozen"
              value={pUnitLabel}
              onChange={(e) => setPUnitLabel(e.target.value)}
              disabled={pUnit !== 'custom'}
            />
          </div>
          <div className="field">
            <label>Minimum quantity</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={pMinQty}
              onChange={(e) => setPMinQty(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Quantity increment</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={pQtyStep}
              onChange={(e) => setPQtyStep(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              maxLength={500}
              placeholder="Short product details"
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Image URL (optional)</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/…"
              value={pImage}
              onChange={(e) => setPImage(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
            <button className="btn primary" type="submit" disabled={isLimitReached || addingProduct}>
              {addingProduct ? 'Adding product…' : 'Add product'}
            </button>
          </div>
        </form>

        {productNotice && (
          <div className={`notice ${productNotice.type}`} style={{ marginTop: 14 }}>
            {productNotice.text}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <h2 style={{ marginTop: 28 }}>Your products</h2>
      <div className="productgrid">
        {products.length > 0 ? (
          products.map((p) => (
            <article className="product" key={p.id}>
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} />
              ) : (
                <div className="empty">No image</div>
              )}
              <h3>{p.name}</h3>
              <p className="muted small">{p.description || ''}</p>
              <div className="price">
                ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <small className="muted" style={{ fontSize: '0.85rem' }}>
                  / {p.unit_label || p.unit_type || 'piece'}
                </small>
              </div>
              <p>
                {p.is_available ? (
                  <span className="pill">Available</span>
                ) : (
                  <span className="pill" style={{ background: '#332a17', color: '#ffe0a3' }}>
                    Unavailable
                  </span>
                )}
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn outline" onClick={() => setEditingProduct(p)}>
                  Edit
                </button>
                <button className="btn outline" onClick={() => handleToggleProduct(p)}>
                  {p.is_available ? 'Mark unavailable' : 'Mark available'}
                </button>
                <button className="btn danger" onClick={() => handleHideProduct(p.id)}>
                  Hide
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty" style={{ gridColumn: '1 / -1' }}>
            No products yet. Add your first product above.
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingProduct(null);
          }}
        >
          <div className="panel" style={{ maxWidth: 500, width: '100%' }}>
            <h2>Edit product</h2>
            <form onSubmit={handleSaveEditProduct}>
              <div className="field">
                <label>Product name</label>
                <input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="field">
                <label>Description</label>
                <input
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Image URL</label>
                <input
                  type="url"
                  value={editingProduct.image_url || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn primary" type="submit">
                  Save changes
                </button>
                <button className="btn outline" type="button" onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Orders List */}
      <h2 style={{ marginTop: 32 }}>Orders</h2>
      <p className="muted small">Orders submitted through your public storefront:</p>
      <div className="stack" style={{ marginTop: 14 }}>
        {orders.length > 0 ? (
          orders.map((o) => (
            <article className="product" key={o.id}>
              <div className="toolbar">
                <div>
                  <b>{o.reference_code || 'Order'}</b>
                  <p className="muted small">
                    {o.customer_name} · {o.customer_phone} · {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <b>₹{Number(o.total_amount || 0).toLocaleString('en-IN')}</b>
              </div>
              {o.customer_address && (
                <p className="small muted" style={{ margin: '6px 0' }}>
                  {o.customer_address}
                </p>
              )}
              <div style={{ marginTop: 10 }}>
                <label className="small">
                  Status:{' '}
                  <select
                    value={o.status}
                    onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                    style={{ marginLeft: 8 }}
                  >
                    {['pending', 'confirmed', 'preparing', 'completed', 'cancelled'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          ))
        ) : (
          <div className="empty">No saved orders yet.</div>
        )}
      </div>
    </section>
  );
};
