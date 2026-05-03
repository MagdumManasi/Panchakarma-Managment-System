/* === Core: Session Timeout & Data Export === */

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let _idleTimer = null;
let _warningTimer = null;

function resetIdleTimer() {
  clearTimeout(_idleTimer);
  clearTimeout(_warningTimer);
  const w = document.getElementById('session-warning');
  if (w) w.style.display = 'none';
  if (!currentUser) return;

  _warningTimer = setTimeout(() => {
    if (!currentUser) return;
    const w = document.getElementById('session-warning');
    if (w) {
      w.style.cssText = 'display:block;position:fixed;bottom:calc(var(--bottom-nav-h)+12px);right:16px;z-index:9999;background:#fff3e0;border:2px solid var(--warning);border-radius:var(--r-md);padding:14px 18px;font-size:.88rem;font-weight:500;box-shadow:var(--shadow-lg);max-width:320px';
      w.innerHTML = `⏱ <strong>Session expiring in 5 min</strong><br><small>Move your mouse to stay signed in.</small>
        <button onclick="resetIdleTimer()" style="display:block;margin-top:8px;padding:5px 14px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.82rem">Stay Signed In</button>`;
    }
  }, SESSION_TIMEOUT_MS - 5*60*1000);

  _idleTimer = setTimeout(() => {
    if (!currentUser) return;
    showToast('Session expired. Please sign in again.', 'warning');
    setTimeout(() => logout(), 1500);
  }, SESSION_TIMEOUT_MS);
}

['mousemove','keydown','click','touchstart'].forEach(e => {
  document.addEventListener(e, () => { if (currentUser) resetIdleTimer(); }, { passive:true });
});

// ── CSV Export ────────────────────────────────
function exportCSV(type) {
  let headers=[], rows=[], filename='';
  if (type === 'patients') {
    headers=['Patient ID','Name','Email','Phone','Gender','Dosha','Blood Group','Registered'];
    rows=DB.users.filter(u=>u.role==='patient').map(p=>[p.patientCode||'',p.name,p.email,p.phone||'',p.gender||'',p.dosha||'',p.bloodGroup||'',p.registeredAt||'']);
    filename='patients.csv';
  } else if (type === 'sessions') {
    headers=['ID','Patient ID','Patient','Doctor','Therapy','Date','Time','Status'];
    rows=DB.sessions.map(s=>{
      const pt=getUser(s.patientId),dr=getUser(s.doctorId),th=getTherapy(s.therapyId);
      return [s.id,pt?.patientCode||'',pt?.name||'',dr?.name||'',th?.name||'',s.date,s.time,s.status];
    });
    filename='sessions.csv';
  } else if (type === 'revenue') {
    headers=['Date','Therapy','Price','Doctor','Patient ID','Status'];
    rows=DB.sessions.filter(s=>s.status==='completed').map(s=>{
      const pt=getUser(s.patientId),dr=getUser(s.doctorId),th=getTherapy(s.therapyId);
      return [s.date,th?.name||'',th?.price||0,dr?.name||'',pt?.patientCode||'','completed'];
    });
    filename='revenue.csv';
  } else if (type === 'orders') {
    headers=['Order ID','Patient ID','Mode','Total','Status','Date','Pickup Code'];
    rows=DB.orders.map(o=>{const pt=getUser(o.patientId);return [o.id,pt?.patientCode||'',o.mode,'₹'+o.total,o.status,o.placedAt||'',o.pickupCode||''];});
    filename='orders.csv';
  }
  const esc=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const csv=[headers.map(esc).join(','),...rows.map(r=>r.map(esc).join(','))].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download=filename; a.click();
  showToast('✅ '+filename+' downloaded','success');
}
