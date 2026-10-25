import React, { useState } from 'react';

interface SampleProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  emoji: string;
  desc: string;
  stock: number;
}

interface CartItem extends SampleProduct {
  qty: number;
}

interface SampleOrder {
  ref: string;
  customer: string;
  date: string;
  items: string;
  total: number;
  status: string;
}

interface LiveDemoProps {
  onBack: () => void;
}

const INITIAL_SAMPLES: SampleProduct[] = [
  { id: 's1', name: 'Homemade Mango Pickle', price: 180, category: 'Food', emoji: '🫙', desc: 'Small-batch, bold flavour', stock: 24 },
  { id: 's2', name: 'Wildflower Honey', price: 250, category: 'Food', emoji: '🍯', desc: 'Naturally golden sweetness', stock: 18 },
  { id: 's3', name: 'Signature Spice Mix', price: 120, category: 'Food', emoji: '🌶️', desc: 'A fragrant everyday blend', stock: 32 },
  { id: 's4', name: 'Butter Cookies', price: 160, category: 'Bakery', emoji: '🍪', desc: 'Freshly baked and crisp', stock: 15 },
  { id: 's5', name: 'Handloom Tote Bag', price: 399, category: 'Lifestyle', emoji: '👜', desc: 'Reusable, colourful and sturdy', stock: 12 },
  { id: 's6', name: 'Ceramic Coffee Mug', price: 299, category: 'Lifestyle', emoji: '☕', desc: 'A little ritual for every day', stock: 20 },
  { id: 's7', name: 'Herbal Bath Soap', price: 99, category: 'Care', emoji: '🧼', desc: 'Gentle daily cleansing bar', stock: 40 },
  { id: 's8', name: 'Sandalwood Candle', price: 349, category: 'Lifestyle', emoji: '🕯️', desc: 'Warm scent for quiet evenings', stock: 9 },
  { id: 's9', name: 'Roasted Cashews', price: 220, category: 'Food', emoji: '🥜', desc: 'Crunchy snack-time favourite', stock: 25 },
  { id: 's10', name: 'Cotton Scarf', price: 499, category: 'Fashion', emoji: '🧣', desc: 'Soft everyday layering', stock: 14 },
  { id: 's11', name: 'Terracotta Planter', price: 279, category: 'Home', emoji: '🪴', desc: 'Earthy accent for your space', stock: 11 },
  { id: 's12', name: 'Filter Coffee Blend', price: 199, category: 'Food', emoji: '🫘', desc: 'Rich roast, balanced finish', stock: 27 },
];

const INITIAL_ORDERS: SampleOrder[] = [
  { ref: 'GD-DEMO-1042', customer: 'Ananya R.', date: 'Today · 10:24 AM', items: 'Honey × 2, Cookies × 1', total: 660, status: 'Confirmed' },
  { ref: 'GD-DEMO-1041', customer: 'Rahul K.', date: 'Today · 9:15 AM', items: 'Pickle × 1', total: 180, status: 'Preparing' },
  { ref: 'GD-DEMO-1040', customer: 'Meera S.', date: 'Yesterday', items: 'Coffee Blend × 2, Mug × 1', total: 697, status: 'Completed' },
];

