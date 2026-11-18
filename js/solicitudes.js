// =====================================================================
// js/solicitudes.js · Gestor de solicitudes y citas (SCR-005)
// T16 · TC-19 · HU-006 · CU-004: el asesor acepta o rechaza solicitudes.
// T17 · TC-20 · HU-007: Mis citas del estudiante y cancelación (48 h).
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
// Conecta los botones de los diálogos una sola vez (lo usan asesor y estudiante)
// ---------------------------------------------------------------------
let dialogosListos = false;
function prepararDialogos() {
  if (dialogosListos) return;
  dialogosListos = true;

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

  // Pestañas: cada grupo [data-grupo] muestra el panel de su botón
  document.querySelectorAll('[data-grupo]').forEach((grupo) => {
    grupo.querySelectorAll('[data-pestana]').forEach((boton) => {
      boton.onclick = () => cambiarPestana(grupo.dataset.grupo, boton.dataset.pestana);
    });
    const primera = grupo.querySelector('[data-pestana]');
    if (primera) cambiarPestana(grupo.dataset.grupo, primera.dataset.pestana);
  });
}

// Marca la pestaña activa y muestra solo su panel
function cambiarPestana(grupo, idPanel) {
  document.querySelectorAll(`[data-grupo="${grupo}"] [data-pestana]`).forEach((b) => {
    const activa = b.dataset.pestana === idPanel;
    b.className = activa
      ? 'pb-3 text-sm font-bold text-[#1B396A] border-b-2 border-[#1B396A]'
      : 'pb-3 text-sm font-medium text-slate-500 hover:text-slate-700';
  });
  document.querySelectorAll(`[data-panel="${grupo}"]`).forEach((p) => {
    p.classList.toggle('hidden', p.id !== idPanel);
  });
}

// ---------------------------------------------------------------------
// Arranque del asesor: solicitudes.html llama a iniciarSolicitudes()
// ---------------------------------------------------------------------
let asesorIniciado = false;
async function iniciarSolicitudes() {
  prepararDialogos();
  asesorIniciado = true;
  await listarPendientesAsesor();
  await listarProximasAsesor();
}

// =====================================================================
// T17 · TC-20 · HU-007 · Mis citas y cancelación con 48 h de anticipación
// =====================================================================
const MSG_48H = 'Solo se puede cancelar con al menos 48 horas de anticipación';
let estudianteIniciado = false;

// Colores del badge según estado_mostrado
const COLORES_ESTADO = {
  'Pendiente': 'bg-amber-100 text-amber-800',
  'Aceptada': 'bg-emerald-100 text-emerald-700',
  'Rechazada': 'bg-rose-100 text-rose-700',
  'Cancelada': 'bg-slate-200 text-slate-700',
  'Caducada': 'bg-orange-100 text-orange-700',
  'Realizada': 'bg-sky-100 text-sky-700',
  'No realizada': 'bg-red-100 text-red-700',
  'Sin registro': 'bg-gray-100 text-gray-600',
};

// ¿La cita todavía no empieza?
function esFutura(c) {
  return new Date(`${c.fecha}T${c.hora_inicio}`) > new Date();
}

