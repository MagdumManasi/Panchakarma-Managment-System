/* === js/components/patient/shop.js === */
function renderPatientShop(el) {
  const myOrders = DB.orders.filter(o => o.patientId === currentUser.id);
  const myCart = getCartItems();
  const recommended = DB.products.filter(p => {
    const myPrescriptions = DB.prescriptions.filter(pr => pr.patientId === currentUser.id);
    const prescribedNames = myPrescriptions.flatMap(pr => pr.medicines.map(m => m.name.toLowerCase()));
    return prescribedNames.some(n => p.name.toLowerCase().includes(n.split(' ')[0]));
  });
  const categories = ['All', ...new Set(DB.products.map(p => p.category))];
  const filtered = DB.products.filter(p => {
    const catOk = shopCategoryFilter === 'All' || p.category === shopCategoryFilter;
    const searchOk = !shopSearchQuery || p.name.toLowerCase().includes(shopSearchQuery.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(shopSearchQuery.toLowerCase()));
    return catOk && searchOk;
  });

  el.innerHTML = `
    <div class="shop-hero">
      <div>
        <div class="shop-hero-title">🌿 Ayurvedic Herbal Shop</div>
        <div class="shop-hero-sub">Doctor-recommended remedies, herbs & wellness products</div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn" style="background:white;color:var(--primary);font-weight:700;padding:10px 20px" onclick="showPage('patient-orders')">📦 My Orders (${myOrders.length})</button>
          ${myCart.length ? `<button class="btn" style="background:var(--accent);color:white;font-weight:700;padding:10px 20px" onclick="openCartModal()">🛒 Cart (${getCartCount()}) — ₹${getCartTotal().toLocaleString()}</button>` : ''}
        </div>
      </div>
      <div class="shop-hero-stats">
        <div class="shop-hero-stat"><div class="shop-hero-stat-val">${DB.products.length}</div><div class="shop-hero-stat-lbl">Products</div></div>
        <div class="shop-hero-stat"><div class="shop-hero-stat-val">${myOrders.filter(o=>o.status==='delivered').length}</div><div class="shop-hero-stat-lbl">Delivered</div></div>
        <div class="shop-hero-stat"><div class="shop-hero-stat-val">Free</div><div class="shop-hero-stat-lbl">Pickup Option</div></div>
      </div>
    </div>

    ${recommended.length ? `
    <div class="card" style="margin-bottom:20px;border:2px solid var(--primary)">
      <div class="card-header">
        <span class="card-title">⭐ Recommended for You</span>
        <span class="badge badge-green">Based on your prescription</span>
      </div>
      <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:4px">
        ${recommended.map(p => `
          <div style="min-width:180px;background:var(--bg);border-radius:var(--radius-md);padding:14px;flex-shrink:0;border:1px solid var(--border)">
            <div style="font-size:2.2rem;margin-bottom:6px">${p.emoji}</div>
            <div style="font-weight:700;font-size:0.88rem">${p.name}</div>
            <div style="font-size:0.75rem;color:var(--text-light);margin:3px 0 8px">${p.unit}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:var(--font-serif);font-weight:700;color:var(--primary)">₹${p.price}</span>
              <button class="add-cart-btn ${isInCart(p.id)?'in-cart':''}" onclick="addToCart('${p.id}')">${isInCart(p.id)?'✓ Added':'+ Cart'}</button>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="shop-filters">
      <input class="shop-search" type="text" placeholder="🔍 Search herbs, remedies..." value="${shopSearchQuery}" oninput="shopSearch(this.value)">
      ${categories.map(c => `<button class="filter-btn ${shopCategoryFilter===c?'active':''}" onclick="setShopCat('${c}')">${c}</button>`).join('')}
    </div>

    <div class="product-grid" id="product-grid">
      ${filtered.map(p => productCardHTML(p)).join('')}
    </div>

    ${myCart.length ? `
    <div class="cart-bar" id="cart-bar">
      <span>🛒</span>
      <span class="cart-bar-count">${getCartCount()} items</span>
      <span class="cart-bar-total">₹${getCartTotal().toLocaleString()}</span>
      <button class="cart-bar-btn" onclick="openCartModal()">View Cart →</button>
    </div>` : ''}`;
}

function productCardHTML(p) {
  const inCart = isInCart(p.id);
  const discountPct = Math.round((1 - p.price/p.mrp)*100);
  const dr = getUser(p.doctorId);
  return `<div class="product-card">
    <div class="product-img" style="background:linear-gradient(135deg,${p.price>500?'#f0ead8':'#e8f5e9'},${p.price>500?'#fff8f0':'#f1f8e9'})">
      <span style="font-size:3.5rem">${p.emoji}</span>
      ${p.isNew ? '<span class="product-badge-corner new">NEW</span>' : ''}
      ${p.recommended && !p.isNew ? '<span class="product-badge-corner rec">⭐ Rec</span>' : ''}
      ${discountPct >= 10 && !p.isNew ? `<span class="product-badge-corner">${discountPct}% OFF</span>` : ''}
    </div>
    <div class="product-body">
      <div class="product-name">${p.name}</div>
      <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:5px">By ${dr?.name||'Clinic'} · ${p.unit}</div>
      <div class="product-desc">${p.description}</div>
      <div class="product-tags">${p.tags.map(t=>`<span class="product-tag">${t}</span>`).join('')}</div>
    </div>
    <div class="product-footer">
      <div>
        <div><span class="product-price">₹${p.price}</span> <span class="product-price-orig">₹${p.mrp}</span></div>
        <div class="product-stock">${p.stock > 10 ? `✅ In Stock (${p.stock})` : p.stock > 0 ? `⚠️ Only ${p.stock} left` : '❌ Out of stock'}</div>
      </div>
      ${p.stock > 0 ? `<button class="add-cart-btn ${inCart?'in-cart':''}" onclick="addToCart('${p.id}')">${inCart ? '✓ Added' : '+ Cart'}</button>` : '<span style="font-size:0.78rem;color:var(--danger);font-weight:600">Out of Stock</span>'}
    </div>
  </div>`;
}

function isInCart(productId) {
  return DB.cart.some(c => c.userId === currentUser.id && c.productId === productId);
}
function addToCart(productId) {
  const existing = DB.cart.find(c => c.userId === currentUser.id && c.productId === productId);
  if (existing) { existing.qty++; }
  else { DB.cart.push({ userId: currentUser.id, productId, qty: 1 }); }
  const p = getProduct(productId);
  showToast(`${p?.name} added to cart 🛒`, 'success');
  buildNav();
  showPage('patient-shop');
}
function removeFromCart(productId) {
  const idx = DB.cart.findIndex(c => c.userId === currentUser.id && c.productId === productId);
  if (idx >= 0) DB.cart.splice(idx, 1);
}
function updateCartQty(productId, delta) {
  const item = DB.cart.find(c => c.userId === currentUser.id && c.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(productId);
  openCartModal(); // refresh modal
}
function setShopCat(cat) { shopCategoryFilter = cat; showPage('patient-shop'); }
function shopSearch(q) { shopSearchQuery = q; const pg=document.getElementById('product-grid'); if(pg) pg.innerHTML = DB.products.filter(p=>{const catOk=shopCategoryFilter==='All'||p.category===shopCategoryFilter;const sOk=!q||p.name.toLowerCase().includes(q.toLowerCase())||p.tags.some(t=>t.toLowerCase().includes(q.toLowerCase()));return catOk&&sOk;}).map(p=>productCardHTML(p)).join('') || '<div class="empty-state"><span class="empty-state-icon">🔍</span><p>No products found</p></div>'; }

function openCartModal() {
  const cartItems = getCartItems();
  if (!cartItems.length) { showToast('Your cart is empty', 'warning'); return; }
  const subtotal = getCartTotal();
  const shipping = 80;
  const total = subtotal + shipping;

  openModal(`
    <div class="modal-header"><div class="modal-title">🛒 Your Cart</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div id="cart-items-list">
      ${cartItems.map(c => {
        const p = getProduct(c.productId);
        return `<div class="cart-item">
          <div class="cart-item-img">${p?.emoji||'📦'}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${p?.name}</div>
            <div class="cart-item-meta">${p?.unit} · ₹${p?.price} each</div>
          </div>
          <div class="qty-ctrl">
            <button class="qty-btn" onclick="updateCartQty('${c.productId}',-1)">−</button>
            <span class="qty-val">${c.qty}</span>
            <button class="qty-btn" onclick="updateCartQty('${c.productId}',1)">+</button>
          </div>
          <div style="min-width:70px;text-align:right">
            <div style="font-weight:700;color:var(--primary)">₹${(p?.price||0)*c.qty}</div>
            <button onclick="removeFromCart('${c.productId}');openCartModal()" style="font-size:0.72rem;color:var(--danger);background:none;border:none;cursor:pointer;margin-top:2px">Remove</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:16px;background:var(--bg);border-radius:var(--radius-md);margin-top:12px">
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:6px"><span style="color:var(--text-med)">Subtotal</span><span>₹${subtotal.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:10px"><span style="color:var(--text-med)">Delivery</span><span>₹${shipping} <span style="font-size:0.72rem;color:var(--success)">(Free for Pickup)</span></span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1rem"><span>Total</span><span style="color:var(--primary)">₹${total.toLocaleString()}</span></div>
    </div>
    <div class="modal-footer" style="flex-direction:column;gap:10px">
      <button class="btn btn-green" style="width:100%;padding:13px;font-size:1rem" onclick="closeMod();openCheckoutModal('online')">💳 Pay Online — ₹${total.toLocaleString()}</button>
      <button class="btn btn-accent" style="width:100%;padding:13px;font-size:1rem" onclick="closeMod();openCheckoutModal('pickup')">🏪 Schedule Pickup — ₹${subtotal.toLocaleString()} (Free Pickup)</button>
      <div style="text-align:center;font-size:0.78rem;color:var(--text-light)">Pickup: Collect from clinic counter. Show your pickup code.</div>
    </div>`);
}

function openCheckoutModal(mode) {
  const cartItems = getCartItems();
  const subtotal = getCartTotal();
  const total = mode === 'online' ? subtotal + 80 : subtotal;

  openModal(`
    <div class="modal-header"><div class="modal-title">${mode==='online'?'💳 Online Payment':'🏪 Schedule Pickup'}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:14px;margin-bottom:20px">
      <div style="font-size:0.85rem;color:var(--text-med);margin-bottom:8px">Order Summary (${cartItems.length} items)</div>
      ${cartItems.map(c=>{const p=getProduct(c.productId);return`<div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px"><span>${p?.emoji} ${p?.name} ×${c.qty}</span><span>₹${(p?.price||0)*c.qty}</span></div>`;}).join('')}
      <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;font-weight:700;display:flex;justify-content:space-between">
        <span>Total Payable</span><span style="color:var(--primary)">₹${total.toLocaleString()}</span>
      </div>
    </div>
    ${mode === 'online' ? `
      <div class="form-grid">
        <div class="form-row full required"><label>Delivery Address</label><textarea id="ck-addr" rows="2" placeholder="Full delivery address...">${currentUser.address||''}</textarea></div>
        <div class="form-row required"><label>Card Number</label><input type="text" id="ck-card" placeholder="4242 4242 4242 4242" maxlength="19"></div>
        <div class="form-row required"><label>Expiry</label><input type="text" id="ck-exp" placeholder="MM/YY" maxlength="5"></div>
        <div class="form-row required"><label>CVV</label><input type="text" id="ck-cvv" placeholder="123" maxlength="3"></div>
        <div class="form-row"><label>Card Holder Name</label><input type="text" id="ck-name" placeholder="${currentUser.name}" value="${currentUser.name}"></div>
      </div>
      <div style="display:flex;gap:8px;margin:8px 0 16px;flex-wrap:wrap">
        ${['💳 Visa/MC','📱 UPI','🏦 Net Banking','💰 Wallets'].map(m=>`<button class="btn btn-outline btn-sm">${m}</button>`).join('')}
      </div>` : `
      <div class="pickup-code-box" style="margin-bottom:20px">
        <div style="font-size:0.82rem;color:var(--text-light);margin-bottom:8px">Your Pickup Code will be generated on order:</div>
        <div class="pickup-code">PKP-????</div>
        <div class="pickup-code-label">Show this code at the pharmacy counter</div>
      </div>
      <div class="pickup-steps">
        <div class="pickup-step"><span class="pickup-step-icon">📲</span><div class="pickup-step-text">Order Placed</div></div>
        <div class="pickup-step"><span class="pickup-step-icon">⚗️</span><div class="pickup-step-text">Prepared</div></div>
        <div class="pickup-step"><span class="pickup-step-icon">📍</span><div class="pickup-step-text">Visit Clinic</div></div>
        <div class="pickup-step"><span class="pickup-step-icon">✅</span><div class="pickup-step-text">Collect</div></div>
      </div>
      <div style="background:#e8f5e9;border-radius:var(--radius-md);padding:12px;margin-top:16px;font-size:0.85rem;color:var(--primary)">
        <strong>💡 How Pickup Works:</strong> After placing the order, the clinic pharmacist is notified and prepares your remedies. Visit the pharmacy counter, show your pickup code, and collect everything ready — no waiting!
      </div>
      <div class="form-row" style="margin-top:16px"><label>Preferred Pickup Date</label><input type="date" id="ck-pickup-date" value="${getDateStr(1)}" min="${getDateStr(0)}"></div>
      <div class="form-row"><label>Preferred Pickup Time</label><select id="ck-pickup-time"><option>09:00 AM – 10:00 AM</option><option>10:00 AM – 11:00 AM</option><option>11:00 AM – 12:00 PM</option><option>02:00 PM – 03:00 PM</option><option>03:00 PM – 04:00 PM</option><option>04:00 PM – 05:00 PM</option></select></div>`}
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod();openCartModal()">← Back to Cart</button>
      <button class="btn btn-green" style="padding:12px 28px" onclick="placeOrder('${mode}')">${mode==='online'?'Pay Now ₹'+total.toLocaleString():'Confirm Pickup Order'}</button>
    </div>`);
}

function placeOrder(mode) {
  const cartItems = getCartItems();
  if (!cartItems.length) return;
  if (mode === 'online') {
    const card = document.getElementById('ck-card')?.value;
    const addr = document.getElementById('ck-addr')?.value;
    if (!addr) { showToast('Please enter delivery address', 'error'); return; }
    if (!card || card.replace(/\s/g,'').length < 12) { showToast('Please enter valid card details', 'error'); return; }
  }
  const subtotal = getCartTotal();
  const total = mode === 'online' ? subtotal + 80 : subtotal;
  const pickupCode = mode === 'pickup' ? 'PKP-' + Math.floor(1000 + Math.random()*9000) : null;
  const pickupDate = mode === 'pickup' ? document.getElementById('ck-pickup-date')?.value : null;
  const pickupTime = mode === 'pickup' ? document.getElementById('ck-pickup-time')?.value : null;

  const order = {
    id: genId('ord'),
    patientId: currentUser.id,
    items: cartItems.map(c => ({ productId: c.productId, qty: c.qty })),
    mode, status: mode === 'online' ? 'processing' : 'ready',
    total,
    address: mode === 'online' ? document.getElementById('ck-addr')?.value : null,
    placedAt: getDateStr(0),
    pickupCode,
    pickupDate,
    pickupTime,
    estimatedDelivery: mode === 'online' ? getDateStr(3) : null
  };
  DB.orders.push(order);

  // Reduce stock
  cartItems.forEach(c => { const p = getProduct(c.productId); if(p) p.stock = Math.max(0, p.stock - c.qty); });
  // Clear cart
  DB.cart = DB.cart.filter(c => c.userId !== currentUser.id);
  // Notification to patient
  DB.notifications.push({ id: genId('n'), userId: currentUser.id, type: 'system', title: mode==='online' ? '✅ Order Placed! Delivery in 2-3 days' : `✅ Pickup Order Ready! Code: ${pickupCode}`, message: mode==='online' ? `Your order of ${cartItems.length} item(s) worth ₹${total} is confirmed. Estimated delivery: ${formatDate(getDateStr(3))}` : `Your order is ready for pickup! Visit the clinic pharmacy with code <strong>${pickupCode}</strong> on ${formatDate(pickupDate)} during ${pickupTime}.`, priority: 'high', read: false, createdAt: new Date().toISOString() });
  buildNav();
  closeMod();

  if (mode === 'pickup') {
    openModal(`
      <div class="modal-header"><div class="modal-title">🎉 Pickup Order Confirmed!</div><button class="modal-close" onclick="closeMod()">✕</button></div>
      <div class="pickup-code-box">
        <div class="pickup-code">${pickupCode}</div>
        <div class="pickup-code-label">Your Pickup Code — Show at pharmacy counter</div>
      </div>
      <div style="text-align:center;margin:16px 0">
        <div style="font-size:0.9rem;color:var(--text-med)">📅 Pickup Date: <strong>${formatDate(pickupDate)}</strong></div>
        <div style="font-size:0.9rem;color:var(--text-med);margin-top:4px">⏰ Time: <strong>${pickupTime}</strong></div>
      </div>
      <div class="pickup-steps">
        <div class="pickup-step"><span class="pickup-step-icon">✅</span><div class="pickup-step-text">Ordered</div></div>
        <div class="pickup-step"><span class="pickup-step-icon">⚗️</span><div class="pickup-step-text">Preparing</div></div>
        <div class="pickup-step"><span class="pickup-step-icon">📍</span><div class="pickup-step-text">Visit Clinic</div></div>
        <div class="pickup-step"><span class="pickup-step-icon">🎁</span><div class="pickup-step-text">Collect</div></div>
      </div>
      <div style="background:#e8f5e9;border-radius:var(--radius-md);padding:14px;margin-top:16px;font-size:0.85rem;color:var(--primary-mid)">
        <strong>What happens next:</strong> Our pharmacist has been notified and will prepare all your Ayurvedic remedies before your pickup time. Everything will be packed & labelled. Just walk in and collect!
      </div>
      <div class="modal-footer"><button class="btn btn-green" onclick="closeMod();showPage('patient-orders')">View My Orders</button></div>`);
  } else {
    showToast('Order placed! Delivery in 2-3 days 🎉', 'success');
    showPage('patient-orders');
  }
}

// ═══════════════════════════════════════════════════════════
// PATIENT — MY ORDERS
// ═══════════════════════════════════════════════════════════
function renderPatientOrders(el) {
  const myOrders = DB.orders.filter(o => o.patientId === currentUser.id).sort((a,b) => b.placedAt.localeCompare(a.placedAt));
  const statusConfig = {
    processing: { label:'Processing', badge:'badge-blue', icon:'⏳' },
    ready: { label:'Ready for Pickup', badge:'badge-orange', icon:'📦' },
    shipped: { label:'Shipped', badge:'badge-info', icon:'🚚' },
    delivered: { label:'Delivered', badge:'badge-green', icon:'✅' },
    cancelled: { label:'Cancelled', badge:'badge-red', icon:'❌' }
  };

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><h2>📦 My Orders</h2><p>Track your herbal remedy orders</p></div>
        <button class="btn btn-green" onclick="showPage('patient-shop')">🛒 Continue Shopping</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">📦</span><div class="stat-label">Total Orders</div><div class="stat-value">${myOrders.length}</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-label">Delivered</div><div class="stat-value">${myOrders.filter(o=>o.status==='delivered').length}</div></div>
      <div class="stat-card"><span class="stat-icon">⏳</span><div class="stat-label">In Progress</div><div class="stat-value">${myOrders.filter(o=>['processing','ready','shipped'].includes(o.status)).length}</div></div>
      <div class="stat-card"><span class="stat-icon">💰</span><div class="stat-label">Total Spent</div><div class="stat-value">₹${myOrders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0).toLocaleString()}</div></div>
    </div>
    ${myOrders.length ? myOrders.map(o => {
      const cfg = statusConfig[o.status] || { label: o.status, badge:'badge-gray', icon:'📦' };
      return `<div class="order-card ${o.mode} ${o.status}">
        <div class="order-header">
          <div>
            <div class="order-id">Order #${o.id.replace('ord','').toUpperCase()}</div>
            <div class="order-date">Placed: ${formatDate(o.placedAt)}</div>
          </div>
          <div style="text-align:right">
            <span class="badge ${cfg.badge}">${cfg.icon} ${cfg.label}</span>
            <div style="font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:var(--primary);margin-top:4px">₹${o.total.toLocaleString()}</div>
          </div>
        </div>
        <div class="order-items-list">
          ${o.items.map(i => { const p=getProduct(i.productId); return `<span class="order-item-chip">${p?.emoji||'📦'} ${p?.name||'?'} ×${i.qty}</span>`; }).join('')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span class="order-mode-badge ${o.mode}">${o.mode==='online'?'💳 Online Delivery':'🏪 Clinic Pickup'}</span>
          ${o.mode==='online'&&o.estimatedDelivery&&o.status!=='delivered'?`<span style="font-size:0.82rem;color:var(--text-med)">📅 Est. delivery: ${formatDate(o.estimatedDelivery)}</span>`:''}
          ${o.mode==='online'&&o.status==='delivered'?`<span style="font-size:0.82rem;color:var(--success)">✅ Delivered</span>`:''}
          ${o.mode==='pickup'&&o.status==='delivered'?`<span style="font-size:0.82rem;color:var(--success)">✅ Collected</span>`:''}
        </div>
        ${o.pickupCode ? `
        <div class="pickup-code-box" style="margin-top:12px">
          <div class="pickup-code">${o.pickupCode}</div>
          <div class="pickup-code-label">Pickup Code${o.pickupDate?` · Visit: ${formatDate(o.pickupDate)}, ${o.pickupTime||''}`:''}</div>
        </div>` : ''}
      </div>`;
    }).join('') : '<div class="empty-state"><span class="empty-state-icon">📦</span><p>No orders yet. Visit the Herbal Shop!</p><button class="btn btn-green" onclick="showPage(\'patient-shop\')" style="margin-top:12px">🛒 Shop Now</button></div>'}`;
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — SHOP MANAGEMENT
// ═══════════════════════════════════════════════════════════
