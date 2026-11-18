// =====================================================================
// js/franjas.js · Publicación de bloques y Mi agenda (T14 · HU-004)
// Pantalla agenda.html (SCR-004) + modal FORM-001.
// Requiere: js/supabase.js y js/sesion.js.
// =====================================================================

let franjasAgenda = [];
let filtroAgenda = 'proximas'; // 'proximas' | 'todas'
let franjaRetirar = null;

function fechaMinimaManana() {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const yyyy = manana.getFullYear();
  const mm = String(manana.getMonth() + 1).padStart(2, '0');
  const dd = String(manana.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function calcularHoraFin(horaInicio) {
  if (!horaInicio) return '';
  const [h, m] = horaInicio.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatearFechaAgenda(fechaIso) {
  const [y, m, d] = fechaIso.split('-');
  return `${d}/${m}/${y}`;
}

function badgeEstadoFranja(estado) {
  if (estado === 'Libre') {
    return '<span class="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Libre</span>';
  }
  if (estado === 'Congelado') {
    return '<span class="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Congelado</span>';
  }
  if (estado === 'Ocupado') {
    return '<span class="bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Ocupado</span>';
  }
  return '<span class="bg-slate-200 text-slate-600 border border-slate-300 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Vencido</span>';
}

// ---------------------------------------------------------------------
// 1. cargarMateriasAprobadas(): llena el select solo con materias
//    Aprobadas en v_postulaciones y activas en el catálogo.
// ---------------------------------------------------------------------
async function cargarMateriasAprobadas() {
  const select = document.getElementById('franja-materia');
  if (!select) return;

  const [resPost, resMat] = await Promise.all([
    db.from('v_postulaciones')
      .select('id_materia, nombre_materia')
      .eq('estado_autorizacion', 'Aprobada')
      .order('nombre_materia'),
    db.from('materia')
      .select('id_materia')
      .eq('estado_activo', true)
  ]);

  if (resPost.error) { mostrarError(resPost.error.message); return; }
  if (resMat.error) { mostrarError(resMat.error.message); return; }

  const activas = new Set((resMat.data || []).map((m) => Number(m.id_materia)));
  const aprobadasActivas = (resPost.data || []).filter((p) => activas.has(Number(p.id_materia)));

  select.innerHTML = '<option value="" disabled selected>Selecciona una materia autorizada</option>';
  aprobadasActivas.forEach((m) => {
    select.add(new Option(m.nombre_materia, m.id_materia));
  });
}

// ---------------------------------------------------------------------
// 2. listarMiAgenda(): consulta v_mi_agenda y agrupa por fecha
// ---------------------------------------------------------------------
async function listarMiAgenda() {
  const { data, error } = await db
    .from('v_mi_agenda')
    .select('*')
    .order('fecha')
    .order('hora_inicio');

  if (error) { mostrarError(error.message); return; }
  franjasAgenda = data || [];
  pintarAgenda();
}

function pintarAgenda() {
  const contenedor = document.getElementById('contenedor-agenda');
  const vacio = document.getElementById('agenda-vacio');
  if (!contenedor) return;

  const visibles = franjasAgenda.filter((f) =>
    filtroAgenda === 'todas' ? true : f.estado_franja !== 'Vencido'
  );

  contenedor.innerHTML = '';
  vacio.classList.toggle('hidden', visibles.length > 0);
  if (visibles.length === 0) return;

  // Agrupar bloques por fecha
  const porFecha = new Map();
  visibles.forEach((f) => {
    if (!porFecha.has(f.fecha)) porFecha.set(f.fecha, []);
    porFecha.get(f.fecha).push(f);
  });

  porFecha.forEach((bloques, fecha) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden';

    tarjeta.innerHTML = `
      <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <span class="text-sm font-bold text-slate-800">Fecha: ${formatearFechaAgenda(fecha)}</span>
        <span class="text-xs text-slate-500">${bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'}</span>
      </div>
      <div class="overflow-x-auto w-full">
        <table class="w-full min-w-[650px] text-left text-sm text-slate-700">
          <thead class="border-b border-slate-100 text-xs uppercase text-slate-500 bg-white">
            <tr>
              <th class="px-5 py-3">Horario</th>
              <th class="px-5 py-3">Materia</th>
              <th class="px-5 py-3">Modalidad / Ubicación</th>
              <th class="px-5 py-3">Estado</th>
              <th class="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100"></tbody>
        </table>
      </div>`;

    const tbody = tarjeta.querySelector('tbody');

    bloques.forEach((b) => {
      const fila = document.createElement('tr');
      fila.className = 'hover:bg-slate-50 transition';

      const horaIni = b.hora_inicio.slice(0, 5);
      const horaFin = calcularHoraFin(horaIni);
      const modalidadTexto = b.modalidad === 'Presencial'
        ? `📍 ${b.ubicacion_presencial || 'Presencial'}`
        : '💻 Virtual';

      const esLibre = b.estado_franja === 'Libre';
      const botonRetirar = esLibre
        ? '<button type="button" data-accion="retirar" class="text-rose-600 hover:text-rose-800 text-xs font-bold transition">Retirar</button>'
        : '<span class="text-slate-300 text-xs font-semibold select-none">Retirar</span>';

      fila.innerHTML = `
        <td class="px-5 py-4 font-medium text-slate-900 whitespace-nowrap">${horaIni} - ${horaFin}</td>
        <td class="px-5 py-4 font-bold text-slate-900"></td>
        <td class="px-5 py-4 text-slate-600"></td>
        <td class="px-5 py-4">${badgeEstadoFranja(b.estado_franja)}</td>
        <td class="px-5 py-4 text-right">${botonRetirar}</td>`;

      fila.children[1].textContent = b.nombre_materia;
      fila.children[2].textContent = modalidadTexto;

      if (esLibre) {
        fila.querySelector('[data-accion="retirar"]').onclick = () => abrirModalRetirar(b);
      }

      tbody.appendChild(fila);
    });

    contenedor.appendChild(tarjeta);
  });
}

// ---------------------------------------------------------------------
// 3. publicarFranja(): valida y ejecuta publicar_franja en Supabase
// ---------------------------------------------------------------------
function errorModalFranja(mensaje) {
  const caja = document.getElementById('franja-error');
  caja.textContent = mensaje;
  caja.classList.remove('hidden');
}

function abrirModalPublicar() {
  const form = document.getElementById('form-publicar-franja');
  form.reset();
  document.getElementById('franja-fecha').min = fechaMinimaManana();
  document.getElementById('franja-hora-fin').value = '';
  document.getElementById('franja-error').classList.add('hidden');
  actualizarVisibilidadUbicacion();
  document.getElementById('modal-publicar').classList.remove('hidden');
}

function cerrarModalPublicar() {
  document.getElementById('modal-publicar').classList.add('hidden');
}

function actualizarVisibilidadUbicacion() {
  const esPresencial = document.querySelector('input[name="modalidad"]:checked').value === 'Presencial';
  const grupo = document.getElementById('grupo-ubicacion');
  const input = document.getElementById('franja-ubicacion');

  grupo.classList.toggle('hidden', !esPresencial);
  input.required = esPresencial;
  if (!esPresencial) input.value = '';
}

async function publicarFranja(evento) {
  evento.preventDefault();
  document.getElementById('franja-error').classList.add('hidden');

  const idMateria = document.getElementById('franja-materia').value;
  const fecha = document.getElementById('franja-fecha').value;
  const hora = document.getElementById('franja-hora-inicio').value;
  const modalidad = document.querySelector('input[name="modalidad"]:checked').value;
  const ubicacion = document.getElementById('franja-ubicacion').value.trim();
  const boton = document.getElementById('btn-guardar-franja');

  if (!idMateria || !fecha || !hora) {
    errorModalFranja('Completa todos los campos obligatorios.');
    return;
  }
  if (modalidad === 'Presencial' && !ubicacion) {
    errorModalFranja('Indica la ubicación en campus para la asesoría presencial.');
    return;
  }

  mostrarCargando(boton, true);
  try {
    const { error } = await db.rpc('publicar_franja', {
      p_id_materia: Number(idMateria),
      p_fecha: fecha,
      p_hora: hora,
      p_modalidad: modalidad,
      p_ubicacion: modalidad === 'Presencial' ? ubicacion : null
    });

    if (error) {
      errorModalFranja(error.message);
      return;
    }

    cerrarModalPublicar();
    mostrarExito('Horario publicado');
    await listarMiAgenda();
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// 4. retirarFranja(): elimina una franja Libre via eliminar_franja(p_id)
// ---------------------------------------------------------------------
function abrirModalRetirar(franja) {
  franjaRetirar = franja;
  const horaIni = franja.hora_inicio.slice(0, 5);
  document.getElementById('texto-retirar-franja').textContent =
    `¿Retirar el horario de ${franja.nombre_materia} del ${formatearFechaAgenda(franja.fecha)} a las ${horaIni}?`;
  document.getElementById('modal-retirar-franja').classList.remove('hidden');
}

function cerrarModalRetirar() {
  document.getElementById('modal-retirar-franja').classList.add('hidden');
  franjaRetirar = null;
}

async function retirarFranja(idDisponibilidad, boton) {
  mostrarCargando(boton, true);
  try {
    const { error } = await db.rpc('eliminar_franja', {
      p_id: Number(idDisponibilidad)
    });

    if (error) {
      cerrarModalRetirar();
      mostrarError(error.message);
      return;
    }

    cerrarModalRetirar();
    mostrarExito('Horario retirado');
    await listarMiAgenda();
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// Arranque de agenda.html
// ---------------------------------------------------------------------
async function iniciarAgenda() {
  document.getElementById('btn-abrir-publicar').onclick = abrirModalPublicar;
  document.getElementById('btn-publicar-vacio').onclick = abrirModalPublicar;
  document.getElementById('btn-cerrar-modal-publicar').onclick = cerrarModalPublicar;
  document.getElementById('btn-cancelar-publicar').onclick = cerrarModalPublicar;

  document.getElementById('franja-hora-inicio').addEventListener('change', (e) => {
    document.getElementById('franja-hora-fin').value = calcularHoraFin(e.target.value);
  });

  document.querySelectorAll('input[name="modalidad"]').forEach((radio) => {
    radio.addEventListener('change', actualizarVisibilidadUbicacion);
  });

  document.getElementById('form-publicar-franja').addEventListener('submit', publicarFranja);

  document.getElementById('btn-cancelar-retirar').onclick = cerrarModalRetirar;
  document.getElementById('btn-confirmar-retirar').onclick = (e) => {
    if (franjaRetirar) retirarFranja(franjaRetirar.id_disponibilidad, e.currentTarget);
  };

  const tabProx = document.getElementById('filtro-agenda-proximas');
  const tabTodas = document.getElementById('filtro-agenda-todas');

  tabProx.onclick = () => {
    filtroAgenda = 'proximas';
    tabProx.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold bg-[#1B396A] text-white transition';
    tabTodas.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    pintarAgenda();
  };

  tabTodas.onclick = () => {
    filtroAgenda = 'todas';
    tabTodas.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold bg-[#1B396A] text-white transition';
    tabProx.className = 'px-3.5 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    pintarAgenda();
  };

  await cargarMateriasAprobadas();
  await listarMiAgenda();
}