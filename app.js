// ─── CÓDIGO MAESTRO ────────────────────────────────────────────────────────
const MASTER_CODE = 'ADMIN2024';

// ─── ESTADO GLOBAL ─────────────────────────────────────────────────────────
let masterUnlocked  = false;
let reservaciones   = [];
let calYear, calMonth;
let pendingDeleteId = null;
let isSubmitting    = false;   // ← flag para ignorar onSnapshot durante guardado

// ─── INIT ───────────────────────────────────────────────────────────────────
window.initApp = function () {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('f-fecha').min = hoy;
  initCal();
  listenReservaciones();
  setupListeners();
};

// ─── FIREBASE: ESCUCHA EN TIEMPO REAL ──────────────────────────────────────
function listenReservaciones() {
  const { collection, onSnapshot, query, orderBy } = window._fbFns;
  const db = window._fbDB;
  const q = query(collection(db, 'reservaciones'), orderBy('fecha'), orderBy('horaInicio'));

  onSnapshot(q, (snap) => {
    reservaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLista();
    renderCal();
    // Solo re-validar conflictos si NO estamos en medio de un submit
    if (!isSubmitting) checkConflictosHorario();
  }, (err) => {
    console.error('Firestore error:', err);
    showToast('Error de conexión con la base de datos', 'error');
  });
}

// ─── FIREBASE: AGREGAR ─────────────────────────────────────────────────────
async function addReservacion(data) {
  const { collection, addDoc, Timestamp } = window._fbFns;
  const db = window._fbDB;
  await addDoc(collection(db, 'reservaciones'), { ...data, creadoEn: Timestamp.now() });
}

// ─── FIREBASE: ELIMINAR ────────────────────────────────────────────────────
async function deleteReservacion(id) {
  const { doc, deleteDoc } = window._fbFns;
  const db = window._fbDB;
  await deleteDoc(doc(db, 'reservaciones', id));
}

// ─── LISTENERS DE FECHA Y HORA ─────────────────────────────────────────────
function setupListeners() {
  document.getElementById('f-fecha').addEventListener('change', checkConflictosHorario);
  document.getElementById('f-hora-inicio').addEventListener('change', () => {
    autoSetFin();
    checkConflictosHorario();
  });
  document.getElementById('f-hora-fin').addEventListener('change', checkConflictosHorario);
}

function autoSetFin() {
  const inicio = document.getElementById('f-hora-inicio').value;
  const fin    = document.getElementById('f-hora-fin').value;
  if (!inicio || fin) return;
  const [h, m] = inicio.split(':').map(Number);
  const date = new Date(2000, 0, 1, h + 1, m);
  document.getElementById('f-hora-fin').value =
    String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
}

// ─── VALIDAR CONFLICTOS DE HORARIO ─────────────────────────────────────────
function checkConflictosHorario() {
  if (isSubmitting) return;   // no interferir durante el guardado

  const fecha      = document.getElementById('f-fecha').value;
  const horaInicio = document.getElementById('f-hora-inicio').value;
  const horaFin    = document.getElementById('f-hora-fin').value;
  const hint       = document.getElementById('horario-hint');
  const fechaHint  = document.getElementById('fecha-hint');

  hint.style.display      = 'none';
  fechaHint.style.display = 'none';
  if (!fecha) return;

  const delDia = reservaciones.filter(r => r.fecha === fecha);
  if (delDia.length > 0) {
    fechaHint.textContent   = `${delDia.length} reservación(es) registrada(s) este día.`;
    fechaHint.className     = 'field-hint warn';
    fechaHint.style.display = 'block';
  }
  if (!horaInicio || !horaFin) return;

  if (horaFin <= horaInicio) {
    hint.textContent    = '⚠ La hora de fin debe ser posterior a la hora de inicio.';
    hint.className      = 'field-hint error';
    hint.style.display  = 'block';
    return;
  }

  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const sS = toMin(horaInicio), sE = toMin(horaFin);
  const conflicto = delDia.find(r => sS < toMin(r.horaFin) && sE > toMin(r.horaInicio));

  if (conflicto) {
    hint.textContent   = `⚠ Conflicto con: ${conflicto.horaInicio}–${conflicto.horaFin} (${conflicto.nombre}).`;
    hint.className     = 'field-hint error';
    hint.style.display = 'block';
  } else {
    hint.textContent   = '✓ Horario disponible.';
    hint.className     = 'field-hint ok';
    hint.style.display = 'block';
  }
}

