/* === js/components/admin/therapies.js === */
function renderAdminTherapies(el) {
  el.innerHTML=`
    <div class="page-header"><h2>🌿 Therapy Management</h2><p>Configure Panchakarma therapy offerings</p></div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px"><button class="btn btn-green" onclick="openAddTherapyModal()">+ Add Therapy</button></div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Therapy</th><th>Category</th><th>Duration</th><th>Price</th><th>Usage</th><th>Actions</th></tr></thead>
          <tbody>
            ${DB.therapies.map(t=>{
              const usage=DB.sessions.filter(s=>s.therapyId===t.id).length;
              return `<tr>
                <td><span style="color:${t.color}">●</span> <strong>${t.name}</strong><br><span style="font-size:0.78rem;color:var(--text-light)">${t.description}</span></td>
                <td><span class="badge badge-green">${t.category}</span></td>
                <td>${t.duration} min</td>
                <td>₹${t.price.toLocaleString()}</td>
                <td>${usage} sessions</td>
                <td><button class="btn btn-sm btn-outline" onclick="editTherapy('${t.id}')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteTherapy('${t.id}')">Delete</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
function openAddTherapyModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">Add Therapy</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row required full"><label>Therapy Name</label><input type="text" id="th-name"></div>
      <div class="form-row required"><label>Category</label><select id="th-cat"><option>Purvakarma</option><option>Pradhanakarma</option><option>Pashchatkarma</option><option>Keraliya</option></select></div>
      <div class="form-row required"><label>Duration (min)</label><input type="number" id="th-dur" value="60"></div>
      <div class="form-row required"><label>Price (₹)</label><input type="number" id="th-price" value="2000"></div>
      <div class="form-row full"><label>Description</label><textarea id="th-desc"></textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="addTherapy()">Add Therapy</button></div>`);
}
function addTherapy() {
  const name=document.getElementById('th-name').value;
  if(!name){showToast('Therapy name required','error');return;}
  DB.therapies.push({ id:genId('t'), name, category:document.getElementById('th-cat').value, duration:parseInt(document.getElementById('th-dur').value)||60, price:parseInt(document.getElementById('th-price').value)||2000, description:document.getElementById('th-desc').value, color:'#4A7C2B' });
  closeMod(); showToast('Therapy added!','success'); showPage('admin-therapies');
}
function editTherapy(id) {
  const t=getTherapy(id);
  if(!t)return;
  openModal(`
    <div class="modal-header"><div class="modal-title">Edit: ${t.name}</div><button class="modal-close" onclick="closeMod()">✕</button></div>
    <div class="form-grid">
      <div class="form-row"><label>Name</label><input type="text" id="et-name" value="${t.name}"></div>
      <div class="form-row"><label>Duration (min)</label><input type="number" id="et-dur" value="${t.duration}"></div>
      <div class="form-row full"><label>Price (₹)</label><input type="number" id="et-price" value="${t.price}"></div>
      <div class="form-row full"><label>Description</label><textarea id="et-desc">${t.description}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-green" onclick="doEditTherapy('${id}')">Save</button></div>`);
}
function doEditTherapy(id) {
  const t=getTherapy(id);
  if(!t)return;
  t.name=document.getElementById('et-name').value||t.name;
  t.duration=parseInt(document.getElementById('et-dur').value)||t.duration;
  t.price=parseInt(document.getElementById('et-price').value)||t.price;
  t.description=document.getElementById('et-desc').value||t.description;
  closeMod(); showToast('Therapy updated!','success'); showPage('admin-therapies');
}
function deleteTherapy(id) {
  const t=getTherapy(id);
  openModal(`<div class="modal-header"><div class="modal-title">Delete Therapy</div><button class="modal-close" onclick="closeMod()">✕</button></div><p style="color:var(--text-med);margin-bottom:20px">Delete <strong>${t?.name}</strong>?</p><div class="modal-footer"><button class="btn btn-outline" onclick="closeMod()">Cancel</button><button class="btn btn-danger" onclick="doDeleteTherapy('${id}')">Delete</button></div>`);
}
function doDeleteTherapy(id) {
  const idx=DB.therapies.findIndex(t=>t.id===id);
  if(idx>=0)DB.therapies.splice(idx,1);
  closeMod(); showToast('Therapy deleted','warning'); showPage('admin-therapies');
}

// ═══════════════════════════════════════════════════════════
// ADMIN — APPOINTMENTS
// ═══════════════════════════════════════════════════════════
