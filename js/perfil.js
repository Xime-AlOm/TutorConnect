// =====================================================================
// js/perfil.js · Mi perfil (T11 · TC-14 · SCR-008)
// Requiere: js/supabase.js (cliente `db`) y js/auth.js (cerrarSesion)
// =====================================================================

function dato(etiqueta, valor) {
  return `
    <div>
      <dt class="text-xs uppercase tracking-wide text-slate-500">${etiqueta}</dt>
      <dd class="font-medium text-slate-800">${valor ?? '—'}</dd>
    </div>`;
}

function estrellas(promedio) {
  const llenas = Math.round(promedio);
  return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
}

async function cargarPerfil() {
  const { data: sesion } = await db.auth.getSession();
  if (!sesion.session) {
    window.location.href = 'index.html';
    return;
  }
  const idUsuario = sesion.session.user.id;

  // Perfil con el nombre de la carrera (relación usuario.id_carrera → carrera)
  const { data: p, error } = await db
    .from('usuario')
    .select('nombre_completo, correo_institucional, rol, matricula_num_empleado, semestre, departamento, carrera(nombre_carrera)')
    .eq('id_usuario', idUsuario)
    .single();

  if (error) {
    const caja = document.getElementById('perfil-error');
    caja.textContent = 'No se pudo cargar tu perfil.';
    caja.classList.remove('hidden');
    document.getElementById('perfil-datos').innerHTML = '';
    return;
  }

  document.getElementById('perfil-rol').textContent = p.rol;

  let html = dato('Nombre', p.nombre_completo) + dato('Correo institucional', p.correo_institucional);
  if (p.rol === 'Estudiante') {
    html += dato('Matrícula', p.matricula_num_empleado)
          + dato('Carrera', p.carrera?.nombre_carrera)
          + dato('Semestre', p.semestre);
  } else {
    html += dato('Número de empleado', p.matricula_num_empleado)
          + dato('Departamento', p.departamento);
  }
  document.getElementById('perfil-datos').innerHTML = html;

  // Promedio público como asesor (vista v_promedio_asesor)
  if (p.rol !== 'Coordinador') {
    const { data: prom } = await db
      .from('v_promedio_asesor')
      .select('promedio, num_evaluaciones')
      .eq('id_asesor', idUsuario)
      .maybeSingle();

    const caja = document.getElementById('perfil-promedio');
    const valor = document.getElementById('promedio-valor');
    if (prom && prom.num_evaluaciones > 0) {
      valor.textContent = `${estrellas(prom.promedio)} ${prom.promedio} (${prom.num_evaluaciones} evaluaciones)`;
      caja.classList.remove('hidden');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-salir').addEventListener('click', cerrarSesion);
  cargarPerfil();
});
