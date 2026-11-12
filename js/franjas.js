/* =========================================================
   TutorConnect — js/franjas.js
   Gestión completa de Mi Agenda y publicación de franjas.
   Usa db y funciones de supabase.js / sesion.js
   ========================================================= */

let filtroActual = 'PROXIMAS';

// Configura RN-10: la fecha mínima para publicar es mañana
function configurarFechaMinima() {
  const inputFecha = document.getElementById('franja-fecha');
  if (inputFecha) {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    inputFecha.min = manana.toISOString().split('T')[0];
  }
}

// Carga el <select> solo con materias que tienen estado 'Aprobada'
async function cargarMateriasAprobadas() {
  const { data, error } = await db
    .from('v_postulaciones')
    .select('id_materia, nombre_materia')
    .eq('estado_autorizacion', 'Aprobada');

  if (error) {
    console.error('Error al cargar materias:', error.message);
    return;
  }

  const select = document.getElementById('franja-materia');
  select.innerHTML = '<option value="" disabled selected>Selecciona una materia autorizada</option>';
  
  if (data.length === 0) {
    select.innerHTML = '<option value="" disabled>No tienes materias aprobadas aún</option>';
    return;
  }

  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id_materia;
    option.textContent = m.nombre_materia;
    select.appendChild(option);
  });
}

/* =========================================================
   AÑADIR O REEMPLAZAR ESTAS FUNCIONES EN js/franjas.js
   ========================================================= */

// Event Listeners: Vincular la validación de horas al cambiar la fecha en el modal
document.addEventListener('DOMContentLoaded', () => {
  const inputFecha = document.getElementById('franja-fecha');
  if (inputFecha) {
    inputFecha.addEventListener('change', actualizarHorasDisponibles);
  }
});

// Función para consultar horas ocupadas y ocultarlas del select
async function actualizarHorasDisponibles() {
  const selectHora = document.getElementById('franja-hora-inicio');
  const fechaSeleccionada = document.getElementById('franja-fecha').value;
  const opcionesHora = selectHora.querySelectorAll('option:not([disabled][selected])');

  // 1. Restaurar todas las opciones a visibles antes de filtrar
  opcionesHora.forEach(op => {
    op.style.display = 'block';
    op.disabled = false;
  });
  
  // Reiniciar la selección al valor por defecto
  selectHora.value = "";
  document.getElementById('franja-hora-fin').value = ""; // Limpiar hora fin calculada

  if (!fechaSeleccionada) return;

  // 2. Consultar a la BD las franjas del asesor en la fecha seleccionada
  // Se usa v_mi_agenda ya que filtra por auth.uid() internamente según tu RLS/Vistas
  const { data, error } = await db
    .from('v_mi_agenda')
    .select('hora_inicio')
    .eq('fecha', fechaSeleccionada);

  if (error) {
    console.error('Error al verificar disponibilidad de horas:', error.message);
    return;
  }

  // 3. Extraer las horas ocupadas en formato 'HH:MM:SS'
  const horasOcupadas = data.map(franja => franja.hora_inicio);

  // 4. Ocultar y deshabilitar las opciones que coincidan con las horas ocupadas
  opcionesHora.forEach(op => {
    // La opción value es '07:00:00', hora_inicio devuelve '07:00:00'
    if (horasOcupadas.includes(op.value)) {
      op.style.display = 'none';
      op.disabled = true;
    }
  });
}

// Actualización a la función abrirModalPublicar
function abrirModalPublicar() {
  document.getElementById('error-publicar').classList.add('hidden');
  document.getElementById('modal-publicar').classList.remove('hidden');
  document.getElementById('modal-publicar').classList.add('flex');
  
  // Inicializamos el select de horas para que estén todas visibles al abrir
  const selectHora = document.getElementById('franja-hora-inicio');
  const opcionesHora = selectHora.querySelectorAll('option');
  opcionesHora.forEach(op => { op.style.display = 'block'; op.disabled = false; });
  selectHora.value = "";
}

function cerrarModalPublicar() {
  document.getElementById('modal-publicar').classList.add('hidden');
  document.getElementById('modal-publicar').classList.remove('flex');
  document.querySelector('form').reset();
  toggleUbicacion();
}

function calcularHoraFin() {
  const inicio = document.getElementById('franja-hora-inicio').value;
  if (!inicio) return;
  const [h, m] = inicio.split(':');
  const finH = String(Number(h) + 1).padStart(2, '0');
  document.getElementById('franja-hora-fin').value = `${finH}:${m}`;
}

function toggleUbicacion() {
  const esVirtual = document.getElementById('mod-virtual').checked;
  const divUbicacion = document.getElementById('div-ubicacion');
  const inputUbicacion = document.getElementById('franja-ubicacion');
  
  if (esVirtual) {
    divUbicacion.classList.add('hidden');
    inputUbicacion.required = false;
    inputUbicacion.value = '';
  } else {
    divUbicacion.classList.remove('hidden');
    inputUbicacion.required = true;
  }
}

