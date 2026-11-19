// =====================================================================
// js/solicitudes.js · Gestor de solicitudes y citas (SCR-005)
// T16 · HU-006 · CU-004: aceptar o rechazar solicitudes.
// T20 · HU-008 · CU-005: cierre de la asesoría por el asesor (Realizada / No realizada).
// Requiere: js/supabase.js (db, mostrarError, mostrarExito, mostrarCargando)
// =====================================================================

let todasLasCitas = [];       // registros de v_mis_citas
let pendientes = [];          // solicitudes pendientes del asesor
let porCerrar = [];           // citas aceptadas del asesor con puede_marcar = true
let proximas = [];            // citas aceptadas vigentes (aún no terminan)
let completadas = [];         // citas concluidas (historial)
let tabActiva = 'pendientes';
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

// Calcula el tiempo restante de las 48 h posteriores al fin de la cita (RN-09)
function calcularTiempoRestanteCierre(fecha, horaInicio) {
  const inicio = new Date(`${fecha}T${horaInicio}`);
  const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
  const limite48h = new Date(fin.getTime() + 48 * 60 * 60 * 1000);
  const diffMs = limite48h.getTime() - Date.now();

  if (diffMs <= 0) {
    return { texto: 'Plazo vencido (pasará a Sin registro)', urgente: true };
  }

  const totalMin = Math.floor(diffMs / (60 * 1000));
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  const fechaLimiteStr = limite48h.toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return {
    texto: `Tienes ${horas} h ${minutos} min para cerrar (vence ${fechaLimiteStr}) antes de que pase a Sin registro.`,
    urgente: horas < 6,
  };
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
// Control de pestañas en SCR-005
// ---------------------------------------------------------------------
function cambiarTab(nombre) {
  tabActiva = nombre;
  const tabs = ['pendientes', 'por-cerrar', 'proximas', 'completadas'];

  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    const sec = document.getElementById(`seccion-${t}`);
    const activo = t === nombre;

    if (btn) {
      btn.className = activo
        ? 'pb-3 text-sm font-bold text-[#1B396A] border-b-2 border-[#1B396A] transition'
        : 'pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 transition';
    }
    if (sec) {
      sec.classList.toggle('hidden', !activo);
    }
  });
}

// ---------------------------------------------------------------------
// Carga general de v_mis_citas y distribución por sección
// ---------------------------------------------------------------------
async function cargarMisCitas() {
  const listaPend = document.getElementById('lista-pendientes');
  const listaCerrar = document.getElementById('lista-por-cerrar');
  const skeleton = '<div class="h-24 rounded-xl bg-slate-100 animate-pulse"></div>'.repeat(2);

  if (listaPend) listaPend.innerHTML = skeleton;
  if (listaCerrar) listaCerrar.innerHTML = skeleton;

  const { data, error } = await db
    .from('v_mis_citas')
    .select('*')
    .order('fecha', { ascending: false })
    .order('hora_inicio', { ascending: false });

  if (error) {
    if (listaPend) listaPend.innerHTML = '';
    if (listaCerrar) listaCerrar.innerHTML = '';
    mostrarError(error.message);
    return;
  }

  todasLasCitas = data || [];

  // 1. Pendientes (del asesor para T16; también pendientes del estudiante si entra)
  pendientes = todasLasCitas
    .filter((s) => s.estado === 'Pendiente')
    .sort((a, b) => `${a.fecha}T${a.hora_inicio}`.localeCompare(`${b.fecha}T${b.hora_inicio}`));

  // 2. Por cerrar: estado = 'Aceptada', usuario es asesor y now() >= fin (puede_marcar = true)
  porCerrar = todasLasCitas
    .filter((s) => s.puede_marcar === true)
    .sort((a, b) => `${a.fecha}T${a.hora_inicio}`.localeCompare(`${b.fecha}T${b.hora_inicio}`));

  // 3. Próximas / en curso: Aceptadas donde aún no termina la hora (puede_marcar = false)
  proximas = todasLasCitas
    .filter((s) => s.estado === 'Aceptada' && !s.puede_marcar)
    .sort((a, b) => `${a.fecha}T${a.hora_inicio}`.localeCompare(`${b.fecha}T${b.hora_inicio}`));

  // 4. Completadas / Historial: estados cerrados
  const estadosFinales = ['Realizada', 'No realizada', 'Sin registro', 'Rechazada', 'Cancelada', 'Caducada'];
  completadas = todasLasCitas.filter((s) => estadosFinales.includes(s.estado));

  // Actualizar contadores
  document.getElementById('contador-pendientes').textContent = pendientes.length;
  document.getElementById('contador-por-cerrar').textContent = porCerrar.length;
  document.getElementById('contador-proximas').textContent = proximas.length;
  document.getElementById('contador-completadas').textContent = completadas.length;

  pintarPendientes();
  pintarPorCerrar();
  pintarProximas();
  pintarCompletadas();
}