// ─── SUBMIT FORMULARIO ─────────────────────────────────────────────────────
window.submitReservacion = async function () {
  if (isSubmitting) return;

  const nombre     = document.getElementById('f-nombre').value.trim();
  const depto      = document.getElementById('f-depto').value.trim();
  const fecha      = document.getElementById('f-fecha').value;
  const horaInicio = document.getElementById('f-hora-inicio').value;
  const horaFin    = document.getElementById('f-hora-fin').value;
  const asistentes = document.getElementById('f-asistentes').value;
  const proposito  = document.getElementById('f-proposito').value.trim();
  const email      = document.getElementById('f-email').value.trim();

  if (!nombre || !depto || !fecha || !horaInicio || !horaFin || !asistentes || !email) {
    showToast('Por favor completa todos los campos obligatorios', 'error');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Ingresa un correo electrónico válido', 'error');
    return;
  }
  if (horaFin <= horaInicio) {
    showToast('La hora de fin debe ser posterior a la hora de inicio', 'error');
    return;
  }

  // Verificar conflicto ANTES de bloquear el botón
  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  const sS = toMin(horaInicio), sE = toMin(horaFin);
  const conflicto = reservaciones.find(r =>
    r.fecha === fecha && sS < toMin(r.horaFin) && sE > toMin(r.horaInicio)
  );
  if (conflicto) {
    showToast(`Conflicto con reservación: ${conflicto.horaInicio}–${conflicto.horaFin}`, 'error');
    return;
  }

  // ── Bloquear UI ──
  isSubmitting = true;
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Guardando...';

  // ── Limpiar hints ANTES de guardar, para que el onSnapshot no los reactive ──
  document.getElementById('fecha-hint').style.display   = 'none';
  document.getElementById('horario-hint').style.display = 'none';

  try {
    await addReservacion({
      nombre, depto, fecha,
      horaInicio, horaFin,
      horario: `${horaInicio}–${horaFin}`,
      asistentes, proposito, email
    });

    // ── Limpiar campos de fecha/hora/propósito; conservar nombre, depto, email, asistentes ──
    document.getElementById('f-fecha').value       = '';
    document.getElementById('f-hora-inicio').value = '';
    document.getElementById('f-hora-fin').value    = '';
    document.getElementById('f-proposito').value   = '';

    // Mostrar banner de confirmación
    const banner = document.getElementById('success-banner');
    banner.style.display = 'block';
    setTimeout(() => banner.style.display = 'none', 7000);

    showToast('¡Reservación guardada exitosamente! ✓');

  } catch (err) {
    console.error(err);
    showToast('Error al guardar la reservación. Intenta de nuevo.', 'error');
  } finally {
    // ── Siempre restaurar el botón, sin importar éxito o error ──
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Solicitar reservación';
    isSubmitting = false;
  }
};

// ─── LIMPIAR FORMULARIO COMPLETO ───────────────────────────────────────────
window.clearForm = function () {
  ['f-nombre','f-depto','f-email','f-proposito','f-hora-inicio','f-hora-fin'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-fecha').value               = '';
  document.getElementById('f-asistentes').selectedIndex  = 0;
  document.getElementById('fecha-hint').style.display    = 'none';
  document.getElementById('horario-hint').style.display  = 'none';
  document.getElementById('success-banner').style.display = 'none';
};

// ─── RENDERIZAR LISTA ──────────────────────────────────────────────────────
function renderLista() {
  const container = document.getElementById('lista-reservaciones');
  const badge     = document.getElementById('count-badge');
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
        <span class="booking-time">${escapeHtml(r.horaInicio||'?')}–${escapeHtml(r.horaFin||'?')}</span>
        <div class="booking-name">${escapeHtml(r.nombre)}</div>
        <div class="booking-meta">${escapeHtml(r.depto)} · ${escapeHtml(r.asistentes)} · ${escapeHtml(r.email)}</div>
        ${r.proposito ? `<div class="booking-desc">"${escapeHtml(r.proposito)}"</div>` : ''}
      </div>
      ${masterUnlocked ? `<button class="btn-delete" onclick="confirmDelete('${r.id}')">Eliminar</button>` : ''}
    </div>`).join('');
}

// ─── ELIMINAR ──────────────────────────────────────────────────────────────
window.confirmDelete = function (id) {
  if (!masterUnlocked) { pendingDeleteId = id; openMaster(); return; }
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
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
               'Septiembre','Octubre','Noviembre','Diciembre'];

function initCal() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCal();
}
window.prevMonth = function () { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCal(); };
window.nextMonth = function () { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCal(); };

function renderCal() {
  const label = document.getElementById('cal-label');
  if (!label) return;
  label.textContent = MESES[calMonth] + ' ' + calYear;

  const grid   = document.getElementById('cal-grid');
  const today  = new Date();
  const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();

  const byDate = {};
  reservaciones.forEach(r => { byDate[r.fecha] = (byDate[r.fecha] || 0) + 1; });

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds    = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = byDate[ds] || 0;
    const isToday = todayY===calYear && todayM===calMonth && todayD===d;

    let cls = 'cal-day ';
    if (count === 0)    cls += 'free';
    else if (count > 3) cls += 'booked clickable';
    else                cls += 'partial clickable';
    if (isToday) cls += ' today';

    const onclick = count > 0 ? `onclick="showDayDetail('${ds}')"` : '';
    html += `<div class="${cls}" ${onclick} ${count>0?`title="${count} reservación(es)"`:''}>${d}</div>`;
  }
  grid.innerHTML = html;
  document.getElementById('day-detail').style.display = 'none';
}

window.showDayDetail = function (dateStr) {
  const panel = document.getElementById('day-detail');
  const title = document.getElementById('day-detail-title');
  const list  = document.getElementById('day-detail-list');
  const items = reservaciones
    .filter(r => r.fecha === dateStr)
    .sort((a,b) => (a.horaInicio||'').localeCompare(b.horaInicio||''));
  const [y,m,d] = dateStr.split('-');
  title.textContent = `${MESES[+m-1]} ${+d}, ${y}`;
  list.innerHTML = items.map(r => `
    <div class="slot-item">
      <span class="slot-time">${escapeHtml(r.horaInicio||'?')}–${escapeHtml(r.horaFin||'?')}</span>
      <div style="flex:1;min-width:0">
        <div class="slot-name">${escapeHtml(r.nombre)}</div>
        <div style="font-size:11px;color:var(--text-faint)">${escapeHtml(r.depto)}</div>
      </div>
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
  el.textContent   = msg;
  el.className     = 'toast ' + type;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── UTILIDADES ────────────────────────────────────────────────────────────
function formatFecha(f) {
  if (!f) return '—';
  const [y,m,d] = f.split('-');
  return `${MESES[+m-1]} ${+d}, ${y}`;
}
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
