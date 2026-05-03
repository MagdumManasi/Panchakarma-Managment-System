/* === js/components/shared/profile.js === */
function renderProfile(el) {
  const u = currentUser;
  const sessions = DB.sessions.filter(s => s.patientId === u.id || s.doctorId === u.id);
  const completedSess = sessions.filter(s => s.status === 'completed').length;
  const avatarColors = ['#2D5016','#1565C0','#C62828','#6A0080','#E65100','#00796B'];
  const colorIdx = u.id.charCodeAt(u.id.length-1) % avatarColors.length;
  const avatarBg = avatarColors[colorIdx];

  el.innerHTML=`
    <div class="page-header"><h2>👤 My Profile</h2><p>Manage your personal information and account</p></div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start">

      <!-- LEFT: Avatar + quick stats -->
      <div>
        <div class="card" style="text-align:center;padding:32px 24px">
          <!-- Avatar with colour picker -->
          <div style="position:relative;display:inline-block;margin-bottom:16px">
            <div id="profile-avatar-display" style="width:100px;height:100px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:2rem;margin:0 auto;box-shadow:0 4px 16px rgba(0,0,0,0.15);cursor:pointer" onclick="toggleAvatarPicker()" title="Change avatar colour">${u.avatar}</div>
            <div style="position:absolute;bottom:2px;right:2px;width:28px;height:28px;border-radius:50%;background:white;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.85rem;cursor:pointer;box-shadow:var(--shadow-sm)" onclick="toggleAvatarPicker()">🎨</div>
          </div>
          <!-- Colour picker -->
          <div id="avatar-picker" style="display:none;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            ${['#2D5016','#1565C0','#C62828','#6A0080','#E65100','#00796B','#AD1457','#37474F'].map(c=>`
              <div onclick="changeAvatarColor('${c}')" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===avatarBg?'white':'transparent'};box-shadow:0 0 0 2px ${c===avatarBg?c:'transparent'};transition:all 0.15s"></div>`).join('')}
          </div>

          <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:700;color:var(--primary)">${u.name}</div>
          <div style="font-size:0.82rem;color:var(--text-light);margin:4px 0 12px">${u.email}</div>
          <span class="role-badge ${u.role}" style="text-transform:capitalize">${u.role}</span>
          ${u.dosha ? `<div style="margin-top:10px"><span class="dosha-badge dosha-${u.dosha.toLowerCase().split('-')[0]}">${u.dosha} Dosha</span></div>` : ''}
          ${u.rating ? `<div style="margin-top:10px;font-size:1rem;color:var(--accent);font-weight:700">★ ${u.rating} Rating</div>` : ''}

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">

          <!-- Quick stats -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center">
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--primary)">${sessions.length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Sessions</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--success)">${completedSess}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Completed</div>
            </div>
            ${u.role==='patient' ? `
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--accent)">${DB.feedback.filter(f=>f.patientId===u.id).length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Feedback</div>
            </div>
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--info)">${DB.orders.filter(o=>o.patientId===u.id).length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Orders</div>
            </div>` : `
            <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px;grid-column:1/-1">
              <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:700;color:var(--info)">${[...new Set(sessions.map(s=>s.patientId||s.doctorId))].length}</div>
              <div style="font-size:0.72rem;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px">Patients/Colleagues</div>
            </div>`}
          </div>

          ${u.isNew ? `<div style="margin-top:16px;background:#e8f5e9;border-radius:var(--radius-md);padding:10px 12px;font-size:0.8rem;color:var(--primary)">🌿 Welcome! Complete your profile to get started.</div>` : ''}
        </div>
      </div>

      <!-- RIGHT: Edit form -->
      <div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Personal Information</span>
            <span style="font-size:0.78rem;color:var(--text-light)">* Required fields</span>
          </div>
          <div class="form-grid">
            <div class="form-row required"><label>Full Name</label><input type="text" id="prof-name" value="${u.name}"></div>
            <div class="form-row"><label>Phone Number</label><input type="tel" id="prof-phone" value="${u.phone||''}"></div>
            <div class="form-row"><label>Address / City</label><input type="text" id="prof-addr" value="${u.address||''}" placeholder="Mumbai, Maharashtra"></div>
            ${u.role==='patient' ? `
            <div class="form-row"><label>Date of Birth</label><input type="date" id="prof-dob" value="${u.dob||''}"></div>
            <div class="form-row"><label>Gender</label>
              <select id="prof-gender">
                <option value="">Select</option>
                <option ${u.gender==='Female'?'selected':''}>Female</option>
                <option ${u.gender==='Male'?'selected':''}>Male</option>
                <option ${u.gender==='Other'?'selected':''}>Other</option>
              </select>
            </div>
            <div class="form-row"><label>Dosha Type</label>
              <select id="prof-dosha">
                ${['Vata','Pitta','Kapha','Vata-Pitta','Pitta-Kapha','Vata-Kapha'].map(d=>`<option ${u.dosha===d?'selected':''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-row"><label>Blood Group</label>
              <select id="prof-bg">
                ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=>`<option ${u.bloodGroup===g?'selected':''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="form-row"><label>Allergies / Sensitivities</label><input type="text" id="prof-allergy" value="${u.allergies||'None'}" placeholder="e.g. Sesame oil, Ghee..."></div>
            <div class="form-row"><label>Emergency Contact</label><input type="tel" id="prof-emergency" value="${u.emergencyContact||''}" placeholder="+91 XXXXX XXXXX"></div>
            ` : ''}
            ${u.role==='doctor' ? `
            <div class="form-row"><label>Specialization</label><input type="text" id="prof-spec" value="${u.specialization||''}"></div>
            <div class="form-row"><label>Qualification</label><input type="text" id="prof-qual" value="${u.qualification||''}"></div>
            <div class="form-row"><label>Years of Experience</label><input type="text" id="prof-exp" value="${u.experience||''}"></div>
            <div class="form-row full"><label>Bio / About</label><textarea id="prof-bio" placeholder="Brief professional bio..." rows="3">${u.bio||''}</textarea></div>
            ` : ''}
          </div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn btn-green" onclick="saveProfile()">💾 Save Changes</button>
            <button class="btn btn-outline" onclick="showPage('${currentUser.role}-dashboard')">Cancel</button>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="card" style="margin-top:0">
          <div class="card-title" style="margin-bottom:16px">🔒 Change Password</div>
          <div class="form-grid">
            <div class="form-row full">
              <label>Current Password</label>
              <div style="position:relative">
                <input type="password" id="pw-current" placeholder="Enter current password" style="padding-right:44px">
                <button onclick="togglePw('pw-current',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-light)">👁️</button>
              </div>
            </div>
            <div class="form-row">
              <label>New Password</label>
              <div style="position:relative">
                <input type="password" id="pw-new" placeholder="Min. 6 characters" oninput="checkPasswordStrength(this.value)" style="padding-right:44px">
                <button onclick="togglePw('pw-new',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-light)">👁️</button>
              </div>
              <div class="pw-strength-wrap" id="pw-strength-wrap">
                <div class="pw-strength-bar"><div class="pw-strength-fill" id="pw-strength-fill"></div></div>
                <div class="pw-strength-label" id="pw-strength-label"></div>
              </div>
            </div>
            <div class="form-row">
              <label>Confirm New Password</label>
              <div style="position:relative">
                <input type="password" id="pw-confirm" placeholder="Repeat new password" style="padding-right:44px">
                <button onclick="togglePw('pw-confirm',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:var(--text-light)">👁️</button>
              </div>
            </div>
          </div>
          <button class="btn btn-green" onclick="changePassword()">Update Password</button>
        </div>
      </div>
    </div>`;
}

function toggleAvatarPicker() {
  const p = document.getElementById('avatar-picker');
  if (p) p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
}

function changeAvatarColor(color) {
  const d = document.getElementById('profile-avatar-display');
  if (d) d.style.background = color;
  currentUser.avatarColor = color;
  // Update header avatar too
  const ha = document.getElementById('header-avatar');
  if (ha) ha.style.background = color;
  showToast('Avatar colour updated!', 'success');
  toggleAvatarPicker();
}

function saveProfile() {
  const u = currentUser;
  u.name  = document.getElementById('prof-name')?.value?.trim()  || u.name;
  u.phone = document.getElementById('prof-phone')?.value?.trim() || '';
  u.address = document.getElementById('prof-addr')?.value?.trim() || '';

  if (u.role === 'patient') {
    u.dob           = document.getElementById('prof-dob')?.value       || u.dob;
    u.gender        = document.getElementById('prof-gender')?.value    || u.gender;
    u.dosha         = document.getElementById('prof-dosha')?.value     || u.dosha;
    u.bloodGroup    = document.getElementById('prof-bg')?.value        || u.bloodGroup;
    u.allergies     = document.getElementById('prof-allergy')?.value   || u.allergies;
    u.emergencyContact = document.getElementById('prof-emergency')?.value || u.emergencyContact;
  }
  if (u.role === 'doctor') {
    u.specialization = document.getElementById('prof-spec')?.value?.trim() || u.specialization;
    u.qualification  = document.getElementById('prof-qual')?.value?.trim() || u.qualification;
    u.experience     = document.getElementById('prof-exp')?.value?.trim()  || u.experience;
    u.bio            = document.getElementById('prof-bio')?.value?.trim()  || '';
  }

  // Update avatar initials from name
  const parts = u.name.trim().split(' ').filter(Boolean);
  u.avatar = parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : parts[0].slice(0,2).toUpperCase();

  // Sync with DB
  const dbUser = DB.users.find(x => x.id === u.id);
  if (dbUser) Object.assign(dbUser, u);

  // Update header
  const ha = document.getElementById('header-avatar');
  if (ha) ha.childNodes[0].textContent = u.avatar;

  showToast('Profile saved successfully! 🌿', 'success');
  showPage('profile');
}

function changePassword() {
  const current = document.getElementById('pw-current')?.value;
  const newPw   = document.getElementById('pw-new')?.value;
  const confirm = document.getElementById('pw-confirm')?.value;

  if (!current)           { showToast('Please enter your current password', 'error');  return; }
  if (current !== currentUser.password) { showToast('Current password is incorrect', 'error'); return; }
  if (!newPw || newPw.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
  if (newPw !== confirm)  { showToast('New passwords do not match', 'error'); return; }
  if (newPw === current)  { showToast('New password must be different from current', 'warning'); return; }

  currentUser.password = newPw;
  const dbUser = DB.users.find(x => x.id === currentUser.id);
  if (dbUser) dbUser.password = newPw;

  // Clear fields
  ['pw-current','pw-new','pw-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const fill = document.getElementById('pw-strength-fill'); if (fill) fill.style.width = '0';
  const lbl  = document.getElementById('pw-strength-label'); if (lbl) lbl.textContent = '';

  showToast('Password changed successfully! 🔒', 'success');
}

// ═══════════════════════════════════════════════════════════
// SHARED — SETTINGS
// ═══════════════════════════════════════════════════════════
const USER_PREFS = {};  // per-session preferences store

