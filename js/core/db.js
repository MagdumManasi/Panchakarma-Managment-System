/* ═══════════════════════════════════════════════
   DATABASE — In-Memory Store + Date Helpers
   ═══════════════════════════════════════════════ */

function getDateStr(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr-12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}
function getUser(id) { return DB.users.find(u => u.id === id); }
function getTherapy(id) { return DB.therapies.find(t => t.id === id); }
function uuid() { return 'id-' + Math.random().toString(36).substr(2,9); }
function genId(prefix) { return prefix + Date.now() + Math.floor(Math.random()*1000); }
function calcAge(dob) { if (!dob) return null; const diff = Date.now() - new Date(dob).getTime(); return Math.floor(diff / (365.25*24*3600*1000)); }

// ── Patient Code Generator ─────────────────────────────────
function generatePatientCode() {
  const cfg    = DB.clinicConfig;
  const num    = String(cfg.patientIdCounter++).padStart(4, '0');
  return `${cfg.patientIdPrefix}-${num}`;
}

// ── Doctor Daily Capacity ──────────────────────────────────
// Returns { used, limit, available, slots[] } for a given doctor on a given date
function getDoctorDayCapacity(doctorId, date) {
  const doctor   = getUser(doctorId);
  const limit    = doctor?.dailyLimit || DB.clinicConfig.defaultDailyLimit;
  const sessions = DB.sessions.filter(s =>
    s.doctorId === doctorId &&
    s.date     === date &&
    s.status   !== 'cancelled'
  );
  const used  = sessions.length;
  const avail = Math.max(0, limit - used);

  // Build available time slots
  const workStart  = doctor?.workStart || DB.clinicConfig.workingHours.start;
  const workEnd    = doctor?.workEnd   || DB.clinicConfig.workingHours.end;
  const slotMins   = DB.clinicConfig.slotDuration;
  const bookedTimes = sessions.map(s => s.time);

  const slots = [];
  let [sh, sm] = workStart.split(':').map(Number);
  const [eh, em] = workEnd.split(':').map(Number);
  while (sh * 60 + sm + slotMins <= eh * 60 + em) {
    const timeStr = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;
    if (!bookedTimes.includes(timeStr)) {
      slots.push(timeStr);
    }
    sm += slotMins;
    while (sm >= 60) { sm -= 60; sh++; }
  }
  return { used, limit, available: avail, slots, doctor };
}

// ── Check if doctor is at daily capacity for a date ───────
function isDoctorAtCapacity(doctorId, date) {
  const cap = getDoctorDayCapacity(doctorId, date);
  return cap.available <= 0;
}

// ── Duplicate Patient Detection ────────────────────────────
// Returns existing patients who share the same name OR phone (not email — email is unique by design)
function findDuplicatePatients(name, phone) {
  const nameLower = name.toLowerCase().trim();
  return DB.users.filter(u => {
    if (u.role !== 'patient') return false;
    const nameMatch  = u.name.toLowerCase().trim() === nameLower;
    const phoneMatch = phone && u.phone && u.phone.replace(/\s/g,'') === phone.replace(/\s/g,'');
    return nameMatch || phoneMatch;
  });
}

function showToast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}
function closeMod() { document.getElementById('modal-overlay').classList.remove('open'); }

// ═══════════════════════════════════════════════════════════
// APP BOOT
// ═══════════════════════════════════════════════════════════
function bootApp() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('app').classList.add('active');

  // Set header
  const badge = document.getElementById('role-badge');
  badge.textContent = currentUser.role === 'doctor' ? '👨‍⚕️ Doctor' : currentUser.role === 'admin' ? '⚙️ Admin' : '🧘 Patient';
  badge.className = `role-badge ${currentUser.role === 'doctor' ? 'doctor' : currentUser.role === 'admin' ? 'admin' : 'patient'}`;
  document.getElementById('header-avatar').childNodes[0].textContent = currentUser.avatar;

  // Build nav
  buildNav();

  // Start idle session timer
  resetIdleTimer();

  // Load first page
  const firstPage = { patient: 'patient-dashboard', doctor: 'doctor-dashboard', admin: 'admin-dashboard' };
  showPage(firstPage[currentUser.role]);
}

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

function showPage(pageId) {
  currentPage = pageId;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('page-' + pageId);
  if (pg) {
    pg.classList.add('active');
    const navBtn = document.getElementById('nav-' + pageId);
    if (navBtn) navBtn.classList.add('active');
    renderPage(pageId, pg);
  }
}

function renderPage(id, el) {
  switch(id) {
    case 'patient-dashboard': renderPatientDashboard(el); break;
    case 'patient-schedule': renderPatientSchedule(el); break;
    case 'patient-progress': renderPatientProgress(el); break;
    case 'patient-notifications': renderPatientNotifications(el); break;
    case 'patient-feedback': renderPatientFeedback(el); break;
    case 'doctor-dashboard': renderDoctorDashboard(el); break;
    case 'doctor-patients': renderDoctorPatients(el); break;
    case 'doctor-schedule': renderDoctorSchedule(el); break;
    case 'doctor-treatments': renderDoctorTreatments(el); break;
    case 'doctor-reports': renderDoctorReports(el); break;
    case 'admin-dashboard': renderAdminDashboard(el); break;
    case 'admin-users':   renderAdminUsers(el); break;
    case 'admin-verify':  window._adminUserFilter='verification'; renderAdminUsers(el); break;
    case 'admin-verify': renderAdminVerify(el); break;
    case 'admin-therapies': renderAdminTherapies(el); break;
    case 'admin-appointments': renderAdminAppointments(el); break;
    case 'admin-reports': renderAdminReports(el); break;
    case 'announcements': renderAnnouncements(el); break;
    case 'patient-shop': renderPatientShop(el); break;
    case 'patient-orders': renderPatientOrders(el); break;
    case 'doctor-shop': renderDoctorShop(el); break;
    case 'admin-shop': renderAdminShop(el); break;
    case 'profile': renderProfile(el); break;
    case 'settings': renderSettings(el); break;
  }
}

