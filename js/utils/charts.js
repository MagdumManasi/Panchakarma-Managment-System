/* === Chart Helpers (Chart.js wrappers) === */
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