// Arma la tarjeta de una cita.
// papel: 'Estudiante' (muestra al asesor) o 'Asesor' (muestra al estudiante)
// tipo: 'pendiente' | 'proxima' | 'historial'
function tarjetaCita(c, papel, tipo) {
  const esVirtual = c.modalidad === 'Virtual';
  const estado = c.estado_mostrado || c.estado;
  const tarjeta = document.createElement('div');
  tarjeta.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4';
  tarjeta.innerHTML = `
    <div class="space-y-1">
      <h3 class="text-sm font-bold text-slate-900">
        <span data-campo="persona"></span> • <span data-campo="materia"></span>
        <span data-campo="estado" class="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${COLORES_ESTADO[estado] || 'bg-gray-100 text-gray-600'}"></span>
      </h3>
      <p class="text-xs text-slate-600">
        <span data-campo="fecha"></span> • ${formatearHora(c.hora_inicio)} – ${horaFin(c.hora_inicio)} •
        <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${esVirtual ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}">${esVirtual ? '💻 Virtual' : '📍 Presencial'}</span>
      </p>
      <p class="text-xs text-slate-500" data-campo="lugar"></p>
      <p class="text-xs text-amber-700 font-semibold" data-campo="aviso"></p>
    </div>
    <div data-campo="acciones" class="flex gap-2 w-full md:w-auto"></div>`;

  // textContent para no inyectar HTML con datos de la BD
  tarjeta.querySelector('[data-campo="persona"]').textContent = papel === 'Estudiante' ? c.asesor : c.estudiante;
  tarjeta.querySelector('[data-campo="materia"]').textContent = c.nombre_materia;
  tarjeta.querySelector('[data-campo="estado"]').textContent = estado;
  const f = formatearFecha(c.fecha);
  tarjeta.querySelector('[data-campo="fecha"]').textContent = f.charAt(0).toUpperCase() + f.slice(1);

  // Ubicación (presencial) o enlace clicable (virtual, solo si ya fue aceptada)
  const lugar = tarjeta.querySelector('[data-campo="lugar"]');
  if (!esVirtual && c.ubicacion_presencial) {
    lugar.textContent = `Ubicación: ${c.ubicacion_presencial}`;
  } else if (esVirtual && c.url_videollamada && validarUrl(c.url_videollamada)) {
    lugar.textContent = 'Enlace: ';
    const enlace = document.createElement('a');
    enlace.href = c.url_videollamada;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.className = 'text-blue-600 font-semibold underline break-all';
    enlace.textContent = c.url_videollamada;
    lugar.appendChild(enlace);
  } else if (esVirtual && tipo === 'pendiente') {
    lugar.textContent = 'El enlace de la sesión virtual se mostrará cuando el asesor acepte.';
  } else {
    lugar.remove();
  }

  const aviso = tarjeta.querySelector('[data-campo="aviso"]');
  const acciones = tarjeta.querySelector('[data-campo="acciones"]');

  if (tipo === 'pendiente') {
    aviso.textContent = `El asesor tiene hasta el ${fechaLimite(c.fecha, c.hora_inicio)} para responder`;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'flex-1 md:flex-none px-4 py-2.5 bg-white border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 transition';
    boton.textContent = 'Retirar solicitud';
    boton.onclick = () => pedirConfirmacion(
      'Retirar solicitud',
      '¿Deseas retirar esta solicitud? El horario quedará libre para otros estudiantes.',
      'Sí, retirar', 'bg-rose-600 hover:bg-rose-700',
      (b) => retirarSolicitud(c.id_solicitud_asesoria, b),
    );
    acciones.appendChild(boton);
  } else if (tipo === 'proxima') {
    aviso.remove();
    // Envoltura con tooltip: un botón deshabilitado no recibe el cursor
    const envoltura = document.createElement('span');
    envoltura.className = 'relative group inline-block w-full md:w-auto';
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Cancelar';
    if (c.puede_cancelar) {
      boton.className = 'w-full px-4 py-2.5 bg-white border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 transition';
      boton.onclick = () => pedirConfirmacion(
        'Cancelar asesoría',
        '¿Deseas cancelar esta asesoría?',
        'Sí, cancelar', 'bg-rose-600 hover:bg-rose-700',
        (b) => cancelarCita(c.id_solicitud_asesoria, b),
      );
    } else {
      boton.disabled = true;
      boton.className = 'w-full px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed';
      envoltura.title = MSG_48H;
      const tip = document.createElement('span');
      tip.className = 'pointer-events-none absolute right-0 bottom-full mb-2 w-64 rounded-lg bg-slate-900 text-white text-xs px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition z-10';
      tip.textContent = MSG_48H;
      envoltura.appendChild(tip);
    }
    envoltura.prepend(boton);
    acciones.appendChild(envoltura);
  } else {
    aviso.remove();
    acciones.remove();
  }

  return tarjeta;
}

