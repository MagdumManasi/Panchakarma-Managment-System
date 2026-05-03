/* === js/components/doctor/schedule.js === */
function renderDoctorSchedule(el) {
  const today      = getDateStr(0);
  const mySessions = DB.sessions.filter(s=>s.doctorId===currentUser.id).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming   = mySessions.filter(s=>s.status==='scheduled');
  const completed  = mySessions.filter(s=>s.status==='completed');

  // Build capacity heatmap for next 7 days
  const capacityDays = Array.from({length:7},(_,i)=>getDateStr(i)).map(date => {
    const cap = getDoctorDayCapacity(currentUser.id, date);
    const pct = Math.round((cap.used/cap.limit)*100);
    const color = pct>=100?'var(--danger)':pct>=75?'var(--warning)':'var(--success)';
    const d = new Date(date+'T00:00:00');
    return { date, day: d.toLocaleDateString('en-IN',{weekday:'short'}), num: d.getDate(), cap, pct, color };
  });

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><h2>📅 My Schedule</h2><p>Daily capacity limit: <strong>${currentUser.dailyLimit||8} patients/day</strong></p></div>
        <button class="btn btn-outline" onclick="openCapacitySettingsModal()">⚙️ Set Daily Limit</button>
      </div>
    </div>

    <!-- 7-day Capacity Heatmap -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <span class="card-title">📊 Week Capacity Overview</span>
        <span style="font-size:0.78rem;color:var(--text-light)">Click a day to filter sessions</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
        ${capacityDays.map(d=>`
          <div onclick="filterScheduleByDate('${d.date}')" style="text-align:center;padding:10px 6px;border-radius:var(--radius-md);border:2px solid ${d.date===today?'var(--primary)':'var(--border)'};background:${d.date===today?'#f0f7ee':'white'};cursor:pointer;transition:all 0.15s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='${d.date===today?'var(--primary)':'var(--border)'}'">
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-light);text-transform:uppercase">${d.day}</div>
            <div style="font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:${d.date===today?'var(--primary)':'var(--text)'};margin:4px 0">${d.num}</div>
            <div style="height:4px;background:#E5DDD0;border-radius:2px;margin-bottom:4px;overflow:hidden"><div style="height:100%;width:${d.pct}%;background:${d.color};transition:width 0.4s ease"></div></div>
            <div style="font-size:0.68rem;font-weight:600;color:${d.color}">${d.cap.used}/${d.cap.limit}</div>
            <div style="font-size:0.65rem;color:var(--text-light)">${d.cap.available>0?d.cap.available+' free':'Full'}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="section-tabs">
      <button class="section-tab active" id="sched-tab-upcoming" onclick="docScheduleTab('upcoming',this)">
        📅 Upcoming (${upcoming.length})
      </button>
      <button class="section-tab" id="sched-tab-completed" onclick="docScheduleTab('completed',this)">
        ✅ Completed (${completed.length})
      </button>
    </div>

    <div class="card" id="doc-schedule-content">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date & Time</th><th>Patient</th><th>Patient ID</th><th>Therapy</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="sched-tbody">
            ${renderScheduleRows(upcoming)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderScheduleRows(sessions) {
  if (!sessions.length) return '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:32px">No sessions found</td></tr>';
  return sessions.map(s => {
    const pt = getUser(s.patientId);
    const th = getTherapy(s.therapyId);
    const wasReallocated = !!s.reallocatedAt;
    return `<tr${wasReallocated ? ' style="background:linear-gradient(90deg,rgba(40,167,69,0.04),transparent)"' : ''}>
      <td>
        <strong>${formatDate(s.date)}</strong><br>
        <span style="color:var(--text-light);font-size:0.8rem">${formatTime(s.time)}</span>
        ${wasReallocated ? `<br><span style="font-size:0.68rem;background:#e8f5e9;color:#2e7d32;padding:1px 6px;border-radius:99px;font-weight:700;white-space:nowrap">🔄 Moved from ${formatTime(s.prevTime)}</span>` : ''}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700">${pt?.avatar||'?'}</div>
          <div>
            <div style="font-weight:600;font-size:0.88rem">${pt?.name||'Unknown'}</div>
            <div style="font-size:0.72rem;color:var(--text-light)">${pt?.phone||'No phone'}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-family:var(--font-serif);font-weight:700;font-size:0.85rem;color:var(--primary);background:var(--bg);padding:2px 8px;border-radius:99px;white-space:nowrap">
          ${pt?.patientCode||'—'}
        </span>
      </td>
      <td><span style="color:${th?.color||'var(--primary)'}">●</span> ${th?.name||'—'}</td>
      <td>${s.duration} min</td>
      <td>
        <span class="badge ${s.status==='completed'?'badge-green':s.status==='cancelled'?'badge-red':'badge-blue'}">${s.status}</span>
        ${wasReallocated ? '<br><span class="badge badge-green" style="font-size:0.65rem;margin-top:3px">auto-moved</span>' : ''}
      </td>
      <td style="white-space:nowrap">
        ${s.status==='scheduled' ? `
          <button class="btn btn-sm btn-green" onclick="markSessionComplete('${s.id}')">✓ Done</button>
          <button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${s.patientId}')">Profile</button>` :
          `<button class="btn btn-sm btn-outline" onclick="viewPatientDetails('${s.patientId}')">Profile</button>`}
      </td>
    </tr>`;
  }).join('');
}

function filterScheduleByDate(date) {
  const tbody = document.getElementById('sched-tbody');
  if (!tbody) return;
  const sessions = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.date===date&&s.status!=='cancelled');
  tbody.innerHTML = sessions.length
    ? renderScheduleRows(sessions)
    : `<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:24px">No sessions on ${formatDate(date)}</td></tr>`;
}

function docScheduleTab(tab, btn) {
  document.querySelectorAll('.section-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const data = DB.sessions.filter(s=>s.doctorId===currentUser.id&&s.status===(tab==='upcoming'?'scheduled':'completed'));
  const tbody = document.getElementById('sched-tbody');
  if (tbody) tbody.innerHTML = renderScheduleRows(data);
}

function openCapacitySettingsModal() {
  const dr = currentUser;
  openModal(`
    <div class="modal-header"><div class="modal-title">⚙️ Capacity Settings</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:14px;margin-bottom:18px;font-size:0.85rem;color:var(--text-med)">
      Setting a daily limit prevents overbooking. Patients will not be able to book if you are at capacity.
    </div>
    <div class="form-row">
      <label>Maximum Patients Per Day</label>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" id="cap-slider" min="1" max="20" value="${dr.dailyLimit||8}"
               oninput="document.getElementById('cap-display').textContent=this.value+' patients/day'"
               style="flex:1;accent-color:var(--primary)">
        <span id="cap-display" style="font-family:var(--font-serif);font-size:1.3rem;font-weight:700;color:var(--primary);min-width:120px">${dr.dailyLimit||8} patients/day</span>
      </div>
    </div>
    <div class="form-row">
      <label>Working Hours</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:4px">Start Time</div>
          <input type="time" id="cap-start" value="${dr.workStart||'09:00'}" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:var(--radius-sm)">
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:4px">End Time</div>
          <input type="time" id="cap-end" value="${dr.workEnd||'18:00'}" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:var(--radius-sm)">
        </div>
      </div>
    </div>
    <div class="form-row">
      <label>Working Days</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`
          <label style="display:flex;align-items:center;gap:5px;padding:6px 12px;border:2px solid var(--border);border-radius:99px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;${(dr.workingDays||['Mon','Tue','Wed','Thu','Fri']).includes(day)?'background:var(--primary);color:white;border-color:var(--primary)':'color:var(--text-med)'}">
            <input type="checkbox" ${(dr.workingDays||['Mon','Tue','Wed','Thu','Fri']).includes(day)?'checked':''}
                   value="${day}" class="cap-day-cb" style="display:none"
                   onchange="this.closest('label').style.cssText=this.checked?'display:flex;align-items:center;gap:5px;padding:6px 12px;border:2px solid var(--primary);border-radius:99px;cursor:pointer;font-size:0.82rem;font-weight:600;background:var(--primary);color:white':'display:flex;align-items:center;gap:5px;padding:6px 12px;border:2px solid var(--border);border-radius:99px;cursor:pointer;font-size:0.82rem;font-weight:600;color:var(--text-med)'">
            ${day}
          </label>`).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="saveCapacitySettings()">Save Settings</button>
    </div>`);
}

function saveCapacitySettings() {
  const dr = DB.users.find(u=>u.id===currentUser.id);
  if (!dr) return;
  dr.dailyLimit  = parseInt(document.getElementById('cap-slider').value) || 8;
  dr.workStart   = document.getElementById('cap-start')?.value || '09:00';
  dr.workEnd     = document.getElementById('cap-end')?.value   || '18:00';
  dr.workingDays = [...document.querySelectorAll('.cap-day-cb:checked')].map(cb=>cb.value);
  Object.assign(currentUser, dr);
  closeMod();
  showToast(`Daily limit set to ${dr.dailyLimit} patients/day ✅`, 'success');
  showPage('doctor-schedule');
}

function markSessionComplete(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  const th = getTherapy(s.therapyId);
  const pt = getUser(s.patientId);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">✅ Complete Session</div>
      <button class="modal-close" onclick="closeMod()">✕</button>
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:16px;font-size:0.85rem">
      <strong>${th?.name||'Session'}</strong> with
      <strong>${pt?.name||'Patient'}</strong> (${pt?.patientCode||'—'})
      on ${formatDate(s.date)} at ${formatTime(s.time)}
    </div>
    <div class="form-row">
      <label>Clinical Notes <span style="color:var(--text-light);font-weight:400">(optional — visible only to doctor)</span></label>
      <textarea id="complete-notes" rows="3" placeholder="e.g. Patient responded well. Reduced Vata symptoms. Recommend 3 follow-up sessions..."
                style="width:100%;padding:10px;border:2px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-sans);font-size:0.9rem;resize:vertical">${s.clinicalNotes||''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeMod()">Cancel</button>
      <button class="btn btn-green" onclick="confirmSessionComplete('${id}')">Mark Complete & Notify Patient</button>
    </div>`);
}

function confirmSessionComplete(id) {
  const s = DB.sessions.find(s=>s.id===id);
  if (!s) return;
  s.status = 'completed';
  s.clinicalNotes = document.getElementById('complete-notes')?.value?.trim() || '';
  s.completedAt   = new Date().toISOString();
  const th = getTherapy(s.therapyId);
  DB.notifications.push({
    id:genId('n'), userId:s.patientId, type:'post_procedure', priority:'high', read:false,
    title:`Post-Session Care: ${th?.name||'Session'}`,
    message:`Your ${th?.name||'session'} with ${currentUser.name} is complete. Rest for 2 hours. Consume warm light food. Avoid cold water and direct sunlight for 24 hours.`,
    createdAt:new Date().toISOString(),
  });
  closeMod();
  showToast('Session marked complete! Patient notified.','success');
  showPage('doctor-schedule');
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — TREATMENTS
// ═══════════════════════════════════════════════════════════
