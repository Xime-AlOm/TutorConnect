// =====================================================================
// js/catalogo.js · Catálogo de materias (T12 · HU-002) y
// Postulación / dictamen de asesores (T13 · HU-003)
// Requiere: js/supabase.js (db, mostrarError, mostrarExito,
// mostrarCargando) y js/sesion.js (iniciarPaginaProtegida).
// =====================================================================

const MSG_DUPLICADO = 'Esa materia ya existe en esta carrera';

let materias = [];          // lista completa traída de la BD
let materiaEditando = null; // id de la materia que se edita (null = alta)
let materiaConfirmar = null;// materia que se va a desactivar

// ---------------------------------------------------------------------
// Carreras (precargadas): llena los dos select (filtro y modal)
// ---------------------------------------------------------------------
async function cargarCarrerasCatalogo() {
  const { data, error } = await db
    .from('carrera')
    .select('id_carrera, nombre_carrera')
    .order('nombre_carrera');

  if (error) { mostrarError(error.message); return; }

  const filtro = document.getElementById('filtro-carrera');
  const modal = document.getElementById('materia-carrera');
  filtro.innerHTML = '<option value="">Todas las carreras</option>';
  modal.innerHTML = '<option value="">Selecciona una carrera</option>';

  data.forEach((c) => {
    filtro.add(new Option(c.nombre_carrera, c.id_carrera));
    modal.add(new Option(c.nombre_carrera, c.id_carrera));
  });
}

// ---------------------------------------------------------------------
// listarMaterias(): trae el catálogo y pinta la tabla
// ---------------------------------------------------------------------
async function listarMaterias() {
  const { data, error } = await db
    .from('materia')
    .select('id_materia, nombre_materia, estado_activo, id_carrera, carrera(nombre_carrera)')
    .order('nombre_materia');

  if (error) { mostrarError(error.message); return; }
  materias = data;
  pintarTabla();
}

// Aplica filtros (carrera, estado y buscador) y dibuja las filas
function pintarTabla() {
  const carrera = document.getElementById('filtro-carrera').value;
  const estado = document.getElementById('filtro-estado').value;
  const texto = document.getElementById('buscar-materia').value.trim().toLowerCase();

  const tbody = document.getElementById('tabla-materias');
  const vacio = document.getElementById('catalogo-vacio');
  const sinResultados = document.getElementById('catalogo-sin-resultados');

  vacio.classList.toggle('hidden', materias.length > 0);

  const filtradas = materias.filter((m) => {
    if (carrera && String(m.id_carrera) !== carrera) return false;
    if (estado === 'activas' && !m.estado_activo) return false;
    if (estado === 'inactivas' && m.estado_activo) return false;
    if (texto && !m.nombre_materia.toLowerCase().includes(texto)) return false;
    return true;
  });

  sinResultados.classList.toggle('hidden', materias.length === 0 || filtradas.length > 0);
  tbody.innerHTML = '';

  filtradas.forEach((m) => {
    const fila = document.createElement('tr');
    fila.className = 'hover:bg-slate-50 transition';

    const badge = m.estado_activo
      ? '<span class="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">Activa</span>'
      : '<span class="inline-block bg-slate-200 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">Inactiva</span>';

    const botonEstado = m.estado_activo
      ? '<button data-accion="desactivar" class="bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded text-xs font-bold transition">Desactivar</button>'
      : '<button data-accion="reactivar" class="bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded text-xs font-bold transition">Reactivar</button>';

    fila.innerHTML = `
      <td class="px-4 py-3.5 font-medium text-slate-900"></td>
      <td class="px-4 py-3.5"></td>
      <td class="px-4 py-3.5">${badge}</td>
      <td class="px-4 py-3.5">
        <div class="flex space-x-2">
          <button data-accion="editar" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition">Editar</button>
          ${botonEstado}
        </div>
      </td>`;
    fila.children[0].textContent = m.nombre_materia;
    fila.children[1].textContent = m.carrera ? m.carrera.nombre_carrera : '—';

    fila.querySelector('[data-accion="editar"]').onclick = () => abrirModalMateria(m);
    const btnEstado = fila.querySelector('[data-accion="desactivar"], [data-accion="reactivar"]');
    btnEstado.onclick = () => (m.estado_activo ? pedirConfirmacion(m) : cambiarEstadoMateria(m, true, btnEstado));

    tbody.appendChild(fila);
  });
}

// ---------------------------------------------------------------------
// Modal de alta / edición
// ---------------------------------------------------------------------
function abrirModalMateria(materia = null) {
  materiaEditando = materia ? materia.id_materia : null;
  document.getElementById('modal-materia-titulo').textContent = materia ? 'Editar materia' : 'Agregar materia';
  document.getElementById('materia-nombre').value = materia ? materia.nombre_materia : '';
  document.getElementById('materia-carrera').value = materia ? materia.id_carrera : '';
  document.getElementById('materia-error').classList.add('hidden');
  document.getElementById('modal-materia').classList.remove('hidden');
  document.getElementById('materia-nombre').focus();
}