// Mensaje dentro de una pestaña vacía
function pestanaVacia(texto) {
  const p = document.createElement('div');
  p.className = 'bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-sm text-slate-500';
  p.textContent = texto;
  return p;
}

// ---------------------------------------------------------------------
// listarMisCitas(): Pendientes, Próximas e Historial del estudiante
// ---------------------------------------------------------------------
async function listarMisCitas() {
  const { data, error } = await db
    .from('v_mis_citas')
    .select('*')
    .eq('mi_papel', 'Estudiante')
    .order('fecha')
    .order('hora_inicio');

  if (error) { mostrarError(error.message); return; }

  const grupos = {
    pendiente: data.filter((c) => c.estado === 'Pendiente'),
    proxima: data.filter((c) => c.estado === 'Aceptada' && esFutura(c)),
  };
  grupos.historial = data.filter((c) => !grupos.pendiente.includes(c) && !grupos.proxima.includes(c));

  const paneles = { pendiente: 'est-pendientes', proxima: 'est-proximas', historial: 'est-historial' };
  const vacios = {
    pendiente: 'No tienes solicitudes pendientes',
    proxima: 'No tienes citas próximas',
    historial: 'Tu historial está vacío',
  };

  Object.keys(paneles).forEach((tipo) => {
    const panel = document.getElementById(paneles[tipo]);
    panel.innerHTML = '';
    if (!grupos[tipo].length) panel.appendChild(pestanaVacia(vacios[tipo]));
    grupos[tipo].forEach((c) => panel.appendChild(tarjetaCita(c, 'Estudiante', tipo)));
    document.getElementById(`contador-${paneles[tipo]}`).textContent = grupos[tipo].length;
  });

  // Estado vacío general: sin ninguna asesoría
  document.getElementById('est-vacio').classList.toggle('hidden', data.length > 0);
}

// Próximas del asesor: citas Aceptadas futuras, con botón Cancelar
async function listarProximasAsesor() {
  const lista = document.getElementById('lista-proximas-asesor');
  const { data, error } = await db
    .from('v_mis_citas')
    .select('*')
    .eq('mi_papel', 'Asesor')
    .eq('estado', 'Aceptada')
    .order('fecha')
    .order('hora_inicio');

  if (error) { mostrarError(error.message); return; }

  const proximas = data.filter(esFutura);
  lista.innerHTML = '';
  if (!proximas.length) lista.appendChild(pestanaVacia('No tienes citas próximas'));
  proximas.forEach((c) => lista.appendChild(tarjetaCita(c, 'Asesor', 'proxima')));
  document.getElementById('contador-proximas-asesor').textContent = proximas.length;
}

// Recarga las vistas que estén abiertas
async function recargarCitas() {
  if (estudianteIniciado) await listarMisCitas();
  if (asesorIniciado) { await listarPendientesAsesor(); await listarProximasAsesor(); }
}

// Llamada común a cancelar_asesoria; muestra el mensaje de la BD tal cual
async function cancelar(id) {
  const { error } = await db.rpc('cancelar_asesoria', { p_id: id });
  if (error) { mostrarError(error.message); return false; }
  return true;
}

// retirarSolicitud(id): el estudiante retira una solicitud Pendiente
async function retirarSolicitud(id, boton) {
  mostrarCargando(boton, true);
  try {
    const ok = await cancelar(id);
    cerrarConfirmacion();
    if (!ok) return;
    mostrarExito('Solicitud retirada');
    await recargarCitas();
  } finally {
    mostrarCargando(boton, false);
  }
}

// cancelarCita(id): estudiante o asesor cancelan una cita Aceptada (≥ 48 h)
async function cancelarCita(id, boton) {
  mostrarCargando(boton, true);
  try {
    const ok = await cancelar(id);
    cerrarConfirmacion();
    if (!ok) return;
    mostrarExito('Asesoría cancelada');
    await recargarCitas();
  } finally {
    mostrarCargando(boton, false);
  }
}

