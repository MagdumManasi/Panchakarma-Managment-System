/* === js/components/doctor/treatments.js === */
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
