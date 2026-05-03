/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */
const CLINIC = Object.freeze({
  DAILY_LIMIT:          8,
  SLOT_DURATION_MINS:   60,
  WORK_START:           '09:00',
  WORK_END:             '18:00',
  WORKING_DAYS:         ['Mon','Tue','Wed','Thu','Fri'],
  BOOKING_ADVANCE_DAYS: 30,
  PATIENT_ID_PREFIX:    'PKM',
  CANCEL_NOTICE_HOURS:  24,
  MAX_RESCHEDULE_COUNT: 3,
  SESSION_TIMEOUT_MS:   30 * 60 * 1000,
});

const ROLES = Object.freeze({ PATIENT:'patient', DOCTOR:'doctor', ADMIN:'admin' });

const SESSION_STATUS = Object.freeze({
  SCHEDULED: 'scheduled', COMPLETED: 'completed',
  CANCELLED: 'cancelled', RESCHEDULED: 'rescheduled',
});

const VERIFY_STATUS = Object.freeze({
  PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected',
});

const NAV = Object.freeze({
  patient: [
    { id:'patient-dashboard',  icon:'🏠', label:'Home'      },
    { id:'patient-schedule',   icon:'📅', label:'Sessions'  },
    { id:'patient-progress',   icon:'📈', label:'Progress'  },
    { id:'patient-shop',       icon:'🛒', label:'Shop'      },
    { id:'patient-notifications', icon:'🔔', label:'Alerts', badge:true },
  ],
  doctor: [
    { id:'doctor-dashboard',   icon:'🏠', label:'Home'      },
    { id:'doctor-patients',    icon:'👥', label:'Patients'  },
    { id:'doctor-schedule',    icon:'📅', label:'Schedule'  },
    { id:'doctor-treatments',  icon:'🌿', label:'Treatments'},
    { id:'doctor-reports',     icon:'📊', label:'Reports'   },
  ],
  admin: [
    { id:'admin-dashboard',    icon:'🏠', label:'Home'      },
    { id:'admin-users',        icon:'👥', label:'Users', badge:true },
    { id:'admin-appointments', icon:'📅', label:'Appts'     },
    { id:'admin-reports',      icon:'📊', label:'Reports'   },
    { id:'admin-therapies',    icon:'🌿', label:'Therapies' },
  ],
});
