/* === js/components/doctor/reports.js === */
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
