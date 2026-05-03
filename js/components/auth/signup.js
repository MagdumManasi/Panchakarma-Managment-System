/* === Auth: Sign Up === */
function handleSignup() {
  clearSignupErrors();
  let valid = true;

  const first   = document.getElementById('su-firstname')?.value?.trim();
  const last    = document.getElementById('su-lastname')?.value?.trim();
  const email   = document.getElementById('su-email')?.value?.trim();
  const phone   = document.getElementById('su-phone')?.value?.trim();
  const pw      = document.getElementById('su-password')?.value;
  const confirm = document.getElementById('su-confirm')?.value;
  const terms   = document.getElementById('su-terms')?.checked;

  if (!first) { showFieldError('su-firstname','First name is required'); valid=false; }
  if (!last)  { showFieldError('su-lastname', 'Last name is required');  valid=false; }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRx.test(email)) { showFieldError('su-email','Enter a valid email address'); valid=false; }
  else if (DB.users.find(u=>u.email===email)) { showFieldError('su-email','This email is already registered'); valid=false; }

  if (!pw || pw.length < 6) { showFieldError('su-password','Minimum 6 characters required'); valid=false; }
  if (pw !== confirm)       { showFieldError('su-confirm','Passwords do not match');          valid=false; }

  if (signupRole==='doctor' && !document.getElementById('su-spec')?.value) {
    showFieldError('su-spec','Please select your specialization'); valid=false;
  }

  if (!terms) {
    const errEl=document.getElementById('signup-error');
    errEl.textContent='Please accept the Terms of Service to continue.'; errEl.classList.add('show');
    valid=false;
  }

  if (!valid) return;

  const btn = document.getElementById('signup-btn');
  if (btn) { btn.disabled=true; btn.innerHTML='<span>Creating account…</span>'; }

  setTimeout(() => {
    if (btn) { btn.disabled=false; btn.innerHTML='<span>Create Account</span><span>→</span>'; }

    const fullName = `${first} ${last}`;
    const avatar   = (first[0]+last[0]).toUpperCase();
    const isDr     = signupRole === 'doctor';
    const newUser  = {
      id: genId('u'), name:fullName, email, password:pw, role:signupRole,
      phone:phone||'', avatar, isNew:true,
      // Doctor-specific verification
      verificationStatus: isDr ? 'pending' : undefined,
      appliedAt: isDr ? new Date().toISOString() : undefined,
      dob:            document.getElementById('su-dob')?.value    || '',
      gender:         document.getElementById('su-gender')?.value || '',
      dosha:          document.getElementById('su-dosha')?.value  || 'Vata',
      address:'', bloodGroup:'—', allergies:'None', emergencyContact:'',
      specialization: document.getElementById('su-spec')?.value  || '',
      qualification:  document.getElementById('su-qual')?.value  || '',
      experience:     document.getElementById('su-exp')?.value   || '',
      rating:0, patients:0,
    };
    DB.users.push(newUser);

    // Notify admins about new doctor application
    if (isDr) {
      DB.users.filter(u => u.role === 'admin').forEach(admin => {
        DB.notifications.push({
          id:genId('n'), userId:admin.id, type:'system', priority:'high', read:false,
          title:`🩺 New Doctor Application — ${fullName}`,
          message:`${fullName} (${newUser.specialization}) has applied for a doctor account. Please review and verify their credentials in Admin → Doctor Verification.`,
          createdAt: new Date().toISOString(),
        });
      });
    }

    DB.notifications.push({
      id:genId('n'), userId:newUser.id, type:'system', priority:'normal', read:false,
      title: isDr ? `🌿 Application Submitted, ${first}!` : `🌿 Welcome to Panchakarma, ${first}!`,
      message: isDr
        ? 'Your doctor application is under review. You will be notified once approved by our admin team. Typical review time: 24-48 hours.'
        : 'Your patient account is ready. Book sessions, track your progress, and shop herbal remedies!',
      createdAt: new Date().toISOString(),
    });

    const sEl=document.getElementById('signup-success');

    if (isDr) {
      sEl.textContent=`✅ Application submitted! Your account is pending admin approval.`; sEl.classList.add('show');
      const btn2 = document.getElementById('signup-btn');
      if (btn2) { btn2.disabled=false; btn2.innerHTML='<span>Create Account</span><span>→</span>'; }
      // Show pending screen after brief delay
      setTimeout(() => { currentUser=newUser; showPendingScreen(newUser,'pending'); }, 1400);
    } else {
      sEl.textContent=`✅ Account created! Welcome, ${first}. Signing you in…`; sEl.classList.add('show');
      setTimeout(() => { currentUser=newUser; bootApp(); setTimeout(() => onPatientSignupSuccess(newUser), 600); }, 1200);
    }
  }, 500);
}

function showTerms() {
  openModal(`
    <div class="modal-header"><div class="modal-title">📋 Terms of Service</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="max-height:360px;overflow-y:auto;font-size:0.87rem;color:var(--text-med);line-height:1.7">
      <p><strong>1. Acceptance</strong><br>By creating an account you agree to these terms and our Privacy Policy.</p>
      <p style="margin-top:12px"><strong>2. Account Responsibility</strong><br>You are responsible for maintaining the security of your credentials. Provide accurate information.</p>
      <p style="margin-top:12px"><strong>3. Medical Disclaimer</strong><br>This platform is for appointment management only. Always consult a qualified Ayurvedic practitioner for medical decisions.</p>
      <p style="margin-top:12px"><strong>4. Privacy</strong><br>Your health data is stored securely and never shared with third parties without consent.</p>
      <p style="margin-top:12px"><strong>5. Herbal Shop</strong><br>Products are listed for reference. Verify suitability with your doctor before purchasing.</p>
      <p style="margin-top:16px;color:var(--text-light);font-size:0.78rem">Last updated: January 2025</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-green" onclick="closeMod();document.getElementById('su-terms').checked=true">Accept & Close</button>
    </div>`);
}

function logout() {
  currentUser = null;
  DB.cart = [];
  document.getElementById('app').classList.remove('active');