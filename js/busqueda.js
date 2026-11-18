// Búsqueda T15a de CarlosV/sp2, integrada con el modal T15b.
function seguro(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

// Carga las materias activas en el select de filtros de buscar.html
async function cargarFiltroMaterias() {
  const selectFiltro = document.getElementById('filtro-materia');
  if (!selectFiltro) return;

  const { data, error } = await db
    .from('materia')
    .select('id_materia, nombre_materia')
    .eq('estado_activo', true)
    .order('nombre_materia');

  if (error) {
    console.error('Error cargando materias filtro:', error.message);
    return;
  }

  data.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id_materia;
    opt.textContent = m.nombre_materia;
    selectFiltro.appendChild(opt);
  });
}

function limpiarFiltrosBusqueda() {
  document.getElementById('form-filtros').reset();
  window.recargarBusqueda();
}

// Consulta v_franjas_disponibles y renderiza skeletons, tarjetas o estado vacío
async function buscarFranjas(filtros = null) {
  const gridSkeletons = document.getElementById('grid-skeletons');
  const gridResultados = document.getElementById('grid-resultados');
  const estadoVacio = document.getElementById('estado-vacio');
  const textoContador = document.getElementById('texto-contador');

  if (!gridResultados) return;

  // 1. Mostrar Skeletons
  gridResultados.classList.add('hidden');
  estadoVacio.classList.add('hidden');
  estadoVacio.classList.remove('flex');
  gridSkeletons.classList.remove('hidden');
  textoContador.textContent = 'Buscando horarios...';

  // 2. Obtener Filtros (desde argumento o desde los inputs del DOM)
  const idMateria = filtros?.id_materia ?? document.getElementById('filtro-materia').value;
  const fecha = filtros?.fecha ?? document.getElementById('filtro-fecha').value;
  const modalidad = filtros?.modalidad ?? document.getElementById('filtro-modalidad').value;

  // 3. Construir Query
  let query = db
    .from('v_franjas_disponibles')
    .select('*')
    .order('fecha')
    .order('hora_inicio');

  if (idMateria) query = query.eq('id_materia', idMateria);
  if (fecha) query = query.eq('fecha', fecha);
  if (modalidad && modalidad !== 'Todas') query = query.eq('modalidad', modalidad);

  const { data, error } = await query;

  // 4. Ocultar Skeletons
  gridSkeletons.classList.add('hidden');

  if (error) {
    textoContador.textContent = 'Error de conexión';
    console.error('Error buscando franjas:', error.message);
    return;
  }

  // 5. Evaluar Resultados (Estado vacío conservando flex flex-col items-center)
  if (data.length === 0) {
    estadoVacio.classList.remove('hidden');
    estadoVacio.classList.add('flex', 'flex-col', 'items-center');
    textoContador.textContent = '0 horarios disponibles';
    gridResultados.innerHTML = '';
    return;
  }

  // 6. Renderizar Tarjetas
  gridResultados.classList.remove('hidden');
  textoContador.textContent = `${data.length} horario${data.length === 1 ? '' : 's'} disponible${data.length === 1 ? '' : 's'}`;
  gridResultados.innerHTML = '';

  data.forEach(f => {
    // Cálculo hora inicio - fin
    const hrInicio = f.hora_inicio.substring(0, 5);
    const hrFin = String(Number(hrInicio.split(':')[0]) + 1).padStart(2, '0') + ':' + hrInicio.split(':')[1];

    // Formato de fecha con solo la primera letra en mayúscula ("Jueves 12 de noviembre")
    const [y, m, d] = f.fecha.split('-');
    const fechaObj = new Date(y, m - 1, d);
    const fechaRaw = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(fechaObj);
    const fechaStr = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);

    // Rol y estrellas calculadas con el promedio
    const badgeRol = f.es_tutor_par ? 'Tutor par' : 'Profesor';
    const numEval = f.num_evaluaciones;
    const n = Math.round(f.promedio);
    const estrellas = '★'.repeat(n) + '☆'.repeat(5 - n);
    const renderCalif = numEval > 0
      ? `${estrellas} <span class="text-slate-500 font-normal">${f.promedio} (${numEval})</span>`
      : `<span class="text-slate-400 font-normal italic">Sin calificaciones</span>`;

    // Modalidad y ubicación sanitizada
    const isVirtual = f.modalidad === 'Virtual';
    const badgeModClass = isVirtual
      ? 'bg-blue-50 text-blue-700 border-blue-100'
      : 'bg-emerald-50 text-emerald-700 border-emerald-100';
    const iconModText = isVirtual ? '💻 Virtual' : '📍 Presencial';
    const ubiSegura = seguro(f.ubicacion_presencial);
    const ubiLinea = !isVirtual && f.ubicacion_presencial
      ? `<p class="flex items-start mt-1.5">📍 <span class="ml-1 leading-tight line-clamp-2" title="${ubiSegura}">${ubiSegura}</span></p>`
      : '';

    const asesorSeguro = seguro(f.asesor);
    const materiaSegura = seguro(f.nombre_materia);

    gridResultados.innerHTML += `
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">${badgeRol}</span>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded border ${badgeModClass}">${iconModText}</span>
          </div>
          
          <div class="mb-4">
            <h3 class="text-sm font-bold text-slate-900 leading-tight line-clamp-1" title="${asesorSeguro}">${asesorSeguro}</h3>
            <p class="text-[11px] text-amber-500 font-bold mt-1">${renderCalif}</p>
          </div>
          
          <div class="text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-100 mb-4 line-clamp-2" title="${materiaSegura}">
            ${materiaSegura}
          </div>
          
          <div class="text-xs text-slate-600 mb-5">
            <p class="flex items-center">🕒 <span class="ml-1">${hrInicio} - ${hrFin} • ${fechaStr}</span></p>
            ${ubiLinea}
          </div>
        </div>
        
        <button data-id-franja="${f.id_disponibilidad}" type="button" class="w-full bg-[#1B396A] hover:bg-[#13274A] text-white text-xs font-semibold py-2.5 rounded-lg transition shadow-sm mt-auto">
          Solicitar asesoría
        </button>
      </div>
    `;
  });
}

// Expuesto globalmente para recargar tras reservar en T15b
window.recargarBusqueda = function() {
  return buscarFranjas();
};
