/* === js/components/doctor/dashboard.js === */
function renderDoctorDashboard(el) {
  const myPatientIds = [...new Set(DB.sessions.filter(s=>s.doctorId===currentUser.id).map(s=>s.patientId))];
  const todaySessions = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.date===getDateStr(0));
  const pendingFeedbacks = DB.feedback.filter(f=>{
    const s=DB.sessions.find(ss=>ss.id===f.sessionId);
    return s&&s.doctorId===currentUser.id;
  });
  const upcoming = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.status==='scheduled').sort((a,b)=>a.date.localeCompare(b.date));

  el.innerHTML = `
    ${getAnnouncementsBanner()}
    <div class="profile-card">
      <div class="profile-avatar-big">${currentUser.avatar}</div>
      <div>
        <div class="profile-name">Welcome, ${currentUser.name}! 🙏</div>
        <div class="profile-role">${currentUser.specialization}</div>
        <div class="profile-detail" style="margin-top:4px">${currentUser.qualification} · ${currentUser.experience}</div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">👥</span><div class="stat-label">Total Patients</div><div class="stat-value">${myPatientIds.length}</div><div class="stat-sub">Active patients under care</div></div>
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">Today's Sessions</div><div class="stat-value">${todaySessions.length}</div><div class="stat-sub">Sessions scheduled today</div></div>
      <div class="stat-card"><span class="stat-icon">📋</span><div class="stat-label">Upcoming</div><div class="stat-value">${upcoming.length}</div><div class="stat-sub">Sessions this week</div></div>
      <div class="stat-card"><span class="stat-icon">⭐</span><div class="stat-label">My Rating</div><div class="stat-value">${currentUser.rating}</div><div class="stat-sub">Patient satisfaction score</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Today's Schedule</span><span style="font-size:0.82rem;color:var(--text-light)">${formatDate(getDateStr(0))}</span></div>
        ${todaySessions.length ? todaySessions.map(s => {
          const th=getTherapy(s.therapyId), pt=getUser(s.patientId);
          return `<div class="session-card">
            <div class="session-time-block"><div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div><div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div></div>
            <div class="session-info"><div class="session-therapy">${th?.name||'—'}</div><div class="session-therapist">Patient: ${pt?.name||'—'}</div></div>
            <div><span class="badge badge-blue">${s.status}</span></div>
          </div>`;
        }).join('') : '<div class="empty-state"><span class="empty-state-icon">📅</span><p>No sessions today</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Patient Feedback</span></div>
        ${pendingFeedbacks.slice(0,4).map(f=>{
          const pt=getUser(f.patientId), s=DB.sessions.find(ss=>ss.id===f.sessionId), th=s?getTherapy(s.therapyId):null;
          const stars='★'.repeat(Math.round(f.rating/2))+'☆'.repeat(5-Math.round(f.rating/2));
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.8rem">${pt?.avatar||'?'}</div>
            <div style="flex:1"><div style="font-weight:600;font-size:0.88rem">${pt?.name}</div><div style="font-size:0.78rem;color:var(--text-light)">${th?.name||'Session'} · ${formatDate(f.submittedAt)}</div></div>
            <div style="color:var(--accent)">${stars}</div>
          </div>`;
        }).join('') || '<div class="empty-state"><span class="empty-state-icon">⭐</span><p>No feedback yet</p></div>'}
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><span class="card-title">Upcoming Appointments</span><button class="btn btn-sm btn-green" onclick="showPage('doctor-schedule')">Full Schedule</button></div>
      ${upcoming.slice(0,5).map(s => {
        const th=getTherapy(s.therapyId), pt=getUser(s.patientId);
        return `<div class="session-card">
          <div class="session-time-block"><div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div><div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div></div>
          <div class="session-info"><div class="session-therapy">${th?.name||'—'}</div><div class="session-therapist">${pt?.name||'—'} · ${formatDate(s.date)}</div></div>
          <div><span class="badge badge-blue">${s.status}</span><button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${pt?.id}')">View</button></div>
        </div>`;
      }).join('') || '<div class="empty-state"><p>No upcoming appointments</p></div>'}
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — PATIENTS
// ═══════════════════════════════════════════════════════════
