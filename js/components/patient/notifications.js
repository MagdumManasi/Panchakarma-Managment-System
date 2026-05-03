/* === js/components/patient/notifications.js === */
function renderPatientNotifications(el) {
  const myNotifs = DB.notifications.filter(n => n.userId === currentUser.id);
  const filtered = notifFilter === 'all' ? myNotifs : myNotifs.filter(n => n.type === notifFilter);
  const unread = myNotifs.filter(n => !n.read).length;

  el.innerHTML = `
    <div class="page-header"><h2>🔔 Notifications</h2><p>${unread} unread notifications</p></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="notif-filters">
        ${[['all','All'],['pre_procedure','Pre-Procedure'],['post_procedure','Post-Procedure'],['general','General'],['system','System']].map(([v,l])=>
          `<button class="filter-btn ${notifFilter===v?'active':''}" onclick="setNotifFilter('${v}')">${l}</button>`
        ).join('')}
      </div>
      <button class="btn btn-sm btn-outline" onclick="markAllNotifRead()">Mark All Read</button>
    </div>
    <div id="notif-list">
      ${filtered.length ? filtered.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).map(n => notifItemHTML(n, true)).join('') : '<div class="empty-state"><span class="empty-state-icon">🔔</span><p>No notifications here</p></div>'}
    </div>`;
}

function notifItemHTML(n, clickable=false) {
  const typeConfig = {
    pre_procedure: { icon: '⚠️', color: '#FF9800', bg: '#FFF3E0' },
    post_procedure: { icon: '✅', color: '#4CAF50', bg: '#E8F5E9' },
    general: { icon: 'ℹ️', color: '#2196F3', bg: '#E3F2FD' },
    system: { icon: '⚙️', color: '#9C27B0', bg: '#F3E5F5' }
  };
  const cfg = typeConfig[n.type] || { icon: '🔔', color: '#888', bg: '#f5f5f5' };
  return `<div class="notif-item ${n.read?'':'unread'} ${n.priority==='critical'?'critical':''}" ${clickable?`onclick="markNotifRead('${n.id}')"`:''}">
    <div class="notif-icon" style="background:${cfg.bg};color:${cfg.color}">${cfg.icon}</div>
    <div class="notif-body">
      <div class="notif-title">${n.title}</div>
      <div class="notif-msg">${n.message}</div>
      <div class="notif-meta">
        <span class="badge ${n.type==='pre_procedure'?'badge-orange':n.type==='post_procedure'?'badge-green':n.type==='system'?'badge-blue':'badge-blue'}">${n.type.replace('_',' ')}</span>
        <span class="notif-time">${relativeTime(n.createdAt)}</span>
        ${n.priority==='critical'?'<span class="badge badge-red">⚡ Critical</span>':''}
        ${n.priority==='high'?'<span class="badge badge-orange">High Priority</span>':''}
      </div>
    </div>
    ${!n.read?'<div class="unread-dot"></div>':'<span style="color:var(--success);font-size:1.1rem">✓</span>'}
  </div>`;
}
function setNotifFilter(f) { notifFilter = f; showPage('patient-notifications'); }
function markNotifRead(id) {
  const n = DB.notifications.find(n=>n.id===id);
  if (n) { n.read = true; buildNav(); showPage('patient-notifications'); }
}
function markAllNotifRead() {
  DB.notifications.filter(n=>n.userId===currentUser.id).forEach(n=>n.read=true);
  buildNav(); showToast('All notifications marked as read'); showPage('patient-notifications');
}

// ═══════════════════════════════════════════════════════════
// PATIENT — FEEDBACK
// ═══════════════════════════════════════════════════════════
let selectedRating = 0;
