import React, { useEffect, useState } from 'react';
import { supabase, Tenant, Product, Order, PaymentTransaction, edgeFailureMessage } from '../lib/supabase';

interface AdminPanelProps {
  onNavigate: (route: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [adminRole, setAdminRole] = useState<'admin' | 'support' | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  // Login form state (if not authenticated)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'users' | 'stores' | 'orders' | 'products' | 'payments' | 'overview' | 'issues'>('users');

  // Admin Data State
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);
  const [selectedInspectTenant, setSelectedInspectTenant] = useState<Tenant | null>(null);
  const [selectedInspectOrder, setSelectedInspectOrder] = useState<Order | null>(null);

  // User management form state
  const [requestedEmail, setRequestedEmail] = useState('');
  const [requestedStoreName, setRequestedStoreName] = useState('');
  const [userActionNotice, setUserActionNotice] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Add Product form in Admin
  const [adminProdStore, setAdminProdStore] = useState('');
  const [adminProdName, setAdminProdName] = useState('');
  const [adminProdPrice, setAdminProdPrice] = useState('');
  const [adminProdDesc, setAdminProdDesc] = useState('');
  const [adminProdImg, setAdminProdImg] = useState('');

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || null;
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const { data: admin, error: adminErr } = await supabase
        .from('platform_admins')
        .select('user_id,role,is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (adminErr || !admin || !['admin', 'support'].includes(admin.role)) {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setNotice({
          text: 'This account is not registered as an active platform administrator.',
          type: 'err',
        });
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      setAdminRole(admin.role as any);
      await loadAdminData(admin.role === 'admin');
    } catch (err: any) {
      setNotice({ text: err?.message || 'Error checking admin permissions', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async (canManage: boolean) => {
    try {
      const [tenantsR, ordersR, productsR, paymentsR, usersR, suspensionsR, logsR] = await Promise.all([
        supabase
          .from('tenants')
          .select(
            'id,user_id,tenant_code,package_type,product_limit,whatsapp_number,business_name,payment_id,created_at,slug,is_published,is_suspended,updated_at'
          )
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('orders')
          .select(
            'id,reference_code,tenant_id,customer_name,customer_phone,customer_address,items,total_amount,created_at,status'
          )
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('products')
          .select(
            'id,tenant_id,name,price,description,is_available,created_at,unit_type,unit_label,quantity_step,min_quantity'
          )
          .order('created_at', { ascending: false })
          .limit(500),
        canManage
          ? supabase
              .from('payment_transactions')
              .select(
                'id,tenant_id,order_id,purpose,provider,amount_paise,currency,status,verified_at,created_at'
              )
              .order('created_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        canManage
          ? supabase
              .from('platform_user_registry')
              .select('user_id,email,created_at,last_sign_in_at,updated_at')
              .order('created_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        canManage
          ? supabase.from('tenant_suspensions').select('tenant_id,reason,suspended_by,created_at')
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('admin_audit_log')
          .select('id,actor_user_id,action,target_type,target_id,details,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      setTenants(tenantsR.data || []);
      if (tenantsR.data?.length) {
        setAdminProdStore(tenantsR.data[0].id);
      }
      setOrders(ordersR.data || []);
      setProducts(productsR.data || []);
      setPayments((paymentsR as any).data || []);
      setUsers((usersR as any).data || []);
      setSuspensions((suspensionsR as any).data || []);
      setAuditLogs(logsR.data || []);
    } catch {
      // ignore
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setNotice(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        setNotice({ text: error.message, type: 'err' });
        return;
      }

      if (data?.user) {
        await checkAdminAuth();
      }
    } catch (err: any) {
      setNotice({ text: err?.message || 'Login failed', type: 'err' });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAdminRole(null);
    onNavigate('/login');
  };

  const audit = async (action: string, targetType: string, targetId: string, details: any = {}) => {
    if (!currentUser) return;
    try {
      await supabase.from('admin_audit_log').insert({
        actor_user_id: currentUser.id,
        action,
        target_type: targetType,
        target_id: String(targetId || ''),
        details: details || {},
      });
    } catch {
      // ignore
    }
  };

  const handleToggleStorePublish = async (t: Tenant) => {
    const nextState = !t.is_published;
    const { error } = await supabase.from('tenants').update({ is_published: nextState }).eq('id', t.id);
    if (error) {
      alert('Could not update store status: ' + error.message);
      return;
    }
    await audit(nextState ? 'store_published' : 'store_unpublished', 'tenant', t.id, {
      is_published: nextState,
    });
    setTenants((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_published: nextState } : x)));
  };

  const handleToggleStoreSuspension = async (t: Tenant) => {
    const wasSuspended = !!t.is_suspended || suspensions.some((s) => s.tenant_id === t.id);
    let reason = '';
    if (!wasSuspended) {
      const r = prompt('Reason for suspending this store (visible to platform admins):', 'Policy review / support issue');
      if (r === null) return;
      if (!r.trim()) {
        alert('Enter a reason before suspending.');
        return;
      }
      reason = r.trim();
    }

    const { error } = await supabase.rpc('manage_tenant_suspension', {
      p_tenant_id: t.id,
      p_suspend: !wasSuspended,
      p_reason: wasSuspended ? null : reason,
    });

    if (error) {
      alert('Store suspension change failed: ' + error.message);
      return;
    }

    alert(wasSuspended ? 'Store restored.' : 'Store suspended and hidden from public storefronts.');
    await loadAdminData(adminRole === 'admin');
  };

  const handleApproveUserAndStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = requestedEmail.trim().toLowerCase();
    const businessName = requestedStoreName.trim();
    if (!email || businessName.length < 2) {
      setUserActionNotice({ text: 'Enter a valid email and store name.', type: 'err' });
      return;
    }

    if (!confirm(`Approve ${email} and create draft store for ${businessName}?`)) return;

    setCreatingUser(true);
    setUserActionNotice(null);

    try {
      const { data, error } = await supabase.functions.invoke('platform-user-management', {
        body: { action: 'invite-user', email },
      });

      if (error || data?.error) {
        throw new Error(await edgeFailureMessage(error, data));
      }

      const uid = data.user_id;
      // Create the draft store and verify the Edge Function result before reporting success.
      const { data: storeData, error: storeError } = await supabase.functions.invoke('platform-user-management', {
        body: { action: 'create-store', user_id: uid, business_name: businessName },
      });

      if (storeError || storeData?.error || !storeData?.success) {
        throw new Error(await edgeFailureMessage(storeError, storeData));
      }

      setUserActionNotice({
        text: `User and draft store created successfully for ${email}.`,
        type: 'ok',
      });
      setRequestedEmail('');
      setRequestedStoreName('');
      await loadAdminData(true);
    } catch (err: any) {
      setUserActionNotice({ text: err?.message || 'Creation failed.', type: 'err' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAdminAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProdStore) {
      alert('Select a store first.');
      return;
    }
    const priceNum = Number(adminProdPrice);
    if (!adminProdName.trim() || !Number.isFinite(priceNum) || priceNum < 0) {
      alert('Enter valid name and price.');
      return;
    }

    const unit_type = prompt('Unit type (piece, kg, g, litre, ml, metre, cm, hour, pack, custom):', 'piece');
    if (unit_type === null) return;
    const unit_label = unit_type === 'custom' ? prompt('Custom unit label:', 'unit') || 'unit' : unit_type;
    const min_quantity = Number(prompt('Minimum quantity:', unit_type === 'kg' || unit_type === 'litre' ? '0.25' : '1')) || 1;
    const quantity_step = Number(prompt('Quantity increment:', unit_type === 'kg' || unit_type === 'litre' ? '0.25' : '1')) || 1;

    const { data, error } = await supabase
      .from('products')
      .insert({
        tenant_id: adminProdStore,
        name: adminProdName.trim(),
        price: priceNum,
        unit_type,
        unit_label,
        min_quantity,
        quantity_step,
        description: adminProdDesc.trim(),
        image_url: adminProdImg.trim() || null,
        is_available: true,
      })
      .select('id')
      .single();

    if (error) {
      alert('Product creation failed: ' + error.message);
      return;
    }

    await audit('admin_created_product', 'product', data.id, {
      tenant_id: adminProdStore,
      name: adminProdName,
      price: priceNum,
    });

    alert('Product created.');
    setAdminProdName('');
    setAdminProdPrice('');
    setAdminProdDesc('');
    setAdminProdImg('');
    await loadAdminData(true);
  };

  const getStoreName = (id?: string) => {
    const t = tenants.find((x) => x.id === id);
    return t ? t.business_name || t.slug || 'Store' : 'Unknown store';
  };

  const confirmedPayments = payments.filter((p) => p.status === 'success' && !!p.verified_at);
  const confirmedAmount = confirmedPayments.reduce((sum, p) => sum + Number(p.amount_paise || 0), 0);

  if (loading) {
    return (
      <div className="panel center">
        <p className="muted">Authenticating platform access…</p>
      </div>
    );
  }

  // Not signed in as platform admin
  if (!currentUser) {
    return (
      <section className="panel center" style={{ maxWidth: 520 }}>
        <span className="eyebrow">GENIEDEVS · OWNER ACCESS</span>
        <h1 style={{ margin: '14px 0 8px' }}>Owner Admin</h1>
        <p className="muted">
          Sign in with the account that has been granted platform-admin access. Merchant accounts cannot enter this panel.
        </p>

        <form onSubmit={handleAdminLogin}>
          <div className="field">
            <label htmlFor="ownerEmail">Email</label>
            <input
              id="ownerEmail"
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ownerPassword">Password</label>
            <input
              id="ownerPassword"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn primary" type="submit" disabled={loginLoading} style={{ width: '100%', marginTop: 8 }}>
            {loginLoading ? 'Signing in…' : 'Secure sign in'}
          </button>
        </form>

        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

        <p className="muted small" style={{ marginTop: 14 }}>
          Never share your password. Admin access is verified by the database, not by this URL.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn outline" onClick={() => onNavigate('/')}>
            ← Main website
          </button>
          <button className="btn outline" onClick={() => onNavigate('/login')}>
            Merchant login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-shell">
      {/* Header */}
      <div className="admin-head">
        <div>
          <span className="eyebrow">VERIFIED PLATFORM ACCESS · {adminRole?.toUpperCase()}</span>
          <h1 style={{ margin: '12px 0 4px' }}>Owner Control Center</h1>
          <p className="muted">
            Manage stores, inspect merchant workspaces, troubleshoot orders and review platform records.
          </p>
        </div>
        <div className="actions">
          <button className="btn outline" onClick={() => onNavigate('/')}>
            Main website
          </button>
          <button className="btn outline" onClick={() => loadAdminData(adminRole === 'admin')}>
            Refresh data
          </button>
          <button className="btn danger" onClick={handleAdminLogout}>
            Sign out
          </button>
        </div>
      </div>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {/* Stats Summary */}
      <div className="admin-stats">
        <div className="admin-stat">
          <small>Registered users</small>
          <b>{users.length}</b>
        </div>
        <div className="admin-stat">
          <small>Payment records</small>
          <b>{payments.length}</b>
        </div>
        <div className="admin-stat">
          <small>Confirmed payments</small>
          <b>{confirmedPayments.length}</b>
        </div>
        <div className="admin-stat">
          <small>Confirmed amount</small>
          <b>
            ₹
            {(confirmedAmount / 100).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </b>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-nav">
        <button
          className={`btn outline ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Registered users
        </button>
        <button
          className={`btn outline ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          Stores ({tenants.length})
        </button>
        <button
          className={`btn outline ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders ({orders.length})
        </button>
        <button
          className={`btn outline ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products ({products.length})
        </button>
        <button
          className={`btn outline ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Payments
        </button>
        <button
          className={`btn outline ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`btn outline ${activeTab === 'issues' ? 'active' : ''}`}
          onClick={() => setActiveTab('issues')}
        >
          Support / Audit
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="panel">
        {/* TAB: USERS */}
        {activeTab === 'users' && (
          <div>
            <h2>User management & account safety</h2>
            <p className="muted">
              Auth account actions run server-side and require active platform-admin verification. Passwords are never
              visible to admins.
            </p>

            <form
              onSubmit={handleApproveUserAndStore}
              className="productgrid"
              style={{
                margin: '16px 0',
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 14,
              }}
            >
              <div className="field">
                <label>Requested user email</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={requestedEmail}
                  onChange={(e) => setRequestedEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Business / store name</label>
                <input
                  maxLength={80}
                  placeholder="Business name"
                  value={requestedStoreName}
                  onChange={(e) => setRequestedStoreName(e.target.value)}
                  required
                />
              </div>
              <div style={{ alignSelf: 'end' }}>
                <button className="btn primary" type="submit" disabled={creatingUser}>
                  {creatingUser ? 'Creating user & store…' : 'Approve user & create store'}
                </button>
              </div>
            </form>

            {userActionNotice && (
              <div className={`notice ${userActionNotice.type}`}>{userActionNotice.text}</div>
            )}

            <div className="field" style={{ margin: '18px 0' }}>
              <label>Search email or User ID</label>
              <input
                type="search"
                placeholder="Search registered accounts…"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email / ID</th>
                    <th>Created</th>
                    <th>Last sign-in</th>
                    <th>Linked Stores</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(
                      (u) =>
                        (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        (u.user_id || '').includes(userSearchQuery)
                    )
                    .map((u) => {
                      const userStores = tenants.filter((t) => t.user_id === u.user_id);
                      return (
                        <tr key={u.user_id}>
                          <td>
                            <b>{u.email}</b>
                            <br />
                            <small className="muted">{u.user_id}</small>
                          </td>
                          <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                          <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}</td>
                          <td>
                            {userStores.length > 0
                              ? userStores.map((s) => s.business_name).join(', ')
                              : 'None assigned'}
                          </td>
                          <td>
                            <div className="admin-actions">
                              {userStores[0] && (
                                <button
                                  className="btn outline"
                                  onClick={() => {
                                    setSelectedInspectTenant(userStores[0]);
                                    setActiveTab('stores');
                                  }}
                                >
                                  Inspect store
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: STORES */}
        {activeTab === 'stores' && (
          <div>
            <h2>Stores & merchant management</h2>
            <p className="muted">
              Suspend/restore blocks public storefront visibility. Controls are restricted to admin role.
            </p>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Business / URL</th>
                    <th>Package</th>
                    <th>Store ID</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const isSuspended = !!t.is_suspended || suspensions.some((s) => s.tenant_id === t.id);
                    return (
                      <tr key={t.id}>
                        <td>
                          <b>{t.business_name || 'Unnamed store'}</b>
                          <br />
                          <small className="muted">{t.slug ? `/store/${t.slug}` : 'no slug'}</small>
                        </td>
                        <td>{t.package_type || '—'}</td>
                        <td>
                          <small className="muted">{t.id.slice(0, 8)}</small>
                        </td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              background: isSuspended ? '#3d1f28' : t.is_published ? '#123c39' : '#332a17',
                              color: isSuspended ? '#ff827d' : t.is_published ? '#72f3d0' : '#ffe0a3',
                            }}
                          >
                            {isSuspended ? 'SUSPENDED' : t.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              className="btn outline"
                              onClick={() => setSelectedInspectTenant(t)}
                            >
                              Inspect workspace
                            </button>
                            {adminRole === 'admin' && (
                              <>
                                <button
                                  className={`btn ${t.is_published ? 'danger' : 'primary'}`}
                                  onClick={() => handleToggleStorePublish(t)}
                                >
                                  {t.is_published ? 'Unpublish' : 'Publish'}
                                </button>
                                <button
                                  className={`btn ${isSuspended ? 'primary' : 'danger'}`}
                                  onClick={() => handleToggleStoreSuspension(t)}
                                >
                                  {isSuspended ? 'Restore store' : 'Suspend'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedInspectTenant && (
              <div style={{ marginTop: 26, padding: 18, border: '1px solid var(--line)', borderRadius: 14 }}>
                <div className="toolbar">
                  <h3>Workspace inspection: {selectedInspectTenant.business_name}</h3>
                  <button className="btn outline" onClick={() => setSelectedInspectTenant(null)}>
                    Close
                  </button>
                </div>
                <div className="admin-detail">
                  <div>
                    Store URL: <b>/store/{selectedInspectTenant.slug}</b>
                  </div>
                  <div>
                    WhatsApp: <b>{selectedInspectTenant.whatsapp_number || 'Not configured'}</b>
                  </div>
                  <div>
                    Plan / limit:{' '}
                    <b>
                      {selectedInspectTenant.package_type || 'Demo'} / {selectedInspectTenant.product_limit ?? 50}
                    </b>
                  </div>
                  <div>
                    Status:{' '}
                    <b>{selectedInspectTenant.is_published ? 'Published' : 'Draft / Unpublished'}</b>
                  </div>
                </div>

                <h4>Store Products ({products.filter((p) => p.tenant_id === selectedInspectTenant.id).length})</h4>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Availability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter((p) => p.tenant_id === selectedInspectTenant.id)
                        .map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>₹{Number(p.price).toFixed(2)}</td>
                            <td>{p.is_available ? 'Available' : 'Hidden'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <h2>All orders</h2>
            <p className="muted">Cross-store orders across the platform:</p>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Store</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? (
                    orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.reference_code || o.id.slice(0, 8)}</b>
                          <br />
                          <small className="muted">{new Date(o.created_at).toLocaleString()}</small>
                        </td>
                        <td>{getStoreName(o.tenant_id)}</td>
                        <td>
                          {o.customer_name || '—'}
                          <br />
                          <small className="muted">{o.customer_phone}</small>
                        </td>
                        <td>₹{Number(o.total_amount || 0).toLocaleString('en-IN')}</td>
                        <td>
                          <select
                            value={o.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              await supabase.from('orders').update({ status: newStatus }).eq('id', o.id);
                              setOrders((prev) =>
                                prev.map((item) =>
                                  item.id === o.id ? { ...item, status: newStatus as any } : item
                                )
                              );
                            }}
                          >
                            {['pending', 'confirmed', 'preparing', 'completed', 'cancelled'].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button className="btn outline" onClick={() => setSelectedInspectOrder(o)}>
                            View details
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedInspectOrder && (
              <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--line)', borderRadius: 14 }}>
                <div className="toolbar">
                  <h3>Order Details: {selectedInspectOrder.reference_code}</h3>
                  <button className="btn outline" onClick={() => setSelectedInspectOrder(null)}>
                    Close
                  </button>
                </div>
                <div className="admin-detail">
                  <div>
                    Customer: <b>{selectedInspectOrder.customer_name}</b>
                  </div>
                  <div>
                    Phone: <b>{selectedInspectOrder.customer_phone}</b>
                  </div>
                  <div>
                    Address: <b>{selectedInspectOrder.customer_address}</b>
                  </div>
                  <div>
                    Total Amount: <b>₹{Number(selectedInspectOrder.total_amount).toLocaleString('en-IN')}</b>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    Items Snapshot:
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', marginTop: 6 }}>
                      {JSON.stringify(selectedInspectOrder.items, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PRODUCTS */}
        {activeTab === 'products' && (
          <div>
            <h2>All products</h2>
            <p className="muted">Cross-store catalog management:</p>

            {adminRole === 'admin' && tenants.length > 0 && (
              <form
                onSubmit={handleAdminAddProduct}
                className="admin-detail"
                style={{ margin: '16px 0', padding: 16, border: '1px solid var(--line)', borderRadius: 14 }}
              >
                <div>
                  <label>Store</label>
                  <select
                    value={adminProdStore}
                    onChange={(e) => setAdminProdStore(e.target.value)}
                    required
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.business_name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Product name</label>
                  <input
                    maxLength={120}
                    value={adminProdName}
                    onChange={(e) => setAdminProdName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Price per unit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={adminProdPrice}
                    onChange={(e) => setAdminProdPrice(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Description</label>
                  <input
                    maxLength={500}
                    value={adminProdDesc}
                    onChange={(e) => setAdminProdDesc(e.target.value)}
                  />
                </div>
                <div>
                  <label>Image URL (optional)</label>
                  <input
                    type="url"
                    value={adminProdImg}
                    onChange={(e) => setAdminProdImg(e.target.value)}
                  />
                </div>
                <div style={{ alignSelf: 'end' }}>
                  <button className="btn primary" type="submit">
                    Add product
                  </button>
                </div>
              </form>
            )}

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Store</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{getStoreName(p.tenant_id)}</td>
                      <td>₹{Number(p.price || 0).toLocaleString('en-IN')}</td>
                      <td>{p.is_available ? 'Yes' : 'No'}</td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === 'payments' && (
          <div>
            <h2>All platform payments</h2>
            <p className="muted">
              Every payment record is shown. CONFIRMED means status is success and verified by server.
            </p>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Store / reference</th>
                    <th>Purpose</th>
                    <th>Provider</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Confirmed at</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? (
                    payments.map((p) => {
                      const isConfirmed = p.status === 'success' && !!p.verified_at;
                      return (
                        <tr key={p.id}>
                          <td>{new Date(p.created_at).toLocaleString()}</td>
                          <td>
                            {getStoreName(p.tenant_id)}
                            <br />
                            <small className="muted">{p.order_id || p.tenant_id || 'No ref'}</small>
                          </td>
                          <td>{p.purpose || '—'}</td>
                          <td>{p.provider || 'Cashfree'}</td>
                          <td>
                            {p.currency || 'INR'} {(Number(p.amount_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span
                              className="pill"
                              style={{
                                background: isConfirmed ? '#123c39' : '#332a17',
                                color: isConfirmed ? '#72f3d0' : '#ffe0a3',
                              }}
                            >
                              {isConfirmed ? 'CONFIRMED' : (p.status || 'PENDING').toUpperCase()}
                            </span>
                          </td>
                          <td>{p.verified_at ? new Date(p.verified_at).toLocaleString() : '—'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7}>No payment records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <h2>Platform overview</h2>
            <div className="admin-detail" style={{ margin: '18px 0' }}>
              <div>
                Registered user records: <b>{users.length}</b>
              </div>
              <div>
                Payment records: <b>{payments.length}</b>
              </div>
              <div>
                Confirmed payments: <b>{confirmedPayments.length}</b>
              </div>
              <div>
                Confirmed amount:{' '}
                <b>
                  ₹
                  {(confirmedAmount / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </b>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ISSUES / AUDIT */}
        {activeTab === 'issues' && (
          <div>
            <h2>Support & audit trail</h2>
            <p className="muted">Recent administrative events logged in the database:</p>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length > 0 ? (
                    auditLogs.map((l) => (
                      <tr key={l.id}>
                        <td>{new Date(l.created_at).toLocaleString()}</td>
                        <td>
                          <b>{l.action}</b>
                        </td>
                        <td>
                          {l.target_type} {l.target_id}
                        </td>
                        <td>
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                            {JSON.stringify(l.details || {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No audit events yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
