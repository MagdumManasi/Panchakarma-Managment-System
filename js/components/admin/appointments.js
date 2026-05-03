/* === js/components/admin/appointments.js === */
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
