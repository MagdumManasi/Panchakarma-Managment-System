/* === js/components/doctor/shop.js === */
function renderDoctorShop(el) {
  const myProducts = DB.products.filter(p => p.doctorId === currentUser.id);
  const allOrders = DB.orders.filter(o => o.items.some(i => {const p=getProduct(i.productId);return p&&p.doctorId===currentUser.id;}));
  const pickupOrders = allOrders.filter(o => o.mode === 'pickup' && o.status === 'ready');
  const revenue = allOrders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0);

  el.innerHTML = `
    <div class="page-header"><h2>🏪 Herbal Shop Management</h2><p>Manage your product listings and fulfil patient orders</p></div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">🌿</span><div class="stat-label">My Products</div><div class="stat-value">${myProducts.length}</div></div>
      <div class="stat-card"><span class="stat-icon">📦</span><div class="stat-label">Total Orders</div><div class="stat-value">${allOrders.length}</div></div>
      <div class="stat-card"><span class="stat-icon">🏪</span><div class="stat-label">Pickup Pending</div><div class="stat-value">${pickupOrders.length}</div></div>
      <div class="stat-card"><span class="stat-icon">💰</span><div class="stat-label">Revenue</div><div class="stat-value">₹${(revenue/1000).toFixed(1)}K</div></div>
    </div>

    ${pickupOrders.length ? `
    <div class="card" style="border:2px solid var(--accent);margin-bottom:20px">
      <div class="card-header"><span class="card-title">⚡ Pickup Orders — Action Required</span><span class="badge badge-orange">${pickupOrders.length} pending</span></div>
      ${pickupOrders.map(o => {
        const pt = getUser(o.patientId);
        return `<div style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg);border-radius:var(--radius-md);margin-bottom:10px">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700">${pt?.avatar||'?'}</div>
          <div style="flex:1">
            <div style="font-weight:700">${pt?.name}</div>
            <div style="font-size:0.82rem;color:var(--text-light)">${o.items.length} items · ₹${o.total} · Code: <strong style="color:var(--primary)">${o.pickupCode}</strong></div>
            ${o.pickupDate?`<div style="font-size:0.78rem;color:var(--text-med)">📅 ${formatDate(o.pickupDate)} ${o.pickupTime||''}</div>`:''}
            <div class="order-items-list" style="margin-top:6px">${o.items.map(i=>{const p=getProduct(i.productId);return`<span class="order-item-chip">${p?.emoji} ${p?.name} ×${i.qty}</span>`;}).join('')}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-sm btn-green" onclick="markOrderCollected('${o.id}')">✓ Collected</button>
            <button class="btn btn-sm btn-outline" onclick="notifyPatientPickup('${o.id}')">📨 Notify</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">My Products</span><button class="btn btn-sm btn-green" onclick="openAddProductModal()">+ Add Product</button></div>
        ${myProducts.length ? myProducts.map(p => `
          <div class="product-mgmt-row">
            <div class="product-mgmt-icon">${p.emoji}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.9rem">${p.name}</div>
              <div style="font-size:0.78rem;color:var(--text-light)">${p.category} · ${p.unit} · ₹${p.price}</div>
              <div style="font-size:0.75rem;margin-top:2px">${p.stock>10?`<span style="color:var(--success)">✅ ${p.stock} in stock</span>`:p.stock>0?`<span style="color:var(--warning)">⚠️ ${p.stock} left</span>`:'<span style="color:var(--danger)">❌ Out of stock</span>'}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Del</button>
            </div>
          </div>`) .join('') : '<div class="empty-state"><span class="empty-state-icon">🌿</span><p>No products listed yet</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Orders</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Patient</th><th>Amount</th><th>Mode</th><th>Status</th></tr></thead>
            <tbody>
              ${allOrders.sort((a,b)=>b.placedAt.localeCompare(a.placedAt)).slice(0,8).map(o=>{
                const pt=getUser(o.patientId);
                const statusBadge = {processing:'badge-blue',ready:'badge-orange',delivered:'badge-green',cancelled:'badge-red'};
                return `<tr><td>${pt?.name||'—'}</td><td>₹${o.total}</td><td><span class="order-mode-badge ${o.mode}" style="font-size:0.72rem">${o.mode==='online'?'💳 Online':'🏪 Pickup'}</span></td><td><span class="badge ${statusBadge[o.status]||'badge-gray'}" style="font-size:0.72rem">${o.status}</span></td></tr>`;
              }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-light);padding:20px">No orders yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function openAddProductModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">Add Herbal Product</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row required full"><label>Product Name</label><input type="text" id="np-name" placeholder="e.g. Triphala Churna"></div>
      <div class="form-row required"><label>Category</label><select id="np-cat"><option>Churna</option><option>Capsules</option><option>Oil</option><option>Ghrita</option><option>Tablet</option><option>Kwatha</option><option>Rasayana</option><option>Powder</option><option>Syrup</option></select></div>
      <div class="form-row required"><label>Unit / Pack Size</label><input type="text" id="np-unit" placeholder="e.g. 100g or 60 caps"></div>
      <div class="form-row required"><label>Selling Price (₹)</label><input type="number" id="np-price" placeholder="299"></div>
      <div class="form-row"><label>MRP (₹)</label><input type="number" id="np-mrp" placeholder="350"></div>
      <div class="form-row"><label>Stock Quantity</label><input type="number" id="np-stock" placeholder="20"></div>
      <div class="form-row full"><label>Description</label><textarea id="np-desc" placeholder="Brief description of the product and its benefits..."></textarea></div>
      <div class="form-row full"><label>Tags (comma separated)</label><input type="text" id="np-tags" placeholder="Digestive, Detox, Vata"></div>
      <div class="form-row"><label>Emoji Icon</label><input type="text" id="np-emoji" placeholder="🌿" maxlength="2" value="🌿"></div>
      <div class="form-row" style="display:flex;align-items:center;gap:10px">
        <label><input type="checkbox" id="np-rec"> Mark as Recommended</label>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="addProduct()">Add Product</button></div>`);
}
function addProduct() {
  const name = document.getElementById('np-name').value;
  const price = parseInt(document.getElementById('np-price').value);
  if (!name || !price) { showToast('Name and price required', 'error'); return; }
  DB.products.push({
    id: genId('p'), name, category: document.getElementById('np-cat').value,
    price, mrp: parseInt(document.getElementById('np-mrp').value) || price,
    stock: parseInt(document.getElementById('np-stock').value) || 10,
    unit: document.getElementById('np-unit').value || '—',
    emoji: document.getElementById('np-emoji').value || '🌿',
    description: document.getElementById('np-desc').value || '',
    tags: (document.getElementById('np-tags').value || '').split(',').map(t=>t.trim()).filter(Boolean),
    doctorId: currentUser.id, recommended: document.getElementById('np-rec').checked, isNew: true, dosha: []
  });
  closeMod(); showToast('Product added to shop!', 'success'); showPage('doctor-shop');
}
function editProduct(id) {
  const p = getProduct(id);
  if (!p) return;
  openModal(`
    <div class="modal-header"><div class="modal-title">Edit: ${p.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row full"><label>Name</label><input type="text" id="ep-name" value="${p.name}"></div>
      <div class="form-row"><label>Price (₹)</label><input type="number" id="ep-price" value="${p.price}"></div>
      <div class="form-row"><label>MRP (₹)</label><input type="number" id="ep-mrp" value="${p.mrp}"></div>
      <div class="form-row"><label>Stock</label><input type="number" id="ep-stock" value="${p.stock}"></div>
      <div class="form-row full"><label>Description</label><textarea id="ep-desc">${p.description}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="saveProduct('${id}')">Save</button></div>`);
}
function saveProduct(id) {
  const p = getProduct(id);
  if (!p) return;
  p.name = document.getElementById('ep-name').value || p.name;
  p.price = parseInt(document.getElementById('ep-price').value) || p.price;
  p.mrp = parseInt(document.getElementById('ep-mrp').value) || p.mrp;
  p.stock = parseInt(document.getElementById('ep-stock').value) ?? p.stock;
  p.description = document.getElementById('ep-desc').value || p.description;
  closeMod(); showToast('Product updated!', 'success'); showPage('doctor-shop');
}
function deleteProduct(id) {
  const p = getProduct(id);
  openModal(`<div class="modal-header"><div class="modal-title">Delete Product</div><button class="modal-close" onclick="closeMod()">✕</button></div><p style="color:var(--text-med);margin-bottom:20px">Delete <strong>${p?.name}</strong> from the shop?</p><div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-danger" onclick="doDeleteProduct('${id}')">Delete</button></div>`);
}
function doDeleteProduct(id) {
  const idx = DB.products.findIndex(p => p.id === id);
  if (idx >= 0) DB.products.splice(idx, 1);
  closeMod(); showToast('Product removed', 'warning'); showPage('doctor-shop');
}
function markOrderCollected(orderId) {
  const o = DB.orders.find(o => o.id === orderId);
  if (o) {
    o.status = 'delivered';
    DB.notifications.push({ id: genId('n'), userId: o.patientId, type: 'system', title: '✅ Pickup Completed!', message: `Your herbal remedies have been collected successfully. Thank you! If you have any questions, contact your doctor.`, priority: 'normal', read: false, createdAt: new Date().toISOString() });
    showToast('Order marked as collected. Patient notified!', 'success');
    showPage('doctor-shop');
  }
}
function notifyPatientPickup(orderId) {
  const o = DB.orders.find(o => o.id === orderId);
  if (!o) return;
  DB.notifications.push({ id: genId('n'), userId: o.patientId, type: 'system', title: '📦 Your Order is Ready for Pickup!', message: `Your herbal remedy order (${o.items.length} items) is ready at the clinic pharmacy. Pickup code: ${o.pickupCode}. Please collect at your convenience.`, priority: 'high', read: false, createdAt: new Date().toISOString() });
  showToast('Patient notified for pickup!', 'success');
}

// ═══════════════════════════════════════════════════════════
// ADMIN — SHOP MANAGEMENT
// ═══════════════════════════════════════════════════════════
function renderAdminShop(el) {
  const totalRev = DB.orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0);
  const pendingPickups = DB.orders.filter(o=>o.mode==='pickup'&&o.status==='ready');
  const filterStatus = window._adminShopFilter || 'all';
  const orders = filterStatus === 'all' ? DB.orders : DB.orders.filter(o => o.status === filterStatus || o.mode === filterStatus);

  el.innerHTML = `
    <div class="page-header"><h2>🏪 Shop Administration</h2><p>Manage all herbal products and orders system-wide</p></div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">🌿</span><div class="stat-label">Total Products</div><div class="stat-value">${DB.products.length}</div></div>
      <div class="stat-card"><span class="stat-icon">📦</span><div class="stat-label">All Orders</div><div class="stat-value">${DB.orders.length}</div></div>
      <div class="stat-card"><span class="stat-icon">🏪</span><div class="stat-label">Pickup Pending</div><div class="stat-value">${pendingPickups.length}</div></div>
      <div class="stat-card"><span class="stat-icon">💰</span><div class="stat-label">Shop Revenue</div><div class="stat-value">₹${(totalRev/1000).toFixed(1)}K</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">All Products</span><button class="btn btn-sm btn-green" onclick="openAdminAddProductModal()">+ Add</button></div>
        <div style="max-height:360px;overflow-y:auto">
          ${DB.products.map(p => {
            const dr = getUser(p.doctorId);
            return `<div class="product-mgmt-row">
              <div class="product-mgmt-icon">${p.emoji}</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:0.88rem">${p.name}</div>
                <div style="font-size:0.75rem;color:var(--text-light)">${dr?.name||'—'} · ₹${p.price} · ${p.stock} left</div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">✕</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">⚡ Pending Pickups</span><span class="badge badge-orange">${pendingPickups.length}</span></div>
        ${pendingPickups.length ? pendingPickups.map(o => {
          const pt=getUser(o.patientId);
          return `<div style="padding:12px;background:var(--bg);border-radius:var(--radius-md);margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong>${pt?.name}</strong><span style="font-size:0.82rem;font-weight:700;color:var(--primary)">${o.pickupCode}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-light)">${o.items.length} items · ₹${o.total}${o.pickupDate?` · ${formatDate(o.pickupDate)}`:''}</div>
            <div class="order-items-list" style="margin-top:6px">${o.items.map(i=>{const p=getProduct(i.productId);return`<span class="order-item-chip" style="font-size:0.72rem">${p?.emoji} ${p?.name} ×${i.qty}</span>`;}).join('')}</div>
            <button class="btn btn-sm btn-green" style="margin-top:8px" onclick="markOrderCollected('${o.id}');showPage('admin-shop')">✓ Mark Collected</button>
          </div>`;
        }).join('') : '<div class="empty-state" style="padding:20px"><p>No pending pickups</p></div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">All Orders</span>
        <div class="section-tabs" style="margin-bottom:0">
          ${[['all','All'],['processing','Processing'],['ready','Pickup Ready'],['delivered','Delivered'],['online','Online'],['pickup','Pickup']].map(([v,l])=>
            `<button class="section-tab ${filterStatus===v?'active':''}" onclick="window._adminShopFilter='${v}';showPage('admin-shop')">${l}</button>`
          ).join('')}
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Order ID</th><th>Patient</th><th>Items</th><th>Total</th><th>Mode</th><th>Pickup Code</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${orders.sort((a,b)=>b.placedAt.localeCompare(a.placedAt)).map(o=>{
              const pt=getUser(o.patientId);
              const statusBadge={processing:'badge-blue',ready:'badge-orange',shipped:'badge-info',delivered:'badge-green',cancelled:'badge-red'};
              return `<tr>
                <td><strong>#${o.id.replace('ord','').toUpperCase()}</strong><br><small style="color:var(--text-light)">${formatDate(o.placedAt)}</small></td>
                <td>${pt?.name||'—'}</td>
                <td>${o.items.map(i=>{const p=getProduct(i.productId);return`${p?.emoji||'📦'}×${i.qty}`;}).join(' ')}</td>
                <td><strong>₹${o.total}</strong></td>
                <td><span class="order-mode-badge ${o.mode}" style="font-size:0.72rem">${o.mode==='online'?'💳 Online':'🏪 Pickup'}</span></td>
                <td>${o.pickupCode?`<strong style="color:var(--primary)">${o.pickupCode}</strong>`:'—'}</td>
                <td><span class="badge ${statusBadge[o.status]||'badge-gray'}">${o.status}</span></td>
                <td style="white-space:nowrap">
                  ${o.status==='processing'?`<button class="btn btn-sm btn-info" onclick="adminUpdateOrder('${o.id}','shipped');showPage('admin-shop')">Ship</button> `:''}
                  ${o.status==='ready'?`<button class="btn btn-sm btn-green" onclick="markOrderCollected('${o.id}');showPage('admin-shop')">Collected</button> `:''}
                  ${!['delivered','cancelled'].includes(o.status)?`<button class="btn btn-sm btn-danger" onclick="adminUpdateOrder('${o.id}','cancelled');showPage('admin-shop')">Cancel</button>`:''}
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:24px">No orders</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}
function openAdminAddProductModal() { openAddProductModal(); }
function adminUpdateOrder(orderId, newStatus) {
  const o = DB.orders.find(o => o.id === orderId);
  if (!o) return;
  o.status = newStatus;
  if (newStatus === 'shipped') {
    DB.notifications.push({ id: genId('n'), userId: o.patientId, type: 'system', title: '🚚 Your Order Has Been Shipped!', message: `Your herbal remedy order is on its way! Expected delivery in 1-2 days.`, priority: 'normal', read: false, createdAt: new Date().toISOString() });
  }
  showToast(`Order ${newStatus}`, newStatus === 'cancelled' ? 'warning' : 'success');
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ANNOUNCEMENTS — Admin broadcasts to all users
// ═══════════════════════════════════════════════════════════