// ═══════════════════════════════════════════════════════════
// PATIENT — DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderPatientDashboard(el) {
  const mySessions = DB.sessions.filter(s => s.patientId === currentUser.id);
  const upcoming = mySessions.filter(s => s.status === 'scheduled').sort((a,b) => a.date.localeCompare(b.date));
  const completed = mySessions.filter(s => s.status === 'completed');
  const unread = DB.notifications.filter(n => n.userId === currentUser.id && !n.read).length;
  const myMilestones = DB.milestones.filter(m => m.patientId === currentUser.id);
  const doneMilestones = myMilestones.filter(m => m.status === 'completed').length;
  const nextSession = upcoming[0];
  const nextTherapy = nextSession ? getTherapy(nextSession.therapyId) : null;
  const doshaBadge = `<span class="dosha-badge dosha-${currentUser.dosha?.toLowerCase().split('-')[0] || 'vata'}">${currentUser.dosha || 'Vata'}</span>`;

  el.innerHTML = `
    ${getAnnouncementsBanner()}
    <div class="profile-card">
      <div class="profile-avatar-big">${currentUser.avatar}</div>
      <div>
        <div class="profile-name">Welcome back, ${currentUser.name.split(' ')[0]}! 🙏</div>
        <div class="profile-role">Panchakarma Patient</div>
        <div class="profile-detail" style="margin-top:8px">Dosha: ${doshaBadge} &nbsp;|&nbsp; ${currentUser.phone}</div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">Next Session</div><div class="stat-value" style="font-size:1.3rem">${nextSession ? formatDate(nextSession.date) : 'None'}</div><div class="stat-sub">${nextTherapy ? nextTherapy.name + ' · ' + formatTime(nextSession.time) : 'Book your first session'}</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-label">Sessions Done</div><div class="stat-value">${completed.length}</div><div class="stat-sub">of ${mySessions.length} total sessions</div></div>
      <div class="stat-card"><span class="stat-icon">🏆</span><div class="stat-label">Milestones</div><div class="stat-value">${doneMilestones}/${myMilestones.length}</div><div class="stat-sub">Treatment milestones completed</div></div>
      <div class="stat-card"><span class="stat-icon">🔔</span><div class="stat-label">Notifications</div><div class="stat-value">${unread}</div><div class="stat-sub">Unread messages</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Upcoming Sessions</span><button class="btn btn-sm btn-green" onclick="showPage('patient-schedule')">View All</button></div>
        ${upcoming.slice(0,3).map(s => {
          const th = getTherapy(s.therapyId); const dr = getUser(s.doctorId);
          return `<div class="session-card" onclick="showPage('patient-schedule')">
            <div class="session-time-block"><div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div><div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div></div>
            <div class="session-info"><div class="session-therapy">${th?.name || '—'}</div><div class="session-therapist">${dr?.name || '—'} · ${formatDate(s.date)}</div></div>
            <span class="badge badge-blue">Scheduled</span>
          </div>`;
        }).join('') || '<div class="empty-state"><span class="empty-state-icon">📅</span><p>No upcoming sessions</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Treatment Progress</span><button class="btn btn-sm btn-outline" onclick="showPage('patient-progress')">Details</button></div>
        <div class="milestone-timeline">
          ${DB.milestones.filter(m=>m.patientId===currentUser.id).slice(0,4).map(m => `
            <div class="milestone-item">
              <div class="milestone-dot ${m.status==='completed'?'done':m.status==='in_progress'?'active':''}">${m.status==='completed'?'✓':m.status==='in_progress'?'⟳':''}</div>
              <div class="milestone-content">
                <div class="milestone-name">${m.name}</div>
                <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${m.pct}%"></div></div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span class="milestone-date">Target: ${formatDate(m.targetDate)}</span>
                  <span class="badge ${m.status==='completed'?'badge-green':m.status==='in_progress'?'badge-yellow':'badge-gray'}">${m.pct}%</span>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><span class="card-title">Recent Notifications</span><button class="btn btn-sm btn-outline" onclick="showPage('patient-notifications')">All Notifications</button></div>
      ${DB.notifications.filter(n=>n.userId===currentUser.id).slice(0,3).map(n => notifItemHTML(n)).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// PATIENT — SCHEDULE
// ═══════════════════════════════════════════════════════════
let calYear, calMonth;
function renderPatientSchedule(el) {
  const now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  const mySessions = DB.sessions.filter(s => s.patientId === currentUser.id && s.status === 'scheduled');

  el.innerHTML = `
    <div class="page-header"><h2>📅 Therapy Schedule</h2><p>Manage your upcoming Panchakarma sessions</p></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-green" onclick="openBookingModal()">+ Book Session</button>
    </div>
    <div class="calendar-layout">
      <div class="cal-wrap">
        <div class="cal-header">
          <button class="cal-nav" onclick="changeMonth(-1)">‹</button>
          <div class="cal-month" id="cal-month-label"></div>
          <button class="cal-nav" onclick="changeMonth(1)">›</button>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>
      <div class="sessions-panel">
        <div class="card">
          <div class="card-header"><span class="card-title">Upcoming Sessions</span><span class="badge badge-blue">${mySessions.length} upcoming</span></div>
          <div id="sessions-list">
            ${mySessions.length ? mySessions.sort((a,b)=>a.date.localeCompare(b.date)).map(s => sessionCardHTML(s)).join('') : '<div class="empty-state"><span class="empty-state-icon">📅</span><p>No upcoming sessions. Book your first one!</p></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Completed Sessions</span></div>
          ${DB.sessions.filter(s=>s.patientId===currentUser.id&&s.status==='completed').map(s=>sessionCardHTML(s)).join('') || '<div class="empty-state"><span class="empty-state-icon">✅</span><p>No completed sessions yet</p></div>'}
        </div>
      </div>
    </div>`;
  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  const grid = document.getElementById('cal-grid');
  if (!label || !grid) return;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${months[calMonth]} ${calYear}`;
  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const sessionDates = DB.sessions.filter(s=>s.patientId===currentUser.id&&s.status==='scheduled').map(s=>s.date);

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-header">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month">${daysInPrev - firstDay + i + 1}</div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getDate()===d && today.getMonth()===calMonth && today.getFullYear()===calYear;
    const hasSession = sessionDates.includes(dateStr);
    const isPast = new Date(dateStr) < new Date(today.toDateString());
    html += `<div class="cal-day ${isToday?'today':''} ${hasSession?'has-session':''} ${isPast&&!isToday?'past':''}" onclick="calDayClick('${dateStr}')">${d}</div>`;
  }
  grid.innerHTML = html;
}
function changeMonth(dir) { calMonth += dir; if(calMonth>11){calMonth=0;calYear++} if(calMonth<0){calMonth=11;calYear--} renderCalendar(); }
function calDayClick(date) { openBookingModal(date); }

function sessionCardHTML(s) {
  const th = getTherapy(s.therapyId), dr = getUser(s.doctorId);
  const statusMap = { scheduled: 'badge-blue', completed: 'badge-green', cancelled: 'badge-red', rescheduled: 'badge-yellow' };
  const wasReallocated = !!s.reallocatedAt;
  return `<div class="session-card" style="border-left-color:${th?.color||'#4A7C2B'}${wasReallocated?';background:linear-gradient(90deg,rgba(40,167,69,0.06),transparent)':''}">
    <div class="session-time-block">
      <div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div>
      <div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div>
    </div>
    <div class="session-info">
      <div class="session-therapy">${th?.name||'—'}</div>
      <div class="session-therapist">${dr?.name||'—'} · ${formatDate(s.date)} · ${th?.duration||60}min</div>
      ${wasReallocated ? `<div style="margin-top:4px"><span style="font-size:0.72rem;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:99px;font-weight:700">🔄 Time updated — was ${formatTime(s.prevTime)}</span></div>` : ''}
    </div>
    <div class="session-actions">
      <span class="badge ${statusMap[s.status]||'badge-gray'}">${s.status}</span>
      ${s.status==='scheduled'?`<button class="btn btn-sm btn-outline" onclick="rescheduleSession('${s.id}')">↺</button>
      <button class="btn btn-sm btn-danger" onclick="cancelSession('${s.id}')">✕</button>`:''}
    </div>
  </div>`;
}

function openBookingModal(prefillDate) {
  const therapyOptions  = DB.therapies.map(t=>`<option value="${t.id}">${t.name} (${t.duration}min · ₹${t.price.toLocaleString()})</option>`).join('');
  const approvedDoctors = DB.users.filter(u=>u.role==='doctor'&&(u.verificationStatus||'approved')==='approved');

  openModal(`
    <div class="modal-header"><div class="modal-title">📅 Book New Session</div><button class="modal-close" onclick="closeMod()">✕</button></div>

    <div class="form-row required full"><label>Therapy Type</label>
      <select id="bk-therapy">${therapyOptions}</select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row required"><label>Date</label>
        <input type="date" id="bk-date" value="${prefillDate||getDateStr(1)}"
               min="${getDateStr(0)}" max="${getDateStr(DB.clinicConfig.bookingAdvanceDays)}"
               onchange="refreshBookingSlots()">
      </div>
      <div class="form-row required"><label>Doctor</label>
        <select id="bk-doctor" onchange="refreshBookingSlots()">
          ${approvedDoctors.map(d=>`<option value="${d.id}">${d.name} — ${d.specialization}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Live capacity indicator -->
    <div id="bk-capacity-bar" style="margin-bottom:14px"></div>

    <div class="form-row required"><label>Available Time Slots</label>
      <select id="bk-time" style="font-size:0.9rem">
        <option value="">Loading slots…</option>
      </select>
    </div>

    <div class="form-row full"><label>Notes (optional)</label>
      <textarea id="bk-notes" rows="2" placeholder="Any special instructions or concerns…"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" id="bk-submit-btn" onclick="confirmBooking()">Confirm Booking →</button>
    </div>`);

  // Initial slot refresh
  setTimeout(refreshBookingSlots, 50);
}

function refreshBookingSlots() {
  const dateEl   = document.getElementById('bk-date');
  const drEl     = document.getElementById('bk-doctor');
  const timeEl   = document.getElementById('bk-time');
  const capEl    = document.getElementById('bk-capacity-bar');
  const submitEl = document.getElementById('bk-submit-btn');
  if (!dateEl || !drEl || !timeEl) return;

  const date     = dateEl.value;
  const doctorId = drEl.value;
  if (!date || !doctorId) return;

  const cap = getDoctorDayCapacity(doctorId, date);

  // Capacity indicator
  const pct   = Math.round((cap.used / cap.limit) * 100);
  const color = pct >= 100 ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--success)';
  capEl.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px;border-left:4px solid ${color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.82rem;font-weight:700;color:${color}">
          ${cap.available === 0 ? '⛔ Fully Booked' : `✅ ${cap.available} slot${cap.available!==1?'s':''} available`}
        </span>
        <span style="font-size:0.78rem;color:var(--text-light)">${cap.used} / ${cap.limit} patients booked</span>
      </div>
      <div style="height:6px;background:#E5DDD0;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:3px;transition:width 0.4s ease"></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-light);margin-top:5px">
        Working hours: ${cap.doctor?.workStart||'09:00'} – ${cap.doctor?.workEnd||'18:00'}
        · Daily limit: ${cap.limit} patients
        ${cap.doctor?.workingDays ? '· ' + cap.doctor.workingDays.join(', ') : ''}
      </div>
    </div>`;

  // Populate time slots
  if (cap.slots.length === 0) {
    timeEl.innerHTML = `<option value="">No available slots — all ${cap.limit} slots booked</option>`;
    if (submitEl) { submitEl.disabled = true; submitEl.style.opacity = '0.5'; }
  } else {
    timeEl.innerHTML = cap.slots.map(t => `<option value="${t}">${formatTime(t)}</option>`).join('');
    if (submitEl) { submitEl.disabled = false; submitEl.style.opacity = '1'; }
  }
}

function confirmBooking() {
  const therapyId = document.getElementById('bk-therapy').value;
  const date      = document.getElementById('bk-date').value;
  const time      = document.getElementById('bk-time').value;
  const doctorId  = document.getElementById('bk-doctor').value;
  const notes     = document.getElementById('bk-notes')?.value || '';

  if (!therapyId || !date || !time || !doctorId) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  // Re-check capacity at booking time (race condition guard)
  if (isDoctorAtCapacity(doctorId, date)) {
    showToast('This doctor is fully booked on the selected date. Please choose another date.', 'error');
    refreshBookingSlots();
    return;
  }

  // Check for duplicate booking (same patient, same doctor, same date)
  const dup = DB.sessions.find(s =>
    s.patientId === currentUser.id &&
    s.doctorId  === doctorId &&
    s.date      === date &&
    s.status    === 'scheduled'
  );
  if (dup) {
    showToast(`You already have a session with this doctor on ${formatDate(date)}.`, 'warning');
    return;
  }

  const th = getTherapy(therapyId);
  const dr = getUser(doctorId);
  const newSession = {
    id: genId('s'), patientId: currentUser.id, doctorId, therapyId,
    date, time, status: 'scheduled', notes, duration: th?.duration || 60
  };
  DB.sessions.push(newSession);

  DB.notifications.push({
    id: genId('n'), userId: currentUser.id, type: 'system', priority: 'normal', read: false,
    title: `✅ Appointment Confirmed — ${th?.name}`,
    message: `Your ${th?.name} session with ${dr?.name} on ${formatDate(date)} at ${formatTime(time)} has been confirmed.`,
    createdAt: new Date().toISOString()
  });

  // Notify the doctor too
  DB.notifications.push({
    id: genId('n'), userId: doctorId, type: 'system', priority: 'normal', read: false,
    title: `📅 New Appointment — ${currentUser.name}`,
    message: `${currentUser.name} (${currentUser.patientCode||'Patient'}) has booked a ${th?.name} session on ${formatDate(date)} at ${formatTime(time)}.`,
    createdAt: new Date().toISOString()
  });

  closeMod();
  showToast(`${th?.name} session booked for ${formatDate(date)} at ${formatTime(time)}! 🌿`, 'success');
  buildNav();
  showPage('patient-schedule');
}

function cancelSession(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  const th = getTherapy(s.therapyId);
  openModal(`
    <div class="modal-header"><div class="modal-title">Cancel Session</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <p style="color:var(--text-med);margin-bottom:20px">Are you sure you want to cancel <strong>${th?.name}</strong> on <strong>${formatDate(s.date)}</strong>?</p>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Keep Session</button><button class="btn btn-danger" onclick="doCancel('${id}')">Yes, Cancel</button></div>`);
}
function doCancel(id) {
  const s = DB.sessions.find(s => s.id === id);
  if (!s) { closeMod(); return; }

  const cancelledTime  = s.time;
  const cancelledDate  = s.date;
  const cancelledDoctor= s.doctorId;
  const th = getTherapy(s.therapyId);

  // Mark as cancelled
  s.status      = 'cancelled';
  s.cancelledAt = new Date().toISOString();

  // Notify the cancelled patient
  DB.notifications.push({
    id: genId('n'), userId: s.patientId, type: 'system',
    priority: 'high', read: false,
    title: `❌ Session Cancelled — ${th?.name || 'Session'}`,
    message: `Your ${th?.name || 'session'} on ${formatDate(cancelledDate)} at ${formatTime(cancelledTime)} has been cancelled.`,
    createdAt: new Date().toISOString(),
  });

  // ── AUTO-REALLOCATION ──────────────────────────────────
  // Find the next scheduled session on the same doctor + date
  // that has a LATER time than the just-freed slot
  const waitingSessions = DB.sessions
    .filter(ws =>
      ws.doctorId === cancelledDoctor &&
      ws.date     === cancelledDate   &&
      ws.status   === 'scheduled'     &&
      ws.time     >  cancelledTime        // later than freed slot
    )
    .sort((a, b) => a.time.localeCompare(b.time)); // earliest first

  if (waitingSessions.length > 0) {
    const next       = waitingSessions[0];
    const oldTime    = next.time;
    const nextPt     = getUser(next.patientId);
    const nextDr     = getUser(cancelledDoctor);
    const nextTh     = getTherapy(next.therapyId);

    // Move that session to the freed slot
    next.time          = cancelledTime;
    next.reallocatedAt = new Date().toISOString();
    next.prevTime      = oldTime; // keep audit trail

    // Notify the patient who got the earlier slot
    DB.notifications.push({
      id: genId('n'), userId: next.patientId, type: 'system',
      priority: 'high', read: false,
      title: `🎉 Earlier Slot Available — Your Session Moved!`,
      message: `Great news, ${nextPt?.name?.split(' ')[0] || 'there'}! A slot opened up earlier. Your ${nextTh?.name || 'session'} with ${nextDr?.name || 'your doctor'} on ${formatDate(cancelledDate)} has been moved from ${formatTime(oldTime)} to ${formatTime(cancelledTime)}. Please plan accordingly.`,
      createdAt: new Date().toISOString(),
    });

    // Notify the doctor about the change
    DB.notifications.push({
      id: genId('n'), userId: cancelledDoctor, type: 'system',
      priority: 'normal', read: false,
      title: `🔄 Schedule Updated — Auto-Reallocation`,
      message: `${nextPt?.name || 'A patient'} (${nextPt?.patientCode || '—'}) has been automatically moved from ${formatTime(oldTime)} to ${formatTime(cancelledTime)} on ${formatDate(cancelledDate)} due to a cancellation.`,
      createdAt: new Date().toISOString(),
    });

    closeMod();
    showToast(
      `Session cancelled. ${nextPt?.name?.split(' ')[0] || 'Next patient'} automatically moved to ${formatTime(cancelledTime)} 🔄`,
      'success'
    );
  } else {
    closeMod();
    showToast('Session cancelled.', 'warning');
  }

  buildNav();
  showPage('patient-schedule');
}

function rescheduleSession(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  const th = getTherapy(s.therapyId);
  const timeOptions = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t=>`<option value="${t}" ${t===s.time?'selected':''}>${formatTime(t)}</option>`).join('');
  openModal(`
    <div class="modal-header"><div class="modal-title">Reschedule: ${th?.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row required"><label>New Date</label><input type="date" id="rs-date" value="${s.date}" min="${getDateStr(0)}"></div>
      <div class="form-row required"><label>New Time</label><select id="rs-time">${timeOptions}</select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="doReschedule('${id}')">Confirm Reschedule</button></div>`);
}
function doReschedule(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  s.date = document.getElementById('rs-date').value;
  s.time = document.getElementById('rs-time').value;
  s.status = 'scheduled';
  closeMod(); showToast('Session rescheduled!', 'success'); showPage('patient-schedule');
}

// ═══════════════════════════════════════════════════════════
// PATIENT — PROGRESS
// ═══════════════════════════════════════════════════════════
function renderPatientProgress(el) {
  const mySessions = DB.sessions.filter(s => s.patientId === currentUser.id);
  const completed = mySessions.filter(s => s.status === 'completed').length;
  const total = mySessions.length;
  const myMilestones = DB.milestones.filter(m => m.patientId === currentUser.id);
  const doneMilestones = myMilestones.filter(m => m.status === 'completed').length;
  const inProgressMilestone = myMilestones.find(m => m.status === 'in_progress');
  const adherence = total > 0 ? Math.round((completed / total) * 100) : 0;
  const myPrescriptions = DB.prescriptions.filter(p => p.patientId === currentUser.id);

  el.innerHTML = `
    <div class="page-header"><h2>📈 Treatment Progress</h2><p>Track your Panchakarma healing journey</p></div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">📊</span><div class="stat-label">Overall Progress</div><div class="stat-value">${inProgressMilestone ? inProgressMilestone.pct : doneMilestones>0?100:0}%</div><div class="stat-sub">Current milestone progress</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-label">Sessions</div><div class="stat-value">${completed}</div><div class="stat-sub">of ${total} sessions completed</div></div>
      <div class="stat-card"><span class="stat-icon">🏆</span><div class="stat-label">Milestones</div><div class="stat-value">${doneMilestones}/${myMilestones.length}</div><div class="stat-sub">Treatment phases</div></div>
      <div class="stat-card"><span class="stat-icon">🎯</span><div class="stat-label">Adherence</div><div class="stat-value">${adherence}%</div><div class="stat-sub">Treatment compliance</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Treatment Journey</span></div>
        <div class="milestone-timeline">
          ${myMilestones.map(m => `
            <div class="milestone-item">
              <div class="milestone-dot ${m.status==='completed'?'done':m.status==='in_progress'?'active':''}">${m.status==='completed'?'✓':m.status==='in_progress'?'⟳':''}</div>
              <div class="milestone-content">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div class="milestone-name">${m.name}</div>
                  <span class="badge ${m.status==='completed'?'badge-green':m.status==='in_progress'?'badge-yellow':'badge-gray'}">${m.status.replace('_',' ')}</span>
                </div>
                <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${m.pct}%"></div></div>
                <div style="display:flex;justify-content:space-between">
                  <span class="milestone-date">Target: ${formatDate(m.targetDate)}</span>
                  <span style="font-size:0.78rem;font-weight:700;color:var(--primary)">${m.pct}%</span>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><span class="card-title">Symptom Improvement</span></div>
          <div class="chart-wrap chart-h-md"><canvas id="symptom-chart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Treatment Adherence</span></div>
          <div style="display:flex;align-items:center;gap:20px">
            <canvas id="adherence-chart" width="160" height="160"></canvas>
            <div>
              <div style="font-family:var(--font-serif);font-size:1.8rem;font-weight:700;color:var(--primary)">${adherence}%</div>
              <div style="font-size:0.85rem;color:var(--text-light)">Adherence Rate</div>
              <div style="font-size:0.85rem;color:var(--text-med);margin-top:6px">${completed} of ${total} sessions attended</div>
              <div class="progress-bar-wrap" style="margin-top:10px;width:160px"><div class="progress-bar-fill" style="width:${adherence}%"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Current Prescriptions</span></div>
      ${myPrescriptions.length ? myPrescriptions.map(p => {
        const dr = getUser(p.doctorId);
        return `<div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <div><strong style="color:var(--primary)">Prescription</strong> — ${formatDate(p.date)}</div>
            <div style="font-size:0.82rem;color:var(--text-light)">By ${dr?.name}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-light);text-transform:uppercase;margin-bottom:6px">Medicines</div>
              ${p.medicines.map(m=>`<div style="font-size:0.85rem;margin-bottom:4px"><strong>${m.name}</strong> — ${m.dose}, ${m.freq}, ${m.duration}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-light);text-transform:uppercase;margin-bottom:6px">Dietary Guidelines</div>
              <div style="font-size:0.85rem;color:var(--text-med)">${p.diet}</div>
            </div>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><span class="empty-state-icon">📋</span><p>No active prescriptions</p></div>'}
    </div>`;

  setTimeout(() => { drawSymptomChart(); drawAdherenceChart(adherence); }, 100);
}

function drawSymptomChart() {
  destroyChart('symptom-chart');
  const canvas = document.getElementById('symptom-chart');
  if (!canvas) return;
  // Build real data from patient feedback
  const myFeedback = DB.feedback.filter(f => f.patientId === currentUser.id).sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt));
  const labels = myFeedback.length >= 2
    ? myFeedback.map(f => formatDate(f.submittedAt))
    : ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6'];
  const values = myFeedback.length >= 2
    ? myFeedback.map(f => f.rating * 10)
    : [20, 38, 52, 66, 78, 88];

  canvas.style.height = '300px';
  _charts['symptom-chart'] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Wellness Score',
        data: values,
        borderColor: '#2D5016',
        backgroundColor: 'rgba(45,80,22,0.12)',
        borderWidth: 2.5,
        pointBackgroundColor: '#2D5016',
        pointRadius: 5,
        tension: 0.4,
        fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}% wellness` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Lato', size: 10 } } },
        y: { min: 0, max: 100, grid: { color: '#E5DDD0' },
             ticks: { font: { family: 'Lato', size: 10 }, callback: v => v + '%' } },
      },
    },
  });
}

function drawAdherenceChart(pct) {
  destroyChart('adherence-chart');
  const canvas = document.getElementById('adherence-chart');
  if (!canvas) return;
  _charts['adherence-chart'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: ['#2D5016', '#E5DDD0'],
        borderWidth: 0, cutout: '72%',
      }],
    },
    options: {
      responsive: false, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        ctx.save();
        ctx.font = 'bold 20px Crimson Pro';
        ctx.fillStyle = '#1A1A1A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct + '%', cx, cy);
        ctx.restore();
      },
    }],
  });
}


// ═══════════════════════════════════════════════════════════
// PATIENT — NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
let notifFilter = 'all';
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
function renderPatientFeedback(el) {
  const completedSessions = DB.sessions.filter(s => s.patientId === currentUser.id && s.status === 'completed');
  const myFeedback = DB.feedback.filter(f => f.patientId === currentUser.id);

  el.innerHTML = `
    <div class="page-header"><h2>⭐ Session Feedback</h2><p>Help us improve your Panchakarma experience</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Submit Feedback</span></div>
        <div class="form-row required">
          <label>Select Session</label>
          <select id="fb-session">
            <option value="">Choose a completed session...</option>
            ${completedSessions.map(s => { const th=getTherapy(s.therapyId); return `<option value="${s.id}">${th?.name||'?'} — ${formatDate(s.date)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-row required">
          <label>Overall Rating (1-10)</label>
          <div class="rating-grid">
            ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="rating-btn ${selectedRating===n?'selected':''}" onclick="setRating(${n})">${n}</button>`).join('')}
          </div>
          <div class="rating-label" id="rating-label">${selectedRating?getRatingLabel(selectedRating):'Select a rating'}</div>
        </div>
        <div class="form-row">
          <label>Symptom Changes</label>
          <textarea id="fb-symptoms" placeholder="Describe any changes in your symptoms..."></textarea>
        </div>
        <div class="form-row required">
          <label>Energy Level</label>
          <select id="fb-energy">
            <option value="">Select energy level...</option>
            <option value="much_improved">😊 Much Improved</option>
            <option value="slightly_improved">🙂 Slightly Improved</option>
            <option value="no_change">😐 No Change</option>
            <option value="slightly_decreased">😕 Slightly Decreased</option>
            <option value="much_decreased">😞 Much Decreased</option>
          </select>
        </div>
        <div class="form-row">
          <label>Additional Comments</label>
          <textarea id="fb-comments" placeholder="Any other feedback for your practitioner..."></textarea>
        </div>
        <button class="btn btn-green" style="width:100%;padding:13px" onclick="submitFeedback()">Submit Feedback ★</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Previous Feedback</span></div>
        ${myFeedback.length ? myFeedback.sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt)).map(f => {
          const s = DB.sessions.find(ss=>ss.id===f.sessionId), th = s?getTherapy(s.therapyId):null;
          const stars = '★'.repeat(Math.round(f.rating/2)) + '☆'.repeat(5-Math.round(f.rating/2));
          return `<div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <strong>${th?.name||'Session'}</strong>
              <span style="color:var(--accent);font-size:1rem">${stars}</span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-light);margin-bottom:6px">${formatDate(f.submittedAt)} · Rating: ${f.rating}/10</div>
            ${f.symptoms?`<div style="font-size:0.85rem;color:var(--text-med);margin-bottom:4px">${f.symptoms}</div>`:''}
            <span class="badge badge-green">${f.energyLevel.replace(/_/g,' ')}</span>
          </div>`;
        }).join('') : '<div class="empty-state"><span class="empty-state-icon">⭐</span><p>No feedback submitted yet</p></div>'}
      </div>
    </div>`;
}
function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('.rating-btn').forEach((b,i)=>{b.classList.toggle('selected',i+1===n);});
  const lbl = document.getElementById('rating-label');
  if(lbl) lbl.textContent = getRatingLabel(n);
}
function getRatingLabel(n) {
  if(n<=3) return '😞 Poor experience';
  if(n<=5) return '😐 Fair experience';
  if(n<=7) return '🙂 Good experience';
  if(n<=9) return '😊 Great experience!';
  return '🤩 Excellent — 10/10!';
}
function submitFeedback() {
  const sessionId = document.getElementById('fb-session').value;
  const energy    = document.getElementById('fb-energy').value;
  if (!sessionId || !selectedRating || !energy) {
    showToast('Please fill all required fields', 'error'); return;
  }
  // Uniqueness guard — one feedback per session per patient
  const alreadyDone = DB.feedback.find(f => f.sessionId === sessionId && f.patientId === currentUser.id);
  if (alreadyDone) {
    showToast('You have already submitted feedback for this session.', 'warning'); return;
  }
  DB.feedback.push({
    id: genId('f'), patientId: currentUser.id, sessionId,
    rating: selectedRating,
    symptoms:    document.getElementById('fb-symptoms')?.value  || '',
    energyLevel: energy,
    comments:    document.getElementById('fb-comments')?.value  || '',
    submittedAt: getDateStr(0),
  });
  selectedRating = 0;
  showToast('Feedback submitted! Thank you 🙏', 'success');
  showPage('patient-feedback');
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderDoctorDashboard(el) {
  const myPatientIds = [...new Set(DB.sessions.filter(s=>s.doctorId===currentUser.id).map(s=>s.patientId))];
  const todaySessions = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.date===getDateStr(0));
  const pendingFeedbacks = DB.feedback.filter(f=>{
    const s=DB.sessions.find(ss=>ss.id===f.sessionId);
    return s&&s.doctorId===currentUser.id;
  });
  const upcoming = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.status==='scheduled').sort((a,b)=>a.date.localeCompare(b.date));

  el.innerHTML = `
    ${getAnnouncementsBanner()}
    <div class="profile-card">
      <div class="profile-avatar-big">${currentUser.avatar}</div>
      <div>
        <div class="profile-name">Welcome, ${currentUser.name}! 🙏</div>
        <div class="profile-role">${currentUser.specialization}</div>
        <div class="profile-detail" style="margin-top:4px">${currentUser.qualification} · ${currentUser.experience}</div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-label">Total Patients</div><div class="stat-value">${myPatientIds.length}</div><div class="stat-sub">Active patients under care</div></div>
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">Today's Sessions</div><div class="stat-value">${todaySessions.length}</div><div class="stat-sub">Sessions scheduled today</div></div>
      <div class="stat-card"><span class="stat-icon">📋</span><div class="stat-label">Upcoming</div><div class="stat-value">${upcoming.length}</div><div class="stat-sub">Sessions this week</div></div>
      <div class="stat-card"><span class="stat-icon">⭐</span><div class="stat-label">My Rating</div><div class="stat-value">${currentUser.rating}</div><div class="stat-sub">Patient satisfaction score</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Today's Schedule</span><span style="font-size:0.82rem;color:var(--text-light)">${formatDate(getDateStr(0))}</span></div>
        ${todaySessions.length ? todaySessions.map(s => {
          const th=getTherapy(s.therapyId), pt=getUser(s.patientId);
          return `<div class="session-card">
            <div class="session-time-block"><div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div><div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div></div>
            <div class="session-info"><div class="session-therapy">${th?.name||'—'}</div><div class="session-therapist">Patient: ${pt?.name||'—'}</div></div>
            <div><span class="badge badge-blue">${s.status}</span></div>
          </div>`;
        }).join('') : '<div class="empty-state"><span class="empty-state-icon">📅</span><p>No sessions today</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Patient Feedback</span></div>
        ${pendingFeedbacks.slice(0,4).map(f=>{
          const pt=getUser(f.patientId), s=DB.sessions.find(ss=>ss.id===f.sessionId), th=s?getTherapy(s.therapyId):null;
          const stars='★'.repeat(Math.round(f.rating/2))+'☆'.repeat(5-Math.round(f.rating/2));
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.8rem">${pt?.avatar||'?'}</div>
            <div style="flex:1"><div style="font-weight:600;font-size:0.88rem">${pt?.name}</div><div style="font-size:0.78rem;color:var(--text-light)">${th?.name||'Session'} · ${formatDate(f.submittedAt)}</div></div>
            <div style="color:var(--accent)">${stars}</div>
          </div>`;
        }).join('') || '<div class="empty-state"><span class="empty-state-icon">⭐</span><p>No feedback yet</p></div>'}
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><span class="card-title">Upcoming Appointments</span><button class="btn btn-sm btn-green" onclick="showPage('doctor-schedule')">Full Schedule</button></div>
      ${upcoming.slice(0,5).map(s => {
        const th=getTherapy(s.therapyId), pt=getUser(s.patientId);
        return `<div class="session-card">
          <div class="session-time-block"><div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div><div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div></div>
          <div class="session-info"><div class="session-therapy">${th?.name||'—'}</div><div class="session-therapist">${pt?.name||'—'} · ${formatDate(s.date)}</div></div>
          <div><span class="badge badge-blue">${s.status}</span><button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${pt?.id}')">View</button></div>
        </div>`;
      }).join('') || '<div class="empty-state"><p>No upcoming appointments</p></div>'}
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — PATIENTS
// ═══════════════════════════════════════════════════════════
function renderDoctorPatients(el) {
  const myPatientIds = [...new Set(DB.sessions.filter(s=>s.doctorId===currentUser.id).map(s=>s.patientId))];
  const myPatients = myPatientIds.map(id=>getUser(id)).filter(Boolean);

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div><h2>👥 My Patients</h2><p>${myPatients.length} patient${myPatients.length!==1?'s':''} · Search by name, Patient ID (PKM-XXXX), or phone</p></div>
        <button class="btn btn-green" onclick="openAddPatientModal()">+ Register Patient</button>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <input type="text" id="patient-search-input" placeholder="🔍 Search by name, PKM-ID, or phone number…"
             style="padding:11px 16px;border:2px solid var(--border);border-radius:var(--radius-sm);font-size:0.9rem;background:white;width:100%;max-width:420px"
             oninput="filterPatients(this.value)">
    </div>
    <div class="patient-grid" id="patients-grid">
      ${myPatients.length ? myPatients.map(p => patientCardHTML(p)).join('') : '<div class="empty-state"><span class="empty-state-icon">👥</span><p>No patients yet. Click Register Patient to add one.</p></div>'}
    </div>`;
}

function patientCardHTML(p) {
  const pSessions = DB.sessions.filter(s=>s.patientId===p.id);
  const completed = pSessions.filter(s=>s.status==='completed').length;
  const upcoming  = pSessions.filter(s=>s.status==='scheduled').length;
  const milestone = DB.milestones.filter(m=>m.patientId===p.id).find(m=>m.status==='in_progress');
  return `<div class="patient-card" onclick="viewPatientDetails('${p.id}')">
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
      <div class="patient-avatar" style="background:var(--primary);flex-shrink:0">${p.avatar}</div>
      <div style="flex:1;min-width:0">
        <div class="patient-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:0.72rem;color:var(--text-light);margin-top:1px">${p.gender||'—'} · ${calcAge(p.dob)||'—'} yrs</div>
      </div>
    </div>
    <!-- Patient ID badge — prominent -->
    <div style="background:linear-gradient(135deg,var(--primary),var(--primary-mid));border-radius:var(--radius-sm);padding:6px 10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.68rem;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px">Patient ID</span>
      <span style="font-family:var(--font-serif);font-weight:700;color:white;font-size:0.95rem;letter-spacing:1px">${p.patientCode||'—'}</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <span class="dosha-badge dosha-${p.dosha?.toLowerCase().split('-')[0]||'vata'}">${p.dosha||'Vata'}</span>
      <span class="badge badge-gray">${p.bloodGroup||'—'}</span>
      ${upcoming>0?`<span class="badge badge-blue">${upcoming} upcoming</span>`:''}
      <span class="badge badge-green">${completed} done</span>
    </div>
    ${milestone?`<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-light);margin-bottom:2px"><span>${milestone.name}</span><span>${milestone.pct}%</span></div><div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${milestone.pct}%"></div></div></div>`:''}
    <div style="font-size:0.75rem;color:var(--text-light);margin-top:4px">📞 ${p.phone||'No phone'}</div>
  </div>`;
}

function getAge(dob) {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25*24*3600*1000));
}

function filterPatients(q) {
  const grid = document.getElementById('patients-grid');
  if (!grid) return;
  const myPatientIds = [...new Set(DB.sessions.filter(s=>s.doctorId===currentUser.id).map(s=>s.patientId))];
  const ql = q.toLowerCase().trim();
  const filtered = myPatientIds.map(id=>getUser(id)).filter(p => {
    if (!p) return false;
    return (
      p.name.toLowerCase().includes(ql) ||
      (p.patientCode||'').toLowerCase().includes(ql) ||
      (p.phone||'').replace(/\s/g,'').includes(ql.replace(/\s/g,'')) ||
      (p.email||'').toLowerCase().includes(ql)
    );
  });
  grid.innerHTML = filtered.length
    ? filtered.map(p=>patientCardHTML(p)).join('')
    : `<div class="empty-state"><span class="empty-state-icon">🔍</span><p>No patients match "<strong>${q}</strong>"</p></div>`;
}

function viewPatientDetails(patientId) {
  const p = getUser(patientId);
  if (!p) return;
  const pSessions = DB.sessions.filter(s=>s.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
  const pMilestones = DB.milestones.filter(m=>m.patientId===p.id);
  const pFeedback = DB.feedback.filter(f=>f.patientId===p.id);

  openModal(`
    <div class="modal-header"><div class="modal-title">Patient Profile</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="display:flex;align-items:center;gap:16px;padding:16px;background:linear-gradient(135deg,var(--primary),var(--primary-mid));border-radius:var(--radius-md);margin-bottom:20px;color:white">
      <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.3rem">${p.avatar}</div>
      <div style="flex:1">
        <div style="font-family:var(--font-serif);font-size:1.2rem;font-weight:700">${p.name}</div>
        <div style="font-size:0.82rem;opacity:0.85">${p.gender||'—'} · ${calcAge(p.dob)||'—'} years · ${p.phone||'No phone'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.68rem;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px">Patient ID</div>
        <div style="font-family:var(--font-serif);font-size:1.3rem;font-weight:700;letter-spacing:1px">${p.patientCode||'—'}</div>
      </div>
    </div>
        <div style="display:flex;gap:6px;margin-top:6px"><span class="dosha-badge dosha-${p.dosha?.toLowerCase().split('-')[0]||'vata'}">${p.dosha}</span><span class="badge badge-gray">${p.bloodGroup}</span></div>
      </div>
    </div>
    <div style="margin-bottom:16px"><strong>Allergies:</strong> ${p.allergies||'None'} &nbsp;|&nbsp; <strong>Emergency:</strong> ${p.emergencyContact||'—'}</div>
    <div style="margin-bottom:16px">
      <div style="font-weight:700;margin-bottom:8px">Sessions (${pSessions.length})</div>
      ${pSessions.slice(0,4).map(s=>{const th=getTherapy(s.therapyId);return`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem"><span>${th?.name||'?'} · ${formatDate(s.date)}</span><span class="badge ${s.status==='completed'?'badge-green':'badge-blue'}">${s.status}</span></div>`;}).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:16px">
      <button class="btn btn-green" onclick="closeMod();openPrescriptionModal('${p.id}')">+ Write Prescription</button>
      <button class="btn btn-info" onclick="closeMod();sendNotificationToPatient('${p.id}')">📨 Send Notification</button>
    </div>`);
}

function openAddPatientModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">Add New Patient</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <!-- Duplicate warning -->
    <div id="dup-warning" style="display:none;background:#fff3e0;border:1px solid #ffcc80;border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;font-size:0.83rem;color:#E65100"></div>
    <div class="form-grid">
      <div class="form-row required"><label>Full Name</label>
        <input type="text" id="ap-name" placeholder="Patient full name" oninput="checkPatientDuplicate()">
      </div>
      <div class="form-row required"><label>Email</label>
        <input type="email" id="ap-email" placeholder="Email address">
      </div>
      <div class="form-row"><label>Phone</label>
        <input type="tel" id="ap-phone" placeholder="+91 XXXXX XXXXX" oninput="checkPatientDuplicate()">
      </div>
      <div class="form-row"><label>Date of Birth</label><input type="date" id="ap-dob"></div>
      <div class="form-row"><label>Gender</label>
        <select id="ap-gender"><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select>
      </div>
      <div class="form-row"><label>Dosha Type</label>
        <select id="ap-dosha"><option>Vata</option><option>Pitta</option><option>Kapha</option><option>Vata-Pitta</option><option>Pitta-Kapha</option><option>Vata-Kapha</option></select>
      </div>
      <div class="form-row"><label>Blood Group</label>
        <select id="ap-blood"><option>—</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select>
      </div>
      <div class="form-row"><label>Allergies</label>
        <input type="text" id="ap-allergies" placeholder="None or list allergies">
      </div>
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px 12px;font-size:0.8rem;color:var(--text-light);margin-bottom:4px">
      🪪 A unique Patient ID (e.g. PKM-0005) will be auto-assigned on registration.
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="addPatient()">Register Patient</button>
    </div>`);
}

function checkPatientDuplicate() {
  const name  = document.getElementById('ap-name')?.value?.trim()  || '';
  const phone = document.getElementById('ap-phone')?.value?.trim() || '';
  const warn  = document.getElementById('dup-warning');
  if (!warn) return;
  if (!name && !phone) { warn.style.display='none'; return; }

  const dupes = findDuplicatePatients(name, phone);
  if (dupes.length === 0) { warn.style.display='none'; return; }

  warn.style.display = 'block';
  warn.innerHTML = `⚠️ <strong>Possible duplicate${dupes.length>1?'s':''} found:</strong><br>
    ${dupes.map(d=>`${d.patientCode||d.id} — <strong>${d.name}</strong> · ${d.phone||'no phone'} · ${d.email}`).join('<br>')}
    <br><span style="font-size:0.78rem">If this is the same person, search for them instead of adding a new record.</span>`;
}

function addPatient() {
  const name  = document.getElementById('ap-name')?.value?.trim();
  const email = document.getElementById('ap-email')?.value?.trim();
  const phone = document.getElementById('ap-phone')?.value?.trim() || '';

  if (!name)  { showToast('Patient name is required', 'error'); return; }
  if (!email) { showToast('Email address is required', 'error'); return; }

  // Email uniqueness check
  if (DB.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    showToast('A patient with this email already exists', 'error'); return;
  }

  const patientCode = generatePatientCode();
  const newUser = {
    id: genId('u'), patientCode, name, email, password: 'temp123', role: 'patient',
    phone, dob: document.getElementById('ap-dob')?.value || '',
    gender:     document.getElementById('ap-gender')?.value || '',
    dosha:      document.getElementById('ap-dosha')?.value  || 'Vata',
    bloodGroup: document.getElementById('ap-blood')?.value  || '—',
    allergies:  document.getElementById('ap-allergies')?.value || 'None',
    avatar: name.split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase(),
    address: '', emergencyContact: '', registeredAt: getDateStr(0),
  };
  DB.users.push(newUser);

  // Welcome notification
  DB.notifications.push({
    id: genId('n'), userId: newUser.id, type: 'system', priority: 'normal', read: false,
    title: `🌿 Welcome to Panchakarma, ${name.split(' ')[0]}!`,
    message: `Your patient account has been created. Your unique Patient ID is: ${patientCode}. Keep this for all future visits.`,
    createdAt: new Date().toISOString(),
  });

  closeMod();
  showToast(`✅ ${name} registered as ${patientCode}`, 'success');
  showPage('doctor-patients');
}

function openPrescriptionModal(patientId) {
  const patients = DB.users.filter(u=>u.role==='patient');
  const p = patientId ? getUser(patientId) : null;
  openModal(`
    <div class="modal-header"><div class="modal-title">✍️ Write Prescription ${p?'for '+p.name:''}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    ${!patientId ? `<div class="form-row required"><label>Patient</label><select id="rx-patient">${patients.map(pt=>`<option value="${pt.id}">${pt.name} (${pt.dosha})</option>`).join('')}</select></div>` : `<input type="hidden" id="rx-patient" value="${patientId}">`}
    ${p ? `<div style="background:var(--bg);padding:10px 14px;border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.83rem;color:var(--text-med)">🌿 Dosha: <strong>${p.dosha}</strong> · Allergies: <strong>${p.allergies||'None'}</strong></div>` : ''}
    <div style="font-weight:700;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light);margin-bottom:8px">Medicines</div>
    <div id="rx-medicines-list"></div>
    <button class="btn btn-sm btn-outline" style="margin-bottom:16px" onclick="addRxMedicineRow()">+ Add Another Medicine</button>
    <div class="form-row"><label>Dietary Guidelines</label><textarea id="rx-diet" rows="2" placeholder="e.g. Warm light food, avoid spicy items, include ginger..."></textarea></div>
    <div class="form-row"><label>Lifestyle Recommendations</label><textarea id="rx-lifestyle" rows="2" placeholder="e.g. Morning yoga 30 min, early bedtime, avoid screen time..."></textarea></div>
    <div class="form-row"><label>Notes / Follow-up</label><input type="text" id="rx-notes" placeholder="e.g. Review after 2 weeks"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="savePrescription(document.getElementById('rx-patient').value)">💾 Save & Notify Patient</button>
    </div>`);
  // Add first medicine row
  addRxMedicineRow();
}

function addRxMedicineRow() {
  const container = document.getElementById('rx-medicines-list');
  if (!container) return;
  const idx = container.children.length;
  const row = document.createElement('div');
  row.style.cssText = 'background:var(--bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;position:relative';
  row.innerHTML = `
    <div style="display:grid;grid-template-columns:2fr 1fr 2fr 1fr auto;gap:8px;align-items:center">
      <input type="text" placeholder="Medicine name" class="rx-med-name" style="padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:var(--font-sans)">
      <input type="text" placeholder="Dose" class="rx-med-dose" style="padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:var(--font-sans)">
      <select class="rx-med-freq" style="padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:var(--font-sans)">
        <option>Once daily</option><option>Twice daily</option><option>Three times daily</option>
        <option>Before meals</option><option>After meals</option><option>Morning on empty stomach</option>
        <option>At bedtime</option><option>As needed</option>
      </select>
      <input type="text" placeholder="Duration" class="rx-med-dur" style="padding:9px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:var(--font-sans)" value="30 days">
      <button onclick="this.closest('div[style]').remove()" style="width:30px;height:30px;border-radius:50%;background:var(--danger);color:white;border:none;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  container.appendChild(row);
}
function savePrescription(patientId) {
  if (!patientId) { showToast('Please select a patient','error'); return; }

  const medicines = [...document.querySelectorAll('#rx-medicines-list > div')].map(row => ({
    name:     row.querySelector('.rx-med-name')?.value?.trim() || '',
    dose:     row.querySelector('.rx-med-dose')?.value?.trim() || '',
    freq:     row.querySelector('.rx-med-freq')?.value         || '',
    duration: row.querySelector('.rx-med-dur')?.value?.trim()  || '',
  })).filter(m => m.name);

  if (!medicines.length) { showToast('Add at least one medicine','error'); return; }

  const rx = {
    id: genId('pr'), patientId, doctorId: currentUser.id, date: getDateStr(0),
    medicines,
    diet:      document.getElementById('rx-diet')?.value      || '',
    lifestyle: document.getElementById('rx-lifestyle')?.value || '',
    notes:     document.getElementById('rx-notes')?.value     || '',
  };
  DB.prescriptions.push(rx);

  const pt = getUser(patientId);
  DB.notifications.push({
    id: genId('n'), userId: patientId, type: 'general', priority: 'high',
    title: `💊 New Prescription from ${currentUser.name}`,
    message: `${currentUser.name} has issued a new prescription with ${medicines.length} medicine(s). Please check your Progress tab for details.`,
    read: false, createdAt: new Date().toISOString()
  });

  closeMod();
  showToast(`Prescription saved & ${pt?.name||'patient'} notified! 💊`, 'success');
}

function sendNotificationToPatient(patientId) {
  const p = getUser(patientId);
  openModal(`
    <div class="modal-header"><div class="modal-title">Send Notification to ${p?.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-row"><label>Notification Type</label><select id="sn-type"><option value="general">General</option><option value="pre_procedure">Pre-Procedure</option><option value="post_procedure">Post-Procedure</option></select></div>
    <div class="form-row"><label>Title</label><input type="text" id="sn-title" placeholder="Notification title"></div>
    <div class="form-row"><label>Message</label><textarea id="sn-msg" placeholder="Enter your message..."></textarea></div>
    <div class="form-row"><label>Priority</label><select id="sn-priority"><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="doSendNotification('${patientId}')">Send Notification</button></div>`);
}
function doSendNotification(patientId) {
  const title = document.getElementById('sn-title').value;
  const msg = document.getElementById('sn-msg').value;
  if(!title||!msg){showToast('Title and message required','error');return;}
  DB.notifications.push({ id: genId('n'), userId: patientId, type: document.getElementById('sn-type').value, title, message: msg, priority: document.getElementById('sn-priority').value, read: false, createdAt: new Date().toISOString() });
  closeMod(); showToast('Notification sent!','success');
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — SCHEDULE
// ═══════════════════════════════════════════════════════════
function renderDoctorSchedule(el) {
  const today      = getDateStr(0);
  const mySessions = DB.sessions.filter(s=>s.doctorId===currentUser.id).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming   = mySessions.filter(s=>s.status==='scheduled');
  const completed  = mySessions.filter(s=>s.status==='completed');

  // Build capacity heatmap for next 7 days
  const capacityDays = Array.from({length:7},(_,i)=>getDateStr(i)).map(date => {
    const cap = getDoctorDayCapacity(currentUser.id, date);
    const pct = Math.round((cap.used/cap.limit)*100);
    const color = pct>=100?'var(--danger)':pct>=75?'var(--warning)':'var(--success)';
    const d = new Date(date+'T00:00:00');
    return { date, day: d.toLocaleDateString('en-IN',{weekday:'short'}), num: d.getDate(), cap, pct, color };
  });

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><h2>📅 My Schedule</h2><p>Daily capacity limit: <strong>${currentUser.dailyLimit||8} patients/day</strong></p></div>
        <button class="btn btn-outline" onclick="openCapacitySettingsModal()">⚙️ Set Daily Limit</button>
      </div>
    </div>

    <!-- 7-day Capacity Heatmap -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <span class="card-title">📊 Week Capacity Overview</span>
        <span style="font-size:0.78rem;color:var(--text-light)">Click a day to filter sessions</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
        ${capacityDays.map(d=>`
          <div onclick="filterScheduleByDate('${d.date}')" style="text-align:center;padding:10px 6px;border-radius:var(--radius-md);border:2px solid ${d.date===today?'var(--primary)':'var(--border)'};background:${d.date===today?'#f0f7ee':'white'};cursor:pointer;transition:all 0.15s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='${d.date===today?'var(--primary)':'var(--border)'}'">
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-light);text-transform:uppercase">${d.day}</div>
            <div style="font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:${d.date===today?'var(--primary)':'var(--text)'};margin:4px 0">${d.num}</div>
            <div style="height:4px;background:#E5DDD0;border-radius:2px;margin-bottom:4px;overflow:hidden"><div style="height:100%;width:${d.pct}%;background:${d.color};transition:width 0.4s ease"></div></div>
            <div style="font-size:0.68rem;font-weight:600;color:${d.color}">${d.cap.used}/${d.cap.limit}</div>
            <div style="font-size:0.65rem;color:var(--text-light)">${d.cap.available>0?d.cap.available+' free':'Full'}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="section-tabs">
      <button class="section-tab active" id="sched-tab-upcoming" onclick="docScheduleTab('upcoming',this)">
        📅 Upcoming (${upcoming.length})
      </button>
      <button class="section-tab" id="sched-tab-completed" onclick="docScheduleTab('completed',this)">
        ✅ Completed (${completed.length})
      </button>
    </div>

    <div class="card" id="doc-schedule-content">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date & Time</th><th>Patient</th><th>Patient ID</th><th>Therapy</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="sched-tbody">
            ${renderScheduleRows(upcoming)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderScheduleRows(sessions) {
  if (!sessions.length) return '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:32px">No sessions found</td></tr>';
  return sessions.map(s => {
    const pt = getUser(s.patientId);
    const th = getTherapy(s.therapyId);
    const wasReallocated = !!s.reallocatedAt;
    return `<tr${wasReallocated ? ' style="background:linear-gradient(90deg,rgba(40,167,69,0.04),transparent)"' : ''}>
      <td>
        <strong>${formatDate(s.date)}</strong><br>
        <span style="color:var(--text-light);font-size:0.8rem">${formatTime(s.time)}</span>
        ${wasReallocated ? `<br><span style="font-size:0.68rem;background:#e8f5e9;color:#2e7d32;padding:1px 6px;border-radius:99px;font-weight:700;white-space:nowrap">🔄 Moved from ${formatTime(s.prevTime)}</span>` : ''}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700">${pt?.avatar||'?'}</div>
          <div>
            <div style="font-weight:600;font-size:0.88rem">${pt?.name||'Unknown'}</div>
            <div style="font-size:0.72rem;color:var(--text-light)">${pt?.phone||'No phone'}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-family:var(--font-serif);font-weight:700;font-size:0.85rem;color:var(--primary);background:var(--bg);padding:2px 8px;border-radius:99px;white-space:nowrap">
          ${pt?.patientCode||'—'}
        </span>
      </td>
      <td><span style="color:${th?.color||'var(--primary)'}">●</span> ${th?.name||'—'}</td>
      <td>${s.duration} min</td>
      <td>
        <span class="badge ${s.status==='completed'?'badge-green':s.status==='cancelled'?'badge-red':'badge-blue'}">${s.status}</span>
        ${wasReallocated ? '<br><span class="badge badge-green" style="font-size:0.65rem;margin-top:3px">auto-moved</span>' : ''}
      </td>
      <td style="white-space:nowrap">
        ${s.status==='scheduled' ? `
          <button class="btn btn-sm btn-green" onclick="markSessionComplete('${s.id}')">✓ Done</button>
          <button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${s.patientId}')">Profile</button>` :
          `<button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${s.patientId}')">Profile</button>`}
      </td>
    </tr>`;
  }).join('');
}

function filterScheduleByDate(date) {
  const tbody = document.getElementById('sched-tbody');
  if (!tbody) return;
  const sessions = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.date===date&&s.status!=='cancelled');
  tbody.innerHTML = sessions.length
    ? renderScheduleRows(sessions)
    : `<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:24px">No sessions on ${formatDate(date)}</td></tr>`;
}

function docScheduleTab(tab, btn) {
  document.querySelectorAll('.section-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const data = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.status===(tab==='upcoming'?'scheduled':'completed'));
  const tbody = document.getElementById('sched-tbody');
  if (tbody) tbody.innerHTML = renderScheduleRows(data);
}

function openCapacitySettingsModal() {
  const dr = currentUser;
  openModal(`
    <div class="modal-header"><div class="modal-title">⚙️ Capacity Settings</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:14px;margin-bottom:18px;font-size:0.85rem;color:var(--text-med)">
      Setting a daily limit prevents overbooking. Patients will not be able to book if you are at capacity.
    </div>
    <div class="form-row">
      <label>Maximum Patients Per Day</label>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" id="cap-slider" min="1" max="20" value="${dr.dailyLimit||8}"
               oninput="document.getElementById('cap-display').textContent=this.value+' patients/day'"
               style="flex:1;accent-color:var(--primary)">
        <span id="cap-display" style="font-family:var(--font-serif);font-size:1.3rem;font-weight:700;color:var(--primary);min-width:120px">${dr.dailyLimit||8} patients/day</span>
      </div>
    </div>
    <div class="form-row">
      <label>Working Hours</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:4px">Start Time</div>
          <input type="time" id="cap-start" value="${dr.workStart||'09:00'}" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:var(--radius-sm)">
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:4px">End Time</div>
          <input type="time" id="cap-end" value="${dr.workEnd||'18:00'}" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:var(--radius-sm)">
        </div>
      </div>
    </div>
    <div class="form-row">
      <label>Working Days</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`
          <label style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:2px solid var(--border);border-radius:99px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;${(dr.workingDays||['Mon','Tue','Wed','Thu','Fri']).includes(day)?'background:var(--primary);color:white;border-color:var(--primary)':'color:var(--text-med)'}">
            <input type="checkbox" ${(dr.workingDays||['Mon','Tue','Wed','Thu','Fri']).includes(day)?'checked':''}
                   value="${day}" class="cap-day-cb" style="display:none"
                   onchange="this.closest('label').style.cssText=this.checked?'display:flex;align-items:center;gap:5px;padding:6px 12px;border:2px solid var(--primary);border-radius:99px;cursor:pointer;font-size:0.82rem;font-weight:600;background:var(--primary);color:white':'display:flex;align-items:center;gap:5px;padding:6px 12px;border:2px solid var(--border);border-radius:99px;cursor:pointer;font-size:0.82rem;font-weight:600;color:var(--text-med)'">
            ${day}
          </label>`).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="saveCapacitySettings()">Save Settings</button>
    </div>`);
}

function saveCapacitySettings() {
  const dr = DB.users.find(u=>u.id===currentUser.id);
  if (!dr) return;
  dr.dailyLimit  = parseInt(document.getElementById('cap-slider').value) || 8;
  dr.workStart   = document.getElementById('cap-start')?.value || '09:00';
  dr.workEnd     = document.getElementById('cap-end')?.value   || '18:00';
  dr.workingDays = [...document.querySelectorAll('.cap-day-cb:checked')].map(cb=>cb.value);
  Object.assign(currentUser, dr);
  closeMod();
  showToast(`Daily limit set to ${dr.dailyLimit} patients/day ✅`, 'success');
  showPage('doctor-schedule');
}

function markSessionComplete(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  const th = getTherapy(s.therapyId);
  const pt = getUser(s.patientId);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">✅ Complete Session</div>
      <button class="modal-close" onclick="closeMod()">✕</button>
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:16px;font-size:0.85rem">
      <strong>${th?.name||'Session'}</strong> with
      <strong>${pt?.name||'Patient'}</strong> (${pt?.patientCode||'—'})
      on ${formatDate(s.date)} at ${formatTime(s.time)}
    </div>
    <div class="form-row">
      <label>Clinical Notes <span style="color:var(--text-light);font-weight:400">(optional — visible only to doctor)</span></label>
      <textarea id="complete-notes" rows="3" placeholder="e.g. Patient responded well. Reduced Vata symptoms. Recommend 3 follow-up sessions..."
                style="width:100%;padding:10px;border:2px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-sans);font-size:0.9rem;resize:vertical">${s.clinicalNotes||''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="confirmSessionComplete('${id}')">Mark Complete & Notify Patient</button>
    </div>`);
}

function confirmSessionComplete(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  s.status = 'completed';
  s.clinicalNotes = document.getElementById('complete-notes')?.value?.trim() || '';
  s.completedAt   = new Date().toISOString();
  const th = getTherapy(s.therapyId);
  DB.notifications.push({
    id:genId('n'), userId:s.patientId, type:'post_procedure', priority:'high', read:false,
    title:`Post-Session Care: ${th?.name||'Session'}`,
    message:`Your ${th?.name||'session'} with ${currentUser.name} is complete. Rest for 2 hours. Consume warm light food. Avoid cold water and direct sunlight for 24 hours.`,
    createdAt:new Date().toISOString(),
  });
  closeMod();
  showToast('Session marked complete! Patient notified.','success');
  showPage('doctor-schedule');
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — TREATMENTS
// ═══════════════════════════════════════════════════════════
function renderDoctorTreatments(el) {
  const tab = window._treatmentsTab || 'patients';
  const myPatientIds = [...new Set(DB.sessions.filter(s=>s.doctorId===currentUser.id).map(s=>s.patientId))];
  const myPatients   = DB.users.filter(u => myPatientIds.includes(u.id));
  const allRx        = DB.prescriptions.filter(p => p.doctorId === currentUser.id);

  el.innerHTML = `
    <div class="page-header"><h2>🌿 Treatment Management</h2><p>Manage patient treatment plans and prescriptions</p></div>
    <div class="section-tabs">
      <button class="section-tab ${tab==='patients'?'active':''}"   onclick="window._treatmentsTab='patients';showPage('doctor-treatments')">🧘 Patients (${myPatients.length})</button>
      <button class="section-tab ${tab==='prescriptions'?'active':''}" onclick="window._treatmentsTab='prescriptions';showPage('doctor-treatments')">💊 Prescriptions (${allRx.length})</button>
      <button class="section-tab ${tab==='milestones'?'active':''}"  onclick="window._treatmentsTab='milestones';showPage('doctor-treatments')">🏆 Milestones</button>
    </div>

    ${tab==='patients' ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${myPatients.length ? myPatients.map(p => {
        const pMilestones = DB.milestones.filter(m=>m.patientId===p.id);
        const pSessions   = DB.sessions.filter(s=>s.patientId===p.id&&s.doctorId===currentUser.id);
        const pRx         = DB.prescriptions.filter(r=>r.patientId===p.id&&r.doctorId===currentUser.id);
        const activeMile  = pMilestones.find(m=>m.status==='in_progress');
        const done        = pMilestones.filter(m=>m.status==='completed').length;
        const overallPct  = pMilestones.length ? Math.round(done/pMilestones.length*100) : 0;
        return `<div class="card" style="padding:20px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div style="width:48px;height:48px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem">${p.avatar}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.95rem">${p.name}</div>
              <div style="font-size:0.78rem;color:var(--text-light)">${p.dosha} Dosha · Age ${calcAge(p.dob)||'—'}</div>
            </div>
            <span class="dosha-badge dosha-${p.dosha?.toLowerCase().split('-')[0]||'vata'}">${p.dosha||'—'}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;text-align:center">
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px">
              <div style="font-weight:700;color:var(--primary)">${pSessions.length}</div>
              <div style="font-size:0.7rem;color:var(--text-light)">Sessions</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px">
              <div style="font-weight:700;color:var(--success)">${pRx.length}</div>
              <div style="font-size:0.7rem;color:var(--text-light)">Prescriptions</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px">
              <div style="font-weight:700;color:var(--accent)">${overallPct}%</div>
              <div style="font-size:0.7rem;color:var(--text-light)">Progress</div>
            </div>
          </div>

          ${activeMile ? `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
              <span style="color:var(--text-med)">Current: ${activeMile.name}</span>
              <span style="font-weight:700;color:var(--primary)">${activeMile.pct}%</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${activeMile.pct}%"></div></div>
          </div>` : ''}

          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-green" onclick="openPrescriptionModal('${p.id}')">✍️ Prescribe</button>
            <button class="btn btn-sm btn-outline" onclick="updateMilestone('${p.id}')">🏆 Milestones</button>
            <button class="btn btn-sm btn-outline" onclick="sendNotificationToPatient('${p.id}')">📨 Notify</button>
            <button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${p.id}')">👁 View</button>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><span class="empty-state-icon">🧘</span><p>No patients assigned yet</p></div>'}
    </div>` : ''}

    ${tab==='prescriptions' ? `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-green" onclick="openPrescriptionModal(null)">+ New Prescription</button>
    </div>
    ${allRx.length ? allRx.sort((a,b)=>b.date.localeCompare(a.date)).map(rx => {
      const pt = getUser(rx.patientId);
      return `<div class="card" style="margin-bottom:12px;padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem">${pt?.avatar||'?'}</div>
            <div>
              <div style="font-weight:700">${pt?.name||'—'}</div>
              <div style="font-size:0.78rem;color:var(--text-light)">📅 ${formatDate(rx.date)} · ${rx.medicines?.length||0} medicine(s)</div>
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="viewPrescriptionDetail('${rx.id}')">View Details</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${(rx.medicines||[]).map(m=>`<span style="background:var(--bg);border-radius:99px;padding:3px 10px;font-size:0.78rem;font-weight:600;color:var(--primary)">💊 ${m.name}</span>`).join('')}
        </div>
        ${rx.diet?`<div style="font-size:0.82rem;color:var(--text-med)">🥗 <strong>Diet:</strong> ${rx.diet.slice(0,80)}${rx.diet.length>80?'…':''}</div>`:''}
      </div>`;
    }).join('') : '<div class="empty-state"><span class="empty-state-icon">💊</span><p>No prescriptions written yet</p></div>'}` : ''}

    ${tab==='milestones' ? `
    <div class="card">
      <div class="card-header"><span class="card-title">All Patient Milestones</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Patient</th><th>Milestone</th><th>Status</th><th>Progress</th><th>Target Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${DB.milestones.filter(m => myPatientIds.includes(m.patientId)).map(m => {
              const pt = getUser(m.patientId);
              return `<tr>
                <td>${pt?.name||'—'}</td>
                <td>${m.name}</td>
                <td><span class="badge ${m.status==='completed'?'badge-green':m.status==='in_progress'?'badge-yellow':'badge-gray'}">${m.status.replace('_',' ')}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="progress-bar-wrap" style="width:80px;margin:0"><div class="progress-bar-fill" style="width:${m.pct}%"></div></div>
                    <span style="font-size:0.78rem;font-weight:700">${m.pct}%</span>
                  </div>
                </td>
                <td>${formatDate(m.targetDate)}</td>
                <td><button class="btn btn-sm btn-outline" onclick="updateMilestone('${m.patientId}')">Update</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}`;
}

function viewPrescriptionDetail(rxId) {
  const rx = DB.prescriptions.find(r=>r.id===rxId);
  if (!rx) return;
  const pt = getUser(rx.patientId);
  const dr = getUser(rx.doctorId);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">💊 Prescription Details</div>
      <button class="modal-close" onclick="closeMod()">✕</button>
    </div>
    <div style="background:linear-gradient(135deg,var(--primary),var(--primary-mid));border-radius:var(--radius-md);padding:16px;color:white;margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-family:var(--font-serif);font-size:1.1rem;font-weight:700">Patient: ${pt?.name||'—'}</div>
          <div style="font-size:0.8rem;opacity:0.85;margin-top:2px">Dr. ${dr?.name||'—'} · ${formatDate(rx.date)}</div>
        </div>
        <div style="text-align:right;font-size:0.78rem;opacity:0.8">${pt?.dosha||'—'} Dosha</div>
      </div>
    </div>
    <div style="font-weight:700;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light);margin-bottom:10px">Medicines</div>
    ${(rx.medicines||[]).map(m=>`
      <div style="display:grid;grid-template-columns:2fr 1fr 2fr 1fr;gap:8px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:6px;font-size:0.85rem">
        <span style="font-weight:700;color:var(--primary)">💊 ${m.name}</span>
        <span style="color:var(--text-med)">${m.dose}</span>
        <span style="color:var(--text-med)">${m.freq}</span>
        <span style="color:var(--text-light)">${m.duration}</span>
      </div>`).join('')}
    ${rx.diet?`<div style="margin-top:14px;padding:12px;background:#e8f5e9;border-radius:var(--radius-sm)"><div style="font-weight:700;font-size:0.8rem;color:var(--primary);margin-bottom:4px">🥗 Diet Instructions</div><div style="font-size:0.85rem;color:var(--text-med)">${rx.diet}</div></div>`:''}
    ${rx.lifestyle?`<div style="margin-top:8px;padding:12px;background:#e3f2fd;border-radius:var(--radius-sm)"><div style="font-weight:700;font-size:0.8rem;color:#1565C0;margin-bottom:4px">🧘 Lifestyle</div><div style="font-size:0.85rem;color:var(--text-med)">${rx.lifestyle}</div></div>`:''}
    ${rx.notes?`<div style="margin-top:8px;font-size:0.82rem;color:var(--text-light)">📝 Notes: ${rx.notes}</div>`:''}
    <div class="modal-footer"><button class="btn btn-green" onclick="closeMod()">Close</button></div>`);
}
function updateMilestone(patientId) {
  const p=getUser(patientId);
  const milestones=DB.milestones.filter(m=>m.patientId===patientId);
  openModal(`
    <div class="modal-header"><div class="modal-title">Update Treatment: ${p?.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    ${milestones.map(m=>`<div style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
      <div style="font-weight:600;margin-bottom:6px">${m.name}</div>
      <div style="display:flex;gap:10px;align-items:center">
        <select id="ms-status-${m.id}" style="padding:6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem">
          <option value="pending" ${m.status==='pending'?'selected':''}>Pending</option>
          <option value="in_progress" ${m.status==='in_progress'?'selected':''}>In Progress</option>
          <option value="completed" ${m.status==='completed'?'selected':''}>Completed</option>
        </select>
        <input type="range" min="0" max="100" value="${m.pct}" id="ms-pct-${m.id}" style="flex:1" oninput="document.getElementById('ms-pct-lbl-${m.id}').textContent=this.value+'%'">
        <span id="ms-pct-lbl-${m.id}" style="min-width:40px;font-weight:700;color:var(--primary)">${m.pct}%</span>
      </div>
    </div>`).join('')}
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="saveMilestones('${patientId}')">Save Updates</button></div>`);
}
function saveMilestones(patientId) {
  DB.milestones.filter(m=>m.patientId===patientId).forEach(m=>{
    const sel=document.getElementById('ms-status-'+m.id);
    const pct=document.getElementById('ms-pct-'+m.id);
    if(sel)m.status=sel.value;
    if(pct){m.pct=parseInt(pct.value);if(m.pct===100)m.status='completed';}
  });
  closeMod(); showToast('Treatment plan updated!','success'); showPage('doctor-treatments');
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — REPORTS
// ═══════════════════════════════════════════════════════════
function renderDoctorReports(el) {
  const myPatientIds = [...new Set(DB.sessions.filter(s=>s.doctorId===currentUser.id).map(s=>s.patientId))];
  const mySessions   = DB.sessions.filter(s=>s.doctorId===currentUser.id);
  const completed    = mySessions.filter(s=>s.status==='completed');
  const upcoming     = mySessions.filter(s=>s.status==='scheduled');
  const myFeedback   = DB.feedback.filter(f=>f.doctorId===currentUser.id||mySessions.some(s=>s.id===f.sessionId));
  const avgRating    = myFeedback.length ? (myFeedback.reduce((s,f)=>s+f.rating,0)/myFeedback.length).toFixed(1) : '—';
  const totalRevenue = completed.reduce((s,ss)=>{const t=getTherapy(ss.therapyId);return s+(t?.price||0);},0);
  const therapyCounts = {};
  mySessions.forEach(s=>{const t=getTherapy(s.therapyId);if(t)therapyCounts[t.name]=(therapyCounts[t.name]||0)+1;});

  // 6-month trend
  const monthlyData = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(); d.setMonth(d.getMonth()-i); d.setDate(1);
    const label = d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
    const mo = d.getMonth(), yr = d.getFullYear();
    const sess = completed.filter(s=>{ const sd=new Date(s.date); return sd.getMonth()===mo&&sd.getFullYear()===yr; });
    const rev  = sess.reduce((s,ss)=>{const t=getTherapy(ss.therapyId);return s+(t?.price||0);},0);
    monthlyData.push({ label, count: sess.length, rev });
  }

  el.innerHTML=`
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><h2>📊 My Reports & Analytics</h2><p>Performance overview and treatment analytics</p></div>
        <button class="btn btn-sm btn-outline" onclick="exportCSV('sessions')">⬇ Export Sessions CSV</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-label">Total Patients</div><div class="stat-value">${myPatientIds.length}</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-label">Completed</div><div class="stat-value">${completed.length}</div></div>
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">Upcoming</div><div class="stat-value">${upcoming.length}</div></div>
      <div class="stat-card"><span class="stat-icon">💰</span><div class="stat-label">Total Revenue</div><div class="stat-value">₹${(totalRevenue/1000).toFixed(1)}K</div></div>
      <div class="stat-card"><span class="stat-icon">⭐</span><div class="stat-label">Avg. Rating</div><div class="stat-value">${avgRating}/10</div></div>
      <div class="stat-card"><span class="stat-icon">📋</span><div class="stat-label">Feedback Count</div><div class="stat-value">${myFeedback.length}</div></div>
    </div>

    <!-- Monthly trend -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">📈 Monthly Session Trend (6 Months)</span></div>
      <div class="chart-wrap chart-h-lg"><canvas id="dr-monthly-chart"></canvas></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Sessions by Therapy</span></div>
        <div class="chart-wrap chart-h-md"><canvas id="therapy-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Patient Feedback</span></div>
        <div style="max-height:280px;overflow-y:auto">
          ${myFeedback.length ? myFeedback.slice().sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt)).slice(0,8).map(f=>{
            const p = getUser(f.patientId);
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0">${p?.avatar||'?'}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.85rem;font-weight:600">${p?.name||'—'}</div>
                <div style="font-size:0.72rem;color:var(--text-light)">${formatDate(f.submittedAt)}</div>
                ${f.comments?`<div style="font-size:0.78rem;color:var(--text-med);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">"${f.comments}"</div>`:''}
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-weight:700;color:var(--primary)">${f.rating}/10</div>
                <span class="badge badge-${f.energyLevel==='much_improved'?'green':f.energyLevel==='slightly_improved'?'blue':'gray'}" style="font-size:0.68rem">${(f.energyLevel||'').replace(/_/g,' ')}</span>
              </div>
            </div>`;
          }).join('') : '<div class="empty-state" style="padding:24px"><p>No feedback yet</p></div>'}
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    drawTherapyChart(therapyCounts);
    drawDoctorMonthlyChart(monthlyData);
  }, 100);
}

function drawDoctorMonthlyChart(data) {
  destroyChart('dr-monthly-chart');
  const canvas = document.getElementById('dr-monthly-chart');
  if (!canvas) return;
  _charts['dr-monthly-chart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d=>d.label),
      datasets: [
        { label: 'Sessions', data: data.map(d=>d.count),
          backgroundColor: 'rgba(45,80,22,0.80)', borderRadius: 5, yAxisID: 'y' },
        { label: 'Revenue (₹)', data: data.map(d=>d.rev),
          type: 'line', borderColor: '#D4A574', backgroundColor: 'rgba(212,165,116,0.15)',
          borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#D4A574',
          tension: 0.4, fill: true, yAxisID: 'y2' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Lato', size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label === 'Revenue (₹)'
              ? ` ₹${ctx.parsed.y.toLocaleString('en-IN')}`
              : ` ${ctx.parsed.y} sessions`,
          },
        },
      },
      scales: {
        x:  { grid: { display: false }, ticks: { font: { family: 'Lato', size: 11 } } },
        y:  { beginAtZero: true, grid: { color: '#E5DDD0' }, position: 'left',
              ticks: { font: { family: 'Lato', size: 11 }, stepSize: 1 }, title: { display: true, text: 'Sessions', font: { size: 10 } } },
        y2: { beginAtZero: true, position: 'right', grid: { display: false },
              ticks: { font: { family: 'Lato', size: 11 }, callback: v => '₹'+(v>=1000?(v/1000).toFixed(0)+'K':v) },
              title: { display: true, text: 'Revenue', font: { size: 10 } } },
      },
    },
  });
}
function drawTherapyChart(data) {
  destroyChart('therapy-chart');
  const canvas = document.getElementById('therapy-chart');
  if (!canvas) return;
  const labels = Object.keys(data);
  const vals   = Object.values(data);
  const colors = ['#2D5016','#4A7C2B','#D4A574','#17A2B8','#FFC107','#DC3545','#6c757d','#8e44ad'];
  canvas.style.height = Math.max(240, labels.length * 44) + 'px';
  _charts['therapy-chart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sessions',
        data: vals,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} sessions` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#E5DDD0' },
             ticks: { font: { family: 'Lato', size: 11 }, stepSize: 1 } },
        y: { grid: { display: false },
             ticks: { font: { family: 'Lato', size: 11 } } },
      },
    },
  });
}


// ═══════════════════════════════════════════════════════════
// ADMIN — DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderAdminDashboard(el) {
  const patients=DB.users.filter(u=>u.role==='patient');
  const doctors=DB.users.filter(u=>u.role==='doctor' && (u.verificationStatus||'approved')==='approved');
  const pendingDoctors=DB.users.filter(u=>u.role==='doctor' && u.verificationStatus==='pending');
  const today=DB.sessions.filter(s=>s.date===getDateStr(0));
  const revenue=DB.sessions.filter(s=>s.status==='completed').reduce((sum,s)=>{const t=getTherapy(s.therapyId);return sum+(t?.price||0);},0);

  el.innerHTML=`
    ${pendingDoctors.length ? `
    <div style="background:linear-gradient(135deg,#fff3e0,#fff8f0);border:2px solid var(--warning);border-radius:var(--radius-lg);padding:18px 22px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
      <div style="font-size:2rem;flex-shrink:0">⚡</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:1rem;color:#E65100">Action Required — Doctor Verification</div>
        <div style="font-size:0.85rem;color:var(--text-med);margin-top:3px">${pendingDoctors.length} doctor application${pendingDoctors.length>1?'s':''} waiting for your approval: ${pendingDoctors.map(d=>`<strong>${d.name}</strong>`).join(', ')}</div>
      </div>
      <button class="btn btn-warning" onclick="window._adminUserFilter='verification';showPage('admin-users')" style="background:var(--warning);color:var(--text);font-weight:700;flex-shrink:0">
        Review Now →
      </button>
    </div>` : ''}

    <div class="profile-card">
      <div class="profile-avatar-big">⚙️</div>
      <div><div class="profile-name">Admin Dashboard</div><div class="profile-role">Panchakarma Clinic Management</div><div class="profile-detail" style="margin-top:4px">Full system control and analytics</div></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-label">Total Patients</div><div class="stat-value">${patients.length}</div><div class="stat-sub">Registered patients</div></div>
      <div class="stat-card"><span class="stat-icon">👨‍⚕️</span><div class="stat-label">Active Doctors</div><div class="stat-value">${doctors.length}</div><div class="stat-sub">${pendingDoctors.length} pending verification</div></div>
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">Today's Sessions</div><div class="stat-value">${today.length}</div><div class="stat-sub">Appointments today</div></div>
      <div class="stat-card"><span class="stat-icon">💰</span><div class="stat-label">Total Revenue</div><div class="stat-value">₹${(revenue/1000).toFixed(1)}K</div><div class="stat-sub">From completed sessions</div></div>
    </div>
    <div class="admin-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-green" style="padding:14px;justify-content:center" onclick="showPage('admin-users')">👥 Manage Users</button>
          <button class="btn ${pendingDoctors.length?'btn-warning':'btn-outline'}" style="padding:14px;justify-content:center;${pendingDoctors.length?'background:var(--warning);color:var(--text);':''}" onclick="window._adminUserFilter='verification';showPage('admin-users')">
            🩺 Verify Doctors${pendingDoctors.length?` (${pendingDoctors.length})`:''}
          </button>
          <button class="btn btn-outline" style="padding:14px;justify-content:center" onclick="showPage('admin-appointments')">📅 Appointments</button>
          <button class="btn btn-accent" style="padding:14px;justify-content:center" onclick="showPage('admin-reports')">📊 Reports</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        ${DB.sessions.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(s=>{
          const pt=getUser(s.patientId),dr=getUser(s.doctorId),th=getTherapy(s.therapyId);
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="width:8px;height:8px;border-radius:50%;background:${s.status==='completed'?'var(--success)':s.status==='cancelled'?'var(--danger)':'var(--info)'}"></div>
            <div style="flex:1;font-size:0.85rem"><strong>${pt?.name}</strong> → ${th?.name}</div>
            <span class="badge ${s.status==='completed'?'badge-green':s.status==='cancelled'?'badge-red':'badge-blue'}">${s.status}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><span class="card-title">Revenue by Therapy</span></div>
      <div class="chart-wrap chart-h-md"><canvas id="admin-revenue-chart"></canvas></div>
    </div>`;
  setTimeout(()=>drawAdminRevenueChart(),100);
}

function drawAdminRevenueChart() {
  destroyChart('admin-revenue-chart');
  const canvas = document.getElementById('admin-revenue-chart');
  if (!canvas) return;
  const revByTherapy = {};
  DB.sessions.filter(s=>s.status==='completed').forEach(s=>{
    const t = getTherapy(s.therapyId);
    if (t) revByTherapy[t.name] = (revByTherapy[t.name]||0) + t.price;
  });
  const labels = Object.keys(revByTherapy);
  const vals   = Object.values(revByTherapy);
  if (!labels.length) return;
  const colors = ['#2D5016','#4A7C2B','#D4A574','#17A2B8','#FFC107','#DC3545','#8e44ad','#e67e22'];
  canvas.style.height = '300px';
  _charts['admin-revenue-chart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data: vals,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN')}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Lato', size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#E5DDD0' },
             ticks: { font: { family: 'Lato', size: 11 },
                      callback: v => '₹' + (v>=1000 ? (v/1000).toFixed(0)+'K' : v) } },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ADMIN — USERS & DOCTOR VERIFICATION
// ═══════════════════════════════════════════════════════════
function renderAdminUsers(el) {
  const filterRole = window._adminUserFilter || 'all';
  const pendingDoctors = DB.users.filter(u => u.role === 'doctor' && u.verificationStatus === 'pending');
  const users = filterRole === 'verification'
    ? DB.users.filter(u => u.role === 'doctor')
    : filterRole === 'all'
    ? DB.users
    : DB.users.filter(u => u.role === filterRole);

  el.innerHTML=`
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h2>👥 User Management</h2>
          <p>Manage patients, doctors, and verify new doctor registrations</p>
        </div>
        <button class="btn btn-green" onclick="openAdminAddUserModal()">+ Add User</button>
      </div>
    </div>

    ${pendingDoctors.length ? `
    <div class="card" style="border:2px solid var(--warning);margin-bottom:20px">
      <div class="card-header">
        <span class="card-title">⚡ Doctor Verification Required</span>
        <span class="badge" style="background:#fff3e0;color:#E65100;font-size:0.8rem">${pendingDoctors.length} pending</span>
      </div>
      <p style="font-size:0.85rem;color:var(--text-med);margin-bottom:16px">
        The following doctors have registered and are awaiting credential verification before they can access the platform.
      </p>
      ${pendingDoctors.map(d => `
      <div class="verify-row">
        <div class="verify-avatar">${d.avatar}</div>
        <div class="verify-info">
          <div class="verify-name">${d.name}</div>
          <div class="verify-meta">📧 ${d.email} · 📞 ${d.phone||'—'}</div>
          <div class="verify-tags">
            <span class="verify-tag">🏥 ${d.specialization||'—'}</span>
            <span class="verify-tag">🎓 ${d.qualification||'—'}</span>
            <span class="verify-tag">⏱ ${d.experience||'—'}</span>
            <span class="verify-tag">📅 Applied: ${d.appliedAt?formatDate(d.appliedAt.split('T')[0]):'Today'}</span>
          </div>
        </div>
        <div class="verify-actions">
          <button class="btn btn-sm btn-green" onclick="verifyDoctor('${d.id}','approved')">✓ Approve</button>
          <button class="btn btn-sm btn-outline" onclick="viewDoctorDetails('${d.id}')">View Details</button>
          <button class="btn btn-sm btn-danger" onclick="openRejectModal('${d.id}')">✕ Reject</button>
        </div>
      </div>`).join('')}
    </div>` : ''}

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div class="section-tabs" style="margin-bottom:0">
        ${[['all','All Users'],['patient','Patients'],['doctor','Doctors'],['verification','Verification'],['admin','Admins']].map(([v,l])=>`
          <button class="section-tab ${filterRole===v?'active':''}" onclick="window._adminUserFilter='${v}';showPage('admin-users')">
            ${l}${v==='verification'&&pendingDoctors.length?` <span style="background:var(--warning);color:white;border-radius:99px;padding:1px 6px;font-size:0.7rem;font-weight:700;margin-left:4px">${pendingDoctors.length}</span>`:''}
          </button>`).join('')}
      </div>
    </div>

    <div class="card">
      ${filterRole === 'verification' ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Doctor</th><th>Specialization</th><th>Qualification</th><th>Applied</th><th>Verification</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map(d=>{
              const vs = d.verificationStatus || 'pending';
              const vb = { approved:'verify-badge-approved', pending:'verify-badge-pending', rejected:'verify-badge-rejected' };
              const vi = { approved:'✅ Approved', pending:'⏳ Pending', rejected:'❌ Rejected' };
              return `<tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                  <div style="width:36px;height:36px;border-radius:50%;background:#1565C0;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">${d.avatar}</div>
                  <div><div style="font-weight:600">${d.name}</div><div style="font-size:0.78rem;color:var(--text-light)">${d.email}</div></div>
                </div></td>
                <td>${d.specialization||'—'}</td>
                <td>${d.qualification||'—'}</td>
                <td>${d.appliedAt?formatDate(d.appliedAt.split('T')[0]):'—'}</td>
                <td><span class="badge ${vb[vs]||'badge-gray'}">${vi[vs]}</span></td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm btn-outline" onclick="viewDoctorDetails('${d.id}')">Details</button>
                  ${vs==='pending'?`<button class="btn btn-sm btn-green" onclick="verifyDoctor('${d.id}','approved')">✓ Approve</button> <button class="btn btn-sm btn-danger" onclick="openRejectModal('${d.id}')">✕ Reject</button>`:''}
                  ${vs==='approved'?`<button class="btn btn-sm btn-danger" onclick="openRejectModal('${d.id}')">Revoke</button>`:''}
                  ${vs==='rejected'?`<button class="btn btn-sm btn-green" onclick="verifyDoctor('${d.id}','approved')">Re-Approve</button>`:''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map(u=>{
              const isDr = u.role==='doctor';
              const vs   = isDr ? (u.verificationStatus||'pending') : null;
              const vb   = { approved:'badge-green', pending:'badge-yellow', rejected:'badge-red' };
              return `<tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                  <div style="width:36px;height:36px;border-radius:50%;background:${u.role==='doctor'?'#1565C0':u.role==='admin'?'#C62828':'var(--primary)'};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">${u.avatar}</div>
                  <div><div style="font-weight:600">${u.name}</div><div style="font-size:0.78rem;color:var(--text-light)">${u.email}</div></div>
                </div></td>
                <td><span class="role-badge ${u.role}">${u.role}</span></td>
                <td>${u.phone||'—'}</td>
                <td>${isDr?`<span class="badge ${vb[vs]||'badge-gray'}">${vs==='approved'?'✅ Verified':vs==='pending'?'⏳ Pending':'❌ Rejected'}</span>`:'<span class="badge badge-green">Active</span>'}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="adminEditUser('${u.id}')">Edit</button>
                  ${isDr&&vs==='pending'?`<button class="btn btn-sm btn-green" onclick="verifyDoctor('${u.id}','approved')">✓ Approve</button>`:''}
                  <button class="btn btn-sm btn-danger" onclick="adminDeleteUser('${u.id}')">Delete</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>`;
}

function verifyDoctor(doctorId, decision) {
  const doctor = getUser(doctorId);
  if (!doctor) return;
  doctor.verificationStatus = decision;

  if (decision === 'approved') {
    // Notify doctor
    DB.notifications.push({
      id:genId('n'), userId:doctorId, type:'system', priority:'high', read:false,
      title:'🎉 Account Approved! Welcome to Panchakarma',
      message:`Congratulations ${doctor.name}! Your doctor account has been verified and approved by our admin team. You can now sign in and access your full dashboard.`,
      createdAt: new Date().toISOString(),
    });
    // Notify admin
    DB.notifications.push({
      id:genId('n'), userId:currentUser.id, type:'system', priority:'normal', read:true,
      title:`✅ Doctor Approved — ${doctor.name}`,
      message:`${doctor.name} (${doctor.specialization}) has been approved and can now access the platform.`,
      createdAt: new Date().toISOString(),
    });
    showToast(`✅ ${doctor.name} approved and notified!`, 'success');
  }
  showPage('admin-users');
}

function openRejectModal(doctorId) {
  const doctor = getUser(doctorId);
  const isRevoke = doctor?.verificationStatus === 'approved';
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${isRevoke ? '⚠️ Revoke Access' : '❌ Reject Application'}</div>
      <button class="modal-close" onclick="closeMod()">✕</button>
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:14px;margin-bottom:20px">
      <div style="font-weight:700">${doctor?.name}</div>
      <div style="font-size:0.82rem;color:var(--text-light)">${doctor?.specialization} · ${doctor?.email}</div>
    </div>
    <div class="form-row">
      <label>${isRevoke ? 'Reason for Revoking Access' : 'Reason for Rejection'} *</label>
      <select id="reject-reason" onchange="toggleCustomReason(this.value)">
        <option value="">Select a reason…</option>
        <option value="Credentials could not be verified">Credentials could not be verified</option>
        <option value="Qualification documents incomplete">Qualification documents incomplete</option>
        <option value="Not affiliated with registered clinic">Not affiliated with registered clinic</option>
        <option value="Duplicate account detected">Duplicate account detected</option>
        <option value="Policy violation">Policy violation</option>
        <option value="custom">Other (specify below)</option>
      </select>
    </div>
    <div class="form-row" id="custom-reason-row" style="display:none">
      <label>Custom Reason</label>
      <textarea id="reject-custom" placeholder="Describe the reason…" rows="3"></textarea>
    </div>
    <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:4px">
      ${isRevoke ? 'The doctor will lose access immediately and be notified.' : 'The applicant will be notified with this reason.'}
    </p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmReject('${doctorId}','${isRevoke}')">${isRevoke ? 'Revoke Access' : 'Reject Application'}</button>
    </div>`);
}

function toggleCustomReason(val) {
  const row = document.getElementById('custom-reason-row');
  if (row) row.style.display = val === 'custom' ? '' : 'none';
}

function confirmReject(doctorId, isRevoke) {
  const reasonSel = document.getElementById('reject-reason')?.value;
  const reasonCustom = document.getElementById('reject-custom')?.value?.trim();
  if (!reasonSel) { showToast('Please select a reason', 'error'); return; }
  const reason = reasonSel === 'custom' ? reasonCustom || 'No reason provided' : reasonSel;

  const doctor = getUser(doctorId);
  if (!doctor) return;
  doctor.verificationStatus = 'rejected';
  doctor.rejectionReason    = reason;

  DB.notifications.push({
    id:genId('n'), userId:doctorId, type:'system', priority:'high', read:false,
    title: isRevoke === 'true' ? '⚠️ Your Access Has Been Revoked' : '❌ Doctor Application Rejected',
    message: isRevoke === 'true'
      ? `Your doctor account access has been revoked. Reason: ${reason}. Please contact admin@panchakarma.com for more information.`
      : `Your doctor application was not approved. Reason: ${reason}. You may re-apply with updated credentials or contact admin@panchakarma.com.`,
    createdAt: new Date().toISOString(),
  });

  closeMod();
  showToast(`${isRevoke==='true'?'Access revoked':'Application rejected'} — ${doctor.name} notified`, 'warning');
  showPage('admin-users');
}

function viewDoctorDetails(doctorId) {
  const d = getUser(doctorId);
  if (!d) return;
  const vs = d.verificationStatus || 'pending';
  const vColor = { approved:'var(--success)', pending:'var(--warning)', rejected:'var(--danger)' };
  const dSessions = DB.sessions.filter(s => s.doctorId === d.id);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Doctor Application Details</div>
      <button class="modal-close" onclick="closeMod()">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,var(--primary),var(--primary-mid));border-radius:var(--radius-md);padding:18px;color:white;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700">${d.avatar}</div>
      <div>
        <div style="font-family:var(--font-serif);font-size:1.25rem;font-weight:700">${d.name}</div>
        <div style="font-size:0.82rem;opacity:0.85">${d.specialization} · ${d.qualification}</div>
        <div style="margin-top:6px;display:inline-block;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:99px;font-size:0.75rem;font-weight:700">${vs.toUpperCase()}</div>
      </div>
    </div>
    ${[
      ['📧 Email', d.email],
      ['📞 Phone', d.phone||'—'],
      ['🏥 Specialization', d.specialization||'—'],
      ['🎓 Qualification', d.qualification||'—'],
      ['⏱ Experience', d.experience||'—'],
      ['📅 Applied On', d.appliedAt ? formatDate(d.appliedAt.split('T')[0]) : 'Today'],
      ['📊 Sessions (if any)', dSessions.length + ' sessions'],
      ...(d.rejectionReason ? [['❌ Rejection Reason', d.rejectionReason]] : []),
    ].map(([k,v]) => `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:0.88rem">
        <span style="color:var(--text-med)">${k}</span>
        <span style="font-weight:600;color:${k.includes('Reason')?'var(--danger)':'var(--text)'}">${v}</span>
      </div>`).join('')}
    <div class="modal-footer" style="margin-top:16px">
      <button class="btn btn-outline" onclick="closeMod()">Close</button>
      ${vs==='pending'||vs==='rejected'?`<button class="btn btn-green" onclick="closeMod();verifyDoctor('${d.id}','approved')">✅ Approve</button>`:''}
      ${vs==='pending'?`<button class="btn btn-danger" onclick="closeMod();openRejectModal('${d.id}')">❌ Reject</button>`:''}
      ${vs==='approved'?`<button class="btn btn-danger" onclick="closeMod();openRejectModal('${d.id}')">⚠️ Revoke Access</button>`:''}
    </div>`);
}

function openAdminAddUserModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">Add New User</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row required"><label>Full Name</label><input type="text" id="au-name"></div>
      <div class="form-row required"><label>Email</label><input type="email" id="au-email"></div>
      <div class="form-row required"><label>Role</label><select id="au-role"><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="admin">Admin</option></select></div>
      <div class="form-row"><label>Phone</label><input type="tel" id="au-phone"></div>
      <div class="form-row required"><label>Password</label><input type="password" id="au-pw" value="demo123"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="adminAddUser()">Add User</button></div>`);
}
function adminAddUser() {
  const name=document.getElementById('au-name').value, email=document.getElementById('au-email').value;
  if(!name||!email){showToast('Name and email required','error');return;}
  const role=document.getElementById('au-role').value;
  DB.users.push({ id:genId('u'), name, email, password:document.getElementById('au-pw').value, role, phone:document.getElementById('au-phone').value, avatar:name.split(' ').map(w=>w[0]).join('').substr(0,2).toUpperCase() });
  closeMod(); showToast(`User ${name} added!`,'success'); showPage('admin-users');
}
function adminEditUser(id) {
  const u=getUser(id);
  if(!u)return;
  openModal(`
    <div class="modal-header"><div class="modal-title">Edit User: ${u.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row"><label>Full Name</label><input type="text" id="eu-name" value="${u.name}"></div>
      <div class="form-row"><label>Phone</label><input type="tel" id="eu-phone" value="${u.phone||''}"></div>
      ${u.role==='patient'?`<div class="form-row"><label>Dosha</label><select id="eu-dosha"><option ${u.dosha==='Vata'?'selected':''}>Vata</option><option ${u.dosha==='Pitta'?'selected':''}>Pitta</option><option ${u.dosha==='Kapha'?'selected':''}>Kapha</option></select></div>`:''}
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="doEditUser('${id}')">Save Changes</button></div>`);
}
function doEditUser(id) {
  const u=getUser(id);
  if(!u)return;
  u.name=document.getElementById('eu-name').value||u.name;
  u.phone=document.getElementById('eu-phone').value||u.phone;
  const ds=document.getElementById('eu-dosha');
  if(ds)u.dosha=ds.value;
  closeMod(); showToast('User updated!','success'); showPage('admin-users');
}
function adminDeleteUser(id) {
  if (id === currentUser.id) { showToast('You cannot delete your own account.', 'error'); return; }
  const u = getUser(id);
  if (!u) return;
  // Prevent deleting the last admin
  if (u.role === 'admin') {
    const adminCount = DB.users.filter(x => x.role === 'admin').length;
    if (adminCount <= 1) { showToast('Cannot delete the last admin account.', 'error'); return; }
  }
  openModal(`
    <div class="modal-header"><div class="modal-title">🗑 Delete User</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="background:#fce4ec;border-radius:var(--radius-md);padding:14px;margin-bottom:18px;font-size:0.85rem;color:#c62828">
      ⚠️ <strong>This action cannot be undone.</strong> All associated sessions, prescriptions, and data will be lost.
    </div>
    <p style="color:var(--text-med);margin-bottom:20px">
      Delete <strong>${u.name}</strong> (${u.role}${u.patientCode ? ' · ' + u.patientCode : ''})?
    </p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-danger" onclick="doDelete('${id}')">Permanently Delete</button>
    </div>`);
}
function doDelete(id) {
  if (id === currentUser.id) { showToast('Cannot delete yourself.', 'error'); closeMod(); return; }
  const idx = DB.users.findIndex(u => u.id === id);
  if (idx >= 0) DB.users.splice(idx, 1);
  // Also remove related data
  DB.sessions      = DB.sessions.filter(s => s.patientId !== id && s.doctorId !== id);
  DB.notifications = DB.notifications.filter(n => n.userId !== id);
  DB.feedback      = DB.feedback.filter(f => f.patientId !== id);
  DB.prescriptions = DB.prescriptions.filter(p => p.patientId !== id && p.doctorId !== id);
  DB.milestones    = DB.milestones.filter(m => m.patientId !== id);
  DB.orders        = DB.orders.filter(o => o.patientId !== id);
  closeMod(); showToast('User and all associated data deleted.', 'warning'); showPage('admin-users');
}

// ═══════════════════════════════════════════════════════════
// ADMIN — THERAPIES
// ═══════════════════════════════════════════════════════════
function renderAdminTherapies(el) {
  el.innerHTML=`
    <div class="page-header"><h2>🌿 Therapy Management</h2><p>Configure Panchakarma therapy offerings</p></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px"><button class="btn btn-green" onclick="openAddTherapyModal()">+ Add Therapy</button></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Therapy</th><th>Category</th><th>Duration</th><th>Price</th><th>Usage</th><th>Actions</th></tr></thead>
          <tbody>
            ${DB.therapies.map(t=>{
              const usage=DB.sessions.filter(s=>s.therapyId===t.id).length;
              return `<tr>
                <td><span style="color:${t.color}">●</span> <strong>${t.name}</strong><br><span style="font-size:0.78rem;color:var(--text-light)">${t.description}</span></td>
                <td><span class="badge badge-green">${t.category}</span></td>
                <td>${t.duration} min</td>
                <td>₹${t.price.toLocaleString()}</td>
                <td>${usage} sessions</td>
                <td><button class="btn btn-sm btn-outline" onclick="editTherapy('${t.id}')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteTherapy('${t.id}')">Delete</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
function openAddTherapyModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">Add Therapy</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row required full"><label>Therapy Name</label><input type="text" id="th-name"></div>
      <div class="form-row required"><label>Category</label><select id="th-cat"><option>Purvakarma</option><option>Pradhanakarma</option><option>Pashchatkarma</option><option>Keraliya</option></select></div>
      <div class="form-row required"><label>Duration (min)</label><input type="number" id="th-dur" value="60"></div>
      <div class="form-row required"><label>Price (₹)</label><input type="number" id="th-price" value="2000"></div>
      <div class="form-row full"><label>Description</label><textarea id="th-desc"></textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="addTherapy()">Add Therapy</button></div>`);
}
function addTherapy() {
  const name=document.getElementById('th-name').value;
  if(!name){showToast('Therapy name required','error');return;}
  DB.therapies.push({ id:genId('t'), name, category:document.getElementById('th-cat').value, duration:parseInt(document.getElementById('th-dur').value)||60, price:parseInt(document.getElementById('th-price').value)||2000, description:document.getElementById('th-desc').value, color:'#4A7C2B' });
  closeMod(); showToast('Therapy added!','success'); showPage('admin-therapies');
}
function editTherapy(id) {
  const t=getTherapy(id);
  if(!t)return;
  openModal(`
    <div class="modal-header"><div class="modal-title">Edit: ${t.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row"><label>Name</label><input type="text" id="et-name" value="${t.name}"></div>
      <div class="form-row"><label>Duration (min)</label><input type="number" id="et-dur" value="${t.duration}"></div>
      <div class="form-row full"><label>Price (₹)</label><input type="number" id="et-price" value="${t.price}"></div>
      <div class="form-row full"><label>Description</label><textarea id="et-desc">${t.description}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="doEditTherapy('${id}')">Save</button></div>`);
}
function doEditTherapy(id) {
  const t=getTherapy(id);
  if(!t)return;
  t.name=document.getElementById('et-name').value||t.name;
  t.duration=parseInt(document.getElementById('et-dur').value)||t.duration;
  t.price=parseInt(document.getElementById('et-price').value)||t.price;
  t.description=document.getElementById('et-desc').value||t.description;
  closeMod(); showToast('Therapy updated!','success'); showPage('admin-therapies');
}
function deleteTherapy(id) {
  const t=getTherapy(id);
  openModal(`<div class="modal-header"><div class="modal-title">Delete Therapy</div><button class="modal-close" onclick="closeMod()">✕</button></div><p style="color:var(--text-med);margin-bottom:20px">Delete <strong>${t?.name}</strong>?</p><div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-danger" onclick="doDeleteTherapy('${id}')">Delete</button></div>`);
}
function doDeleteTherapy(id) {
  const idx=DB.therapies.findIndex(t=>t.id===id);
  if(idx>=0)DB.therapies.splice(idx,1);
  closeMod(); showToast('Therapy deleted','warning'); showPage('admin-therapies');
}

// ═══════════════════════════════════════════════════════════
// ADMIN — APPOINTMENTS
// ═══════════════════════════════════════════════════════════
function renderAdminAppointments(el) {
  const filter  = window._adminApptFilter || 'all';
  const search  = window._adminApptSearch || '';
  const pageNum = window._adminApptPage  || 1;
  const PAGE_SZ = 20;

  let sessions = filter === 'all' ? DB.sessions : DB.sessions.filter(s=>s.status===filter);
  if (search) {
    const sq = search.toLowerCase();
    sessions = sessions.filter(s => {
      const pt = getUser(s.patientId), dr = getUser(s.doctorId), th = getTherapy(s.therapyId);
      return (pt?.name||'').toLowerCase().includes(sq)
          || (pt?.patientCode||'').toLowerCase().includes(sq)
          || (dr?.name||'').toLowerCase().includes(sq)
          || (th?.name||'').toLowerCase().includes(sq)
          || s.date.includes(sq);
    });
  }
  sessions = sessions.sort((a,b)=>b.date.localeCompare(a.date));
  const total     = sessions.length;
  const totalPages= Math.ceil(total / PAGE_SZ) || 1;
  const page      = Math.min(Math.max(pageNum, 1), totalPages);
  const slice     = sessions.slice((page-1)*PAGE_SZ, page*PAGE_SZ);

  const statusCls = { scheduled:'badge-blue', completed:'badge-green', cancelled:'badge-red', rescheduled:'badge-yellow' };

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><h2>📅 All Appointments</h2><p>${total} total appointments</p></div>
        <input type="text" placeholder="🔍 Search patient, doctor, therapy…"
               value="${search}"
               oninput="window._adminApptSearch=this.value;window._adminApptPage=1;showPage('admin-appointments')"
               style="padding:9px 14px;border:2px solid var(--border);border-radius:var(--radius-sm);font-size:0.88rem;width:260px">
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="section-tabs" style="margin-bottom:0">
        ${[['all','All'],['scheduled','Scheduled'],['completed','Completed'],['cancelled','Cancelled']].map(([v,l])=>
          `<button class="section-tab ${filter===v?'active':''}" onclick="window._adminApptFilter='${v}';window._adminApptPage=1;showPage('admin-appointments')">${l}</button>`
        ).join('')}
      </div>
      <span class="badge badge-blue">Page ${page} of ${totalPages}</span>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date & Time</th><th>Patient</th><th>Patient ID</th><th>Doctor</th><th>Therapy</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${slice.map(s=>{
              const pt=getUser(s.patientId), dr=getUser(s.doctorId), th=getTherapy(s.therapyId);
              return `<tr>
                <td>${formatDate(s.date)}<br><small style="color:var(--text-light)">${formatTime(s.time)}</small></td>
                <td><strong>${pt?.name||'—'}</strong></td>
                <td><span style="font-family:var(--font-serif);font-weight:700;color:var(--primary);font-size:0.85rem">${pt?.patientCode||'—'}</span></td>
                <td>${dr?.name||'—'}</td>
                <td>${th?.name||'—'}</td>
                <td>₹${th?.price?.toLocaleString()||'—'}</td>
                <td><span class="badge ${statusCls[s.status]||'badge-gray'}">${s.status}</span></td>
                <td style="white-space:nowrap">
                  ${s.status==='scheduled'
                    ? `<button class="btn btn-sm btn-green" onclick="adminCompleteSession('${s.id}')">Complete</button>
                       <button class="btn btn-sm btn-danger" onclick="adminCancelSession('${s.id}')">Cancel</button>`
                    : '—'}
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-light)">No appointments found</td></tr>'}
          </tbody>
        </table>
      </div>
      <!-- Pagination -->
      ${totalPages > 1 ? `
      <div style="display:flex;justify-content:center;align-items:center;gap:8px;padding:16px 0 4px;flex-wrap:wrap">
        <button class="btn btn-sm btn-outline" ${page<=1?'disabled':''} onclick="window._adminApptPage=${page-1};showPage('admin-appointments')">← Prev</button>
        ${Array.from({length:totalPages},(_,i)=>i+1).filter(p=>Math.abs(p-page)<=2||p===1||p===totalPages).reduce((acc,p,i,arr)=>{
          if(i>0&&arr[i-1]!==p-1) acc.push('<span style="padding:0 4px;color:var(--text-light)">…</span>');
          acc.push(`<button class="btn btn-sm ${p===page?'btn-green':'btn-outline'}" onclick="window._adminApptPage=${p};showPage('admin-appointments')">${p}</button>`);
          return acc;
        },[]).join('')}
        <button class="btn btn-sm btn-outline" ${page>=totalPages?'disabled':''} onclick="window._adminApptPage=${page+1};showPage('admin-appointments')">Next →</button>
      </div>` : ''}
    </div>`;
}
function adminCompleteSession(id) {
  const s=DB.sessions.find(s=>s.id===id);
  if(s){s.status='completed';showToast('Session marked complete','success');showPage('admin-appointments');}
}
function adminCancelSession(id) {
  const s = DB.sessions.find(s => s.id === id);
  if (!s) return;

  const cancelledTime   = s.time;
  const cancelledDate   = s.date;
  const cancelledDoctor = s.doctorId;
  const th  = getTherapy(s.therapyId);
  const pt  = getUser(s.patientId);

  s.status      = 'cancelled';
  s.cancelledAt = new Date().toISOString();

  // Notify patient
  DB.notifications.push({
    id: genId('n'), userId: s.patientId, type: 'system',
    priority: 'high', read: false,
    title: `❌ Session Cancelled — ${th?.name || 'Session'}`,
    message: `Your ${th?.name || 'session'} on ${formatDate(cancelledDate)} at ${formatTime(cancelledTime)} was cancelled by the clinic.`,
    createdAt: new Date().toISOString(),
  });

  // Auto-reallocation
  const next = DB.sessions
    .filter(ws => ws.doctorId===cancelledDoctor && ws.date===cancelledDate && ws.status==='scheduled' && ws.time>cancelledTime)
    .sort((a,b) => a.time.localeCompare(b.time))[0];

  if (next) {
    const oldTime = next.time;
    const nextPt  = getUser(next.patientId);
    const nextDr  = getUser(cancelledDoctor);
    const nextTh  = getTherapy(next.therapyId);
    next.time          = cancelledTime;
    next.reallocatedAt = new Date().toISOString();
    next.prevTime      = oldTime;

    DB.notifications.push({
      id: genId('n'), userId: next.patientId, type: 'system',
      priority: 'high', read: false,
      title: `🎉 Earlier Slot Available — Your Session Moved!`,
      message: `A slot opened up earlier. Your ${nextTh?.name || 'session'} with ${nextDr?.name || 'your doctor'} on ${formatDate(cancelledDate)} has been moved from ${formatTime(oldTime)} to ${formatTime(cancelledTime)}.`,
      createdAt: new Date().toISOString(),
    });
    DB.notifications.push({
      id: genId('n'), userId: cancelledDoctor, type: 'system',
      priority: 'normal', read: false,
      title: `🔄 Schedule Updated — Auto-Reallocation`,
      message: `${nextPt?.name || 'A patient'} (${nextPt?.patientCode || '—'}) moved from ${formatTime(oldTime)} to ${formatTime(cancelledTime)} on ${formatDate(cancelledDate)}.`,
      createdAt: new Date().toISOString(),
    });
    showToast(`Cancelled. ${nextPt?.name?.split(' ')[0] || 'Next patient'} auto-moved to ${formatTime(cancelledTime)} 🔄`, 'success');
  } else {
    showToast('Session cancelled.', 'warning');
  }
  buildNav();
  showPage('admin-appointments');
}

// ═══════════════════════════════════════════════════════════
// ADMIN — REPORTS
// ═══════════════════════════════════════════════════════════
function renderAdminReports(el) {
  const allSessions   = DB.sessions;
  const completed     = allSessions.filter(s=>s.status==='completed');
  const scheduled     = allSessions.filter(s=>s.status==='scheduled');
  const cancelled     = allSessions.filter(s=>s.status==='cancelled');
  const totalRev      = completed.reduce((sum,s)=>{const t=getTherapy(s.therapyId);return sum+(t?.price||0);},0);
  const now           = new Date();
  const monthlyRev    = completed.filter(s=>{const d=new Date(s.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((sum,s)=>{const t=getTherapy(s.therapyId);return sum+(t?.price||0);},0);
  const avgRating     = DB.feedback.length ? (DB.feedback.reduce((s,f)=>s+f.rating,0)/DB.feedback.length).toFixed(1) : '—';
  const shopRev       = DB.orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0);
  const totalPatients = DB.users.filter(u=>u.role==='patient').length;
  const activeDoctors = DB.users.filter(u=>u.role==='doctor'&&(u.verificationStatus||'approved')==='approved').length;

  // Top therapy by revenue
  const therapyRevMap = {};
  completed.forEach(s=>{const t=getTherapy(s.therapyId);if(t){therapyRevMap[t.name]=(therapyRevMap[t.name]||0)+t.price;}});
  const topTherapy = Object.entries(therapyRevMap).sort((a,b)=>b[1]-a[1])[0];

  // Monthly revenue for last 6 months
  const monthlyData = [];
  for (let i=5; i>=0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth()-i);
    const rev = completed.filter(s=>{const sd=new Date(s.date);return sd.getMonth()===d.getMonth()&&sd.getFullYear()===d.getFullYear();}).reduce((sum,s)=>{const t=getTherapy(s.therapyId);return sum+(t?.price||0);},0);
    const shopM = DB.orders.filter(o=>{const od=new Date(o.placedAt);return od.getMonth()===d.getMonth()&&od.getFullYear()===d.getFullYear()&&o.status!=='cancelled';}).reduce((s,o)=>s+o.total,0);
    monthlyData.push({ label: d.toLocaleDateString('en-IN',{month:'short'}), therapy: rev, shop: shopM });
  }

  el.innerHTML=`
    <div class="page-header"><h2>📊 System Reports</h2><p>Clinic analytics, financials and performance overview</p></div>

    <!-- KPI row -->
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">💰</span><div class="stat-label">Total Revenue</div><div class="stat-value">₹${(totalRev/1000).toFixed(1)}K</div><div class="stat-sub">Therapy sessions</div></div>
      <div class="stat-card"><span class="stat-icon">🛒</span><div class="stat-label">Shop Revenue</div><div class="stat-value">₹${(shopRev/1000).toFixed(1)}K</div><div class="stat-sub">Herbal products</div></div>
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">This Month</div><div class="stat-value">₹${(monthlyRev/1000).toFixed(1)}K</div><div class="stat-sub">${now.toLocaleDateString('en-IN',{month:'long'})}</div></div>
      <div class="stat-card"><span class="stat-icon">⭐</span><div class="stat-label">Avg Rating</div><div class="stat-value">${avgRating}/10</div><div class="stat-sub">Patient satisfaction</div></div>
    </div>

    <!-- Secondary KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      ${[
        ['👥','Patients',totalPatients,'Registered'],
        ['👨‍⚕️','Doctors',activeDoctors,'Active & verified'],
        ['✅','Completed',completed.length,'Sessions done'],
        ['🏆','Top Therapy',topTherapy?topTherapy[0]:'—',topTherapy?`₹${(topTherapy[1]/1000).toFixed(1)}K revenue`:'No data'],
      ].map(([icon,label,val,sub])=>`
        <div style="background:white;border-radius:var(--radius-md);padding:16px;box-shadow:var(--shadow-sm);text-align:center">
          <div style="font-size:1.6rem;margin-bottom:6px">${icon}</div>
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light)">${label}</div>
          <div style="font-family:var(--font-serif);font-size:1.3rem;font-weight:700;color:var(--primary);margin:4px 0 2px">${val}</div>
          <div style="font-size:0.72rem;color:var(--text-light)">${sub}</div>
        </div>`).join('')}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">📈 6-Month Revenue Trend</span></div>
        <div class="chart-wrap chart-h-lg"><canvas id="monthly-trend-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🥧 Session Status</span></div>
        <div class="chart-wrap chart-h-lg"><canvas id="status-pie-chart"></canvas></div>
      </div>
    </div>

    <!-- Detailed tables row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">👨‍⚕️ Doctor Performance</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Doctor</th><th>Patients</th><th>Sessions</th><th>Revenue</th><th>Rating</th></tr></thead>
            <tbody>
              ${DB.users.filter(u=>u.role==='doctor'&&(u.verificationStatus||'approved')==='approved').map(d=>{
                const dSess = DB.sessions.filter(s=>s.doctorId===d.id&&s.status==='completed');
                const dPat  = [...new Set(DB.sessions.filter(s=>s.doctorId===d.id).map(s=>s.patientId))];
                const dRev  = dSess.reduce((sum,s)=>{const t=getTherapy(s.therapyId);return sum+(t?.price||0);},0);
                return `<tr>
                  <td><div style="font-weight:600">${d.name}</div><div style="font-size:0.75rem;color:var(--text-light)">${d.specialization}</div></td>
                  <td>${dPat.length}</td>
                  <td>${dSess.length}</td>
                  <td>₹${(dRev/1000).toFixed(1)}K</td>
                  <td>⭐ ${d.rating||'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🌿 Revenue by Therapy</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Therapy</th><th>Sessions</th><th>Revenue</th><th>Share</th></tr></thead>
            <tbody>
              ${Object.entries(therapyRevMap).sort((a,b)=>b[1]-a[1]).map(([name,rev])=>{
                const count = completed.filter(s=>getTherapy(s.therapyId)?.name===name).length;
                const share = totalRev ? Math.round(rev/totalRev*100) : 0;
                return `<tr>
                  <td><strong>${name}</strong></td>
                  <td>${count}</td>
                  <td>₹${(rev/1000).toFixed(1)}K</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="height:6px;border-radius:3px;background:var(--primary);width:${share}px;min-width:4px"></div>
                      <span style="font-size:0.78rem;color:var(--text-light)">${share}%</span>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Recent feedback summary -->
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <span class="card-title">💬 Recent Patient Feedback</span>
        <span class="badge badge-green">${DB.feedback.length} total reviews</span>
      </div>
      ${DB.feedback.slice().reverse().slice(0,6).map(f=>{
        const pt = getUser(f.patientId);
        const s  = DB.sessions.find(ss=>ss.id===f.sessionId);
        const th = s ? getTherapy(s.therapyId) : null;
        const dr = s ? getUser(s.doctorId) : null;
        const stars = Math.round(f.rating/2);
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">${pt?.avatar||'?'}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.88rem">${pt?.name||'—'}</div>
            <div style="font-size:0.78rem;color:var(--text-light)">${th?.name||'Session'} with ${dr?.name||'—'} · ${formatDate(f.submittedAt)}</div>
            ${f.comments?`<div style="font-size:0.82rem;color:var(--text-med);margin-top:3px;font-style:italic">"${f.comments}"</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="color:var(--accent);font-size:0.9rem">${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</div>
            <div style="font-weight:700;color:var(--primary)">${f.rating}/10</div>
            <span class="badge badge-${f.energyLevel==='much_improved'?'green':f.energyLevel==='slightly_improved'?'blue':'gray'}" style="font-size:0.7rem">${f.energyLevel?.replace(/_/g,' ')}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  setTimeout(()=>{
    drawStatusPieChart();
    drawMonthlyTrendChart(monthlyData);
    addExportButtons(el);
  }, 100);
}

// ── Chart.js helper — destroy previous instance before redraw ─
const _charts = {};
function destroyChart(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }

function drawMonthlyTrendChart(data) {
  destroyChart('monthly-trend-chart');
  const canvas = document.getElementById('monthly-trend-chart');
  if (!canvas) return;
  canvas.height = 360;
  _charts['monthly-trend-chart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [
        { label: 'Therapy Revenue (₹)', data: data.map(d => d.therapy),
          backgroundColor: 'rgba(45,80,22,0.85)', borderRadius: 4, stack: 'rev' },
        { label: 'Shop Revenue (₹)',    data: data.map(d => d.shop),
          backgroundColor: 'rgba(212,165,116,0.80)', borderRadius: 4, stack: 'rev' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Lato', size: 11 }, usePointStyle: true, pointStyle: 'rect' } },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN')}` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false },
             ticks: { font: { family: 'Lato', size: 11 } } },
        y: { stacked: true, beginAtZero: true,
             ticks: { font: { family: 'Lato', size: 11 },
                      callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'K' : v) },
             grid: { color: '#E5DDD0' } },
      },
    },
  });
}

function drawStatusPieChart() {
  destroyChart('status-pie-chart');
  const canvas = document.getElementById('status-pie-chart');
  if (!canvas) return;
  const sch = DB.sessions.filter(s=>s.status==='scheduled').length;
  const cmp = DB.sessions.filter(s=>s.status==='completed').length;
  const cnc = DB.sessions.filter(s=>s.status==='cancelled').length;
  if (!sch && !cmp && !cnc) return;
  canvas.height = 360;
  _charts['status-pie-chart'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Scheduled', 'Completed', 'Cancelled'],
      datasets: [{ data: [sch, cmp, cnc],
        backgroundColor: ['#17A2B8','#28A745','#DC3545'],
        borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Lato', size: 11 }, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
      },
    },
  });
}


// ═══════════════════════════════════════════════════════════
// SHARED — PROFILE
// ═══════════════════════════════════════════════════════════
function renderProfile(el) {
  const u = currentUser;
  const sessions = DB.sessions.filter(s => s.patientId === u.id || s.doctorId === u.id);
  const completedSess = sessions.filter(s => s.status === 'completed').length;
  const avatarColors = ['#2D5016','#1565C0','#C62828','#6A0080','#E65100','#00796B'];
  const colorIdx = u.id.charCodeAt(u.id.length-1) % avatarColors.length;
  const avatarBg = avatarColors[colorIdx];

  el.innerHTML=`
    <div class="page-header"><h2>👤 My Profile</h2><p>Manage your personal information and account</p></div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start">

      <!-- LEFT: Avatar + quick stats -->
      <div>
        <div class="card" style="text-align:center;padding:32px 24px">
          <!-- Avatar with colour picker -->
          <div style="position:relative;display:inline-block;margin-bottom:16px">
            <div id="profile-avatar-display" style="width:100px;height:100px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:2rem;margin:0 auto;box-shadow:0 4px 16px rgba(0,0,0,0.15);cursor:pointer" onclick="toggleAvatarPicker()" title="Change avatar colour">${u.avatar}</div>
            <div style="position:absolute;bottom:2px;right:2px;width:28px;height:28px;border-radius:50%;background:white;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.85rem;cursor:pointer;box-shadow:var(--shadow-sm)" onclick="toggleAvatarPicker()">🎨</div>
          </div>
          <!-- Colour picker -->
          <div id="avatar-picker" style="display:none;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            ${['#2D5016','#1565C0','#C62828','#6A0080','#E65100','#00796B','#AD1457','#37474F'].map(c=>`
              <div onclick="changeAvatarColor('${c}')" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===avatarBg?'white':'transparent'};box-shadow:0 0 0 2px ${c===avatarBg?c:'transparent'};transition:all 0.15s"></div>`).join('')}
          </div>

          <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:700;color:var(--primary)">${u.name}</div>
          <div style="font-size:0.82rem;color:var(--text-light);margin:4px 0 12px">${u.email}</div>
          <span class="role-badge ${u.role}" style="text-transform:capitalize">${u.role}</span>
          ${u.dosha ? `<div style="margin-top:10px"><span class="dosha-badge dosha-${u.dosha.toLowerCase().split('-')[0]}">${u.dosha} Dosha</span></div>` : ''}
          ${u.rating ? `<div style="margin-top:10px;font-size:1rem;color:var(--accent);font-weight:700">★ ${u.rating} Rating</div>` : ''}

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">

          <!-- Quick stats -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center">
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--primary)">${sessions.length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Sessions</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--success)">${completedSess}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Completed</div>
            </div>
            ${u.role==='patient' ? `
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--accent)">${DB.feedback.filter(f=>f.patientId===u.id).length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Feedback</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--info)">${DB.orders.filter(o=>o.patientId===u.id).length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Orders</div>
            </div>` : `
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px;grid-column:1/-1">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--info)">${[...new Set(sessions.map(s=>s.patientId||s.doctorId))].length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Patients/Colleagues</div>
            </div>`}
          </div>

          ${u.isNew ? `<div style="margin-top:16px;background:#e8f5e9;border-radius:var(--radius-md);padding:10px 12px;font-size:0.8rem;color:var(--primary)">🌿 Welcome! Complete your profile to get started.</div>` : ''}
        </div>
      </div>

      <!-- RIGHT: Edit form -->
      <div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Personal Information</span>
            <span style="font-size:0.78rem;color:var(--text-light)">* Required fields</span>
          </div>
          <div class="form-grid">
            <div class="form-row required"><label>Full Name</label><input type="text" id="prof-name" value="${u.name}"></div>
            <div class="form-row"><label>Phone Number</label><input type="tel" id="prof-phone" value="${u.phone||''}"></div>
            <div class="form-row"><label>Address / City</label><input type="text" id="prof-addr" value="${u.address||''}" placeholder="Mumbai, Maharashtra"></div>
            ${u.role==='patient' ? `
            <div class="form-row"><label>Date of Birth</label><input type="date" id="prof-dob" value="${u.dob||''}"></div>
            <div class="form-row"><label>Gender</label>
              <select id="prof-gender">
                <option value="">Select</option>
                <option ${u.gender==='Female'?'selected':''}>Female</option>
                <option ${u.gender==='Male'?'selected':''}>Male</option>
                <option ${u.gender==='Other'?'selected':''}>Other</option>
              </select>
            </div>
            <div class="form-row"><label>Dosha Type</label>
              <select id="prof-dosha">
                ${['Vata','Pitta','Kapha','Vata-Pitta','Pitta-Kapha','Vata-Kapha'].map(d=>`<option ${u.dosha===d?'selected':''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-row"><label>Blood Group</label>
              <select id="prof-bg">
                ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=>`<option ${u.bloodGroup===g?'selected':''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="form-row"><label>Allergies / Sensitivities</label><input type="text" id="prof-allergy" value="${u.allergies||'None'}" placeholder="e.g. Sesame oil, Ghee..."></div>
            <div class="form-row"><label>Emergency Contact</label><input type="tel" id="prof-emergency" value="${u.emergencyContact||''}" placeholder="+91 XXXXX XXXXX"></div>
            ` : ''}
            ${u.role==='doctor' ? `
            <div class="form-row"><label>Specialization</label><input type="text" id="prof-spec" value="${u.specialization||''}"></div>
            <div class="form-row"><label>Qualification</label><input type="text" id="prof-qual" value="${u.qualification||''}"></div>
            <div class="form-row"><label>Years of Experience</label><input type="text" id="prof-exp" value="${u.experience||''}"></div>
            <div class="form-row full"><label>Bio / About</label><textarea id="prof-bio" placeholder="Brief professional bio..." rows="3">${u.bio||''}</textarea></div>
            ` : ''}
          </div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn btn-green" onclick="saveProfile()">💾 Save Changes</button>
            <button class="btn btn-outline" onclick="showPage('${currentUser.role}-dashboard')">Cancel</button>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="card" style="margin-top:0">
          <div class="card-title" style="margin-bottom:16px">🔒 Change Password</div>
          <div class="form-grid">
            <div class="form-row full">
              <label>Current Password</label>
              <div style="position:relative">
                <input type="password" id="pw-current" placeholder="Enter current password" style="padding-right:44px">
                <button onclick="togglePw('pw-current',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-light)">👁️</button>
              </div>
            </div>
            <div class="form-row">
              <label>New Password</label>
              <div style="position:relative">
                <input type="password" id="pw-new" placeholder="Min. 6 characters" oninput="checkPasswordStrength(this.value)" style="padding-right:44px">
                <button onclick="togglePw('pw-new',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-light)">👁️</button>
              </div>
              <div class="pw-strength-wrap" id="pw-strength-wrap">
                <div class="pw-strength-bar"><div class="pw-strength-fill" id="pw-strength-fill"></div></div>
                <div class="pw-strength-label" id="pw-strength-label"></div>
              </div>
            </div>
            <div class="form-row">
              <label>Confirm New Password</label>
              <div style="position:relative">
                <input type="password" id="pw-confirm" placeholder="Repeat new password" style="padding-right:44px">
                <button onclick="togglePw('pw-confirm',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-light)">👁️</button>
              </div>
            </div>
          </div>
          <button class="btn btn-green" onclick="changePassword()">Update Password</button>
        </div>
      </div>
    </div>`;
}

function toggleAvatarPicker() {
  const p = document.getElementById('avatar-picker');
  if (p) p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
}

function changeAvatarColor(color) {
  const d = document.getElementById('profile-avatar-display');
  if (d) d.style.background = color;
  currentUser.avatarColor = color;
  // Update header avatar too
  const ha = document.getElementById('header-avatar');
  if (ha) ha.style.background = color;
  showToast('Avatar colour updated!', 'success');
  toggleAvatarPicker();
}

function saveProfile() {
  const u = currentUser;
  u.name  = document.getElementById('prof-name')?.value?.trim()  || u.name;
  u.phone = document.getElementById('prof-phone')?.value?.trim() || '';
  u.address = document.getElementById('prof-addr')?.value?.trim() || '';

  if (u.role === 'patient') {
    u.dob           = document.getElementById('prof-dob')?.value       || u.dob;
    u.gender        = document.getElementById('prof-gender')?.value    || u.gender;
    u.dosha         = document.getElementById('prof-dosha')?.value     || u.dosha;
    u.bloodGroup    = document.getElementById('prof-bg')?.value        || u.bloodGroup;
    u.allergies     = document.getElementById('prof-allergy')?.value   || u.allergies;
    u.emergencyContact = document.getElementById('prof-emergency')?.value || u.emergencyContact;
  }
  if (u.role === 'doctor') {
    u.specialization = document.getElementById('prof-spec')?.value?.trim() || u.specialization;
    u.qualification  = document.getElementById('prof-qual')?.value?.trim() || u.qualification;
    u.experience     = document.getElementById('prof-exp')?.value?.trim()  || u.experience;
    u.bio            = document.getElementById('prof-bio')?.value?.trim()  || '';
  }

  // Update avatar initials from name
  const parts = u.name.trim().split(' ').filter(Boolean);
  u.avatar = parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : parts[0].slice(0,2).toUpperCase();

  // Sync with DB
  const dbUser = DB.users.find(x => x.id === u.id);
  if (dbUser) Object.assign(dbUser, u);

  // Update header
  const ha = document.getElementById('header-avatar');
  if (ha) ha.childNodes[0].textContent = u.avatar;

  showToast('Profile saved successfully! 🌿', 'success');
  showPage('profile');
}

function changePassword() {
  const current = document.getElementById('pw-current')?.value;
  const newPw   = document.getElementById('pw-new')?.value;
  const confirm = document.getElementById('pw-confirm')?.value;

  if (!current)           { showToast('Please enter your current password', 'error');  return; }
  if (current !== currentUser.password) { showToast('Current password is incorrect', 'error'); return; }
  if (!newPw || newPw.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
  if (newPw !== confirm)  { showToast('New passwords do not match', 'error'); return; }
  if (newPw === current)  { showToast('New password must be different from current', 'warning'); return; }

  currentUser.password = newPw;
  const dbUser = DB.users.find(x => x.id === currentUser.id);
  if (dbUser) dbUser.password = newPw;

  // Clear fields
  ['pw-current','pw-new','pw-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const fill = document.getElementById('pw-strength-fill'); if (fill) fill.style.width = '0';
  const lbl  = document.getElementById('pw-strength-label'); if (lbl) lbl.textContent = '';

  showToast('Password changed successfully! 🔒', 'success');
}

// ═══════════════════════════════════════════════════════════
// SHARED — SETTINGS
// ═══════════════════════════════════════════════════════════
const USER_PREFS = {};  // per-session preferences store

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
function renderAnnouncements(el) {
  const isAdmin = currentUser.role === 'admin';
  const myAudience = currentUser.role;
  const visible = DB.announcements
    .filter(a => a.audience === 'all' || a.audience === myAudience)
    .sort((a,b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><h2>📢 Announcements</h2><p>${isAdmin ? 'Broadcast messages to patients and doctors' : 'Latest news from the clinic'}</p></div>
        ${isAdmin ? `<button class="btn btn-green" onclick="openNewAnnouncementModal()">+ New Announcement</button>` : ''}
      </div>
    </div>

    ${visible.length ? visible.map(a => {
      const author = DB.users.find(u => u.id === a.authorId);
      const isNew  = Date.now() - new Date(a.createdAt).getTime() < 3 * 86400000;
      return `
      <div class="card" style="margin-bottom:16px;${a.pinned?'border-left:4px solid var(--primary);':''}" >
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            ${a.pinned ? '<span style="background:var(--primary);color:white;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:99px">📌 PINNED</span>' : ''}
            ${isNew    ? '<span style="background:#e3f2fd;color:#1565C0;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:99px">🆕 NEW</span>' : ''}
            <span class="badge ${a.audience==='all'?'badge-green':a.audience==='patient'?'badge-blue':'badge-yellow'}" style="font-size:0.72rem">
              ${a.audience === 'all' ? '👥 All Users' : a.audience === 'patient' ? '🧘 Patients' : '👨‍⚕️ Doctors'}
            </span>
          </div>
          ${isAdmin ? `
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-outline" onclick="togglePin('${a.id}')">${a.pinned?'Unpin':'📌 Pin'}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${a.id}')">Delete</button>
          </div>` : ''}
        </div>
        <div style="font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:var(--primary);margin-bottom:8px">${a.title}</div>
        <div style="font-size:0.9rem;color:var(--text-med);line-height:1.65">${a.message}</div>
        <div style="margin-top:12px;font-size:0.75rem;color:var(--text-light)">
          Posted by <strong>${author?.name || 'Admin'}</strong> · ${relativeTime(a.createdAt)}
        </div>
      </div>`;
    }).join('') : `
    <div class="empty-state"><span class="empty-state-icon">📢</span><p>No announcements yet</p>
    ${isAdmin ? `<button class="btn btn-green" onclick="openNewAnnouncementModal()" style="margin-top:12px">Create First Announcement</button>` : ''}</div>`}`;
}

function openNewAnnouncementModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">📢 New Announcement</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-row required"><label>Title</label><input type="text" id="ann-title" placeholder="Announcement headline…"></div>
    <div class="form-row required"><label>Message</label><textarea id="ann-message" rows="4" placeholder="Full announcement content…"></textarea></div>
    <div class="form-row"><label>Send To</label>
      <select id="ann-audience">
        <option value="all">👥 All Users (Patients + Doctors)</option>
        <option value="patient">🧘 Patients Only</option>
        <option value="doctor">👨‍⚕️ Doctors Only</option>
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <input type="checkbox" id="ann-pinned" style="width:16px;height:16px;accent-color:var(--primary)">
      <label for="ann-pinned" style="font-size:0.85rem;font-weight:600;color:var(--text-med);cursor:pointer">📌 Pin this announcement (appears at the top)</label>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <input type="checkbox" id="ann-notify" checked style="width:16px;height:16px;accent-color:var(--primary)">
      <label for="ann-notify" style="font-size:0.85rem;font-weight:600;color:var(--text-med);cursor:pointer">🔔 Also send as in-app notification</label>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="publishAnnouncement()">📢 Publish</button>
    </div>`);
}

function publishAnnouncement() {
  const title    = document.getElementById('ann-title')?.value?.trim();
  const message  = document.getElementById('ann-message')?.value?.trim();
  const audience = document.getElementById('ann-audience')?.value || 'all';
  const pinned   = document.getElementById('ann-pinned')?.checked;
  const notify   = document.getElementById('ann-notify')?.checked;

  if (!title)   { showToast('Please enter a title',   'error'); return; }
  if (!message) { showToast('Please enter a message', 'error'); return; }

  const ann = { id: genId('ann'), title, message, audience, pinned, authorId: currentUser.id, createdAt: new Date().toISOString() };
  DB.announcements.unshift(ann);

  if (notify) {
    // Send as notification to relevant users
    const targets = DB.users.filter(u => audience === 'all' || u.role === audience);
    targets.forEach(u => {
      DB.notifications.push({
        id: genId('n'), userId: u.id, type: 'system', priority: 'normal', read: false,
        title: `📢 ${title}`,
        message,
        createdAt: new Date().toISOString(),
      });
    });
    buildNav();
    showToast(`Announcement published & ${targets.length} users notified! 📢`, 'success');
  } else {
    showToast('Announcement published! 📢', 'success');
  }
  closeMod();
  showPage('announcements');
}

function togglePin(id) {
  const a = DB.announcements.find(a => a.id === id);
  if (a) { a.pinned = !a.pinned; showPage('announcements'); }
}

function deleteAnnouncement(id) {
  openModal(`
    <div class="modal-header"><div class="modal-title">Delete Announcement</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <p style="color:var(--text-med);margin-bottom:20px">This announcement will be permanently removed.</p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-danger" onclick="DB.announcements=DB.announcements.filter(a=>a.id!=='${id}');closeMod();showPage('announcements')">Delete</button>
    </div>`);
}

// ── Show announcements banner on patient/doctor dashboards ──
function getAnnouncementsBanner() {
  const pinned = DB.announcements.find(a =>
    a.pinned && (a.audience === 'all' || a.audience === currentUser.role)
  );
  if (!pinned) return '';
  return `
    <div style="background:linear-gradient(135deg,#e8f5e9,#f0f7ee);border:1px solid #a5d6a7;border-left:4px solid var(--primary);border-radius:var(--radius-md);padding:14px 18px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;cursor:pointer" onclick="showPage('announcements')">
      <div style="font-size:1.4rem;flex-shrink:0">📢</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.9rem;color:var(--primary)">${pinned.title}</div>
        <div style="font-size:0.82rem;color:var(--text-med);margin-top:3px">${pinned.message.slice(0,100)}${pinned.message.length>100?'…':''}</div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-light);flex-shrink:0">View all →</div>
    </div>`;
}

// APP INIT — SPLASH
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('login-page').classList.add('active');
  }, 1800);
});

// ═══════════════════════════════════════════════════════════
// SESSION TIMEOUT (30 min idle → auto logout)
// ═══════════════════════════════════════════════════════════
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let _idleTimer = null;
let _warningTimer = null;

function resetIdleTimer() {
  clearTimeout(_idleTimer);
  clearTimeout(_warningTimer);
  const warnEl = document.getElementById('session-warning-toast');
  if (warnEl) warnEl.remove();
  if (!currentUser) return;

  // 25 min: show warning
  _warningTimer = setTimeout(() => {
    if (!currentUser) return;
    const div = document.createElement('div');
    div.id = 'session-warning-toast';
    div.style.cssText = 'position:fixed;bottom:80px;right:24px;z-index:9999;background:#fff3e0;border:2px solid var(--warning);border-radius:var(--radius-md);padding:14px 20px;font-size:0.88rem;font-weight:500;box-shadow:var(--shadow-lg);max-width:320px';
    div.innerHTML = `⏱ <strong>Session expiring in 5 minutes</strong><br><small>Move your mouse or click anywhere to stay signed in.</small>
      <button onclick="resetIdleTimer()" style="display:block;margin-top:8px;padding:5px 14px;background:var(--primary);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem">Stay Signed In</button>`;
    document.body.appendChild(div);
  }, SESSION_TIMEOUT_MS - 5 * 60 * 1000);

  // 30 min: logout
  _idleTimer = setTimeout(() => {
    if (!currentUser) return;
    showToast('Session expired. Please sign in again.', 'warning');
    setTimeout(() => {
      currentUser = null;
      const warnEl = document.getElementById('session-warning-toast');
      if (warnEl) warnEl.remove();
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-page').classList.add('active');
    }, 1500);
  }, SESSION_TIMEOUT_MS);
}

['mousemove','keydown','click','touchstart','scroll'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// ═══════════════════════════════════════════════════════════
// DATA EXPORT — CSV
// ═══════════════════════════════════════════════════════════
function exportCSV(type) {
  let headers = [], rows = [], filename = '';

  if (type === 'patients') {
    headers = ['Patient ID','Name','Email','Phone','Gender','Dosha','Blood Group','Registered Date'];
    rows = DB.users.filter(u => u.role === 'patient').map(p => [
      p.patientCode||'', p.name, p.email, p.phone||'',
      p.gender||'', p.dosha||'', p.bloodGroup||'', p.registeredAt||'',
    ]);
    filename = 'patients_export.csv';
  } else if (type === 'sessions') {
    headers = ['Session ID','Patient ID','Patient Name','Doctor','Therapy','Date','Time','Status','Duration'];
    rows = DB.sessions.map(s => {
      const pt = getUser(s.patientId), dr = getUser(s.doctorId), th = getTherapy(s.therapyId);
      return [s.id, pt?.patientCode||'', pt?.name||'', dr?.name||'', th?.name||'',
              s.date, s.time, s.status, s.duration+'min'];
    });
    filename = 'sessions_export.csv';
  } else if (type === 'revenue') {
    headers = ['Date','Therapy','Price','Doctor','Patient ID','Status'];
    rows = DB.sessions.filter(s => s.status === 'completed').map(s => {
      const pt = getUser(s.patientId), dr = getUser(s.doctorId), th = getTherapy(s.therapyId);
      return [s.date, th?.name||'', th?.price||0, dr?.name||'', pt?.patientCode||'', s.status];
    });
    filename = 'revenue_export.csv';
  } else if (type === 'orders') {
    headers = ['Order ID','Patient ID','Mode','Total','Status','Placed Date','Pickup Code'];
    rows = DB.orders.map(o => {
      const pt = getUser(o.patientId);
      return [o.id, pt?.patientCode||'', o.mode, '₹'+o.total, o.status, o.placedAt||'', o.pickupCode||''];
    });
    filename = 'orders_export.csv';
  }

  const escape = v => '"' + String(v).replace(/"/g, '""') + '"';
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ ${filename} downloaded`, 'success');
}

// ═══════════════════════════════════════════════════════════
// SIGN-UP — show patient code after registration
// ═══════════════════════════════════════════════════════════
const _origDoSignup = typeof doSignup === 'function' ? doSignup : null;

// Patch the new-user flow to display the PKM code in a welcome modal
function onPatientSignupSuccess(user) {
  if (!user?.patientCode) return;
  openModal(`
    <div class="modal-header"><div class="modal-title">🌿 Welcome to Panchakarma!</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:3rem;margin-bottom:12px">🎉</div>
      <div style="font-family:var(--font-serif);font-size:1.3rem;color:var(--primary);margin-bottom:8px">Your account is ready, ${user.name.split(' ')[0]}!</div>
      <div style="font-size:0.9rem;color:var(--text-med);margin-bottom:20px">Your unique Patient ID has been assigned:</div>
      <div style="background:linear-gradient(135deg,var(--primary),var(--primary-mid));color:white;border-radius:var(--radius-md);padding:18px 32px;display:inline-block;margin-bottom:20px">
        <div style="font-size:0.72rem;opacity:0.8;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Patient ID</div>
        <div style="font-family:var(--font-serif);font-size:2rem;font-weight:700;letter-spacing:4px">${user.patientCode}</div>
      </div>
      <div style="font-size:0.82rem;color:var(--text-light);margin-bottom:20px">Keep this ID safe — use it for all future visits and appointments.</div>
    </div>
    <div class="modal-footer" style="justify-content:center">
      <button class="btn btn-green" onclick="closeMod()">Go to Dashboard →</button>
    </div>`);
}

// ═══════════════════════════════════════════════════════════
// MOBILE NAV — overflow scrollable fix
// ═══════════════════════════════════════════════════════════
(function patchMobileNav() {
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 900px) {
      .header-nav {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-bottom: 2px;
        gap: 2px;
      }
      .header-nav::-webkit-scrollbar { display: none; }
      .nav-btn { font-size: 0.75rem !important; padding: 7px 10px !important; }
      .nav-btn .nav-icon { display: inline-block; }
      .nav-btn .nav-label { display: none; }
    }
    @media (max-width: 600px) {
      .app-main { padding: 12px !important; }
      .stats-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
      .page-header h2 { font-size: 1.4rem !important; }
      .modal-box { padding: 20px 16px !important; }
    }
  `;
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════
// ADMIN EXPORT BUTTONS — inject into reports page
// ═══════════════════════════════════════════════════════════
function addExportButtons(containerEl) {
  if (!containerEl) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center';
  bar.innerHTML = `
    <span style="font-size:0.82rem;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;margin-right:4px">Export:</span>
    <button class="btn btn-sm btn-outline" onclick="exportCSV('patients')">⬇ Patients CSV</button>
    <button class="btn btn-sm btn-outline" onclick="exportCSV('sessions')">⬇ Sessions CSV</button>
    <button class="btn btn-sm btn-outline" onclick="exportCSV('revenue')">⬇ Revenue CSV</button>
    <button class="btn btn-sm btn-outline" onclick="exportCSV('orders')">⬇ Orders CSV</button>
  `;
  containerEl.insertBefore(bar, containerEl.firstChild);
}


const DB = {
  // ── Clinic Configuration ────────────────────────────────
  clinicConfig: {
    defaultDailyLimit:   8,       // default max patients per doctor per day
    workingHours:        { start: '09:00', end: '18:00' },
    slotDuration:        60,      // minutes per default slot
    bookingAdvanceDays:  30,      // how far ahead patients can book
    patientIdPrefix:     'PKM',   // patient ID prefix e.g. PKM-0001
    patientIdCounter:    5,       // next patient number (4 seeded)
  },
  users: [
    { id: 'u1', patientCode: 'PKM-0001', name: 'Priya Sharma',   email: 'priya@demo.com',   password: 'demo123',  role: 'patient', phone: '+91 98765 43210', dob: '1988-05-14', gender: 'Female', dosha: 'Pitta',      address: 'Mumbai, Maharashtra', avatar: 'PS', bloodGroup: 'B+',  allergies: 'None',       emergencyContact: '+91 97654 32109', registeredAt: getDateStr(-90) },
    { id: 'u2', patientCode: 'PKM-0002', name: 'Arjun Mehta',    email: 'arjun@demo.com',   password: 'demo123',  role: 'patient', phone: '+91 87654 32109', dob: '1975-11-22', gender: 'Male',   dosha: 'Vata',       address: 'Pune, Maharashtra',   avatar: 'AM', bloodGroup: 'O+',  allergies: 'Sesame oil', emergencyContact: '+91 86543 21098', registeredAt: getDateStr(-60) },
    { id: 'u3', patientCode: 'PKM-0003', name: 'Kavitha Nair',   email: 'kavitha@demo.com', password: 'demo123',  role: 'patient', phone: '+91 76543 21098', dob: '1992-03-07', gender: 'Female', dosha: 'Kapha',      address: 'Kochi, Kerala',       avatar: 'KN', bloodGroup: 'A+',  allergies: 'None',       emergencyContact: '+91 75432 10987', registeredAt: getDateStr(-45) },
    { id: 'u4', patientCode: 'PKM-0004', name: 'Rajan Pillai',   email: 'rajan@demo.com',   password: 'demo123',  role: 'patient', phone: '+91 65432 10987', dob: '1968-07-30', gender: 'Male',   dosha: 'Vata-Pitta', address: 'Thrissur, Kerala',    avatar: 'RP', bloodGroup: 'AB+', allergies: 'Ghee',       emergencyContact: '+91 64321 09876', registeredAt: getDateStr(-30) },
    { id: 'd1', name: 'Dr. Suresh Kumar', email: 'doctor@demo.com', password: 'demo123',  role: 'doctor', verificationStatus: 'approved', phone: '+91 99887 76655', specialization: 'Panchakarma Specialist', experience: '15 years', qualification: 'BAMS, MD (Ayu)', avatar: 'SK', rating: 4.9, patients: 120, dailyLimit: 8,  workingDays: ['Mon','Tue','Wed','Thu','Fri'], workStart: '09:00', workEnd: '18:00' },
    { id: 'd2', name: 'Dr. Meena Iyer',   email: 'meena@demo.com',  password: 'demo123',  role: 'doctor', verificationStatus: 'approved', phone: '+91 88776 65544', specialization: 'Ayurvedic Physician',    experience: '12 years', qualification: 'BAMS, PhD (Ayu)', avatar: 'MI', rating: 4.8, patients: 95,  dailyLimit: 6,  workingDays: ['Mon','Tue','Thu','Fri','Sat'], workStart: '10:00', workEnd: '17:00' },
    { id: 'd3', name: 'Dr. Ravi Nambiar', email: 'ravi@demo.com',   password: 'demo123',  role: 'doctor', verificationStatus: 'pending',  phone: '+91 77665 54433', specialization: 'Kayachikitsa',           experience: '8 years',  qualification: 'BAMS, PG Diploma', avatar: 'RN', rating: 0, patients: 0, dailyLimit: 5, workingDays: ['Mon','Wed','Fri'], workStart: '09:30', workEnd: '16:00', appliedAt: new Date(Date.now()-2*86400000).toISOString() },
    { id: 'a1', name: 'Admin Manager', email: 'admin@demo.com', password: 'admin123', role: 'admin', phone: '+91 11223 34455', avatar: 'AM' }
  ],
  therapies: [
    { id: 't1', name: 'Abhyanga', duration: 60, price: 2500, category: 'Purvakarma', description: 'Full body oil massage with medicated oils', color: '#4A7C2B' },
    { id: 't2', name: 'Shirodhara', duration: 45, price: 3000, category: 'Pradhanakarma', description: 'Continuous stream of warm oil on the forehead', color: '#D4A574' },
    { id: 't3', name: 'Basti', duration: 90, price: 3500, category: 'Pradhanakarma', description: 'Medicated enema therapy for Vata disorders', color: '#2D5016' },
    { id: 't4', name: 'Nasya', duration: 30, price: 1800, category: 'Pradhanakarma', description: 'Nasal administration of medicated oils', color: '#17A2B8' },
    { id: 't5', name: 'Virechana', duration: 120, price: 4000, category: 'Pradhanakarma', description: 'Therapeutic purgation for Pitta disorders', color: '#FFC107' },
    { id: 't6', name: 'Vamana', duration: 90, price: 3800, category: 'Pradhanakarma', description: 'Therapeutic emesis for Kapha disorders', color: '#6c757d' },
    { id: 't7', name: 'Pizhichil', duration: 75, price: 4500, category: 'Keraliya', description: 'Continuous pouring of warm medicated oil', color: '#e67e22' },
    { id: 't8', name: 'Navarakizhi', duration: 90, price: 4200, category: 'Keraliya', description: 'Rice bolus massage with medicated milk', color: '#8e44ad' },
  ],
  sessions: [
    { id: 's1', patientId: 'u1', doctorId: 'd1', therapyId: 't1', date: getDateStr(1), time: '10:00', status: 'scheduled', notes: 'First session', duration: 60 },
    { id: 's2', patientId: 'u1', doctorId: 'd1', therapyId: 't2', date: getDateStr(3), time: '11:00', status: 'scheduled', notes: 'Follow up', duration: 45 },
    { id: 's3', patientId: 'u1', doctorId: 'd2', therapyId: 't4', date: getDateStr(-7), time: '09:00', status: 'completed', notes: 'Good response', duration: 30 },
    { id: 's4', patientId: 'u1', doctorId: 'd1', therapyId: 't3', date: getDateStr(-14), time: '10:00', status: 'completed', notes: 'Well tolerated', duration: 90 },
    { id: 's5', patientId: 'u2', doctorId: 'd1', therapyId: 't1', date: getDateStr(2), time: '14:00', status: 'scheduled', notes: '', duration: 60 },
    { id: 's6', patientId: 'u3', doctorId: 'd2', therapyId: 't7', date: getDateStr(0), time: '09:30', status: 'scheduled', notes: 'Sensitive skin', duration: 75 },
    { id: 's7', patientId: 'u4', doctorId: 'd1', therapyId: 't5', date: getDateStr(-3), time: '10:00', status: 'completed', notes: '', duration: 120 },
    { id: 's8', patientId: 'u1', doctorId: 'd1', therapyId: 't1', date: getDateStr(7), time: '10:00', status: 'scheduled', notes: '', duration: 60 },
    { id: 's9', patientId: 'u2', doctorId: 'd2', therapyId: 't8', date: getDateStr(-1), time: '11:00', status: 'completed', notes: '', duration: 90 },
    { id: 's10', patientId: 'u3', doctorId: 'd1', therapyId: 't2', date: getDateStr(5), time: '15:00', status: 'scheduled', notes: '', duration: 45 },
    // ── Demo sessions showing auto-reallocation (same doctor, same day, consecutive times) ──
    { id: 's11', patientId: 'u1', doctorId: 'd2', therapyId: 't1', date: getDateStr(2), time: '10:00', status: 'scheduled', notes: 'Demo: cancel this to trigger auto-reallocation', duration: 60 },
    { id: 's12', patientId: 'u4', doctorId: 'd2', therapyId: 't4', date: getDateStr(2), time: '11:00', status: 'scheduled', notes: 'Demo: will auto-move to 10:00 when s11 is cancelled', duration: 30 },
    { id: 's13', patientId: 'u2', doctorId: 'd2', therapyId: 't7', date: getDateStr(2), time: '12:00', status: 'scheduled', notes: 'Demo: third patient on same day', duration: 75 },
  ],
  notifications: [
    { id: 'n1', userId: 'u1', type: 'pre_procedure', title: 'Prepare for Tomorrow\'s Abhyanga', message: 'Please fast for 2 hours before your session. Wear loose comfortable clothing. Avoid applying any oils or creams. Arrive 10 minutes early.', priority: 'high', read: false, createdAt: new Date(Date.now() - 2*3600000).toISOString(), sessionId: 's1' },
    { id: 'n2', userId: 'u1', type: 'post_procedure', title: 'Post-Session Care Instructions', message: 'Rest for at least 2 hours after your session. Consume warm, light, easily digestible food. Avoid cold water and direct sunlight. Stay warm and relaxed.', priority: 'normal', read: false, createdAt: new Date(Date.now() - 8*3600000).toISOString(), sessionId: 's3' },
    { id: 'n3', userId: 'u1', type: 'general', title: 'Your Treatment Plan Update', message: 'Dr. Suresh has updated your treatment protocol. You are now progressing to Pradhanakarma phase. Three new sessions have been added.', priority: 'normal', read: true, createdAt: new Date(Date.now() - 24*3600000).toISOString() },
    { id: 'n4', userId: 'u1', type: 'system', title: 'Appointment Confirmed ✓', message: 'Your Shirodhara appointment on has been confirmed with Dr. Suresh Kumar. You will receive reminders 24 hours and 2 hours before.', priority: 'normal', read: true, createdAt: new Date(Date.now() - 48*3600000).toISOString() },
    { id: 'n5', userId: 'u1', type: 'pre_procedure', title: 'Session Reminder: Shirodhara', message: 'Your Shirodhara session is in 24 hours. Please avoid caffeine today and maintain a calm mind. Dietary guidelines attached in your portal.', priority: 'high', read: false, createdAt: new Date(Date.now() - 1*3600000).toISOString(), sessionId: 's2' },
    { id: 'n6', userId: 'u2', type: 'pre_procedure', title: 'Tomorrow\'s Abhyanga Session', message: 'Fast for 2 hours before treatment. Comfortable loose clothing recommended. Arrive 10 min early.', priority: 'high', read: false, createdAt: new Date(Date.now() - 3600000).toISOString(), sessionId: 's5' },
    { id: 'n7', userId: 'u3', type: 'general', title: 'Welcome to Panchakarma Program', message: 'Your 28-day Panchakarma journey begins today. Dr. Meena Iyer will guide your treatment. Please review your personalized diet chart.', priority: 'normal', read: false, createdAt: new Date(Date.now() - 3*3600000).toISOString() },
    { id: 'n8', userId: 'u4', type: 'post_procedure', title: 'Post-Virechana Care', message: 'Critical: Only consume light diet for 48 hours. Avoid heavy, oily, spicy foods. Stay hydrated. Contact clinic if discomfort persists.', priority: 'critical', read: false, createdAt: new Date(Date.now() - 4*3600000).toISOString(), sessionId: 's7' },
  ],
  milestones: [
    { id: 'm1', patientId: 'u1', name: 'Initial Consultation', status: 'completed', pct: 100, targetDate: getDateStr(-21), completedDate: getDateStr(-21) },
    { id: 'm2', patientId: 'u1', name: 'Purvakarma — Preparation Phase', status: 'completed', pct: 100, targetDate: getDateStr(-14), completedDate: getDateStr(-14) },
    { id: 'm3', patientId: 'u1', name: 'Pradhanakarma — Main Treatment', status: 'in_progress', pct: 68, targetDate: getDateStr(7) },
    { id: 'm4', patientId: 'u1', name: 'Pashchatkarma — Post Treatment', status: 'pending', pct: 0, targetDate: getDateStr(14) },
    { id: 'm5', patientId: 'u1', name: 'Diet & Lifestyle Integration', status: 'pending', pct: 0, targetDate: getDateStr(21) },
    { id: 'm6', patientId: 'u1', name: 'Follow-up Assessment', status: 'pending', pct: 0, targetDate: getDateStr(28) },
    { id: 'm7', patientId: 'u1', name: 'Maintenance Protocol', status: 'pending', pct: 0, targetDate: getDateStr(35) },
    { id: 'm8', patientId: 'u2', name: 'Initial Consultation', status: 'completed', pct: 100, targetDate: getDateStr(-10), completedDate: getDateStr(-10) },
    { id: 'm9', patientId: 'u2', name: 'Purvakarma — Preparation Phase', status: 'in_progress', pct: 45, targetDate: getDateStr(5) },
  ],
  feedback: [
    { id: 'f1', patientId: 'u1', sessionId: 's3', rating: 8, symptoms: 'Significant reduction in joint pain. Improved sleep quality.', energyLevel: 'much_improved', comments: 'Excellent session. Dr. Suresh was very attentive.', submittedAt: getDateStr(-7) },
    { id: 'f2', patientId: 'u1', sessionId: 's4', rating: 9, symptoms: 'Digestive issues improving. Less bloating.', energyLevel: 'slightly_improved', comments: 'Treatment was intensive but very effective.', submittedAt: getDateStr(-14) },
    { id: 'f3', patientId: 'u2', sessionId: 's9', rating: 7, symptoms: 'Back pain still present but reduced by 50%.', energyLevel: 'slightly_improved', comments: 'Good session, look forward to next one.', submittedAt: getDateStr(-1) },
  ],
  prescriptions: [
    { id: 'pr1', patientId: 'u1', doctorId: 'd1', date: getDateStr(-7), medicines: [{ name: 'Triphala Churna', dose: '5g', freq: 'Twice daily', duration: '30 days' }, { name: 'Ashwagandha Capsules', dose: '500mg', freq: 'Once daily', duration: '30 days' }], diet: 'Warm, light, easily digestible foods. Avoid spicy and cold items. Include ginger and turmeric.', lifestyle: 'Morning yoga for 30 minutes. Early bedtime. Avoid screen time before sleep.', notes: 'Review after 2 weeks.' },
    { id: 'pr2', patientId: 'u1', doctorId: 'd2', date: getDateStr(-14), medicines: [{ name: 'Brahmi Ghrita', dose: '1 tsp', freq: 'Morning on empty stomach', duration: '21 days' }], diet: 'Include sesame seeds and almonds. Avoid raw vegetables.', lifestyle: 'Meditation 15 minutes daily.', notes: 'Monitor digestion.' },
  ],
  products: [
    { id: 'p1', name: 'Triphala Churna', category: 'Churna', price: 280, mrp: 350, stock: 45, unit: '100g', emoji: '🌿', description: 'Classic Ayurvedic blend of three fruits for digestion & detox', tags: ['Digestive','Detox','Vata'], doctorId: 'd1', recommended: true, isNew: false, dosha: ['Vata','Pitta','Kapha'] },
    { id: 'p2', name: 'Ashwagandha Capsules', category: 'Capsules', price: 420, mrp: 499, stock: 32, unit: '60 caps', emoji: '💊', description: 'Pure KSM-66 Ashwagandha for stress relief and vitality', tags: ['Adaptogen','Stress','Energy'], doctorId: 'd1', recommended: true, isNew: false, dosha: ['Vata','Kapha'] },
    { id: 'p3', name: 'Brahmi Ghrita', category: 'Ghrita', price: 650, mrp: 780, stock: 18, unit: '250g', emoji: '🫙', description: 'Medicated ghee with Brahmi for memory & cognitive function', tags: ['Brain','Memory','Pitta'], doctorId: 'd2', recommended: false, isNew: false, dosha: ['Pitta','Vata'] },
    { id: 'p4', name: 'Sesame Taila (Oil)', category: 'Oil', price: 380, mrp: 450, stock: 25, unit: '200ml', emoji: '🍶', description: 'Cold-pressed sesame oil for Abhyanga self-massage at home', tags: ['Oil','Massage','Vata'], doctorId: 'd1', recommended: true, isNew: false, dosha: ['Vata'] },
    { id: 'p5', name: 'Dashamoola Kwatha', category: 'Kwatha', price: 320, mrp: 400, stock: 20, unit: '200ml', emoji: '🌱', description: 'Ten-root decoction for joint pain, inflammation & Vata disorders', tags: ['Joints','Pain','Anti-inflammatory'], doctorId: 'd1', recommended: false, isNew: true, dosha: ['Vata'] },
    { id: 'p6', name: 'Neem Tulsi Tablets', category: 'Tablet', price: 199, mrp: 249, stock: 60, unit: '60 tabs', emoji: '🍃', description: 'Purifying combination for skin health and blood purification', tags: ['Skin','Pitta','Detox'], doctorId: 'd2', recommended: false, isNew: false, dosha: ['Pitta','Kapha'] },
    { id: 'p7', name: 'Chyawanprash', category: 'Rasayana', price: 560, mrp: 650, stock: 15, unit: '500g', emoji: '🫕', description: 'Classic Ayurvedic jam for immunity, strength and longevity', tags: ['Immunity','Rasayana','All'], doctorId: 'd2', recommended: true, isNew: false, dosha: ['Vata','Pitta','Kapha'] },
    { id: 'p8', name: 'Shirodhara Oil Kit', category: 'Oil', price: 890, mrp: 1100, stock: 10, unit: 'Kit', emoji: '💆', description: 'Complete kit with Brahmi oil, dripping vessel & instructions', tags: ['Stress','Shirodhara','Mind'], doctorId: 'd1', recommended: false, isNew: true, dosha: ['Pitta','Vata'] },
    { id: 'p9', name: 'Haritaki Powder', category: 'Churna', price: 160, mrp: 200, stock: 50, unit: '100g', emoji: '🌾', description: 'Single herb powder for constipation, digestion and rejuvenation', tags: ['Digestive','Laxative','Vata'], doctorId: 'd1', recommended: false, isNew: false, dosha: ['Vata','Kapha'] },
    { id: 'p10', name: 'Turmeric Milk Mix', category: 'Churna', price: 240, mrp: 290, stock: 35, unit: '150g', emoji: '🟡', description: 'Golden milk blend with turmeric, ginger, pepper & ashwagandha', tags: ['Immunity','Anti-inflammatory','Sleep'], doctorId: 'd2', recommended: true, isNew: true, dosha: ['Vata','Kapha'] },
    { id: 'p11', name: 'Ksheerabala Taila', category: 'Oil', price: 480, mrp: 560, stock: 14, unit: '200ml', emoji: '🫧', description: 'Medicated oil prepared in milk for neuromuscular disorders', tags: ['Neuro','Joints','Vata'], doctorId: 'd2', recommended: false, isNew: false, dosha: ['Vata'] },
    { id: 'p12', name: 'Amalaki Rasayana', category: 'Rasayana', price: 420, mrp: 520, stock: 22, unit: '250g', emoji: '🫐', description: 'Pure Amla-based rejuvenating tonic rich in Vitamin C', tags: ['Immunity','Pitta','Antioxidant'], doctorId: 'd1', recommended: false, isNew: true, dosha: ['Pitta','Vata','Kapha'] },
  ],
  orders: [
    { id: 'ord1', patientId: 'u1', items: [{productId:'p1',qty:2},{productId:'p2',qty:1}], mode: 'online', status: 'delivered', total: 980, address: 'Mumbai, Maharashtra', placedAt: getDateStr(-10), pickupCode: null, estimatedDelivery: getDateStr(-7) },
    { id: 'ord2', patientId: 'u1', items: [{productId:'p4',qty:1}], mode: 'pickup', status: 'ready', total: 380, address: null, placedAt: getDateStr(-2), pickupCode: 'PKP-4821', estimatedDelivery: null },
    { id: 'ord3', patientId: 'u2', items: [{productId:'p7',qty:1},{productId:'p9',qty:2}], mode: 'online', status: 'processing', total: 880, address: 'Pune, Maharashtra', placedAt: getDateStr(-1), pickupCode: null, estimatedDelivery: getDateStr(2) },
  ],
  cart: [],
  announcements: [
    { id:'ann1', title:'🌿 Welcome to Our New Online Platform!', message:'We are excited to launch our new Panchakarma Management Software. You can now book sessions, track progress, shop herbal remedies, and more — all in one place.', authorId:'a1', createdAt: new Date(Date.now()-5*86400000).toISOString(), pinned:true, audience:'all' },
    { id:'ann2', title:'🏪 Herbal Shop Now Open', message:'Our curated herbal shop is now live! Browse doctor-recommended Ayurvedic remedies and medicines. Order online for home delivery or schedule a clinic pickup.', authorId:'a1', createdAt: new Date(Date.now()-2*86400000).toISOString(), pinned:false, audience:'patient' },
  ]
};

let currentUser = null;
let currentPage = '';
let currentLoginRole = 'patient';
let signupRole = 'patient';

