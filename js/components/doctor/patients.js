/* === js/components/doctor/patients.js === */
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