// Alias compatible con llamadas previas de T16
async function listarPendientesAsesor() {
  await cargarMisCitas();
}

// ---------------------------------------------------------------------
// Renderizado: 1. Pendientes
// ---------------------------------------------------------------------
function pintarPendientes() {
  const lista = document.getElementById('lista-pendientes');
  const vacio = document.getElementById('pendientes-vacio');
  lista.innerHTML = '';
  vacio.classList.toggle('hidden', pendientes.length > 0);

  pendientes.forEach((s) => {
    const esVirtual = s.modalidad === 'Virtual';
    const soyAsesor = s.mi_papel === 'Asesor';
    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4';

    tarjeta.innerHTML = `
      <div class="space-y-1">
        <h3 class="text-sm font-bold text-slate-900"><span data-campo="contraparte"></span> • <span data-campo="materia"></span></h3>
        <p class="text-xs text-slate-600">
          <span data-campo="fecha"></span> • ${formatearHora(s.hora_inicio)} – ${horaFin(s.hora_inicio)} •
          <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${esVirtual ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}">${esVirtual ? '💻 Virtual' : '📍 Presencial'}</span>
        </p>
        <p class="text-xs text-slate-500" data-campo="ubicacion"></p>
        <p class="text-xs text-amber-700 font-semibold">Responder antes de: ${fechaLimite(s.fecha, s.hora_inicio)}</p>
      </div>
      <div class="flex gap-2 w-full md:w-auto" data-acciones></div>`;

    tarjeta.querySelector('[data-campo="contraparte"]').textContent = soyAsesor
      ? s.estudiante
      : `Asesor: ${s.asesor}`;
    tarjeta.querySelector('[data-campo="materia"]').textContent = s.nombre_materia;
    const f = formatearFecha(s.fecha);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = f.charAt(0).toUpperCase() + f.slice(1);

    const ubic = tarjeta.querySelector('[data-campo="ubicacion"]');
    if (!esVirtual && s.ubicacion_presencial) ubic.textContent = `Ubicación: ${s.ubicacion_presencial}`;
    else ubic.remove();

    const zonaAcciones = tarjeta.querySelector('[data-acciones]');
    if (soyAsesor) {
      zonaAcciones.innerHTML = `
        <button data-accion="rechazar" class="flex-1 md:flex-none px-4 py-2.5 bg-white border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-50 transition">Rechazar</button>
        <button data-accion="aceptar" class="flex-1 md:flex-none px-5 py-2.5 bg-[#1B396A] text-white text-xs font-semibold rounded-lg hover:bg-[#13274A] transition shadow-sm">${esVirtual ? 'Aceptar y adjuntar enlace' : 'Aceptar'}</button>`;

      zonaAcciones.querySelector('[data-accion="aceptar"]').onclick = () =>
        esVirtual ? abrirModalEnlace(s) : pedirConfirmacion(
          'Aceptar asesoría',
          `¿Aceptar la asesoría presencial de ${s.estudiante}?`,
          'Aceptar', 'bg-[#1B396A] hover:bg-[#13274A]',
          (boton) => aceptarSolicitud(s.id_solicitud_asesoria, null, boton),
        );

      zonaAcciones.querySelector('[data-accion="rechazar"]').onclick = () => pedirConfirmacion(
        'Rechazar solicitud',
        `¿Rechazar la solicitud de ${s.estudiante}?`,
        'Rechazar', 'bg-rose-600 hover:bg-rose-700',
        (boton) => rechazarSolicitud(s.id_solicitud_asesoria, boton),
      );
    } else {
      zonaAcciones.innerHTML = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Pendiente de respuesta</span>';
    }

    lista.appendChild(tarjeta);
  });
}

