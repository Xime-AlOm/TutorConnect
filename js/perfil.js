// =====================================================================
// js/perfil.js · Mi perfil (T11 · TC-14 · SCR-008)
// Requiere: js/supabase.js (db, mostrarError) y js/sesion.js
// (iniciarPaginaProtegida, usuarioActual, cerrarSesion).
// El botón «Cerrar sesión» (id="btn-cerrar-sesion") lo conecta sesion.js.
// =====================================================================

// Iniciales para los círculos de avatar («Laura Gómez» → «LG»)
function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function escribir(id, valor) {
  document.getElementById(id).textContent = valor ?? '—';
}

function mostrarBloque(id, visible) {
  document.getElementById(id).classList.toggle('hidden', !visible);
}

function estrellas(promedio) {
  const llenas = Math.round(promedio);
  return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
}

async function cargarPerfil() {
  // Sesión, vencimientos, menú y botón «Cerrar sesión» (sesion.js)
  const perfil = await iniciarPaginaProtegida();
  if (!perfil) return;

  // Nombre de la carrera (relación usuario.id_carrera → carrera)
  let carrera = null;
  if (perfil.rol === 'Estudiante' && perfil.id_carrera) {
    const { data, error } = await db
      .from('carrera')
      .select('nombre_carrera')
      .eq('id_carrera', perfil.id_carrera)
      .maybeSingle();
    if (error) mostrarError(error.message);
    carrera = data?.nombre_carrera;
  }

  const nombre = perfil.nombre_completo;
  escribir('perfil-nombre', nombre);
  escribir('perfil-iniciales', iniciales(nombre));
  escribir('avatar-iniciales', iniciales(nombre));
  escribir('perfil-rol', perfil.rol);
  escribir('perfil-correo', perfil.correo_institucional);
  escribir('perfil-matricula', perfil.matricula_num_empleado);

  const esEstudiante = perfil.rol === 'Estudiante';
  escribir('etiqueta-matricula', esEstudiante ? 'Matrícula / No. Control' : 'Número de empleado');
  mostrarBloque('bloque-carrera', esEstudiante);
  mostrarBloque('bloque-semestre', esEstudiante);
  mostrarBloque('bloque-departamento', !esEstudiante);

  if (esEstudiante) {
    escribir('perfil-carrera', carrera);
    escribir('perfil-semestre', perfil.semestre ? `${perfil.semestre}° Semestre` : null);
  } else {
    escribir('perfil-departamento', perfil.departamento);
  }

  // Promedio público como asesor (vista v_promedio_asesor)
  if (perfil.rol !== 'Coordinador') {
    const { data: prom } = await db
      .from('v_promedio_asesor')
      .select('promedio, num_evaluaciones')
      .eq('id_asesor', perfil.id_usuario)
      .maybeSingle();

    if (prom && prom.num_evaluaciones > 0) {
      escribir('perfil-promedio',
        `${estrellas(prom.promedio)} ${prom.promedio} como asesor (${prom.num_evaluaciones} evaluaciones)`);
      mostrarBloque('perfil-promedio', true);
    }
  }
}

document.addEventListener('DOMContentLoaded', cargarPerfil);