// Llamada a la RPC publicar_franja
async function publicarFranja(event) {
  event.preventDefault();
  const btnSubmit = document.getElementById('btn-submit-franja');
  const msjError = document.getElementById('error-publicar');
  
  btnSubmit.disabled = true;
  btnSubmit.innerText = 'Publicando...';
  msjError.classList.add('hidden');

  const p_id_materia = document.getElementById('franja-materia').value;
  const p_fecha = document.getElementById('franja-fecha').value;
  const p_hora = document.getElementById('franja-hora-inicio').value;
  const p_modalidad = document.querySelector('input[name="modalidad"]:checked').value;
  const p_ubicacion = document.getElementById('franja-ubicacion').value;

  const { data, error } = await db.rpc('publicar_franja', {
    p_id_materia,
    p_fecha,
    p_hora,
    p_modalidad,
    p_ubicacion: p_modalidad === 'Presencial' ? p_ubicacion : null
  });

  btnSubmit.disabled = false;
  btnSubmit.innerText = 'Publicar';

  if (error) {
    msjError.textContent = error.message; // Imprime los mensajes SQL (RN-10, cruzados, permisos)
    msjError.classList.remove('hidden');
    return;
  }

  mostrarToast('Horario publicado exitosamente');
  cerrarModalPublicar();
  listarMiAgenda();
}

// Filtros y Renderizado de la Vista v_mi_agenda
function cambiarFiltroAgenda(filtro) {
  filtroActual = filtro;
  document.getElementById('tab-proximas').className = filtro === 'PROXIMAS' 
    ? "px-4 py-2.5 bg-[#1B396A] text-white transition" 
    : "px-4 py-2.5 bg-white text-slate-600 hover:bg-slate-50 transition";
  document.getElementById('tab-todas').className = filtro === 'TODAS' 
    ? "px-4 py-2.5 bg-[#1B396A] text-white transition" 
    : "px-4 py-2.5 bg-white text-slate-600 hover:bg-slate-50 transition";
  listarMiAgenda();
}