// ---------------------------------------------------------------------
// Renderizado: 2. Por cerrar (CU-005 · puede_marcar = true)
// ---------------------------------------------------------------------
function pintarPorCerrar() {
  const lista = document.getElementById('lista-por-cerrar');
  const vacio = document.getElementById('por-cerrar-vacio');
  lista.innerHTML = '';
  vacio.classList.toggle('hidden', porCerrar.length > 0);

  porCerrar.forEach((s) => {
    const esVirtual = s.modalidad === 'Virtual';
    const plazo = calcularTiempoRestanteCierre(s.fecha, s.hora_inicio);

    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4';
    tarjeta.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">Concluida · Por cerrar</span>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${esVirtual ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}">${esVirtual ? '💻 Virtual' : '📍 Presencial'}</span>
        </div>
        <h3 class="text-sm font-bold text-slate-900">
          <span data-campo="estudiante"></span> • <span data-campo="materia"></span>
        </h3>
        <p class="text-xs text-slate-600">
          <span data-campo="fecha"></span> • ${formatearHora(s.hora_inicio)} – ${horaFin(s.hora_inicio)}
        </p>
        <p class="text-xs font-semibold ${plazo.urgente ? 'text-rose-700' : 'text-amber-700'} flex items-center gap-1.5">
          <span>⏳</span>
          <span data-campo="aviso-plazo"></span>
        </p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
        <button type="button" data-accion="no-realizada"
                class="w-full sm:w-auto px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition shadow-sm">
          No realizada
        </button>
        <button type="button" data-accion="realizada"
                class="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-sm">
          Realizada
        </button>
      </div>`;

    // textContent para evitar inyección HTML
    tarjeta.querySelector('[data-campo="estudiante"]').textContent = s.estudiante;
    tarjeta.querySelector('[data-campo="materia"]').textContent = s.nombre_materia;
    const f = formatearFecha(s.fecha);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = f.charAt(0).toUpperCase() + f.slice(1);
    tarjeta.querySelector('[data-campo="aviso-plazo"]').textContent = plazo.texto;

    // Botón «Realizada» (verde)
    tarjeta.querySelector('[data-accion="realizada"]').onclick = (e) => {
      marcarResultado(s.id_solicitud_asesoria, true, e.currentTarget);
    };

    // Botón «No realizada» (gris) con confirmación reglamentaria
    tarjeta.querySelector('[data-accion="no-realizada"]').onclick = () => {
      pedirConfirmacion(
        'Marcar como no realizada',
        'Se registrará solo para estadística; no afecta a nadie.',
        'Confirmar',
        'bg-slate-600 hover:bg-slate-700',
        (boton) => marcarResultado(s.id_solicitud_asesoria, false, boton),
      );
    };

    lista.appendChild(tarjeta);
  });
}

// ---------------------------------------------------------------------
// Renderizado: 3. Próximas (Aceptadas antes de terminar la hora: sin botones de cierre)
// ---------------------------------------------------------------------
function pintarProximas() {
  const lista = document.getElementById('lista-proximas');
  const vacio = document.getElementById('proximas-vacio');
  lista.innerHTML = '';
  vacio.classList.toggle('hidden', proximas.length > 0);

  proximas.forEach((s) => {
    const esVirtual = s.modalidad === 'Virtual';
    const soyAsesor = s.mi_papel === 'Asesor';

    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4';
    tarjeta.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Aceptada</span>
          ${s.es_proxima ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">En menos de 24 h</span>' : ''}
        </div>
        <h3 class="text-sm font-bold text-slate-900"><span data-campo="contraparte"></span> • <span data-campo="materia"></span></h3>
        <p class="text-xs text-slate-600">
          <span data-campo="fecha"></span> • ${formatearHora(s.hora_inicio)} – ${horaFin(s.hora_inicio)} •
          <span>${esVirtual ? '💻 Virtual' : '📍 Presencial'}</span>
        </p>
        <p class="text-xs text-slate-500" data-campo="detalle-lugar"></p>
      </div>
      <div class="text-xs text-slate-500 font-medium">
        ${soyAsesor ? 'Disponible para cerrar al terminar la hora' : 'Sesión confirmada'}
      </div>`;

    tarjeta.querySelector('[data-campo="contraparte"]').textContent = soyAsesor ? s.estudiante : s.asesor;
    tarjeta.querySelector('[data-campo="materia"]').textContent = s.nombre_materia;
    const f = formatearFecha(s.fecha);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = f.charAt(0).toUpperCase() + f.slice(1);

    const detalleLugar = tarjeta.querySelector('[data-campo="detalle-lugar"]');
    if (esVirtual && s.url_videollamada) {
      detalleLugar.textContent = `Enlace: ${s.url_videollamada}`;
    } else if (!esVirtual && s.ubicacion_presencial) {
      detalleLugar.textContent = `Ubicación: ${s.ubicacion_presencial}`;
    } else {
      detalleLugar.remove();
    }

    lista.appendChild(tarjeta);
  });
}

