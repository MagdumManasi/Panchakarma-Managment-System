/* === Shared: Modal === */

function openModal(html) {
  const box = document.getElementById('modal-box');
  const overlay = document.getElementById('modal-overlay');
  if (!box || !overlay) return;
  box.innerHTML = html;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Close on overlay click (not box click)
  overlay.onclick = (e) => { if (e.target === overlay) closeMod(); };
}

function closeModal(e) { if (e && e.target !== e.currentTarget) return; closeMod(); }

function closeMod() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMod(); });
