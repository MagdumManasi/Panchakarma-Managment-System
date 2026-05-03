/* === js/components/patient/dashboard.js === */
function renderPatientDashboard(el) {
  const mySessions = DB.sessions.filter(s => s.patientId === currentUser.id);
  const upcoming = mySessions.filter(s => s.status === 'scheduled').sort((a,b) => a.date.localeCompare(b.date));
  const completed = mySessions.filter(s => s.status === 'completed');
  const unread = DB.notifications.filter(n => n.userId === currentUser.id && !n.read).length;
  const myMilestones = DB.milestones.filter(m => m.patientId === currentUser.id);
  const doneMilestones = myMilestones.filter(m => m.status === 'completed').length;
  const nextSession = upcoming[0];
  const nextTherapy = nextSession ? getTherapy(nextSession.therapyId) : null;
  const doshaBadge = `<span class="dosha-badge dosha-${currentUser.dosha?.toLowerCase().split('-')[0] || 'vata'}">${currentUser.dosha || 'Vata'}</span>`;

  el.innerHTML = `
    ${getAnnouncementsBanner()}
    <div class="profile-card">
      <div class="profile-avatar-big">${currentUser.avatar}</div>
      <div>
        <div class="profile-name">Welcome back, ${currentUser.name.split(' ')[0]}! 🙏</div>
        <div class="profile-role">Panchakarma Patient</div>
        <div class="profile-detail" style="margin-top:8px">Dosha: ${doshaBadge} &nbsp;|&nbsp; ${currentUser.phone}</div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-icon">📅</span><div class="stat-label">Next Session</div><div class="stat-value" style="font-size:1.3rem">${nextSession ? formatDate(nextSession.date) : 'None'}</div><div class="stat-sub">${nextTherapy ? nextTherapy.name + ' · ' + formatTime(nextSession.time) : 'Book your first session'}</div></div>
      <div class="stat-card"><span class="stat-icon">✅</span><div class="stat-label">Sessions Done</div><div class="stat-value">${completed.length}</div><div class="stat-sub">of ${mySessions.length} total sessions</div></div>
      <div class="stat-card"><span class="stat-icon">🏆</span><div class="stat-label">Milestones</div><div class="stat-value">${doneMilestones}/${myMilestones.length}</div><div class="stat-sub">Treatment milestones completed</div></div>
      <div class="stat-card"><span class="stat-icon">🔔</span><div class="stat-label">Notifications</div><div class="stat-value">${unread}</div><div class="stat-sub">Unread messages</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Upcoming Sessions</span><button class="btn btn-sm btn-green" onclick="showPage('patient-schedule')">View All</button></div>
        ${upcoming.slice(0,3).map(s => {
          const th = getTherapy(s.therapyId); const dr = getUser(s.doctorId);
          return `<div class="session-card" onclick="showPage('patient-schedule')">
            <div class="session-time-block"><div class="session-time-big">${formatTime(s.time).split(' ')[0]}</div><div class="session-time-ampm">${formatTime(s.time).split(' ')[1]}</div></div>
            <div class="session-info"><div class="session-therapy">${th?.name || '—'}</div><div class="session-therapist">${dr?.name || '—'} · ${formatDate(s.date)}</div></div>
            <span class="badge badge-blue">Scheduled</span>
          </div>`;
        }).join('') || '<div class="empty-state"><span class="empty-state-icon">📅</span><p>No upcoming sessions</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Treatment Progress</span><button class="btn btn-sm btn-outline" onclick="showPage('patient-progress')">Details</button></div>
        <div class="milestone-timeline">
          ${DB.milestones.filter(m=>m.patientId===currentUser.id).slice(0,4).map(m => `
            <div class="milestone-item">
              <div class="milestone-dot ${m.status==='completed'?'done':m.status==='in_progress'?'active':''}">${m.status==='completed'?'✓':m.status==='in_progress'?'⟳':''}</div>
              <div class="milestone-content">
                <div class="milestone-name">${m.name}</div>
                <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${m.pct}%"></div></div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span class="milestone-date">Target: ${formatDate(m.targetDate)}</span>
                  <span class="badge ${m.status==='completed'?'badge-green':m.status==='in_progress'?'badge-yellow':'badge-gray'}">${m.pct}%</span>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><span class="card-title">Recent Notifications</span><button class="btn btn-sm btn-outline" onclick="showPage('patient-notifications')">All Notifications</button></div>
      ${DB.notifications.filter(n=>n.userId===currentUser.id).slice(0,3).map(n => notifItemHTML(n)).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// PATIENT — SCHEDULE
// ═══════════════════════════════════════════════════════════
let calYear, calMonth;