// ---------------------------------------------------------------------
// Renderizado: 4. Completadas / Historial
// ---------------------------------------------------------------------
function pintarCompletadas() {
  const lista = document.getElementById('lista-completadas');
  const vacio = document.getElementById('completadas-vacio');
  lista.innerHTML = '';
  vacio.classList.toggle('hidden', completadas.length > 0);

  completadas.forEach((s) => {
    const soyAsesor = s.mi_papel === 'Asesor';
    const estadoLabel = s.estado_mostrado || s.estado;

    const estilosEstado = {
      Realizada: 'bg-emerald-100 text-emerald-800',
      Evaluada: 'bg-emerald-100 text-emerald-800',
      'Cerrada sin evaluar': 'bg-slate-100 text-slate-700',
      'No realizada': 'bg-slate-200 text-slate-700',
      'Sin registro': 'bg-amber-100 text-amber-800',
      Rechazada: 'bg-rose-100 text-rose-800',
      Cancelada: 'bg-rose-100 text-rose-800',
      Caducada: 'bg-slate-100 text-slate-600',
    };
    const badgeClass = estilosEstado[estadoLabel] || 'bg-slate-100 text-slate-700';

    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4';
    tarjeta.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded text-[11px] font-bold ${badgeClass}" data-campo="estado"></span>
          <span class="text-[11px] text-slate-400 font-medium">${soyAsesor ? 'Rol: Asesor' : 'Rol: Estudiante'}</span>
        </div>
        <h3 class="text-sm font-bold text-slate-900"><span data-campo="contraparte"></span> • <span data-campo="materia"></span></h3>
        <p class="text-xs text-slate-600">
          <span data-campo="fecha"></span> • ${formatearHora(s.hora_inicio)} – ${horaFin(s.hora_inicio)}
        </p>
      </div>
      <div class="flex items-center gap-3" data-lado-derecho></div>`;

    tarjeta.querySelector('[data-campo="estado"]').textContent = estadoLabel;
    tarjeta.querySelector('[data-campo="contraparte"]').textContent = soyAsesor ? s.estudiante : s.asesor;
    tarjeta.querySelector('[data-campo="materia"]').textContent = s.nombre_materia;
    const f = formatearFecha(s.fecha);
    tarjeta.querySelector('[data-campo="fecha"]').textContent = f.charAt(0).toUpperCase() + f.slice(1);

    const derecho = tarjeta.querySelector('[data-lado-derecho]');
    if (s.puede_calificar) {
      // Habilitado por 7 días (168 h) cuando el asesor marca Realizada (HU-009)
      const btnCalificar = document.createElement('button');
      btnCalificar.type = 'button';
      btnCalificar.textContent = '★ Calificar';
      btnCalificar.className = 'px-4 py-2 bg-[#1B396A] hover:bg-[#13274A] text-white text-xs font-semibold rounded-lg shadow-sm transition';
      btnCalificar.onclick = () => {
        if (typeof window.abrirModalCalificar === 'function') {
          window.abrirModalCalificar(s);
        } else {
          mostrarExito('Ventana de calificación activa (7 días).');
        }
      };
      derecho.appendChild(btnCalificar);
    } else if (s.puntuacion) {
      const spanCalif = document.createElement('span');
      spanCalif.className = 'text-xs font-bold text-amber-600';
      spanCalif.textContent = `★ ${s.puntuacion} / 5`;
      derecho.appendChild(spanCalif);
    }

    lista.appendChild(tarjeta);
  });
}

// ---------------------------------------------------------------------
// CU-005 · marcarResultado(id, realizada): cierra la cita como Realizada o No realizada
// ---------------------------------------------------------------------
async function marcarResultado(id, realizada, boton) {
  mostrarCargando(boton, true);
  try {
    // Llamada directa a db.rpc (igual que ejecutar) para validar error en funciones VOID
    // y mostrar tal cual los mensajes de la base de datos:
    // «La asesoría aún no termina.», «Solo se cierran asesorías aceptadas (<estado>).», «Esta asesoría no es tuya.»
    const { error } = await db.rpc('marcar_resultado', {
      p_id: id,
      p_realizada: realizada,
    });

    cerrarConfirmacion();

    if (error) {
      mostrarError(error.message);
      return false;
    }

    mostrarExito(realizada ? 'Asesoría marcada como realizada' : 'Asesoría marcada como no realizada');
    await cargarMisCitas();
    return true;
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// Llamada común a resolver_solicitud (T16)
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
    await cargarMisCitas();
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
    await cargarMisCitas();
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
// Diálogo de confirmación reutilizable (aceptar presencial / rechazar / no realizada)
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

  await cargarMisCitas();
}