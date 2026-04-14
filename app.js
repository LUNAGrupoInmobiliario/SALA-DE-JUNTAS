// ─── CÓDIGO MAESTRO ────────────────────────────────────────────────────────
// Cambia esta constante para personalizar el código de administrador
const MASTER_CODE = 'ADMIN2024';

// ─── ESTADO GLOBAL ─────────────────────────────────────────────────────────
let masterUnlocked = false;
let reservaciones = [];          // cache local (sincronizado por onSnapshot)
let calYear, calMonth;
let pendingDeleteId = null;

// ─── INIT ───────────────────────────────────────────────────────────────────
window.initApp = function () {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('f-fecha').min = hoy;

  initCal();
  listenReservaciones();
  setupFechaListener();
};

// ─── FIREBASE: ESCUCHA EN TIEMPO REAL ──────────────────────────────────────
function listenReservaciones() {
  const { collection, onSnapshot, query, orderBy } = window._fbFns;
  const db = window._fbDB;

  const q = query(collection(db, 'reservaciones'), orderBy('fecha'), orderBy('horario'));

  onSnapshot(q, (snap) => {
    reservaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLista();
    renderCal();
    updateHorarioOptions();
  }, (err) => {
    console.error('Error escuchando Firestore:', err);
    showToast('Error de conexión con la base de datos', 'error');
  });
}

// ─── FIREBASE: AGREGAR ─────────────────────────────────────────────────────
async function addReservacion(data) {
  const { collection, addDoc, Timestamp } = window._fbFns;
  const db = window._fbDB;

  await addDoc(collection(db, 'reservaciones'), {
    ...data,
    creadoEn: Timestamp.now()
  });
}

// ─── FIREBASE: ELIMINAR ────────────────────────────────────────────────────
async function deleteReservacion(id) {
  const { doc, deleteDoc } = window._fbFns;
  const db = window._fbDB;
  await deleteDoc(doc(db, 'reservaciones', id));
}