function cerrarModalMateria() {
  document.getElementById('modal-materia').classList.add('hidden');
  materiaEditando = null;
}

function errorModal(mensaje) {
  const caja = document.getElementById('materia-error');
  caja.textContent = mensaje;
  caja.classList.remove('hidden');
}

// ---------------------------------------------------------------------
// guardarMateria(): alta (insert) o edición (update)
// ---------------------------------------------------------------------
async function guardarMateria(evento) {
  evento.preventDefault();
  const nombre = document.getElementById('materia-nombre').value.trim();
  const idCarrera = document.getElementById('materia-carrera').value;
  const boton = document.getElementById('btn-guardar-materia');

  if (!nombre) { errorModal('Escribe el nombre de la materia.'); return; }
  if (nombre.length > 100) { errorModal('El nombre no puede pasar de 100 caracteres.'); return; }
  if (!idCarrera) { errorModal('Selecciona una carrera.'); return; }

  const datos = { nombre_materia: nombre, id_carrera: Number(idCarrera) };

  mostrarCargando(boton, true);
  try {
    const { error } = materiaEditando
      ? await db.from('materia').update(datos).eq('id_materia', materiaEditando)
      : await db.from('materia').insert(datos);

    if (error) {
      const duplicado = error.code === '23505' || (error.message || '').includes('uq_materia_nombre_carrera');
      errorModal(duplicado ? MSG_DUPLICADO : error.message);
      return;
    }

    const eraEdicion = Boolean(materiaEditando);
    cerrarModalMateria();
    mostrarExito(eraEdicion ? 'Materia actualizada' : 'Materia agregada');
    await listarMaterias();
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// Desactivar (con confirmación) / reactivar
// ---------------------------------------------------------------------
function pedirConfirmacion(materia) {
  materiaConfirmar = materia;
  document.getElementById('confirmar-texto').textContent =
    `¿Desactivar ${materia.nombre_materia}? Dejará de aparecer para asesores y estudiantes, pero su historial se conserva.`;
  document.getElementById('modal-confirmar').classList.remove('hidden');
}

function cerrarConfirmacion() {
  document.getElementById('modal-confirmar').classList.add('hidden');
  materiaConfirmar = null;
}

async function cambiarEstadoMateria(materia, activa, boton) {
  mostrarCargando(boton, true);
  try {
    const { error } = await db
      .from('materia')
      .update({ estado_activo: activa })
      .eq('id_materia', materia.id_materia);

    if (error) { mostrarError(error.message); return; }

    cerrarConfirmacion();
    mostrarExito(activa ? 'Materia reactivada' : 'Materia desactivada');
    await listarMaterias();
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// Arranque T12: Catálogo de materias en admin.html
// ---------------------------------------------------------------------
async function iniciarCatalogo() {
  document.getElementById('btn-agregar-materia').onclick = () => abrirModalMateria();
  document.getElementById('btn-agregar-vacio').onclick = () => abrirModalMateria();
  document.getElementById('btn-cancelar-materia').onclick = cerrarModalMateria;
  document.getElementById('form-materia').addEventListener('submit', guardarMateria);

  document.getElementById('btn-no-desactivar').onclick = cerrarConfirmacion;
  document.getElementById('btn-si-desactivar').onclick = (e) =>
    cambiarEstadoMateria(materiaConfirmar, false, e.currentTarget);

  document.getElementById('filtro-carrera').addEventListener('change', pintarTabla);
  document.getElementById('filtro-estado').addEventListener('change', pintarTabla);
  document.getElementById('buscar-materia').addEventListener('input', pintarTabla);

  await cargarCarrerasCatalogo();
  await listarMaterias();
}


// =====================================================================
// T13 · HU-003 · Postulación como asesor y dictamen del coordinador
// =====================================================================

let misPostulaciones = [];
let postulacionesAdmin = [];
let tabPostulaciones = 'pendientes'; // 'pendientes' | 'historial'
let postulacionRechazar = null;

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function badgeEstadoPostulacion(estado) {
  if (estado === 'Aprobada') {
    return '<span class="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Aprobada</span>';
  }
  if (estado === 'Rechazada') {
    return '<span class="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Rechazada</span>';
  }
  return '<span class="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Pendiente</span>';
}

// ---------------------------------------------------------------------
// 1. Parte Estudiante / Profesor (postulacion.html · SCR-006)
// ---------------------------------------------------------------------

async function cargarSelectMateriasPostulacion() {
  const select = document.getElementById('select-materia');
  if (!select) return;

  const { data, error } = await db
    .from('materia')
    .select('id_materia, nombre_materia, carrera(nombre_carrera)')
    .eq('estado_activo', true)
    .order('nombre_materia');

  if (error) { mostrarError(error.message); return; }

  const yaPostuladas = new Set(misPostulaciones.map((p) => Number(p.id_materia)));
  select.innerHTML = '<option value="" disabled selected>-- Elige una materia activa --</option>';

  data.forEach((m) => {
    const carreraTexto = m.carrera ? ` (${m.carrera.nombre_carrera})` : '';
    const postulada = yaPostuladas.has(Number(m.id_materia));
    const etiqueta = `${m.nombre_materia}${carreraTexto}${postulada ? ' — Ya postulada' : ''}`;
    const opcion = new Option(etiqueta, m.id_materia);
    opcion.disabled = postulada;
    select.add(opcion);
  });
}

// listarMisPostulaciones(): consulta v_postulaciones y dibuja la tabla del usuario
async function listarMisPostulaciones() {
  const { data, error } = await db
    .from('v_postulaciones')
    .select('*')
    .order('fecha_solicitud', { ascending: false });

  if (error) { mostrarError(error.message); return; }
  misPostulaciones = data || [];

  const tbody = document.getElementById('tabla-mis-postulaciones');
  const vacio = document.getElementById('postulaciones-vacio');
  if (!tbody) return;

  tbody.innerHTML = '';
  vacio.classList.toggle('hidden', misPostulaciones.length > 0);

  misPostulaciones.forEach((p) => {
    const fila = document.createElement('tr');
    fila.className = 'hover:bg-slate-50 transition';

    const dictamenTexto = p.fecha_dictamen
      ? formatearFecha(p.fecha_dictamen)
      : '<span class="text-slate-400 italic">En revisión</span>';

    fila.innerHTML = `
      <td class="px-5 py-4 font-semibold text-slate-900"></td>
      <td class="px-5 py-4 text-slate-500">${formatearFecha(p.fecha_solicitud)}</td>
      <td class="px-5 py-4">${badgeEstadoPostulacion(p.estado_autorizacion)}</td>
      <td class="px-5 py-4 text-slate-500">${dictamenTexto}</td>`;
    fila.children[0].textContent = p.nombre_materia;

    tbody.appendChild(fila);
  });
}

// postular(): llama a postular_materia(p_id_materia) y recarga vista
async function postular(idMateria, boton) {
  mostrarCargando(boton, true);
  try {
    const { error } = await db.rpc('postular_materia', {
      p_id_materia: Number(idMateria)
    });

    if (error) {
      mostrarError(error.message);
      return;
    }

    document.getElementById('modal-confirmar-postulacion').classList.add('hidden');
    mostrarExito('Solicitud enviada correctamente');
    await listarMisPostulaciones();
    await cargarSelectMateriasPostulacion();
  } finally {
    mostrarCargando(boton, false);
  }
}

async function iniciarPostulacion() {
  const form = document.getElementById('form-postulacion');
  const select = document.getElementById('select-materia');
  const modal = document.getElementById('modal-confirmar-postulacion');
  const textoConfirmar = document.getElementById('texto-confirmar-postulacion');
  const btnCancelar = document.getElementById('btn-cancelar-postulacion');
  const btnConfirmar = document.getElementById('btn-confirmar-postulacion');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!select.value) {
      mostrarError('Selecciona una materia activa del catálogo.');
      return;
    }
    const nombreMateria = select.options[select.selectedIndex].textContent;
    textoConfirmar.textContent = `¿Deseas enviar tu solicitud para impartir asesorías de "${nombreMateria}"?`;
    modal.classList.remove('hidden');
  });

  btnCancelar.onclick = () => modal.classList.add('hidden');
  btnConfirmar.onclick = () => postular(select.value, btnConfirmar);

  await listarMisPostulaciones();
  await cargarSelectMateriasPostulacion();
}

// ---------------------------------------------------------------------
// 2. Parte Coordinador (admin.html · SCR-007)
// ---------------------------------------------------------------------

// listarPostulacionesPendientes(): consulta v_postulaciones (todas para Coordinador)
async function listarPostulacionesPendientes() {
  const { data, error } = await db
    .from('v_postulaciones')
    .select('*')
    .order('fecha_solicitud', { ascending: false });

  if (error) { mostrarError(error.message); return; }
  postulacionesAdmin = data || [];

  const totalPendientes = postulacionesAdmin.filter((p) => p.estado_autorizacion === 'Pendiente').length;
  const contador = document.getElementById('contador-pendientes');
  if (contador) contador.textContent = totalPendientes;

  pintarTablaPostulacionesAdmin();
}

function pintarTablaPostulacionesAdmin() {
  const tbody = document.getElementById('tabla-postulaciones-admin');
  const vacio = document.getElementById('postulaciones-admin-vacio');
  const colAccion = document.getElementById('col-postulacion-accion');
  if (!tbody) return;

  const esPendientes = tabPostulaciones === 'pendientes';
  colAccion.textContent = esPendientes ? 'Acciones' : 'Dictamen';

  const lista = postulacionesAdmin.filter((p) =>
    esPendientes ? p.estado_autorizacion === 'Pendiente' : p.estado_autorizacion !== 'Pendiente'
  );

  tbody.innerHTML = '';
  vacio.textContent = esPendientes
    ? 'No hay postulaciones pendientes por dictaminar.'
    : 'Aún no hay dictámenes registrados en el historial.';
  vacio.classList.toggle('hidden', lista.length > 0);

  lista.forEach((p) => {
    const fila = document.createElement('tr');
    fila.className = 'hover:bg-slate-50 transition';

    const rolEtiqueta = p.rol_solicitante === 'Estudiante'
      ? 'Estudiante (tutor par)'
      : 'Profesor';

    const celdaFinal = esPendientes
      ? `<div class="flex space-x-2">
           <button data-accion="aprobar" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">Aprobar</button>
           <button data-accion="rechazar" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">Rechazar</button>
         </div>`
      : `<div class="flex flex-col items-start gap-1">
           ${badgeEstadoPostulacion(p.estado_autorizacion)}
           <span class="text-xs text-slate-400">${formatearFecha(p.fecha_dictamen)}</span>
         </div>`;

    fila.innerHTML = `
      <td class="px-4 py-3.5 font-medium text-slate-900"></td>
      <td class="px-4 py-3.5 text-slate-600">${rolEtiqueta}</td>
      <td class="px-4 py-3.5 font-medium text-slate-800"></td>
      <td class="px-4 py-3.5 text-slate-500">${formatearFecha(p.fecha_solicitud)}</td>
      <td class="px-4 py-3.5">${celdaFinal}</td>`;

    fila.children[0].textContent = p.solicitante;
    fila.children[2].textContent = p.nombre_materia;

    if (esPendientes) {
      const btnAprobar = fila.querySelector('[data-accion="aprobar"]');
      const btnRechazar = fila.querySelector('[data-accion="rechazar"]');
      btnAprobar.onclick = () => dictaminar(p.id_asesor_materia, true, btnAprobar);
      btnRechazar.onclick = () => abrirModalRechazo(p);
    }

    tbody.appendChild(fila);
  });
}

function abrirModalRechazo(postulacion) {
  postulacionRechazar = postulacion;
  document.getElementById('texto-confirmar-rechazo').textContent =
    `¿Rechazar la postulación de ${postulacion.solicitante} para la materia ${postulacion.nombre_materia}?`;
  document.getElementById('modal-confirmar-rechazo').classList.remove('hidden');
}

function cerrarModalRechazo() {
  document.getElementById('modal-confirmar-rechazo').classList.add('hidden');
  postulacionRechazar = null;
}

// dictaminar(): llama a dictaminar_postulacion(p_id, p_aprobar) y actualiza la tabla
async function dictaminar(pId, pAprobar, boton) {
  mostrarCargando(boton, true);
  try {
    const { error } = await db.rpc('dictaminar_postulacion', {
      p_id: Number(pId),
      p_aprobar: Boolean(pAprobar)
    });

    if (error) {
      mostrarError(error.message);
      return;
    }

    cerrarModalRechazo();
    mostrarExito(pAprobar ? 'Postulación aprobada' : 'Postulación rechazada');
    await listarPostulacionesPendientes();
  } finally {
    mostrarCargando(boton, false);
  }
}

async function iniciarPostulacionesAdmin() {
  const tabPend = document.getElementById('tab-postulaciones-pendientes');
  const tabHist = document.getElementById('tab-postulaciones-historial');

  tabPend.onclick = () => {
    tabPostulaciones = 'pendientes';
    tabPend.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold bg-[#1B396A] text-white transition';
    tabHist.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    pintarTablaPostulacionesAdmin();
  };

  tabHist.onclick = () => {
    tabPostulaciones = 'historial';
    tabHist.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold bg-[#1B396A] text-white transition';
    tabPend.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    pintarTablaPostulacionesAdmin();
  };

  document.getElementById('btn-cancelar-rechazo').onclick = cerrarModalRechazo;
  document.getElementById('btn-confirmar-rechazo').onclick = (e) => {
    if (postulacionRechazar) {
      dictaminar(postulacionRechazar.id_asesor_materia, false, e.currentTarget);
    }
  };

  await listarPostulacionesPendientes();
}