async function listarMiAgenda() {
  const tbody = document.getElementById('tabla-agenda-body');
  const msjVacio = document.getElementById('agenda-vacia');
  const tablaContenedor = tbody.parentElement.parentElement;
  
  tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-4 text-center text-sm text-slate-500">Cargando agenda...</td></tr>';

  let query = db.from('v_mi_agenda').select('*').order('fecha').order('hora_inicio');
  
  if (filtroActual === 'PROXIMAS') {
    const hoy = new Date().toISOString().split('T')[0];
    query = query.gte('fecha', hoy);
  }

  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-4 text-center text-rose-600">Error: ${error.message}</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tablaContenedor.classList.add('hidden');
    msjVacio.classList.remove('hidden');
    return;
  }

  tablaContenedor.classList.remove('hidden');
  msjVacio.classList.add('hidden');
  tbody.innerHTML = '';

  data.forEach(franja => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";

    // Formatear hora de 07:00:00 a 07:00
    const hrInicio = franja.hora_inicio.substring(0, 5);
    const hrFin = String(Number(hrInicio.split(':')[0]) + 1).padStart(2, '0') + ':' + hrInicio.split(':')[1];
    
    // Formatear fecha a DD/MM/YYYY
    const [y, m, d] = franja.fecha.split('-');
    const fechaFormat = `${d}/${m}/${y}`;

    // Estilos de estado
    let badgeClass = '';
    let iconModalidad = franja.modalidad === 'Virtual' ? '💻' : '📍';
    let ubTexto = franja.modalidad === 'Virtual' ? 'Virtual' : franja.ubicacion_presencial;
    
    switch (franja.estado_franja) {
      case 'Libre': badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200'; break;
      case 'Congelado': badgeClass = 'bg-amber-100 text-amber-800 border-amber-200'; break;
      case 'Ocupado': badgeClass = 'bg-blue-100 text-blue-800 border-blue-200'; break;
      case 'Vencido': badgeClass = 'bg-slate-100 text-slate-600 border-slate-200'; break;
    }

    const btnRetirar = franja.estado_franja === 'Libre' 
      ? `<button onclick="retirarFranja(${franja.id_disponibilidad})" class="text-rose-600 hover:text-rose-800 font-semibold text-xs transition">Retirar</button>`
      : `<span class="text-slate-400 text-xs cursor-not-allowed">Retirar</span>`;

    tr.innerHTML = `
      <td class="px-5 py-4 font-medium text-slate-900">${fechaFormat}</td>
      <td class="px-5 py-4">${hrInicio} - ${hrFin}</td>
      <td class="px-5 py-4 font-bold text-slate-900">${franja.nombre_materia}</td>
      <td class="px-5 py-4">${iconModalidad} <span class="ml-1 truncate max-w-[150px] inline-block align-bottom" title="${ubTexto}">${ubTexto}</span></td>
      <td class="px-5 py-4">
        <span class="${badgeClass} border px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">${franja.estado_franja}</span>
      </td>
      <td class="px-5 py-4 text-right">${btnRetirar}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function retirarFranja(id) {
  if (!confirm('¿Estás seguro de que deseas retirar este horario? Ya no aparecerá en las búsquedas.')) return;

  const { error } = await db.rpc('eliminar_franja', { p_id: id });

  if (error) {
    alert(error.message); // Imprime "No se puede eliminar: el horario ya tiene solicitudes registradas"
    return;
  }

  mostrarToast('Horario retirado de la agenda');
  listarMiAgenda();
}

function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').innerText = msg;
  
  toast.classList.remove('translate-y-[120%]', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[120%]', 'opacity-0');
  }, 3500);
}

/* =========================================================
   TutorConnect — MÓDULO DE BÚSQUEDA (SCR-003 / T15a)
   Integra la consulta a v_franjas_disponibles
   ========================================================= */

// Carga las materias activas en el select de filtros
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

// Expuesto globalmente para recargar tras reservar en T15b
window.recargarBusqueda = async function() {
  const gridSkeletons = document.getElementById('grid-skeletons');
  const gridResultados = document.getElementById('grid-resultados');
  const estadoVacio = document.getElementById('estado-vacio');
  const textoContador = document.getElementById('texto-contador');

  if(!gridResultados) return; // Protege ejecución si no estamos en buscar.html

  // 1. Mostrar Skeletons
  gridResultados.classList.add('hidden');
  estadoVacio.classList.add('hidden');
  gridSkeletons.classList.remove('hidden');
  textoContador.textContent = 'Buscando horarios...';

  // 2. Obtener Filtros
  const idMateria = document.getElementById('filtro-materia').value;
  const fecha = document.getElementById('filtro-fecha').value;
  const modalidad = document.getElementById('filtro-modalidad').value;

  // 3. Construir Query
  let query = db.from('v_franjas_disponibles').select('*').order('fecha').order('hora_inicio');
  
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

  // 5. Evaluar Resultados
  if (data.length === 0) {
    estadoVacio.classList.remove('hidden');
    textoContador.textContent = '0 horarios disponibles';
    gridResultados.innerHTML = '';
    return;
  }

  // 6. Renderizar Tarjetas
  gridResultados.classList.remove('hidden');
  textoContador.textContent = `${data.length} horario${data.length === 1 ? '' : 's'} disponible${data.length === 1 ? '' : 's'}`;
  gridResultados.innerHTML = '';

  data.forEach(f => {
    // Cálculo hora fin
    const hrInicio = f.hora_inicio.substring(0, 5);
    const hrFin = String(Number(hrInicio.split(':')[0]) + 1).padStart(2, '0') + ':' + hrInicio.split(':')[1];
    
    // Formato de Fecha "jueves 12 de noviembre"
    const [y, m, d] = f.fecha.split('-');
    const fechaObj = new Date(y, m - 1, d);
    const fechaStr = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(fechaObj);

    // Diseño de etiquetas y calificaciones
    const badgeRol = f.es_tutor_par ? 'Tutor par' : 'Profesor';
    const numEval = f.num_evaluaciones;
    const renderCalif = numEval > 0 
      ? `★★★★★ <span class="text-slate-500 font-normal">${f.promedio} (${numEval})</span>`
      : `<span class="text-slate-400 font-normal italic">Sin calificaciones</span>`;

    const isVirtual = f.modalidad === 'Virtual';
    const badgeModClass = isVirtual ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100';
    const iconModText = isVirtual ? '💻 Virtual' : '📍 Presencial';
    const ubiLinea = !isVirtual && f.ubicacion_presencial 
      ? `<p class="flex items-start mt-1.5">📍 <span class="ml-1 leading-tight line-clamp-2" title="${f.ubicacion_presencial}">${f.ubicacion_presencial}</span></p>`
      : ``;

    gridResultados.innerHTML += `
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">${badgeRol}</span>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded border ${badgeModClass}">${iconModText}</span>
          </div>
          
          <div class="mb-4">
            <h3 class="text-sm font-bold text-slate-900 leading-tight line-clamp-1" title="${f.asesor}">${f.asesor}</h3>
            <p class="text-[11px] text-amber-500 font-bold mt-1">${renderCalif}</p>
          </div>
          
          <div class="text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-100 mb-4 line-clamp-2">
            ${f.nombre_materia}
          </div>
          
          <div class="text-xs text-slate-600 mb-5">
            <p class="flex items-center capitalize">🕒 <span class="ml-1">${hrInicio} - ${hrFin} • ${fechaStr}</span></p>
            ${ubiLinea}
          </div>
        </div>
        
        <button data-id-franja="${f.id_disponibilidad}" onclick="abrirModalSolicitar(this)" class="w-full bg-[#1B396A] hover:bg-[#13274A] text-white text-xs font-semibold py-2.5 rounded-lg transition shadow-sm mt-auto">
          Solicitar asesoría
        </button>
      </div>
    `;
  });
};