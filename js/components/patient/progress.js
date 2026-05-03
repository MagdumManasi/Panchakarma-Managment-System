/* === js/components/patient/progress.js === */
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
