// =====================================================================
// js/panel.js · Panel principal según el rol (T11 · TC-14 · SCR-002)
// Requiere: js/supabase.js (db, mostrarError) y js/sesion.js
// (iniciarPaginaProtegida, usuarioActual, cerrarSesion).
// La revisión de sesión, el rol, los vencimientos, el menú y el botón
// «Cerrar sesión» los hace sesion.js; aquí solo se pinta el panel.
// =====================================================================

// Accesos que ve cada tipo de usuario (cap. 13.2 y 13.7)
const ACCESOS = {
  Estudiante: [
    { titulo: 'Agendar nueva asesoría', url: 'buscar.html' },
    { titulo: 'Mis citas', url: 'solicitudes.html' },
    { titulo: 'Postularme como tutor', url: 'postulacion.html' },
  ],
  Profesor: [
    { titulo: 'Postular materia', url: 'postulacion.html' },
  ],
  Asesor: [ // se agrega a Estudiante o Profesor con al menos una materia Aprobada
    { titulo: 'Mi agenda', url: 'agenda.html' },
    { titulo: 'Solicitudes recibidas', url: 'solicitudes.html' },
  ],
  Coordinador: [
    { titulo: 'Catálogo de materias', url: 'admin.html' },
    { titulo: 'Postulaciones de asesores', url: 'admin.html' },
    { titulo: 'Reporte del servicio', url: 'admin.html' },
  ],
};

// Estilos del diseño de Carlos: el primer acceso es el principal
const CLASE_PRINCIPAL = 'w-full bg-[#1B396A] hover:bg-[#13274A] text-white text-center font-semibold py-2.5 rounded-lg shadow-sm transition text-sm';
const CLASE_SECUNDARIA = 'w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-center font-semibold py-2.5 rounded-lg shadow-sm transition text-sm';

// Escapa texto que viene de la base de datos antes de meterlo en HTML
function seguro(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Iniciales para el círculo de la cabecera («Laura Gómez» → «LG»)
function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ¿Tiene al menos una materia aprobada para asesorar? (RN-02)
// La vista v_postulaciones ya devuelve solo las postulaciones del usuario.
async function tieneMateriaAprobada() {
  const { data, error } = await db
    .from('v_postulaciones')
    .select('id_asesor_materia')
    .eq('estado_autorizacion', 'Aprobada')
    .limit(1);
  return !error && data.length > 0;
}

// Los bloques duran siempre 1 hora (RN-03): «15:00:00» → «16:00»
function horaFin(horaInicio) {
  const [h, m] = horaInicio.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function pintarAccesos(lista) {
  document.getElementById('accesos').innerHTML = lista.map((a, i) =>
    `<a href="${a.url}" class="${i === 0 ? CLASE_PRINCIPAL : CLASE_SECUNDARIA}">${a.titulo}</a>`
  ).join('');
}

// Citas aceptadas de las próximas 24 h (vista v_mis_citas, columna es_proxima)
async function pintarProximasCitas() {
  const { data, error } = await db
    .from('v_mis_citas')
    .select('nombre_materia, fecha, hora_inicio, modalidad, ubicacion_presencial, url_videollamada, estudiante, asesor, mi_papel')
    .eq('es_proxima', true)
    .order('fecha')
    .order('hora_inicio');

  if (error) {
    mostrarError(error.message);
    return;
  }
  if (!data.length) return; // se queda el mensaje «No tienes citas…»

  document.getElementById('proximas').innerHTML = data.map(c => {
    const conQuien = c.mi_papel === 'Estudiante' ? `Asesor: ${seguro(c.asesor)}` : `Estudiante: ${seguro(c.estudiante)}`;
    const horario = `${c.hora_inicio.slice(0, 5)} - ${horaFin(c.hora_inicio)}`;
    const accion = c.modalidad === 'Virtual' && c.url_videollamada
      ? `<a href="${seguro(c.url_videollamada)}" target="_blank" rel="noopener"
            class="w-full md:w-auto text-center px-5 py-2.5 bg-[#1B396A] text-white text-xs font-bold rounded-lg shadow-sm hover:bg-[#13274A] transition">
           Unirse a la videollamada
         </a>`
      : `<span class="text-xs text-slate-600">${seguro(c.ubicacion_presencial)}</span>`;
    return `
      <div class="bg-white p-6 rounded-xl border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center space-x-3 mb-2">
            <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-200">Confirmada</span>
          </div>
          <h3 class="text-base font-bold text-slate-900 leading-tight">${seguro(c.nombre_materia)}</h3>
          <p class="text-sm text-slate-600 mt-1">${conQuien}</p>
          <p class="text-xs text-slate-500 mt-1">${c.fecha} • ${horario} • ${c.modalidad}</p>
        </div>
        <div class="flex flex-col space-y-2 w-full md:w-auto">${accion}</div>
      </div>`;
  }).join('');
}

async function cargarPanel() {
  // Sesión, rol, vencimientos, menú y botón «Cerrar sesión» (sesion.js)
  const perfil = await iniciarPaginaProtegida();
  if (!perfil) return;

  const nombre = perfil.nombre_completo;
  document.getElementById('saludo').textContent = `Hola, ${nombre.split(' ')[0]}.`;
  const avatar = document.getElementById('avatar-iniciales');
  avatar.textContent = iniciales(nombre);
  avatar.title = nombre;

  let accesos = [...ACCESOS[perfil.rol]];
  let rolMostrado = perfil.rol;

  if (perfil.rol !== 'Coordinador' && await tieneMateriaAprobada()) {
    accesos = accesos.concat(ACCESOS.Asesor);
    rolMostrado += ' • Asesor autorizado';
  }

  document.getElementById('rol-texto').textContent = rolMostrado;
  pintarAccesos(accesos);

  // El coordinador no reserva ni imparte asesorías (cap. 13.2)
  if (perfil.rol === 'Coordinador') {
    document.getElementById('seccion-proximas').classList.add('hidden');
  } else {
    await pintarProximasCitas();
  }
}

document.addEventListener('DOMContentLoaded', cargarPanel);