// Arranque del estudiante: solicitudes.html llama a iniciarMisCitasEstudiante()
async function iniciarMisCitasEstudiante() {
  prepararDialogos();
  estudianteIniciado = true;
  await listarMisCitas();

  // Toast que deja T15b al redirigir después de una solicitud exitosa
  try {
    const exito = sessionStorage.getItem('t15b-exito');
    if (exito) { sessionStorage.removeItem('t15b-exito'); mostrarExito(exito); }
  } catch (_) { /* opcional */ }
}

/* T15b. Requiere supabase.js, sesion.js y t15bSesionLista.
 * T15a: #grid-resultados, botones [data-id-franja], window.recargarBusqueda().
 * La reserva, el congelamiento y la notificación los hace la RPC, nunca el cliente.
 */
(() => {
  'use strict';
  const EXITO = 'Solicitud enviada. El asesor tiene hasta 24 h antes de la cita para responder.';
  const RESERVADO = 'Este horario ya fue reservado.';
  const modal = document.getElementById('modal-solicitar');
  let franja = null;
  let enviando = false;
  let version = 0;
  const porId = id => document.getElementById(id);
  const mensaje = error => error?.message || 'No fue posible conectar. Intenta nuevamente.';
  const fecha = valor => String(valor || '').split('-').reverse().join('/');
  const hora = valor => String(valor || '').slice(0, 5);

  function detalle(destino, etiqueta, valor) {
    const fila = document.createElement('div');
    const titulo = document.createElement('dt');
    titulo.className = 'font-semibold';
    titulo.textContent = etiqueta;
    const texto = document.createElement('dd');
    texto.textContent = valor || '—';
    fila.append(titulo, texto);
    destino.append(fila);
  }
  async function recargar() {
    try {
      if (typeof window.recargarBusqueda === 'function') await window.recargarBusqueda();
    } catch (_) {
      mostrarError('No se pudo actualizar la búsqueda. Recarga la página.');
    }
  }
  function errorModal(texto) {
    porId('solicitud-error').textContent = texto;
    porId('solicitud-error').hidden = false;
  }
  function cerrar() {
    if (enviando) return;
    version++;
    franja = null;
    modal.close();
  }

  window.solicitarAsesoria = async function solicitarAsesoria(idFranja) {
    if (!modal || enviando) return;
    const id = String(idFranja);
    if (!/^[1-9]\d*$/.test(id)) {
      mostrarError('El identificador del horario no es válido.');
      return;
    }
    const turno = ++version;
    try {
      const usuario = await window.t15bSesionLista;
      if (turno !== version || !usuario) return;
      if (usuario.rol !== 'Estudiante') {
        mostrarError('Solo los estudiantes pueden solicitar asesorías.');
        return;
      }
      franja = null;
      porId('solicitud-resumen').replaceChildren();
      porId('solicitud-error').hidden = true;
      porId('solicitud-aviso').hidden = true;
      porId('solicitud-cargando').hidden = false;
      porId('solicitud-confirmar').disabled = true;
      if (!modal.open) modal.showModal();
      const { data, error } = await db.from('v_franjas_disponibles')
        .select('*').eq('id_disponibilidad', id).maybeSingle();
      if (turno !== version) return;
      if (error) throw error;
      if (!data) {
        cerrar();
        mostrarError('Este horario ya no está disponible.');
        await recargar();
        return;
      }
      franja = data;
      const resumen = porId('solicitud-resumen');
      detalle(resumen, 'Asesor', data.asesor);
      detalle(resumen, 'Materia', data.nombre_materia);
      detalle(resumen, 'Fecha', fecha(data.fecha));
      detalle(resumen, 'Hora (Pachuca)', hora(data.hora_inicio));
      detalle(resumen, 'Modalidad', data.modalidad);
      detalle(resumen, 'Ubicación', data.modalidad === 'Virtual' ? 'Sesión virtual' : data.ubicacion_presencial);
      porId('solicitud-aviso').hidden = data.modalidad !== 'Virtual';
      porId('solicitud-confirmar').disabled = false;
    } catch (error) {
      if (turno === version) {
        if (modal.open) errorModal(mensaje(error));
        else mostrarError(mensaje(error));
      }
    } finally {
      if (turno === version) porId('solicitud-cargando').hidden = true;
    }
  };

  async function confirmar() {
    if (enviando || !franja) return;
    enviando = true;
    const boton = porId('solicitud-confirmar');
    boton.disabled = true;
    boton.textContent = 'Procesando…';
    porId('solicitud-cancelar').disabled = true;
    porId('solicitud-error').hidden = true;
    modal.setAttribute('aria-busy', 'true');
    let exito = false;
    try {
      const idSolicitud = await ejecutar('solicitar_asesoria', {
        p_id_disponibilidad: franja.id_disponibilidad
      }, { propagarError: true });
      if (idSolicitud == null) throw new Error('No se recibió la confirmación. Revisa Mis solicitudes antes de volver a intentar.');
      exito = true;
      modal.close();
      mostrarExito(EXITO);
      // Una falla del almacenamiento no debe convertir una reserva exitosa en error.
      try { sessionStorage.setItem('t15b-exito', EXITO); } catch (_) { /* opcional */ }
      setTimeout(() => window.location.assign('solicitudes.html'), 1400);
    } catch (error) {
      if (mensaje(error) === RESERVADO) {
        franja = null;
        modal.close();
        mostrarError(RESERVADO);
        await recargar();
      } else {
        errorModal(mensaje(error));
      }
    } finally {
      if (!exito) {
        enviando = false;
        boton.disabled = !franja;
        boton.textContent = 'Confirmar solicitud';
        porId('solicitud-cancelar').disabled = false;
        modal.removeAttribute('aria-busy');
      }
    }
  }
  if (modal) {
    porId('solicitud-confirmar').addEventListener('click', confirmar);
    porId('solicitud-cancelar').addEventListener('click', cerrar);
    modal.addEventListener('cancel', event => {
      event.preventDefault();
      cerrar();
    });
    porId('grid-resultados')?.addEventListener('click', event => {
      const boton = event.target.closest('[data-id-franja]');
      if (!boton || boton.disabled) return;
      event.preventDefault();
      window.solicitarAsesoria(boton.dataset.idFranja);
    });
  }

  async function cargarMisCitas() {
    const lista = porId('t15b-mis-citas');
    if (!lista) return;
    try {
      if (!await window.t15bSesionLista) return;
      const { data, error } = await db.from('v_mis_citas').select('*')
        .eq('mi_papel', 'Estudiante')
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      lista.replaceChildren();
      if (!data?.length) lista.textContent = 'Todavía no tienes solicitudes.';
      for (const cita of data || []) {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'bg-white border rounded-xl p-5 shadow-sm';
        const titulo = document.createElement('h2');
        titulo.className = 'font-bold text-lg';
        titulo.textContent = cita.nombre_materia;
        tarjeta.append(titulo);
        const datos = document.createElement('dl');
        datos.className = 'grid gap-3 sm:grid-cols-3 text-sm mt-3';
        detalle(datos, 'Solicitud', String(cita.id_solicitud_asesoria));
        detalle(datos, 'Estado', cita.estado_mostrado || cita.estado);
        detalle(datos, 'Asesor', cita.asesor);
        detalle(datos, 'Estudiante', cita.estudiante);
        detalle(datos, 'Fecha y hora (Pachuca)', `${fecha(cita.fecha)} ${hora(cita.hora_inicio)}`);
        detalle(datos, 'Modalidad', cita.modalidad);
        tarjeta.append(datos);
        lista.append(tarjeta);
      }
      try {
        if (sessionStorage.getItem('t15b-exito') === EXITO) {
          sessionStorage.removeItem('t15b-exito');
          mostrarExito(EXITO);
        }
      } catch (_) { /* opcional */ }
    } catch (error) {
      lista.textContent = 'No se pudieron cargar las solicitudes. Recarga para intentar otra vez.';
      mostrarError(mensaje(error));
    }
  }
  window.iniciarMisSolicitudesEstudiante = cargarMisCitas;
})();
