/* === js/components/admin/announcements.js === */
function renderAnnouncements(el) {
  const isAdmin = currentUser.role === 'admin';
  const myAudience = currentUser.role;
  const visible = DB.announcements
    .filter(a => a.audience === 'all' || a.audience === myAudience)
    .sort((a,b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><h2>📢 Announcements</h2><p>${isAdmin ? 'Broadcast messages to patients and doctors' : 'Latest news from the clinic'}</p></div>
        ${isAdmin ? `<button class="btn btn-green" onclick="openNewAnnouncementModal()">+ New Announcement</button>` : ''}
      </div>
    </div>

    ${visible.length ? visible.map(a => {
      const author = DB.users.find(u => u.id === a.authorId);
      const isNew  = Date.now() - new Date(a.createdAt).getTime() < 3 * 86400000;
      return `
      <div class="card" style="margin-bottom:16px;${a.pinned?'border-left:4px solid var(--primary);':''}" >
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            ${a.pinned ? '<span style="background:var(--primary);color:white;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:99px">📌 PINNED</span>' : ''}
            ${isNew    ? '<span style="background:#e3f2fd;color:#1565C0;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:99px">🆕 NEW</span>' : ''}
            <span class="badge ${a.audience==='all'?'badge-green':a.audience==='patient'?'badge-blue':'badge-yellow'}" style="font-size:0.72rem">
              ${a.audience === 'all' ? '👥 All Users' : a.audience === 'patient' ? '🧘 Patients' : '👨‍⚕️ Doctors'}
            </span>
          </div>
          ${isAdmin ? `
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-outline" onclick="togglePin('${a.id}')">${a.pinned?'Unpin':'📌 Pin'}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${a.id}')">Delete</button>
          </div>` : ''}
        </div>
        <div style="font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:var(--primary);margin-bottom:8px">${a.title}</div>
        <div style="font-size:0.9rem;color:var(--text-med);line-height:1.65">${a.message}</div>
        <div style="margin-top:12px;font-size:0.75rem;color:var(--text-light)">
          Posted by <strong>${author?.name || 'Admin'}</strong> · ${relativeTime(a.createdAt)}
        </div>
      </div>`;
    }).join('') : `
    <div class="empty-state"><span class="empty-state-icon">📢</span><p>No announcements yet</p>
    ${isAdmin ? `<button class="btn btn-green" onclick="openNewAnnouncementModal()" style="margin-top:12px">Create First Announcement</button>` : ''}</div>`}`;
}

function openNewAnnouncementModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">📢 New Announcement</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-row required"><label>Title</label><input type="text" id="ann-title" placeholder="Announcement headline…"></div>
    <div class="form-row required"><label>Message</label><textarea id="ann-message" rows="4" placeholder="Full announcement content…"></textarea></div>
    <div class="form-row"><label>Send To</label>
      <select id="ann-audience">
        <option value="all">👥 All Users (Patients + Doctors)</option>
        <option value="patient">🧘 Patients Only</option>
        <option value="doctor">👨‍⚕️ Doctors Only</option>
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <input type="checkbox" id="ann-pinned" style="width:16px;height:16px;accent-color:var(--primary)">
      <label for="ann-pinned" style="font-size:0.85rem;font-weight:600;color:var(--text-med);cursor:pointer">📌 Pin this announcement (appears at the top)</label>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <input type="checkbox" id="ann-notify" checked style="width:16px;height:16px;accent-color:var(--primary)">
      <label for="ann-notify" style="font-size:0.85rem;font-weight:600;color:var(--text-med);cursor:pointer">🔔 Also send as in-app notification</label>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="publishAnnouncement()">📢 Publish</button>
    </div>`);
}

function publishAnnouncement() {
  const title    = document.getElementById('ann-title')?.value?.trim();
  const message  = document.getElementById('ann-message')?.value?.trim();
  const audience = document.getElementById('ann-audience')?.value || 'all';
  const pinned   = document.getElementById('ann-pinned')?.checked;
  const notify   = document.getElementById('ann-notify')?.checked;

  if (!title)   { showToast('Please enter a title',   'error'); return; }
  if (!message) { showToast('Please enter a message', 'error'); return; }

  const ann = { id: genId('ann'), title, message, audience, pinned, authorId: currentUser.id, createdAt: new Date().toISOString() };
  DB.announcements.unshift(ann);

  if (notify) {
    // Send as notification to relevant users
    const targets = DB.users.filter(u => audience === 'all' || u.role === audience);
    targets.forEach(u => {
      DB.notifications.push({
        id: genId('n'), userId: u.id, type: 'system', priority: 'normal', read: false,
        title: `📢 ${title}`,
        message,
        createdAt: new Date().toISOString(),
      });
    });
    buildNav();
    showToast(`Announcement published & ${targets.length} users notified! 📢`, 'success');
  } else {
    showToast('Announcement published! 📢', 'success');
  }
  closeMod();
  showPage('announcements');
}

function togglePin(id) {
  const a = DB.announcements.find(a => a.id === id);
  if (a) { a.pinned = !a.pinned; showPage('announcements'); }
}

function deleteAnnouncement(id) {
  openModal(`
    <div class="modal-header"><div class="modal-title">Delete Announcement</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <p style="color:var(--text-med);margin-bottom:20px">This announcement will be permanently removed.</p>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-danger" onclick="DB.announcements=DB.announcements.filter(a=>a.id!=='${id}');closeMod();showPage('announcements')">Delete</button>
    </div>`);
}

// ── Show announcements banner on patient/doctor dashboards ──
function getAnnouncementsBanner() {
  const pinned = DB.announcements.find(a =>
    a.pinned && (a.audience === 'all' || a.audience === currentUser.role)
  );
  if (!pinned) return '';
  return `
    <div style="background:linear-gradient(135deg,#e8f5e9,#f0f7ee);border:1px solid #a5d6a7;border-left:4px solid var(--primary);border-radius:var(--radius-md);padding:14px 18px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;cursor:pointer" onclick="showPage('announcements')">
      <div style="font-size:1.4rem;flex-shrink:0">📢</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.9rem;color:var(--primary)">${pinned.title}</div>
        <div style="font-size:0.82rem;color:var(--text-med);margin-top:3px">${pinned.message.slice(0,100)}${pinned.message.length>100?'…':''}</div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-light);flex-shrink:0">View all →</div>
    </div>`;
}

// APP INIT — SPLASH
// ═══════════════════════════════════════════════════════════
