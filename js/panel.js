// =====================================================================
// js/panel.js · Panel principal según el rol (T11 · TC-14 · SCR-002)
// Requiere: js/supabase.js (cliente `db`) y js/auth.js (cerrarSesion)
// =====================================================================

// Accesos que ve cada tipo de usuario (cap. 13.2 y 13.7)
const ACCESOS = {
  Estudiante: [
    { titulo: 'Buscar asesoría', texto: 'Encuentra asesores por materia y fecha', url: 'buscar.html' },
    { titulo: 'Mis citas', texto: 'Solicitudes, citas próximas e historial', url: 'solicitudes.html' },
    { titulo: 'Postularme como tutor', texto: 'Pide autorización para asesorar una materia', url: 'postulacion.html' },
  ],
  Profesor: [
    { titulo: 'Postular materia', texto: 'Pide autorización para asesorar una materia', url: 'postulacion.html' },
  ],
  Asesor: [ // se agrega a Estudiante o Profesor con al menos una materia Aprobada
    { titulo: 'Mi agenda', texto: 'Publica y administra tus bloques de 1 hora', url: 'agenda.html' },
    { titulo: 'Solicitudes recibidas', texto: 'Acepta o rechaza solicitudes de asesoría', url: 'solicitudes.html' },
  ],
  Coordinador: [
    { titulo: 'Catálogo de materias', texto: 'Alta, edición y desactivación de materias', url: 'admin.html' },
    { titulo: 'Postulaciones', texto: 'Aprueba o rechaza asesores por materia', url: 'admin.html' },
    { titulo: 'Reporte', texto: 'Indicadores del servicio por periodo', url: 'admin.html' },
  ],
};

function mostrarErrorPanel(mensaje) {
  const caja = document.getElementById('panel-error');
  caja.textContent = mensaje;
  caja.classList.toggle('hidden', !mensaje);
}

// Revisa la sesión; sin sesión regresa al login
async function obtenerSesion() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return null;
  }
  return data.session.user;
}

// Lee el perfil del usuario conectado (tabla usuario, política usuario_propio)
async function obtenerPerfil(idUsuario) {
  const { data, error } = await db
    .from('usuario')
    .select('nombre_completo, rol')
    .eq('id_usuario', idUsuario)
    .single();
  if (error) throw new Error('No se encontró tu perfil. Completa tu registro.');
  return data;
}

// ¿Tiene al menos una materia aprobada para asesorar? (RN-02)
async function esAsesorAprobado() {
  const { data, error } = await db
    .from('v_postulaciones')
    .select('id_asesor_materia')
    .eq('estado_autorizacion', 'Aprobada')
    .limit(1);
  return !error && data.length > 0;
}

function pintarAccesos(lista) {
  const contenedor = document.getElementById('accesos');
  contenedor.innerHTML = lista.map(a => `
    <a href="${a.url}" class="block rounded-xl bg-white p-4 shadow hover:shadow-md transition">
      <h3 class="font-semibold text-blue-900">${a.titulo}</h3>
      <p class="text-sm text-slate-500">${a.texto}</p>
    </a>`).join('');
}

// Citas aceptadas de las próximas 24 h (vista v_mis_citas, columna es_proxima)
async function pintarProximasCitas() {
  const { data, error } = await db
    .from('v_mis_citas')
    .select('nombre_materia, fecha, hora_inicio, modalidad, ubicacion_presencial, url_videollamada, estudiante, asesor, mi_papel')
    .eq('es_proxima', true)
    .order('fecha')
    .order('hora_inicio');
  if (error || !data.length) return; // se queda el mensaje de "No tienes citas"

  document.getElementById('proximas').innerHTML = data.map(c => {
    const conQuien = c.mi_papel === 'Estudiante' ? `con ${c.asesor}` : `con ${c.estudiante}`;
    const lugar = c.modalidad === 'Virtual'
      ? `<a href="${c.url_videollamada}" target="_blank" class="text-blue-700 underline">Entrar a la videollamada</a>`
      : c.ubicacion_presencial;
    return `
      <div class="rounded-xl bg-white p-4 shadow border-l-4 border-amber-400">
        <p class="font-semibold">${c.nombre_materia} · ${conQuien}</p>
        <p class="text-sm text-slate-600">${c.fecha} · ${c.hora_inicio.slice(0, 5)} h · ${c.modalidad}</p>
        <p class="text-sm">${lugar}</p>
      </div>`;
  }).join('');
}

async function cargarPanel() {
  try {
    const usuario = await obtenerSesion();
    if (!usuario) return;

    const perfil = await obtenerPerfil(usuario.id);
    document.getElementById('saludo').textContent = `Hola, ${perfil.nombre_completo}`;
    document.getElementById('cabecera-usuario').textContent = `${perfil.nombre_completo} · ${perfil.rol}`;

    let accesos = [...ACCESOS[perfil.rol]];
    let rolMostrado = perfil.rol;

    if (perfil.rol !== 'Coordinador' && await esAsesorAprobado()) {
      accesos = accesos.concat(ACCESOS.Asesor);
      rolMostrado += ' · Asesor autorizado';
    }

    document.getElementById('rol-texto').textContent = rolMostrado;
    pintarAccesos(accesos);

    // El coordinador no reserva ni imparte asesorías (cap. 13.2)
    if (perfil.rol === 'Coordinador') {
      document.getElementById('seccion-proximas').classList.add('hidden');
    } else {
      await pintarProximasCitas();
    }
  } catch (e) {
    mostrarErrorPanel(e.message);
    document.getElementById('accesos').innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-salir').addEventListener('click', cerrarSesion);
  cargarPanel();
});
