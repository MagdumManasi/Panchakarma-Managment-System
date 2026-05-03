/* === Shared: Header & Desktop Nav === */
function buildNav() {
  const navDef = {
    patient: [
      { id: 'patient-dashboard',     label: 'Dashboard',     icon: '🏠' },
      { id: 'patient-schedule',      label: 'Schedule',      icon: '📅' },
      { id: 'patient-progress',      label: 'Progress',      icon: '📈' },
      { id: 'patient-notifications', label: 'Notifications', icon: '🔔', badge: true },
      { id: 'patient-feedback',      label: 'Feedback',      icon: '⭐' },
      { id: 'patient-shop',          label: 'Herbal Shop',   icon: '🛒', cartBadge: true },
      { id: 'announcements',         label: 'News',          icon: '📢' },
    ],
    doctor: [
      { id: 'doctor-dashboard',  label: 'Dashboard',  icon: '🏠' },
      { id: 'doctor-patients',   label: 'Patients',   icon: '👥' },
      { id: 'doctor-schedule',   label: 'Schedule',   icon: '📅' },
      { id: 'doctor-treatments', label: 'Treatments', icon: '🌿' },
      { id: 'doctor-shop',       label: 'Herbal Shop',icon: '🏪' },
      { id: 'doctor-reports',    label: 'Reports',    icon: '📊' },
      { id: 'announcements',     label: 'News',       icon: '📢' },
    ],
    admin: [
      { id: 'admin-dashboard',    label: 'Dashboard',    icon: '🏠' },
      { id: 'admin-users',        label: 'Users',        icon: '👥' },
      { id: 'admin-verify',       label: 'Verify Docs',  icon: '🩺', verifyBadge: true },
      { id: 'admin-therapies',    label: 'Therapies',    icon: '🌿' },
      { id: 'admin-appointments', label: 'Appointments', icon: '📅' },
      { id: 'admin-shop',         label: 'Shop Mgmt',    icon: '🏪' },
      { id: 'admin-reports',      label: 'Reports',      icon: '📊' },
      { id: 'announcements',      label: 'Announce',     icon: '📢' },
    ]
  };
  const nav = document.getElementById('main-nav');
  const items = navDef[currentUser.role] || [];
  nav.innerHTML = items.map(item => {
    const unread      = item.badge       ? DB.notifications.filter(n => n.userId === currentUser.id && !n.read).length : 0;
    const cartCount   = item.cartBadge   ? DB.cart.filter(c => c.userId === currentUser.id).reduce((s,c)=>s+c.qty,0) : 0;
    const verifyCount = item.verifyBadge ? DB.users.filter(u => u.role==='doctor' && u.verificationStatus==='pending').length : 0;
    const badgeVal    = unread || cartCount || verifyCount;
    return `<button class="nav-btn" onclick="showPage('${item.id}')" id="nav-${item.id}">
      ${item.icon} ${item.label}
      ${badgeVal > 0 ? `<span class="notif-badge">${badgeVal}</span>` : ''}
    </button>`;
  }).join('');
}
