/* === js/utils/helpers.js === */
function getUser(id) { return DB.users.find(u => u.id === id); }
function getTherapy(id) { return DB.therapies.find(t => t.id === id); }
function uuid() { return 'id-' + Math.random().toString(36).substr(2,9); }
function genId(prefix) { return prefix + Date.now() + Math.floor(Math.random()*1000); }
function calcAge(dob) { if (!dob) return null; const diff = Date.now() - new Date(dob).getTime(); return Math.floor(diff / (365.25*24*3600*1000)); }

// ── Patient Code Generator ─────────────────────────────────
function generatePatientCode() {
  const cfg    = DB.clinicConfig;
  const num    = String(cfg.patientIdCounter++).padStart(4, '0');
  return `${cfg.patientIdPrefix}-${num}`;
}

// ── Doctor Daily Capacity ──────────────────────────────────
// Returns { used, limit, available, slots[] } for a given doctor on a given date
function getDoctorDayCapacity(doctorId, date) {
  const doctor   = getUser(doctorId);
  const limit    = doctor?.dailyLimit || DB.clinicConfig.defaultDailyLimit;
  const sessions = DB.sessions.filter(s =>
    s.doctorId === doctorId &&
    s.date     === date &&
    s.status   !== 'cancelled'
  );
  const used  = sessions.length;
  const avail = Math.max(0, limit - used);

  // Build available time slots
  const workStart  = doctor?.workStart || DB.clinicConfig.workingHours.start;
  const workEnd    = doctor?.workEnd   || DB.clinicConfig.workingHours.end;
  const slotMins   = DB.clinicConfig.slotDuration;
  const bookedTimes = sessions.map(s => s.time);

  const slots = [];
  let [sh, sm] = workStart.split(':').map(Number);
  const [eh, em] = workEnd.split(':').map(Number);
  while (sh * 60 + sm + slotMins <= eh * 60 + em) {
    const timeStr = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;
    if (!bookedTimes.includes(timeStr)) {
      slots.push(timeStr);
    }
    sm += slotMins;
    while (sm >= 60) { sm -= 60; sh++; }
  }
  return { used, limit, available: avail, slots, doctor };
}

// ── Check if doctor is at daily capacity for a date ───────
function isDoctorAtCapacity(doctorId, date) {
  const cap = getDoctorDayCapacity(doctorId, date);
  return cap.available <= 0;
}

// ── Duplicate Patient Detection ────────────────────────────
// Returns existing patients who share the same name OR phone (not email — email is unique by design)
function findDuplicatePatients(name, phone) {
  const nameLower = name.toLowerCase().trim();
  return DB.users.filter(u => {
    if (u.role !== 'patient') return false;
    const nameMatch  = u.name.toLowerCase().trim() === nameLower;
    const phoneMatch = phone && u.phone && u.phone.replace(/\s/g,'') === phone.replace(/\s/g,'');
    return nameMatch || phoneMatch;
  });
}



/* === Capacity & Patient Code Helpers === */
function generatePatientCode() {
  const cfg    = DB.clinicConfig;
  const num    = String(cfg.patientIdCounter++).padStart(4, '0');
  return `${cfg.patientIdPrefix}-${num}`;
}

// ── Doctor Daily Capacity ──────────────────────────────────
// Returns { used, limit, available, slots[] } for a given doctor on a given date
function getDoctorDayCapacity(doctorId, date) {
  const doctor   = getUser(doctorId);
  const limit    = doctor?.dailyLimit || DB.clinicConfig.defaultDailyLimit;
  const sessions = DB.sessions.filter(s =>
    s.doctorId === doctorId &&
    s.date     === date &&
    s.status   !== 'cancelled'
  );
  const used  = sessions.length;
  const avail = Math.max(0, limit - used);

  // Build available time slots
  const workStart  = doctor?.workStart || DB.clinicConfig.workingHours.start;
  const workEnd    = doctor?.workEnd   || DB.clinicConfig.workingHours.end;
  const slotMins   = DB.clinicConfig.slotDuration;
  const bookedTimes = sessions.map(s => s.time);

  const slots = [];
  let [sh, sm] = workStart.split(':').map(Number);
  const [eh, em] = workEnd.split(':').map(Number);
  while (sh * 60 + sm + slotMins <= eh * 60 + em) {
    const timeStr = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;
    if (!bookedTimes.includes(timeStr)) {
      slots.push(timeStr);
    }
    sm += slotMins;
    while (sm >= 60) { sm -= 60; sh++; }
  }
  return { used, limit, available: avail, slots, doctor };
}

// ── Check if doctor is at daily capacity for a date ───────
function isDoctorAtCapacity(doctorId, date) {
  const cap = getDoctorDayCapacity(doctorId, date);
  return cap.available <= 0;
}

// ── Duplicate Patient Detection ────────────────────────────
// Returns existing patients who share the same name OR phone (not email — email is unique by design)
function findDuplicatePatients(name, phone) {
  const nameLower = name.toLowerCase().trim();
  return DB.users.filter(u => {
    if (u.role !== 'patient') return false;
    const nameMatch  = u.name.toLowerCase().trim() === nameLower;
    const phoneMatch = phone && u.phone && u.phone.replace(/\s/g,'') === phone.replace(/\s/g,'');
    return nameMatch || phoneMatch;
  });
}
