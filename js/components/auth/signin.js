/* === Auth: Sign In === */
function switchAuthMode(mode) {
  document.getElementById('card-signin').classList.toggle('active', mode === 'signin');
  document.getElementById('card-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('tab-signin').classList.toggle('active', mode === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  ['signin-error','signup-error','signup-success'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('show'); el.textContent = ''; }
  });
}

// ═══════════════════════════════════════════════════════════
// AUTH — SIGN IN
// ═══════════════════════════════════════════════════════════
function switchLoginTab(role) { currentLoginRole = role; }  // legacy alias
function switchSigninRole(role, btn) {
  currentLoginRole = role;
  document.querySelectorAll('#signin-role-tabs .auth-role-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const errEl = document.getElementById('signin-error');
  if (errEl) errEl.classList.remove('show');
}

function demoLogin(role) {
  const DEMO = {
    patient: { email:'priya@demo.com',  password:'demo123'  },
    doctor:  { email:'doctor@demo.com', password:'demo123'  },
    admin:   { email:'admin@demo.com',  password:'admin123' },
  };
  const si = document.getElementById('signin-email');     if (si) si.value = DEMO[role].email;
  const sp = document.getElementById('signin-password');  if (sp) sp.value = DEMO[role].password;
  document.querySelectorAll('#signin-role-tabs .auth-role-tab').forEach((b,i) => {
    b.classList.toggle('active', ['patient','doctor','admin'][i] === role);
  });
  currentLoginRole = role;
  handleLogin();
}

function handleLogin() {
  const email = (document.getElementById('signin-email')?.value || '').trim();
  const pw    =  document.getElementById('signin-password')?.value || '';
  const errEl =  document.getElementById('signin-error');

  if (!email || !pw) {
    if (errEl) { errEl.textContent = 'Please enter your email and password.'; errEl.classList.add('show'); }
    return;
  }

  const btn = document.getElementById('signin-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span>Signing in…</span>'; }

  setTimeout(() => {
    const user = DB.users.find(u => u.email === email && u.password === pw);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>Sign In</span><span>→</span>'; }
    if (!user) {
      if (errEl) { errEl.textContent = 'Invalid email or password. Please try again.'; errEl.classList.add('show'); }
      const card = document.getElementById('card-signin');
      if (card) { card.style.animation='none'; void card.offsetHeight; card.style.animation='shake 0.4s ease'; }
      return;
    }
    if (errEl) errEl.classList.remove('show');

    // ── DOCTOR VERIFICATION CHECK ──────────────────────────────
    if (user.role === 'doctor') {
      const status = user.verificationStatus || 'pending';
      if (status === 'pending' || status === 'rejected') {
        currentUser = user;
        showPendingScreen(user, status);
        return;
      }
    }

    currentUser = user;
    bootApp();
  }, 380);
}

// ═══════════════════════════════════════════════════════════
// DOCTOR VERIFICATION — PENDING / REJECTED SCREEN
// ═══════════════════════════════════════════════════════════
function showPendingScreen(user, status) {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('pending-page').classList.add('active');

  const el = document.getElementById('pending-card-content');

  if (status === 'pending') {
    el.innerHTML = `
      <div class="pending-icon-wrap pending">
        <div class="pending-pulse"></div>
        ⏳
      </div>
      <div class="pending-title">Verification Pending</div>
      <div class="pending-subtitle">
        Your doctor application is under review by our clinic administrators.<br>
        You will receive access once your credentials are verified.
      </div>

      <div class="pending-steps">
        <div class="pending-step">
          <div class="pending-step-dot done">✓</div>
          <div class="pending-step-label">Registered</div>
        </div>
        <div class="pending-step">
          <div class="pending-step-dot active">🔍</div>
          <div class="pending-step-label">Under Review</div>
        </div>
        <div class="pending-step">
          <div class="pending-step-dot wait">✓</div>
          <div class="pending-step-label">Approved</div>
        </div>
        <div class="pending-step">
          <div class="pending-step-dot wait">🏠</div>
          <div class="pending-step-label">Dashboard</div>
        </div>
      </div>

      <div class="pending-info-box">
        <div class="pending-info-label">Your Application Details</div>
        <div class="pending-info-row"><span class="pending-info-key">Name</span><span class="pending-info-value">${user.name}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Email</span><span class="pending-info-value">${user.email}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Specialization</span><span class="pending-info-value">${user.specialization || '—'}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Qualification</span><span class="pending-info-value">${user.qualification || '—'}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Applied</span><span class="pending-info-value">${user.appliedAt ? formatDate(user.appliedAt.split('T')[0]) : 'Today'}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Status</span><span class="pending-info-value" style="color:var(--warning);font-weight:700">⏳ Awaiting Admin Approval</span></div>
      </div>

      <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:20px;line-height:1.6">
        ⏱ Typical review time is <strong>24–48 hours</strong>.<br>
        You will receive an email notification once your account is approved or if additional information is required.
      </p>

      <button class="btn-primary" onclick="logoutFromPending()" style="margin-bottom:12px">← Back to Sign In</button>
      <button class="btn-primary" style="background:transparent;color:var(--primary);border:2px solid var(--primary);box-shadow:none" onclick="checkApprovalStatus()">🔄 Check Status</button>`;

  } else if (status === 'rejected') {
    el.innerHTML = `
      <div class="pending-icon-wrap rejected">
        ❌
      </div>
      <div class="pending-title">Application Rejected</div>
      <div class="pending-subtitle">
        Unfortunately your doctor application was not approved at this time.<br>
        Please contact the clinic administrator for more information.
      </div>

      <div class="pending-info-box rejected">
        <div class="pending-info-label">Rejection Details</div>
        <div class="pending-info-row"><span class="pending-info-key">Name</span><span class="pending-info-value">${user.name}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Email</span><span class="pending-info-value">${user.email}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Reason</span><span class="pending-info-value" style="color:var(--danger)">${user.rejectionReason || 'Credentials could not be verified'}</span></div>
        <div class="pending-info-row"><span class="pending-info-key">Status</span><span class="pending-info-value" style="color:var(--danger);font-weight:700">❌ Rejected</span></div>
      </div>

      <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:20px;line-height:1.6">
        You may re-apply with updated credentials or contact us at <strong>admin@panchakarma.com</strong>.
      </p>

      <button class="btn-primary" onclick="logoutFromPending()">← Back to Sign In</button>`;
  }
}

function logoutFromPending() {
  currentUser = null;
  document.getElementById('pending-page').classList.remove('active');
  document.getElementById('login-page').classList.add('active');
  document.getElementById('signin-email').value = '';
  document.getElementById('signin-password').value = '';
  switchAuthMode('signin');
}

function checkApprovalStatus() {
  if (!currentUser) return;
  const fresh = DB.users.find(u => u.id === currentUser.id);
  if (!fresh) return;
  if (fresh.verificationStatus === 'approved') {
    currentUser = fresh;
    document.getElementById('pending-page').classList.remove('active');
    showToast('🎉 Your account has been approved! Welcome!', 'success');
    bootApp();
  } else {
    showToast('Still pending. Please check back later.', 'info');
    // Re-render in case status changed to rejected
    showPendingScreen(fresh, fresh.verificationStatus);
  }
}

function showForgotPassword() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🔑 Reset Password</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <p style="color:var(--text-med);margin-bottom:20px;font-size:0.9rem;line-height:1.6">Enter your registered email and we will send you a reset link.</p>
    <div class="form-row"><label>Email Address</label><input type="email" id="forgot-email" placeholder="your@email.com"></div>
    <div id="forgot-msg" style="display:none;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:0.85rem"></div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="sendPasswordReset()">Send Reset Link</button>
    </div>`);
}
function sendPasswordReset() {
  const email = document.getElementById('forgot-email')?.value?.trim();
  const msgEl = document.getElementById('forgot-msg');
  if (!email) { showToast('Please enter your email','error'); return; }
  const user = DB.users.find(u => u.email === email);
  if (!msgEl) return;
  msgEl.style.display = 'block';
  if (user) {
    msgEl.style.cssText = 'display:block;background:#e8f5e9;color:#2e7d32;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:0.85px';
    msgEl.innerHTML = `✅ A reset link has been sent to <strong>${email}</strong>.`;
  } else {
    msgEl.style.cssText = 'display:block;background:#fce4ec;color:#c62828;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:0.85px';
    msgEl.textContent = 'No account found with this email address.';
  }
}

// ═══════════════════════════════════════════════════════════
// AUTH — SIGN UP
// ═══════════════════════════════════════════════════════════
function switchSignupRole(role, btn) {
  signupRole = role;
  document.querySelectorAll('#signup-role-tabs .auth-role-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('su-patient-fields').style.display = role === 'patient' ? '' : 'none';
  document.getElementById('su-doctor-fields').style.display  = role === 'doctor'  ? '' : 'none';
  clearSignupErrors();
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId); if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁️';
}

function checkPasswordStrength(pw) {
  const wrap  = document.getElementById('pw-strength-wrap');
  const fill  = document.getElementById('pw-strength-fill');
  const label = document.getElementById('pw-strength-label');
  if (!wrap) return;
  wrap.style.display = pw.length ? 'block' : 'none';
  let score = 0;
  if (pw.length >= 6)           score++;
  if (pw.length >= 10)          score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const lvls = [
    {p:20,c:'#DC3545',t:'Very Weak'},{p:40,c:'#fd7e14',t:'Weak'},
    {p:60,c:'#FFC107',t:'Fair'},{p:80,c:'#20c997',t:'Good'},{p:100,c:'#28A745',t:'Strong 💪'},
  ];
  const l = lvls[Math.min(score,5)-1] || lvls[0];
  fill.style.width=l.p+'%'; fill.style.background=l.c;
  label.style.color=l.c; label.textContent=l.t;
}

function clearSignupErrors() {
  ['su-firstname','su-lastname','su-email','su-password','su-confirm','su-spec'].forEach(id => {
    const el=document.getElementById(id); if(el) el.classList.remove('error');
    const er=document.getElementById('err-'+id); if(er) er.classList.remove('show');
  });
  ['signup-error','signup-success'].forEach(id => {
    const el=document.getElementById(id); if(el){el.classList.remove('show');el.textContent='';}
  });
}

function showFieldError(fid, msg) {
  const inp=document.getElementById(fid); if(inp) inp.classList.add('error');
  const err=document.getElementById('err-'+fid); if(err){err.textContent=msg;err.classList.add('show');}
}