// ─── SUBMIT FORMULARIO ─────────────────────────────────────────────────────
window.submitReservacion = async function () {
  const nombre     = document.getElementById('f-nombre').value.trim();
  const depto      = document.getElementById('f-depto').value.trim();
  const fecha      = document.getElementById('f-fecha').value;
  const horario    = document.getElementById('f-horario').value;
  const asistentes = document.getElementById('f-asistentes').value;
  const proposito  = document.getElementById('f-proposito').value.trim();
  const email      = document.getElementById('f-email').value.trim();

  if (!nombre || !depto || !fecha || !horario || !asistentes || !email) {
    showToast('Por favor completa todos los campos obligatorios', 'error');
    return;
  }

  // Validar email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Ingresa un correo electrónico válido', 'error');
    return;
  }

  // Verificar conflicto
  const conflicto = reservaciones.some(r => r.fecha === fecha && r.horario === horario);
  if (conflicto) {
    showToast('Ese horario ya está ocupado en la fecha seleccionada', 'error');
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Guardando...';

  try {
    await addReservacion({ nombre, depto, fecha, horario, asistentes, proposito, email });
    showToast('Reservación registrada exitosamente ✓');
    clearForm();
  } catch (err) {
    console.error(err);
    showToast('Error al guardar la reservación', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Solicitar reservación';
  }
};

function clearForm() {
  ['f-nombre','f-depto','f-email','f-proposito'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-fecha').value = '';
  document.getElementById('f-horario').selectedIndex = 0;
  document.getElementById('f-asistentes').selectedIndex = 0;
  document.getElementById('fecha-hint').style.display = 'none';
}

// ─── LISTENER FECHA → DESHABILITAR HORARIOS ────────────────────────────────
function setupFechaListener() {
  document.getElementById('f-fecha').addEventListener('change', function () {
    updateHorarioOptions(this.value);
  });
}

function updateHorarioOptions(fecha) {
  const sel = document.getElementById('f-horario');
  const hint = document.getElementById('fecha-hint');

  if (!fecha) fecha = document.getElementById('f-fecha').value;
  if (!fecha) return;

  const ocupados = reservaciones.filter(r => r.fecha === fecha).map(r => r.horario);
  const totalSlots = sel.options.length - 1; // descuenta el placeholder

  Array.from(sel.options).forEach(opt => {
    if (!opt.value) return;
    opt.disabled = ocupados.includes(opt.value);
    opt.text = opt.value + (ocupados.includes(opt.value) ? ' — OCUPADO' : '');
  });

  if (ocupados.length > 0 && ocupados.length < totalSlots) {
    hint.textContent = `⚠ ${ocupados.length} horario(s) ocupado(s) en esta fecha.`;
    hint.className = 'field-hint warn';
    hint.style.display = 'block';
  } else if (ocupados.length >= totalSlots) {
    hint.textContent = '✕ Esta fecha está completamente ocupada.';
    hint.className = 'field-hint error';
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }

  // Resetear selección si el horario actual quedó bloqueado
  if (sel.value && ocupados.includes(sel.value)) sel.selectedIndex = 0;
}

// ─── RENDERIZAR LISTA ──────────────────────────────────────────────────────
function renderLista() {
  const container = document.getElementById('lista-reservaciones');
  const badge = document.getElementById('count-badge');

  badge.textContent = reservaciones.length;

  if (!reservaciones.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No hay reservaciones registradas.</p>
      </div>`;
    return;
  }

  container.innerHTML = reservaciones.map(r => `
    <div class="booking-card" id="card-${r.id}">
      <div>
        <div class="booking-date">${formatFecha(r.fecha)}</div>
        <span class="booking-time">${r.horario}</span>
        <div class="booking-name">${escapeHtml(r.nombre)}</div>
        <div class="booking-meta">${escapeHtml(r.depto)} · ${escapeHtml(r.asistentes)} · ${escapeHtml(r.email)}</div>
        ${r.proposito ? `<div class="booking-desc">"${escapeHtml(r.proposito)}"</div>` : ''}
      </div>
      ${masterUnlocked
        ? `<button class="btn-delete" onclick="confirmDelete('${r.id}')">Eliminar</button>`
        : ''}
    </div>`).join('');
}

// ─── ELIMINAR ──────────────────────────────────────────────────────────────
window.confirmDelete = function (id) {
  if (!masterUnlocked) {
    pendingDeleteId = id;
    openMaster();
    return;
  }
  doDelete(id);
};

async function doDelete(id) {
  try {
    await deleteReservacion(id);
    showToast('Reservación eliminada');
    pendingDeleteId = null;
  } catch (err) {
    console.error(err);
    showToast('Error al eliminar', 'error');
  }
}

// ─── TABS ──────────────────────────────────────────────────────────────────
window.switchTab = function (tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).style.display = 'block';
  btn.classList.add('active');
  if (tab === 'calendario') renderCal();
};

// ─── CALENDARIO ────────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function initCal() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCal();
}

window.prevMonth = function () {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCal();
};
window.nextMonth = function () {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCal();
};

function renderCal() {
  const label = document.getElementById('cal-label');
  if (!label) return;
  label.textContent = MESES[calMonth] + ' ' + calYear;

  const grid   = document.getElementById('cal-grid');
  const today  = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  // Agrupar reservaciones por fecha
  const byDate = {};
  const TOTAL_SLOTS = 10;
  reservaciones.forEach(r => {
    if (!byDate[r.fecha]) byDate[r.fecha] = 0;
    byDate[r.fecha]++;
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = calYear + '-' + String(calMonth + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const count   = byDate[dateStr] || 0;
    const isToday = todayY === calYear && todayM === calMonth && todayD === d;

    let cls = 'cal-day ';
    if (count === 0)                    cls += 'free';
    else if (count >= TOTAL_SLOTS)      cls += 'booked clickable';
    else                                cls += 'partial clickable';
    if (isToday)                        cls += ' today';

    const onclick = count > 0 ? `onclick="showDayDetail('${dateStr}')"` : '';
    const title = count > 0 ? `title="${count} reservación(es)"` : '';

    html += `<div class="${cls}" ${onclick} ${title}>${d}</div>`;
  }

  grid.innerHTML = html;

  // Ocultar detalle si el mes cambia
  document.getElementById('day-detail').style.display = 'none';
}

window.showDayDetail = function (dateStr) {
  const panel = document.getElementById('day-detail');
  const title = document.getElementById('day-detail-title');
  const list  = document.getElementById('day-detail-list');

  const items = reservaciones.filter(r => r.fecha === dateStr)
                             .sort((a,b) => a.horario.localeCompare(b.horario));

  const [y, m, d] = dateStr.split('-');
  title.textContent = `${MESES[+m-1]} ${+d}, ${y}`;

  list.innerHTML = items.map(r => `
    <div class="slot-item">
      <span class="slot-time">${r.horario}</span>
      <span class="slot-name">${escapeHtml(r.nombre)}</span>
      <span style="font-size:11px;color:var(--text-faint)">${escapeHtml(r.depto)}</span>
    </div>`).join('');

  panel.style.display = 'block';
};

// ─── MODAL MASTER ──────────────────────────────────────────────────────────
window.openMaster = function () {
  document.getElementById('overlay').classList.add('open');
  document.getElementById('master-modal').classList.add('open');
  document.getElementById('master-input').value = '';
  document.getElementById('master-err').style.display = 'none';
  setTimeout(() => document.getElementById('master-input').focus(), 80);
};

window.closeMaster = function () {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('master-modal').classList.remove('open');
  pendingDeleteId = null;
};

window.verifyMaster = function () {
  const val = document.getElementById('master-input').value;
  if (val === MASTER_CODE) {
    masterUnlocked = true;
    closeMaster();
    showToast('Modo administrador activado');
    document.getElementById('admin-btn').classList.add('active');
    document.getElementById('admin-label').textContent = 'Admin ✓';
    renderLista();
    if (pendingDeleteId) doDelete(pendingDeleteId);
  } else {
    document.getElementById('master-err').style.display = 'block';
    document.getElementById('master-input').select();
  }
};

// ─── TOAST ─────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ─── UTILIDADES ────────────────────────────────────────────────────────────
function formatFecha(f) {
  const [y, m, d] = f.split('-');
  return `${MESES[+m - 1]} ${+d}, ${y}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
