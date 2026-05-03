/* === js/components/patient/feedback.js === */
function renderPatientFeedback(el) {
  const completedSessions = DB.sessions.filter(s => s.patientId === currentUser.id && s.status === 'completed');
  const myFeedback = DB.feedback.filter(f => f.patientId === currentUser.id);

  el.innerHTML = `
    <div class="page-header"><h2>⭐ Session Feedback</h2><p>Help us improve your Panchakarma experience</p></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><span class="card-title">Submit Feedback</span></div>
        <div class="form-row required">
          <label>Select Session</label>
          <select id="fb-session">
            <option value="">Choose a completed session...</option>
            ${completedSessions.map(s => { const th=getTherapy(s.therapyId); return `<option value="${s.id}">${th?.name||'?'} — ${formatDate(s.date)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-row required">
          <label>Overall Rating (1-10)</label>
          <div class="rating-grid">
            ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="rating-btn ${selectedRating===n?'selected':''}" onclick="setRating(${n})">${n}</button>`).join('')}
          </div>
          <div class="rating-label" id="rating-label">${selectedRating?getRatingLabel(selectedRating):'Select a rating'}</div>
        </div>
        <div class="form-row">
          <label>Symptom Changes</label>
          <textarea id="fb-symptoms" placeholder="Describe any changes in your symptoms..."></textarea>
        </div>
        <div class="form-row required">
          <label>Energy Level</label>
          <select id="fb-energy">
            <option value="">Select energy level...</option>
            <option value="much_improved">😊 Much Improved</option>
            <option value="slightly_improved">🙂 Slightly Improved</option>
            <option value="no_change">😐 No Change</option>
            <option value="slightly_decreased">😕 Slightly Decreased</option>
            <option value="much_decreased">😞 Much Decreased</option>
          </select>
        </div>
        <div class="form-row">
          <label>Additional Comments</label>
          <textarea id="fb-comments" placeholder="Any other feedback for your practitioner..."></textarea>
        </div>
        <button class="btn btn-green" style="width:100%;padding:13px" onclick="submitFeedback()">Submit Feedback ★</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Previous Feedback</span></div>
        ${myFeedback.length ? myFeedback.sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt)).map(f => {
          const s = DB.sessions.find(ss=>ss.id===f.sessionId), th = s?getTherapy(s.therapyId):null;
          const stars = '★'.repeat(Math.round(f.rating/2)) + '☆'.repeat(5-Math.round(f.rating/2));
          return `<div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <strong>${th?.name||'Session'}</strong>
              <span style="color:var(--accent);font-size:1rem">${stars}</span>
            </div>
            <div style="font-size:0.82rem;color:var(--text-light);margin-bottom:6px">${formatDate(f.submittedAt)} · Rating: ${f.rating}/10</div>
            ${f.symptoms?`<div style="font-size:0.85rem;color:var(--text-med);margin-bottom:4px">${f.symptoms}</div>`:''}
            <span class="badge badge-green">${f.energyLevel.replace(/_/g,' ')}</span>
          </div>`;
        }).join('') : '<div class="empty-state"><span class="empty-state-icon">⭐</span><p>No feedback submitted yet</p></div>'}
      </div>
    </div>`;
}
function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('.rating-btn').forEach((b,i)=>{b.classList.toggle('selected',i+1===n);});
  const lbl = document.getElementById('rating-label');
  if(lbl) lbl.textContent = getRatingLabel(n);
}
function getRatingLabel(n) {
  if(n<=3) return '😞 Poor experience';
  if(n<=5) return '😐 Fair experience';
  if(n<=7) return '🙂 Good experience';
  if(n<=9) return '😊 Great experience!';
  return '🤩 Excellent — 10/10!';
}
function submitFeedback() {
  const sessionId = document.getElementById('fb-session').value;
  const energy    = document.getElementById('fb-energy').value;
  if (!sessionId || !selectedRating || !energy) {
    showToast('Please fill all required fields', 'error'); return;
  }
  // Uniqueness guard — one feedback per session per patient
  const alreadyDone = DB.feedback.find(f => f.sessionId === sessionId && f.patientId === currentUser.id);
  if (alreadyDone) {
    showToast('You have already submitted feedback for this session.', 'warning'); return;
  }
  DB.feedback.push({
    id: genId('f'), patientId: currentUser.id, sessionId,
    rating: selectedRating,
    symptoms:    document.getElementById('fb-symptoms')?.value  || '',
    energyLevel: energy,
    comments:    document.getElementById('fb-comments')?.value  || '',
    submittedAt: getDateStr(0),
  });
  selectedRating = 0;
  showToast('Feedback submitted! Thank you 🙏', 'success');
  showPage('patient-feedback');
}

// ═══════════════════════════════════════════════════════════
// DOCTOR — DASHBOARD
// ═══════════════════════════════════════════════════════════
