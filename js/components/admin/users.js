/* === js/components/admin/users.js === */
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
