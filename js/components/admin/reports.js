/* === js/components/admin/reports.js === */
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
