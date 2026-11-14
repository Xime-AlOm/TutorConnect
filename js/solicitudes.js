// =====================================================================
// js/solicitudes.js · Gestor de solicitudes y citas (SCR-005)
// T16 · TC-19 · HU-006 · CU-004: el asesor acepta o rechaza solicitudes.
// (T15b agrega aquí solicitarAsesoria(idFranja); no se pisan.)
// Requiere: js/supabase.js (db, mostrarError, mostrarExito, mostrarCargando)
// =====================================================================

let pendientes = [];          // solicitudes pendientes del asesor
let solicitudActual = null;   // solicitud que se está aceptando/rechazando
let accionConfirmar = null;   // función a ejecutar al confirmar el diálogo

// ---------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------
// "2026-11-12" → "jueves 12 de noviembre"
function formatearFecha(fecha) {
  return new Date(`${fecha}T00:00`).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// "10:00:00" → "10:00"
function formatearHora(hora) {
  return hora ? hora.slice(0, 5) : '';
}

// Hora de fin = inicio + 60 minutos (los bloques son de 1 hora)
function horaFin(hora) {
  const [h, m] = hora.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Fecha límite para responder: 24 h antes de la cita
function fechaLimite(fecha, hora) {
  const limite = new Date(new Date(`${fecha}T${hora}`).getTime() - 24 * 60 * 60 * 1000);
  return limite.toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------
// validarUrl(url): obligatorio y debe empezar con https://
// ---------------------------------------------------------------------
function validarUrl(url) {
  const texto = (url || '').trim();
  if (!texto.startsWith('https://')) return false;
  try {
    const u = new URL(texto);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------
// listarPendientesAsesor(): solicitudes Pendientes donde soy el asesor
// ---------------------------------------------------------------------
async function listarPendientesAsesor() {
  const lista = document.getElementById('lista-pendientes');
  lista.innerHTML = '<div class="h-20 rounded-xl bg-slate-100 animate-pulse"></div>'.repeat(2);

  const { data, error } = await db
    .from('v_mis_citas')
    .select('*')
    .eq('mi_papel', 'Asesor')
    .eq('estado', 'Pendiente')
    .order('fecha')
    .order('hora_inicio');

  if (error) { lista.innerHTML = ''; mostrarError(error.message); return; }

  pendientes = data;
  document.getElementById('contador-pendientes').textContent = data.length;
  pintarPendientes();
}

function pintarPendientes() {
  const lista = document.getElementById('lista-pendientes');
  const vacio = document.getElementById('pendientes-vacio');
  lista.innerHTML = '';
  vacio.classList.toggle('hidden', pendientes.length > 0);

  pendientes.forEach((s) => {
    const esVirtual = s.modalidad === 'Virtual';
    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4';
    tarjeta.innerHTML = `
      <div class="space-y-1">
        <h3 class="text-sm font-bold text-slate-900"><span data-campo="estudiante"></span> • <span data-campo="materia"></span></h3>
        <p class="text-xs text-slate-600 capitalize-first">
          <span data-campo="fecha"></span> • ${formatearHora(s.hora_inicio)} – ${horaFin(s.hora_inicio)} •
          <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${esVirtual ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}">${esVirtual ? '💻 Virtual' : '📍 Presencial'}</span>
        </p>
        <p class="text-xs text-slate-500" data-campo="ubicacion"></p>
        <p class="text-xs text-amber-700 font-semibold">Responder antes de: ${fechaLimite(s.fecha, s.hora_inicio)}</p>
      </div>
      <div class="flex gap-2 w-full md:w-auto">
        <button data-accion="rechazar" class="flex-1 md:flex-none px-4 py-2.5 bg-white border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 transition">Rechazar</button>
        <button data-accion="aceptar" class="flex-1 md:flex-none px-5 py-2.5 bg-[#1B396A] text-white text-xs font-semibold rounded-lg hover:bg-[#13274A] transition shadow-sm">${esVirtual ? 'Aceptar y adjuntar enlace' : 'Aceptar'}</button>
      </div>`;

    // textContent para no inyectar HTML con datos de la BD
    tarjeta.querySelector('[data-campo="estudiante"]').textContent = s.estudiante;
    tarjeta.querySelector('[data-campo="materia"]').textContent = s.nombre_materia;
    const f = formatearFecha(s.fecha);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = f.charAt(0).toUpperCase() + f.slice(1);
    const ubic = tarjeta.querySelector('[data-campo="ubicacion"]');
    if (!esVirtual && s.ubicacion_presencial) ubic.textContent = `Ubicación: ${s.ubicacion_presencial}`;
    else ubic.remove();

    tarjeta.querySelector('[data-accion="aceptar"]').onclick = () =>
      esVirtual ? abrirModalEnlace(s) : pedirConfirmacion(
        'Aceptar asesoría',
        `¿Aceptar la asesoría presencial de ${s.estudiante}?`,
        'Aceptar', 'bg-[#1B396A] hover:bg-[#13274A]',
        (boton) => aceptarSolicitud(s.id_solicitud_asesoria, null, boton),
      );

    tarjeta.querySelector('[data-accion="rechazar"]').onclick = () => pedirConfirmacion(
      'Rechazar solicitud',
      `¿Rechazar la solicitud de ${s.estudiante}?`,
      'Rechazar', 'bg-rose-600 hover:bg-rose-700',
      (boton) => rechazarSolicitud(s.id_solicitud_asesoria, boton),
    );

    lista.appendChild(tarjeta);
  });
}

// ---------------------------------------------------------------------
// Llamada común a resolver_solicitud. Se usa db.rpc (como ejecutar) para
// saber si hubo error aunque la función no devuelva datos.
// Los mensajes de la BD se muestran tal cual.
// ---------------------------------------------------------------------
async function resolver(id, aceptar, url) {
  const { error } = await db.rpc('resolver_solicitud', {
    p_id: id,
    p_aceptar: aceptar,
    p_url: url,
  });
  if (error) { mostrarError(error.message); return false; }
  return true;
}

// aceptarSolicitud(id, url): presencial → url null; virtual → enlace https://
async function aceptarSolicitud(id, url, boton) {
  mostrarCargando(boton, true);
  try {
    const ok = await resolver(id, true, url);
    cerrarModalEnlace();
    cerrarConfirmacion();
    if (!ok) return;
    mostrarExito('Asesoría aceptada');
    await listarPendientesAsesor();
  } finally {
    mostrarCargando(boton, false);
  }
}

// rechazarSolicitud(id): la franja vuelve a Libre
async function rechazarSolicitud(id, boton) {
  mostrarCargando(boton, true);
  try {
    const ok = await resolver(id, false, null);
    cerrarConfirmacion();
    if (!ok) return;
    mostrarExito('Solicitud rechazada');
    await listarPendientesAsesor();
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// Modal FORM-002: enlace de la videollamada (solo virtual)
// ---------------------------------------------------------------------
function abrirModalEnlace(solicitud) {
  solicitudActual = solicitud;
  const campo = document.getElementById('url-meet');
  campo.value = '';
  document.getElementById('modal-enlace-detalle').textContent =
    `${solicitud.estudiante} • ${solicitud.nombre_materia} • ${formatearHora(solicitud.hora_inicio)}`;
  actualizarValidacionUrl();
  document.getElementById('modal-confirmar-enlace').classList.remove('hidden');
  document.getElementById('modal-confirmar-enlace').classList.add('flex');
  campo.focus();
}

function cerrarModalEnlace() {
  const modal = document.getElementById('modal-confirmar-enlace');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  solicitudActual = null;
}

// Habilita «Confirmar» solo si el enlace es válido y muestra la vista previa
function actualizarValidacionUrl() {
  const url = document.getElementById('url-meet').value.trim();
  const valido = validarUrl(url);
  document.getElementById('btn-confirmar-enlace').disabled = !valido;
  document.getElementById('url-aviso').classList.toggle('hidden', valido || url === '');
  const previa = document.getElementById('url-previa');
  previa.textContent = valido ? url : '—';
}

// ---------------------------------------------------------------------
// Diálogo de confirmación reutilizable (aceptar presencial / rechazar)
// ---------------------------------------------------------------------
function pedirConfirmacion(titulo, texto, textoBoton, colorBoton, accion) {
  document.getElementById('confirmar-titulo').textContent = titulo;
  document.getElementById('confirmar-texto').textContent = texto;
  const boton = document.getElementById('btn-si-confirmar');
  boton.textContent = textoBoton;
  boton.className = `px-5 py-2.5 text-white text-xs font-semibold rounded-lg shadow-sm transition ${colorBoton}`;
  accionConfirmar = accion;
  const modal = document.getElementById('modal-confirmar');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function cerrarConfirmacion() {
  const modal = document.getElementById('modal-confirmar');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  accionConfirmar = null;
}

// ---------------------------------------------------------------------
// Arranque: solicitudes.html llama a iniciarSolicitudes() tras la sesión
// ---------------------------------------------------------------------
async function iniciarSolicitudes() {
  document.getElementById('url-meet').addEventListener('input', actualizarValidacionUrl);
  document.getElementById('btn-cancelar-enlace').onclick = cerrarModalEnlace;
  document.getElementById('btn-confirmar-enlace').onclick = (e) => {
    const url = document.getElementById('url-meet').value.trim();
    if (!validarUrl(url) || !solicitudActual) return;
    aceptarSolicitud(solicitudActual.id_solicitud_asesoria, url, e.currentTarget);
  };

  document.getElementById('btn-no-confirmar').onclick = cerrarConfirmacion;
  document.getElementById('btn-si-confirmar').onclick = (e) => {
    if (accionConfirmar) accionConfirmar(e.currentTarget);
  };

  await listarPendientesAsesor();
}
