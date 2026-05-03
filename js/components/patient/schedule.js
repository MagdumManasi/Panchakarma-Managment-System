/* === js/components/patient/schedule.js === */
function renderPatientSchedule(el) {
  const now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  const mySessions = DB.sessions.filter(s => s.patientId === currentUser.id && s.status === 'scheduled');

  el.innerHTML = `
    <div class="page-header"><h2>📅 Therapy Schedule</h2><p>Manage your upcoming Panchakarma sessions</p></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-green" onclick="openBookingModal()">+ Book Session</button>
    </div>
    <div class="calendar-layout">
      <div class="cal-wrap">
        <div class="cal-header">
          <button class="cal-nav" onclick="changeMonth(-1)">‹</button>
          <div class="cal-month" id="cal-month-label"></div>
          <button class="cal-nav" onclick="changeMonth(1)">›</button>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>
      <div class="sessions-panel">
        <div class="card">
          <div class="card-header"><span class="card-title">Upcoming Sessions</span><span class="badge badge-blue">${mySessions.length} upcoming</span></div>
          <div id="sessions-list">
            ${mySessions.length ? mySessions.sort((a,b)=>a.date.localeCompare(b.date)).map(s => sessionCardHTML(s)).join('') : '<div class="empty-state"><span class="empty-state-icon">📅</span><p>No upcoming sessions. Book your first one!</p></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Completed Sessions</span></div>
          ${DB.sessions.filter(s=>s.patientId===currentUser.id&&s.status==='completed').map(s=>sessionCardHTML(s)).join('') || '<div class="empty-state"><span class="empty-state-icon">✅</span><p>No completed sessions yet</p></div>'}
        </div>
      </div>
    </div>`;
  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  const grid = document.getElementById('cal-grid');
  if (!label || !grid) return;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${months[calMonth]} ${calYear}`;
  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const sessionDates = DB.sessions.filter(s=>s.patientId===currentUser.id&&s.status==='scheduled').map(s=>s.date);

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-header">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month">${daysInPrev - firstDay + i + 1}</div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getDate()===d && today.getMonth()===calMonth && today.getFullYear()===calYear;
    const hasSession = sessionDates.includes(dateStr);
    const isPast = new Date(dateStr) < new Date(today.toDateString());
    html += `<div class="cal-day ${isToday?'today':''} ${hasSession?'has-session':''} ${isPast&&!isToday?'past':''}" onclick="calDayClick('${dateStr}')">${d}</div>`;
  }
  grid.innerHTML = html;
}
function changeMonth(dir) { calMonth += dir; if(calMonth>11){calMonth=0;calYear++} if(calMonth<0){calMonth=11;calYear--} renderCalendar(); }
function calDayClick(date) { openBookingModal(date); }

function sessionCardHTML(s) {
  const th = getTherapy(s.therapyId), dr = getUser(s.doctorId);
  const statusMap = { scheduled: 'badge-blue', completed: 'badge-green', cancelled: 'badge-red', rescheduled: 'badge-yellow' };
  const wasReallocated = !!s.reallocatedAt;
  return `<div class="session-card" style="border-left-color:${th?.color||'#4A7C2B'}${wasReallocated?';background:linear-gradient(90deg,rgba(40,167,69,0.06),transparent)':''}">
    <div class="session-time-block">
      <div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div>
      <div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div>
    </div>
    <div class="session-info">
      <div class="session-therapy">${th?.name||'—'}</div>
      <div class="session-therapist">${dr?.name||'—'} · ${formatDate(s.date)} · ${th?.duration||60}min</div>
      ${wasReallocated ? `<div style="margin-top:4px"><span style="font-size:0.72rem;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:99px;font-weight:700">🔄 Time updated — was ${formatTime(s.prevTime)}</span></div>` : ''}
    </div>
    <div class="session-actions">
      <span class="badge ${statusMap[s.status]||'badge-gray'}">${s.status}</span>
      ${s.status==='scheduled'?`<button class="btn btn-sm btn-outline" onclick="rescheduleSession('${s.id}')">↺</button>
      <button class="btn btn-sm btn-danger" onclick="cancelSession('${s.id}')">✕</button>`:''}
    </div>
  </div>`;
}

function openBookingModal(prefillDate) {
  const therapyOptions  = DB.therapies.map(t=>`<option value="${t.id}">${t.name} (${t.duration}min · ₹${t.price.toLocaleString()})</option>`).join('');
  const approvedDoctors = DB.users.filter(u=>u.role==='doctor'&&(u.verificationStatus||'approved')==='approved');

  openModal(`
    <div class="modal-header"><div class="modal-title">📅 Book New Session</div><button class="modal-close" onclick="closeMod()">✕</button></div>

    <div class="form-row required full"><label>Therapy Type</label>
      <select id="bk-therapy">${therapyOptions}</select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row required"><label>Date</label>
        <input type="date" id="bk-date" value="${prefillDate||getDateStr(1)}"
               min="${getDateStr(0)}" max="${getDateStr(DB.clinicConfig.bookingAdvanceDays)}"
               onchange="refreshBookingSlots()">
      </div>
      <div class="form-row required"><label>Doctor</label>
        <select id="bk-doctor" onchange="refreshBookingSlots()">
          ${approvedDoctors.map(d=>`<option value="${d.id}">${d.name} — ${d.specialization}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Live capacity indicator -->
    <div id="bk-capacity-bar" style="margin-bottom:14px"></div>

    <div class="form-row required"><label>Available Time Slots</label>
      <select id="bk-time" style="font-size:0.9rem">
        <option value="">Loading slots…</option>
      </select>
    </div>

    <div class="form-row full"><label>Notes (optional)</label>
      <textarea id="bk-notes" rows="2" placeholder="Any special instructions or concerns…"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" id="bk-submit-btn" onclick="confirmBooking()">Confirm Booking →</button>
    </div>`);

  // Initial slot refresh
  setTimeout(refreshBookingSlots, 50);
}

function refreshBookingSlots() {
  const dateEl   = document.getElementById('bk-date');
  const drEl     = document.getElementById('bk-doctor');
  const timeEl   = document.getElementById('bk-time');
  const capEl    = document.getElementById('bk-capacity-bar');
  const submitEl = document.getElementById('bk-submit-btn');
  if (!dateEl || !drEl || !timeEl) return;

  const date     = dateEl.value;
  const doctorId = drEl.value;
  if (!date || !doctorId) return;

  const cap = getDoctorDayCapacity(doctorId, date);

  // Capacity indicator
  const pct   = Math.round((cap.used / cap.limit) * 100);
  const color = pct >= 100 ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--success)';
  capEl.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px;border-left:4px solid ${color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.82rem;font-weight:700;color:${color}">
          ${cap.available === 0 ? '⛔ Fully Booked' : `✅ ${cap.available} slot${cap.available!==1?'s':''} available`}
        </span>
        <span style="font-size:0.78rem;color:var(--text-light)">${cap.used} / ${cap.limit} patients booked</span>
      </div>
      <div style="height:6px;background:#E5DDD0;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:3px;transition:width 0.4s ease"></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-light);margin-top:5px">
        Working hours: ${cap.doctor?.workStart||'09:00'} – ${cap.doctor?.workEnd||'18:00'}
        · Daily limit: ${cap.limit} patients
        ${cap.doctor?.workingDays ? '· ' + cap.doctor.workingDays.join(', ') : ''}
      </div>
    </div>`;

  // Populate time slots
  if (cap.slots.length === 0) {
    timeEl.innerHTML = `<option value="">No available slots — all ${cap.limit} slots booked</option>`;
    if (submitEl) { submitEl.disabled = true; submitEl.style.opacity = '0.5'; }
  } else {
    timeEl.innerHTML = cap.slots.map(t => `<option value="${t}">${formatTime(t)}</option>`).join('');
    if (submitEl) { submitEl.disabled = false; submitEl.style.opacity = '1'; }
  }
}

function confirmBooking() {
  const therapyId = document.getElementById('bk-therapy').value;
  const date      = document.getElementById('bk-date').value;
  const time      = document.getElementById('bk-time').value;
  const doctorId  = document.getElementById('bk-doctor').value;
  const notes     = document.getElementById('bk-notes')?.value || '';

  if (!therapyId || !date || !time || !doctorId) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  // Re-check capacity at booking time (race condition guard)
  if (isDoctorAtCapacity(doctorId, date)) {
    showToast('This doctor is fully booked on the selected date. Please choose another date.', 'error');
    refreshBookingSlots();
    return;
  }

  // Check for duplicate booking (same patient, same doctor, same date)
  const dup = DB.sessions.find(s =>
    s.patientId === currentUser.id &&
    s.doctorId  === doctorId &&
    s.date      === date &&
    s.status    === 'scheduled'
  );
  if (dup) {
    showToast(`You already have a session with this doctor on ${formatDate(date)}.`, 'warning');
    return;
  }

  const th = getTherapy(therapyId);
  const dr = getUser(doctorId);
  const newSession = {
    id: genId('s'), patientId: currentUser.id, doctorId, therapyId,
    date, time, status: 'scheduled', notes, duration: th?.duration || 60
  };
  DB.sessions.push(newSession);

  DB.notifications.push({
    id: genId('n'), userId: currentUser.id, type: 'system', priority: 'normal', read: false,
    title: `✅ Appointment Confirmed — ${th?.name}`,
    message: `Your ${th?.name} session with ${dr?.name} on ${formatDate(date)} at ${formatTime(time)} has been confirmed.`,
    createdAt: new Date().toISOString()
  });

  // Notify the doctor too
  DB.notifications.push({
    id: genId('n'), userId: doctorId, type: 'system', priority: 'normal', read: false,
    title: `📅 New Appointment — ${currentUser.name}`,
    message: `${currentUser.name} (${currentUser.patientCode||'Patient'}) has booked a ${th?.name} session on ${formatDate(date)} at ${formatTime(time)}.`,
    createdAt: new Date().toISOString()
  });

  closeMod();
  showToast(`${th?.name} session booked for ${formatDate(date)} at ${formatTime(time)}! 🌿`, 'success');
  buildNav();
  showPage('patient-schedule');
}

function cancelSession(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  const th = getTherapy(s.therapyId);
  openModal(`
    <div class="modal-header"><div class="modal-title">Cancel Session</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <p style="color:var(--text-med);margin-bottom:20px">Are you sure you want to cancel <strong>${th?.name}</strong> on <strong>${formatDate(s.date)}</strong>?</p>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Keep Session</button><button class="btn btn-danger" onclick="doCancel('${id}')">Yes, Cancel</button></div>`);
}
function doCancel(id) {
  const s = DB.sessions.find(s => s.id === id);
  if (!s) { closeMod(); return; }

  const cancelledTime  = s.time;
  const cancelledDate  = s.date;
  const cancelledDoctor= s.doctorId;
  const th = getTherapy(s.therapyId);

  // Mark as cancelled
  s.status      = 'cancelled';
  s.cancelledAt = new Date().toISOString();

  // Notify the cancelled patient
  DB.notifications.push({
    id: genId('n'), userId: s.patientId, type: 'system',
    priority: 'high', read: false,
    title: `❌ Session Cancelled — ${th?.name || 'Session'}`,
    message: `Your ${th?.name || 'session'} on ${formatDate(cancelledDate)} at ${formatTime(cancelledTime)} has been cancelled.`,
    createdAt: new Date().toISOString(),
  });

  // ── AUTO-REALLOCATION ──────────────────────────────────
  // Find the next scheduled session on the same doctor + date
  // that has a LATER time than the just-freed slot
  const waitingSessions = DB.sessions
    .filter(ws =>
      ws.doctorId === cancelledDoctor &&
      ws.date     === cancelledDate   &&
      ws.status   === 'scheduled'     &&
      ws.time     >  cancelledTime        // later than freed slot
    )
    .sort((a, b) => a.time.localeCompare(b.time)); // earliest first

  if (waitingSessions.length > 0) {
    const next       = waitingSessions[0];
    const oldTime    = next.time;
    const nextPt     = getUser(next.patientId);
    const nextDr     = getUser(cancelledDoctor);
    const nextTh     = getTherapy(next.therapyId);

    // Move that session to the freed slot
    next.time          = cancelledTime;
    next.reallocatedAt = new Date().toISOString();
    next.prevTime      = oldTime; // keep audit trail

    // Notify the patient who got the earlier slot
    DB.notifications.push({
      id: genId('n'), userId: next.patientId, type: 'system',
      priority: 'high', read: false,
      title: `🎉 Earlier Slot Available — Your Session Moved!`,
      message: `Great news, ${nextPt?.name?.split(' ')[0] || 'there'}! A slot opened up earlier. Your ${nextTh?.name || 'session'} with ${nextDr?.name || 'your doctor'} on ${formatDate(cancelledDate)} has been moved from ${formatTime(oldTime)} to ${formatTime(cancelledTime)}. Please plan accordingly.`,
      createdAt: new Date().toISOString(),
    });

    // Notify the doctor about the change
    DB.notifications.push({
      id: genId('n'), userId: cancelledDoctor, type: 'system',
      priority: 'normal', read: false,
      title: `🔄 Schedule Updated — Auto-Reallocation`,
      message: `${nextPt?.name || 'A patient'} (${nextPt?.patientCode || '—'}) has been automatically moved from ${formatTime(oldTime)} to ${formatTime(cancelledTime)} on ${formatDate(cancelledDate)} due to a cancellation.`,
      createdAt: new Date().toISOString(),
    });

    closeMod();
    showToast(
      `Session cancelled. ${nextPt?.name?.split(' ')[0] || 'Next patient'} automatically moved to ${formatTime(cancelledTime)} 🔄`,
      'success'
    );
  } else {
    closeMod();
    showToast('Session cancelled.', 'warning');
  }

  buildNav();
  showPage('patient-schedule');
}

function rescheduleSession(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  const th = getTherapy(s.therapyId);
  const timeOptions = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t=>`<option value="${t}" ${t===s.time?'selected':''}>${formatTime(t)}</option>`).join('');
  openModal(`
    <div class="modal-header"><div class="modal-title">Reschedule: ${th?.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row required"><label>New Date</label><input type="date" id="rs-date" value="${s.date}" min="${getDateStr(0)}"></div>
      <div class="form-row required"><label>New Time</label><select id="rs-time">${timeOptions}</select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="doReschedule('${id}')">Confirm Reschedule</button></div>`);
}
function doReschedule(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  s.date = document.getElementById('rs-date').value;
  s.time = document.getElementById('rs-time').value;
  s.status = 'scheduled';
  closeMod(); showToast('Session rescheduled!', 'success'); showPage('patient-schedule');
}

// ═══════════════════════════════════════════════════════════
// PATIENT — PROGRESS
// ═══════════════════════════════════════════════════════════
