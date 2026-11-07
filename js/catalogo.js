// =====================================================================
// js/catalogo.js · Catálogo de materias (T12 · TC-15 · HU-002)
// Sección «Catálogo de materias» de admin.html (SCR-007).
// Requiere: js/supabase.js (db, mostrarError, mostrarExito,
// mostrarCargando) y js/sesion.js (iniciarPaginaProtegida).
// Las materias no se borran: se desactivan (estado_activo = false)
// para que el historial y los reportes conserven las asesorías pasadas.
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

  // Estado vacío: no hay ninguna materia en el catálogo
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
    // textContent para no inyectar HTML con los nombres
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

// Muestra un error dentro del modal (no detrás de él)
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
  const nombre = document.getElementById('materia-nombre').value.trim(); // sin espacios al inicio/final
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
      // 23505 = valor duplicado (restricción uq_materia_nombre_carrera)
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

// cambiarEstadoMateria(): baja lógica (false) o reactivación (true)
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
// Arranque: admin.html llama a iniciarCatalogo() después de comprobar
// que el usuario es Coordinador.
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
