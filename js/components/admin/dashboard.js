/* === js/components/admin/dashboard.js === */
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