export const LiveDemo: React.FC<LiveDemoProps> = ({ onBack }) => {
  const [samples, setSamples] = useState<SampleProduct[]>(INITIAL_SAMPLES);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'store' | 'preview' | 'checkout'>('overview');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [orders, setOrders] = useState<SampleOrder[]>(INITIAL_ORDERS);
  const [storeSettings, setStoreSettings] = useState({
    name: 'Little Local Market',
    tagline: 'Fresh finds, local love.',
    whatsapp: '919876543210',
    city: 'Hyderabad',
    delivery: 'Local delivery · Hyderabad',
  });

  // Custom sample product form state
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('299');
  const [newProductCategory, setNewProductCategory] = useState('My products');
  const [newProductEmoji, setNewProductEmoji] = useState('📦');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [addNotice, setAddNotice] = useState('Added products remain in this browser session only.');

  // Demo checkout form state
  const [checkoutCustomer, setCheckoutCustomer] = useState('Priya Sharma');
  const [checkoutPhone, setCheckoutPhone] = useState('98765 43210');
  const [checkoutAddress, setCheckoutAddress] = useState('Flat 402, Green Meadows, Jubilee Hills, Hyderabad');
  const [checkoutNotice, setCheckoutNotice] = useState<string>('Demo only — nothing is submitted, sent or saved.');
  const [isCheckoutOk, setIsCheckoutOk] = useState(false);

  const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const total = () => cart.reduce((s, x) => s + x.price * x.qty, 0);

  const demoSlug = (name: string) =>
    String(name || 'my-store')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'my-store';

  const addToCart = (product: SampleProduct) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === product.id);
      if (existing) {
        return prev.map((x) => (x.id === product.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setActiveTab('checkout');
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((x) => {
          if (x.id === id) {
            const nextQty = x.qty + delta;
            return nextQty > 0 ? { ...x, qty: nextQty } : null;
          }
          return x;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleAddSampleProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(newProductPrice);
    if (!newProductName.trim() || !Number.isFinite(priceNum) || priceNum <= 0) return;

    const newProd: SampleProduct = {
      id: 'custom-' + Date.now(),
      name: newProductName.trim(),
      price: priceNum,
      category: newProductCategory.trim() || 'My products',
      emoji: newProductEmoji.trim() || '📦',
      desc: newProductDesc.trim(),
      stock: 10,
    };

    setSamples((prev) => [newProd, ...prev]);
    setNewProductName('');
    setNewProductDesc('');
    setAddNotice('Sample product added! Open Customer storefront to see it.');
  };

  const handlePreviewWhatsAppOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) {
      setCheckoutNotice('Add at least one product before previewing checkout.');
      setIsCheckoutOk(false);
      return;
    }
    const msg =
      `DEMO ORDER PREVIEW — ${storeSettings.name}\n` +
      `Customer: ${checkoutCustomer}\n` +
      `Phone: ${checkoutPhone}\n` +
      `Address: ${checkoutAddress}\n\n` +
      cart.map((x) => `${x.name} × ${x.qty} = ${money(x.price * x.qty)}`).join('\n') +
      `\n\nTotal: ${money(total())}`;

    setCheckoutNotice(msg + '\n\nNo message was sent and no real order was placed.');
    setIsCheckoutOk(true);
  };

  const allCategories = ['All', ...Array.from(new Set(samples.map((p) => p.category)))];
  const filteredProducts = samples.filter((p) => {
    const matchesCategory = category === 'All' || p.category === category;
    const matchesQuery = (p.name + ' ' + p.desc).toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const tabTitles: Record<string, string> = {
    overview: 'Good morning 👋',
    products: 'Manage your catalog',
    orders: 'Order management',
    store: 'Store profile & delivery',
    preview: 'Your customer storefront',
    checkout: 'Cart & checkout preview',
  };

  return (
    <>
      <section className="storehead">
        <span className="eyebrow">✦ INTERACTIVE PRODUCT DEMO · SAMPLE DATA</span>
        <h1>
          Run your store, <span className="gradient">beautifully.</span>
        </h1>
        <p className="muted">
          Explore a realistic seller dashboard with a sample catalog, order management, storefront preview and
          settings. All changes stay in this demo session only — nothing is saved to a real account or database.
        </p>
        <div className="actions">
          <button className="btn outline" onClick={onBack}>
            ← Back to GenieDevs
          </button>
          <span className="demo-chip">● Demo mode · No real orders</span>
        </div>
      </section>

      <section className="sections" style={{ paddingTop: 20 }}>
        <div className="demo-layout">
          {/* Sidebar */}
          <aside className="demo-sidebar">
            <div style={{ padding: '8px 10px 15px' }}>
              <div style={{ fontWeight: 850, fontSize: '1.1rem' }}>✳ {storeSettings.name}</div>
              <small className="muted">Seller workspace</small>
            </div>

            <button
              className={`demo-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              ▦ &nbsp; Overview
            </button>
            <button
              className={`demo-tab ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              ▤ &nbsp; Products
            </button>
            <button
              className={`demo-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              ↗ &nbsp; Orders
            </button>
            <button
              className={`demo-tab ${activeTab === 'store' ? 'active' : ''}`}
              onClick={() => setActiveTab('store')}
            >
              ◈ &nbsp; Store settings
            </button>
            <button
              className={`demo-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              ◈ &nbsp; Customer storefront
            </button>
            <button
              className={`demo-tab ${activeTab === 'checkout' ? 'active' : ''}`}
              onClick={() => setActiveTab('checkout')}
            >
              🛒 &nbsp; Cart & checkout ({cart.reduce((s, x) => s + x.qty, 0)})
            </button>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)', marginTop: 12, padding: '14px 9px 3px' }}>
              <small className="muted">PREVIEW ONLY</small>
              <p className="muted" style={{ fontSize: '0.82rem', margin: '5px 0' }}>
                Sample data resets when this page is refreshed.
              </p>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="demo-main">
            <div className="demo-topline">
              <div>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  SELLER DASHBOARD / <span>{activeTab.toUpperCase()}</span>
                </span>
                <h2 style={{ margin: '4px 0 0' }}>{tabTitles[activeTab]}</h2>
              </div>
              {activeTab === 'products' && (
                <button
                  className="btn primary"
                  onClick={() => {
                    document.getElementById('newProductName')?.focus();
                    document.getElementById('newProductName')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  ＋ Add sample item
                </button>
              )}
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                <div className="demo-kpis">
                  <div className="demo-kpi">
                    <span>Active products</span>
                    <strong>{samples.length}</strong>
                    <small className="muted">of 25 demo slots</small>
                  </div>
                  <div className="demo-kpi">
                    <span>Sample orders</span>
                    <strong>{orders.length}</strong>
                    <small className="muted">Across recent activity</small>
                  </div>
                  <div className="demo-kpi">
                    <span>Sample sales</span>
                    <strong>{money(orders.reduce((s, o) => s + o.total, 0))}</strong>
                    <small className="muted">Illustrative only</small>
                  </div>
                </div>

                <div className="demo-content">
                  <div className="demo-topline">
                    <div>
                      <h3 style={{ margin: 0 }}>Recent orders</h3>
                      <small className="muted">Sample activity, not real customer orders</small>
                    </div>
                    <button className="btn outline" onClick={() => setActiveTab('orders')}>
                      View all
                    </button>
                  </div>
                  {orders.slice(0, 3).map((o, idx) => (
                    <div className="demo-row" key={idx}>
                      <div>
                        <b>{o.customer}</b>
                        <br />
                        <small>
                          {o.ref} · {o.date}
                        </small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <b>{money(o.total)}</b>
                        <br />
                        <span className="demo-chip">{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="demo-content">
                  <div className="demo-topline">
                    <div>
                      <h3 style={{ margin: 0 }}>Catalog highlights</h3>
                      <small className="muted">A sample of your product range</small>
                    </div>
                    <button className="btn outline" onClick={() => setActiveTab('products')}>
                      Manage catalog
                    </button>
                  </div>
                  <div className="demo-products">
                    {samples.slice(0, 3).map((p) => (
                      <article className="demo-product" key={p.id}>
                        <div className="demo-product-art">{p.emoji}</div>
                        <span className="muted" style={{ fontSize: '0.76rem' }}>
                          {p.category}
                        </span>
                        <h3>{p.name}</h3>
                        <p>{p.desc}</p>
                        <div className="price">{money(p.price)}</div>
                        <button className="btn primary" onClick={() => addToCart(p)}>
                          Add to demo cart
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TAB: PRODUCTS */}
            {activeTab === 'products' && (
              <>
                <div className="demo-content">
                  <div className="demo-topline">
                    <div>
                      <h3 style={{ margin: 0 }}>Product catalog</h3>
                      <small className="muted">{samples.length} sample products · Search and filter interactive</small>
                    </div>
                    <span className="demo-chip">Demo package · 25 slots</span>
                  </div>

                  <div className="demo-filter">
                    <input
                      placeholder="Search products…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="demo-products">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => (
                        <article className="demo-product" key={p.id}>
                          <div className="demo-product-art">{p.emoji}</div>
                          <span className="muted" style={{ fontSize: '0.76rem' }}>
                            {p.category}
                          </span>
                          <h3>{p.name}</h3>
                          <p>{p.desc}</p>
                          <div className="price">{money(p.price)}</div>
                          <button className="btn primary" onClick={() => addToCart(p)}>
                            Add to demo cart
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="empty" style={{ gridColumn: '1 / -1' }}>
                        No sample products match your search.
                      </div>
                    )}
                  </div>
                </div>

                <div className="demo-content">
                  <h3>Add your own sample product</h3>
                  <p className="muted">
                    Try your own product name, price, category and description. This is session-only demo data.
                  </p>
                  <form onSubmit={handleAddSampleProduct} className="demo-product-form">
                    <div className="demo-setting">
                      <label htmlFor="newProductName">Product name</label>
                      <input
                        id="newProductName"
                        maxLength={80}
                        placeholder="e.g. Handmade candles"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="newProductPrice">Price (₹)</label>
                      <input
                        id="newProductPrice"
                        type="number"
                        min={1}
                        max={1000000}
                        step={1}
                        value={newProductPrice}
                        onChange={(e) => setNewProductPrice(e.target.value)}
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="newProductCategory">Category</label>
                      <input
                        id="newProductCategory"
                        maxLength={40}
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="newProductEmoji">Product icon / emoji</label>
                      <input
                        id="newProductEmoji"
                        maxLength={8}
                        value={newProductEmoji}
                        onChange={(e) => setNewProductEmoji(e.target.value)}
                        required
                      />
                    </div>
                    <div className="demo-setting" style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="newProductDesc">Description</label>
                      <input
                        id="newProductDesc"
                        maxLength={140}
                        placeholder="A short product description"
                        value={newProductDesc}
                        onChange={(e) => setNewProductDesc(e.target.value)}
                        required
                      />
                    </div>
                    <button className="btn primary" type="submit">
                      ＋ Add sample product
                    </button>
                  </form>
                  <p className="muted small" role="status" style={{ marginTop: 8 }}>
                    {addNotice}
                  </p>
                </div>

                <div className="demo-content">
                  <h3>Catalog management preview</h3>
                  <p className="muted">
                    In a paid store, product details and availability are managed here. This demo uses fictional items
                    only and does not write to your account.
                  </p>
                  <div className="demo-row">
                    <span>Active sample products</span>
                    <b>{samples.length} / 25</b>
                  </div>
                  <div className="demo-row">
                    <span>Sample product categories</span>
                    <b>{allCategories.length - 1}</b>
                  </div>
                </div>
              </>
            )}

            {/* TAB: ORDERS */}
            {activeTab === 'orders' && (
              <div className="demo-content">
                <div className="demo-topline">
                  <div>
                    <h3 style={{ margin: 0 }}>Orders workspace</h3>
                    <small className="muted">Fictional orders to preview the workflow</small>
                  </div>
                  <span className="demo-chip">{orders.length} sample orders</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i}>
                          <td>
                            <b>{o.ref}</b>
                            <br />
                            <small className="muted">{o.date}</small>
                          </td>
                          <td>{o.customer}</td>
                          <td>{o.items}</td>
                          <td>
                            <b>{money(o.total)}</b>
                          </td>
                          <td>
                            <select
                              value={o.status}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                setOrders((prev) =>
                                  prev.map((order, idx) => (idx === i ? { ...order, status: newStatus } : order))
                                );
                              }}
                              aria-label="Sample order status"
                            >
                              {['Pending', 'Confirmed', 'Preparing', 'Completed', 'Cancelled'].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ fontSize: '0.85rem', marginTop: 14, marginBottom: 0 }}>
                  Change a sample status to see the interaction. It will not affect any real order.
                </p>
              </div>
            )}

            {/* TAB: STORE SETTINGS */}
            {activeTab === 'store' && (
              <>
                <div className="demo-content">
                  <h3>Store settings</h3>
                  <p className="muted">
                    Edit this sample shop profile and preview the result. No real store settings are changed.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setActiveTab('preview');
                    }}
                  >
                    <div className="demo-setting">
                      <label htmlFor="demoStoreName">Business name</label>
                      <input
                        id="demoStoreName"
                        maxLength={80}
                        value={storeSettings.name}
                        onChange={(e) => setStoreSettings({ ...storeSettings, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="demoTagline">Store tagline</label>
                      <input
                        id="demoTagline"
                        maxLength={100}
                        value={storeSettings.tagline}
                        onChange={(e) => setStoreSettings({ ...storeSettings, tagline: e.target.value })}
                        placeholder="A short line about your shop"
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="demoStoreWhatsApp">Business WhatsApp (with country code)</label>
                      <input
                        id="demoStoreWhatsApp"
                        value={storeSettings.whatsapp}
                        onChange={(e) => setStoreSettings({ ...storeSettings, whatsapp: e.target.value })}
                        maxLength={18}
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="demoCity">City / service area</label>
                      <input
                        id="demoCity"
                        value={storeSettings.city}
                        onChange={(e) => setStoreSettings({ ...storeSettings, city: e.target.value })}
                        maxLength={80}
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="demoDelivery">Delivery policy shown to customers</label>
                      <select
                        id="demoDelivery"
                        value={storeSettings.delivery}
                        onChange={(e) => setStoreSettings({ ...storeSettings, delivery: e.target.value })}
                      >
                        {['Local delivery · Hyderabad', 'Selected PIN codes only', 'Across India', 'Pickup only'].map(
                          (x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button className="btn primary" type="submit">
                        Apply & view storefront ↗
                      </button>
                    </div>
                  </form>

                  <div className="demo-row" style={{ marginTop: 18 }}>
                    <span>Store URL preview</span>
                    <b>/{demoSlug(storeSettings.name)}</b>
                  </div>
                  <p className="muted small">Preview only; actual store URL is assigned during setup.</p>
                </div>

                <div className="demo-content">
                  <h3>Customer-facing shop profile</h3>
                  <p className="muted">This is how the configured details could appear on the storefront.</p>
                  <h2>{storeSettings.name}</h2>
                  <p className="muted">
                    {storeSettings.city} · {storeSettings.delivery}
                  </p>
                  <span className="demo-chip">WhatsApp-first ordering</span>
                </div>
              </>
            )}

            {/* TAB: CUSTOMER STOREFRONT PREVIEW */}
            {activeTab === 'preview' && (
              <div className="demo-content">
                <div className="demo-topline">
                  <div>
                    <span className="demo-chip">CUSTOMER VIEW · PREVIEW</span>
                    <h2 style={{ margin: '10px 0 5px' }}>{storeSettings.name}</h2>
                    <p className="muted">{storeSettings.tagline}</p>
                  </div>
                  <span className="demo-chip">WhatsApp-first shop</span>
                </div>

                <div className="demo-row">
                  <span>Store URL preview</span>
                  <b>/{demoSlug(storeSettings.name)}</b>
                </div>
                <p className="muted small">
                  This URL is a preview only. It is not published or reserved until a real store is set up.
                </p>

                <div className="demo-store-hero">
                  <span className="eyebrow">WELCOME TO OUR STORE</span>
                  <h2>{storeSettings.name}</h2>
                  <p>{storeSettings.tagline}</p>
                  <div className="row" style={{ marginTop: 12 }}>
                    <span className="demo-chip">{storeSettings.city}</span>
                    <span className="demo-chip">{storeSettings.delivery}</span>
                  </div>
                </div>

                <div className="demo-topline" style={{ marginTop: 24 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Shop the collection</h3>
                    <small className="muted">{samples.length} sample products · fictional demo catalog</small>
                  </div>
                  <button className="btn outline" onClick={() => setActiveTab('store')}>
                    Customize store
                  </button>
                </div>

                <div className="demo-products">
                  {samples.map((p) => (
                    <article className="demo-product" key={p.id}>
                      <div className="demo-product-art">{p.emoji}</div>
                      <span className="muted" style={{ fontSize: '0.76rem' }}>
                        {p.category}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.desc}</p>
                      <div className="price">{money(p.price)}</div>
                      <button className="btn primary" onClick={() => addToCart(p)}>
                        Add to demo cart
                      </button>
                    </article>
                  ))}
                </div>

                <div className="demo-content" style={{ marginTop: 18 }}>
                  <h3>Order from {storeSettings.name}</h3>
                  <div className="demo-row">
                    <span>Business WhatsApp</span>
                    <b>{storeSettings.whatsapp}</b>
                  </div>
                  <div className="demo-row">
                    <span>Service area</span>
                    <b>
                      {storeSettings.city} · {storeSettings.delivery}
                    </b>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => setActiveTab('checkout')}
                    style={{ marginTop: 14 }}
                  >
                    View cart ({cart.reduce((s, x) => s + x.qty, 0)}) · {money(total())}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: CART & CHECKOUT */}
            {activeTab === 'checkout' && (
              <div className="demo-checkout-grid">
                <div className="demo-content">
                  <h3>Shopping cart</h3>
                  <p className="muted">
                    Add sample products from the catalog to test quantity controls and totals.
                  </p>

                  <div id="demoCartLines">
                    {cart.length > 0 ? (
                      cart.map((x) => (
                        <div className="demo-row" key={x.id}>
                          <div>
                            <b>{x.name}</b>
                            <br />
                            <small>{money(x.price)} each</small>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="demo-qty">
                              <button
                                onClick={() => handleUpdateQty(x.id, -1)}
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <b>{x.qty}</b>
                              <button
                                onClick={() => handleUpdateQty(x.id, 1)}
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            <b>{money(x.price * x.qty)}</b>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">Your demo cart is empty.</div>
                    )}
                  </div>

                  <div className="demo-row" style={{ marginTop: 16 }}>
                    <b>Subtotal</b>
                    <b>{money(total())}</b>
                  </div>
                  <div className="demo-row">
                    <span className="muted">Delivery</span>
                    <span>Calculated by shop (preview)</span>
                  </div>

                  <h2 style={{ textAlign: 'right', margin: '14px 0' }}>{money(total())}</h2>
                  {cart.length > 0 && (
                    <button className="btn outline" onClick={() => setCart([])}>
                      Clear cart
                    </button>
                  )}
                </div>

                <div className="demo-content">
                  <h3>Checkout preview</h3>
                  <p className="muted">
                    Enter example details to preview a customer order. This form does not send WhatsApp messages or
                    create a real order.
                  </p>

                  <form onSubmit={handlePreviewWhatsAppOrder}>
                    <div className="demo-setting">
                      <label htmlFor="demoCustomer">Customer name</label>
                      <input
                        id="demoCustomer"
                        value={checkoutCustomer}
                        onChange={(e) => setCheckoutCustomer(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="demoPhone">Phone number</label>
                      <input
                        id="demoPhone"
                        type="tel"
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value)}
                        placeholder="e.g. 98765 43210"
                        required
                      />
                    </div>
                    <div className="demo-setting">
                      <label htmlFor="demoAddress">Delivery address / notes</label>
                      <textarea
                        id="demoAddress"
                        rows={3}
                        value={checkoutAddress}
                        onChange={(e) => setCheckoutAddress(e.target.value)}
                        placeholder="Enter sample delivery details"
                        required
                      />
                    </div>
                    <button className="btn primary" type="submit" style={{ width: '100%' }}>
                      Preview WhatsApp order
                    </button>
                  </form>

                  <div
                    className={`notice ${isCheckoutOk ? 'ok' : ''}`}
                    style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}
                    role="status"
                  >
                    {checkoutNotice}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};
