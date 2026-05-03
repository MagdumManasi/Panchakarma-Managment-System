/* === Shared: Bottom Navigation (Mobile) === */

function buildBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav || !currentUser) return;

  const navItems = NAV[currentUser.role] || [];
  const unreadCount = DB.notifications.filter(n => n.userId === currentUser.id && !n.read).length;
  const pendingDoctors = currentUser.role === 'admin'
    ? DB.users.filter(u => u.role === 'doctor' && u.verificationStatus === 'pending').length : 0;

  nav.innerHTML = '<div class="bottom-nav-items">' +
    navItems.map(item => {
      const isActive = currentPage === item.id;
      let badgeCount = 0;
      if (item.badge) {
        if (item.id.includes('notification')) badgeCount = unreadCount;
        if (item.id === 'admin-users') badgeCount = pendingDoctors;
      }
      return `<button class="bottom-nav-item ${isActive ? 'active' : ''}" onclick="showPage('${item.id}')">
        ${badgeCount > 0 ? `<span class="bottom-nav-badge">${badgeCount}</span>` : ''}
        <span class="bn-icon">${item.icon}</span>
        <span class="bn-label">${item.label}</span>
      </button>`;
    }).join('') +
  '</div>';
}
