/* === js/components/shared/settings.js === */
function renderSettings(el) {
  const u = currentUser;
  const prefs = USER_PREFS[u.id] = USER_PREFS[u.id] || {
    emailNotif: true, smsReminders: true, preProcedure: true,
    postProcedure: true, generalUpdates: false, shopUpdates: true,
    language: 'en', theme: 'light', sessionTimeout: '30',
  };

  // Build recent activity from notifications
  const recentActivity = DB.notifications
    .filter(n => n.userId === u.id)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  el.innerHTML=`
    <div class="page-header"><h2>⚙️ Settings</h2><p>Preferences, security, and account management</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

      <!-- Notification Preferences -->
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">🔔 Notification Preferences</div>
        ${[
          ['emailNotif',    'Email Notifications',   'Receive updates and alerts via email',      prefs.emailNotif],
          ['smsReminders',  'SMS Reminders',          'Session reminders sent by SMS',             prefs.smsReminders],
          ['preProcedure',  'Pre-Procedure Alerts',   '24h and 2h reminders before sessions',      prefs.preProcedure],
          ['postProcedure', 'Post-Procedure Care',    'Post-session care instructions',             prefs.postProcedure],
          ['generalUpdates','General Updates',        'Clinic news and announcements',             prefs.generalUpdates],
          ['shopUpdates',   'Shop & Order Updates',   'Order confirmations and pickup alerts',      prefs.shopUpdates],
        ].map(([key, label, desc, checked]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-weight:600;font-size:0.88rem">${label}</div><div style="font-size:0.75rem;color:var(--text-light)">${desc}</div></div>
          <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;flex-shrink:0">
            <input type="checkbox" ${checked?'checked':''} onchange="togglePref('${key}',this.checked)"
                   style="opacity:0;width:0;height:0;position:absolute">
            <span id="toggle-${key}" style="position:absolute;inset:0;border-radius:12px;background:${checked?'var(--primary)':'#ccc'};transition:0.3s;cursor:pointer"></span>
          </label>
        </div>`).join('')}
      </div>

      <!-- Account Security -->
      <div>
        <div class="card" style="margin-bottom:20px">
          <div class="card-title" style="margin-bottom:16px">🔒 Account Security</div>
          <div class="form-row">
            <label>Session Timeout</label>
            <select id="st-session-timeout" onchange="prefs.sessionTimeout=this.value">
              ${['15','30','60','120'].map(m=>`<option value="${m}" ${prefs.sessionTimeout===m?'selected':''}>${m} minutes</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label>Language</label>
            <select id="st-language" onchange="prefs.language=this.value">
              <option value="en" ${prefs.language==='en'?'selected':''}>English</option>
              <option value="hi" ${prefs.language==='hi'?'selected':''}>हिंदी (Hindi)</option>
              <option value="ml" ${prefs.language==='ml'?'selected':''}>മലയാളം (Malayalam)</option>
            </select>
          </div>

          <div style="background:var(--bg);border-radius:var(--radius-md);padding:14px;margin-top:4px">
            <div style="font-size:0.82rem;color:var(--text-med);margin-bottom:10px"><strong>Account Details</strong></div>
            <div style="font-size:0.82rem;color:var(--text-med);margin-bottom:4px">📧 ${u.email}</div>
            <div style="font-size:0.82rem;color:var(--text-med);margin-bottom:4px">👤 Role: <span style="text-transform:capitalize;font-weight:600">${u.role}</span></div>
            ${u.role==='doctor'?`<div style="font-size:0.82rem;color:var(--text-med)">✅ Status: <span style="color:${u.verificationStatus==='approved'?'var(--success)':'var(--warning)'};font-weight:600">${u.verificationStatus||'Approved'}</span></div>`:''}
            <div style="font-size:0.82rem;color:var(--text-light);margin-top:6px">Member since: Today's session</div>
          </div>

          <div style="display:flex;gap:10px;margin-top:16px">
            <button class="btn btn-green" onclick="showToast('Preferences saved! ✅','success')">💾 Save Preferences</button>
            <button class="btn btn-outline" onclick="showPage('profile')">👤 Edit Profile</button>
          </div>

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
          <div style="font-weight:700;color:var(--danger);margin-bottom:10px;font-size:0.9rem">⚠️ Danger Zone</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-danger" onclick="confirmLogout()">🚪 Sign Out</button>
            <button class="btn btn-outline" style="border-color:var(--danger);color:var(--danger)" onclick="showDeactivateConfirm()">🗑️ Deactivate Account</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity Log -->
    <div class="card" style="margin-top:4px">
      <div class="card-header">
        <span class="card-title">📋 Recent Activity</span>
        <button class="btn btn-sm btn-outline" onclick="clearAllNotifications()">Clear All</button>
      </div>
      ${recentActivity.length ? `
      <div style="max-height:340px;overflow-y:auto">
        ${recentActivity.map(n => {
          const typeIcons = { pre_procedure:'🌿', post_procedure:'💊', general:'📋', system:'⚙️' };
          const priorityColors = { critical:'var(--danger)', high:'var(--warning)', normal:'var(--text-light)' };
          return `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer;align-items:flex-start" onclick="markSingleNotifRead('${n.id}')">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${typeIcons[n.type]||'📢'}</div>
            <div style="flex:1">
              <div style="font-weight:${n.read?'500':'700'};font-size:0.88rem;color:var(--text)">${n.title}</div>
              <div style="font-size:0.78rem;color:var(--text-light);margin-top:2px">${n.message.slice(0,90)}${n.message.length>90?'…':''}</div>
              <div style="font-size:0.72rem;margin-top:4px;color:${priorityColors[n.priority]||'var(--text-light)'}">${n.priority==='critical'?'🚨 Critical · ':n.priority==='high'?'⚡ High · ':''}${relativeTime?.(n.createdAt)||'recently'}</div>
            </div>
            ${!n.read?'<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:6px"></div>':''}
          </div>`;
        }).join('')}
      </div>` : '<div class="empty-state"><span class="empty-state-icon">📋</span><p>No activity yet</p></div>'}
    </div>`;
}

function togglePref(key, val) {
  const u = currentUser;
  USER_PREFS[u.id] = USER_PREFS[u.id] || {};
  USER_PREFS[u.id][key] = val;
  const span = document.getElementById('toggle-' + key);
  if (span) span.style.background = val ? 'var(--primary)' : '#ccc';
}

function markSingleNotifRead(id) {
  const n = DB.notifications.find(n => n.id === id);
  if (n) { n.read = true; buildNav(); }
}

function clearAllNotifications() {
  DB.notifications.filter(n => n.userId === currentUser.id).forEach(n => n.read = true);
  buildNav();
  showToast('All notifications cleared', 'success');
  showPage('settings');
}

function confirmLogout() {
  openModal(`
    <div class="modal-header"><div class="modal-title">Sign Out</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <p style="color:var(--text-med);margin-bottom:20px;font-size:0.9rem">Are you sure you want to sign out of your account?</p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-danger" onclick="closeMod();logout()">Yes, Sign Out</button>
    </div>`);
}

function showDeactivateConfirm() {
  openModal(`
    <div class="modal-header"><div class="modal-title" style="color:var(--danger)">⚠️ Deactivate Account</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="background:#fff5f5;border:1px solid #f48fb1;border-radius:var(--radius-md);padding:14px;margin-bottom:16px;font-size:0.85rem;color:var(--danger)">
      This action will deactivate your account. You will not be able to sign in until an administrator reactivates it.
    </div>
    <div class="form-row"><label>Enter your password to confirm</label><input type="password" id="deactivate-confirm-pw" placeholder="Your current password"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-danger" onclick="doDeactivate()">Deactivate My Account</button>
    </div>`);
}

function doDeactivate() {
  const pw = document.getElementById('deactivate-confirm-pw')?.value;
  if (pw !== currentUser.password) { showToast('Incorrect password','error'); return; }
  closeMod();
  showToast('Account deactivated. Signing you out...','warning');
  setTimeout(() => logout(), 1500);
}

// ═══════════════════════════════════════════════════════════
// HERBAL SHOP — PATIENT SIDE
// ═══════════════════════════════════════════════════════════
let shopCategoryFilter = 'All';
let shopSearchQuery = '';

function getProduct(id) { return DB.products.find(p => p.id === id); }
function getCartItems() { return DB.cart.filter(c => c.userId === currentUser.id); }
function getCartTotal() { return getCartItems().reduce((s,c) => s + (getProduct(c.productId)?.price||0)*c.qty, 0); }
function getCartCount() { return getCartItems().reduce((s,c) => s + c.qty, 0); }

