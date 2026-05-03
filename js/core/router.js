/* === Core: Router, Boot, Nav === */

function bootApp() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('pending-page').classList.remove('active');
  document.getElementById('app').classList.add('active');

  // Render header
  buildHeader();
  buildBottomNav();

  // Start idle timer
  resetIdleTimer();

  // Navigate to default page
  const first = { patient:'patient-dashboard', doctor:'doctor-dashboard', admin:'admin-dashboard' };
  showPage(first[currentUser.role]);
}

function buildHeader() {
  const el = document.getElementById('app-header');
  if (!el || !currentUser) return;
  const unread = DB.notifications.filter(n=>n.userId===currentUser.id&&!n.read).length;
  const pending = currentUser.role==='admin'
    ? DB.users.filter(u=>u.role==='doctor'&&u.verificationStatus==='pending').length : 0;

  const navItems = NAV[currentUser.role] || [];
  el.innerHTML = `
    <div class="header-brand">
      <div class="header-brand-icon">🌿</div>
      <div class="header-brand-name">Panchakarma</div>
    </div>
    <nav class="header-nav" id="main-nav">
      ${navItems.map(item=>`
        <button class="nav-btn ${currentPage===item.id?'active':''}" onclick="showPage('${item.id}')">
          ${item.icon}
          <span>${item.label}</span>
          ${item.badge&&(unread>0||pending>0)?`<span class="nav-badge">${item.id.includes('notif')?unread:pending}</span>`:''}
        </button>`).join('')}
      <button class="nav-btn" onclick="showPage('profile')">👤 Profile</button>
    </nav>
    <div class="header-right">
      <span class="role-badge ${currentUser.role}" id="role-badge">${currentUser.role==='doctor'?'👨‍⚕️ Doctor':currentUser.role==='admin'?'⚙️ Admin':'🧘 Patient'}</span>
      <div class="header-avatar" id="header-avatar" title="${currentUser.name}"
           onclick="showPage('profile')">${currentUser.avatar}</div>
    </div>`;
}

function buildNav() { buildHeader(); buildBottomNav(); }

function showPage(pageId) {
  currentPage = pageId;
  buildHeader();
  buildBottomNav();

  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = '';
  content.className = 'page-content';
  renderPage(pageId, content);

  // Scroll to top
  window.scrollTo({ top:0, behavior:'smooth' });
}

function renderPage(pageId, el) {
  const map = {
    // Patient
    'patient-dashboard':      renderPatientDashboard,
    'patient-schedule':       renderPatientSchedule,
    'patient-progress':       renderPatientProgress,
    'patient-notifications':  renderPatientNotifications,
    'patient-feedback':       renderPatientFeedback,
    'patient-shop':           renderPatientShop,
    'patient-orders':         renderPatientOrders,
    // Doctor
    'doctor-dashboard':       renderDoctorDashboard,
    'doctor-patients':        renderDoctorPatients,
    'doctor-schedule':        renderDoctorSchedule,
    'doctor-treatments':      renderDoctorTreatments,
    'doctor-reports':         renderDoctorReports,
    'doctor-shop':            renderDoctorShop,
    // Admin
    'admin-dashboard':        renderAdminDashboard,
    'admin-users':            renderAdminUsers,
    'admin-appointments':     renderAdminAppointments,
    'admin-reports':          renderAdminReports,
    'admin-therapies':        renderAdminTherapies,
    'admin-shop':             renderAdminShop,
    'admin-announcements':    renderAnnouncements,
    // Shared
    'profile':                renderProfile,
    'settings':               renderSettings,
  };
  const fn = map[pageId];
  if (fn) fn(el);
  else el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🔧</span><p>Page "${pageId}" not found</p></div>`;
}
