/* =========================================================
   TutorConnect - T13 / HU-003
   Postulación por materia y dictamen del coordinador.
   Requiere js/supabase.js y js/sesion.js antes de este archivo.
   ========================================================= */

const ESTILOS_ESTADO = {
  Pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
  Aprobada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Rechazada: 'bg-rose-100 text-rose-800 border-rose-200'
};

function escaparCatalogo(valor) {
  const elemento = document.createElement('span');
  elemento.textContent = valor ?? '';
  return elemento.innerHTML;
}

function fechaCatalogo(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-MX', {
    dateStyle: 'short', timeStyle: 'short'
  });
}

function mensajeCatalogo(mensaje, tipo = 'error', destinoId = 'mensaje-postulaciones') {
  const destino = document.getElementById(destinoId);
  if (!destino) {
    if (tipo === 'error') mostrarError(mensaje);
    else mostrarExito(mensaje);
    return;
  }
  destino.textContent = mensaje;
  destino.className = tipo === 'error'
    ? 'mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700'
    : 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700';
  destino.classList.remove('hidden');
}

function limpiarMensajeCatalogo(destinoId = 'mensaje-postulaciones') {
  const destino = document.getElementById(destinoId);
  if (destino) {
    destino.textContent = '';
    destino.classList.add('hidden');
  }
}

async function listarMisPostulaciones() {
  const cuerpo = document.getElementById('mis-postulaciones');
  if (!cuerpo) return [];

  cuerpo.innerHTML = '<tr><td colspan="4" class="px-5 py-6 text-center text-slate-500">Cargando postulaciones…</td></tr>';
  const { data, error } = await db
    .from('v_postulaciones')
    .select('id_asesor_materia, id_materia, nombre_materia, fecha_solicitud, estado_autorizacion, fecha_dictamen')
    .order('fecha_solicitud', { ascending: false });

  if (error) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="px-5 py-6 text-center text-rose-600">No se pudieron cargar las postulaciones.</td></tr>';
    mensajeCatalogo(error.message);
    return [];
  }

  if (!data.length) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="px-5 py-6 text-center text-slate-500">Todavía no has enviado postulaciones.</td></tr>';
    return [];
  }

  cuerpo.innerHTML = data.map((p) => {
    const estado = escaparCatalogo(p.estado_autorizacion);
    const estilo = ESTILOS_ESTADO[p.estado_autorizacion] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<tr class="hover:bg-slate-50">
      <td class="px-5 py-4 font-semibold text-slate-900">${escaparCatalogo(p.nombre_materia)}</td>
      <td class="px-5 py-4 text-slate-500">${fechaCatalogo(p.fecha_solicitud)}</td>
      <td class="px-5 py-4"><span class="rounded border px-2.5 py-1 text-xs font-bold ${estilo}">${estado}</span></td>
      <td class="px-5 py-4 text-slate-500">${fechaCatalogo(p.fecha_dictamen)}</td>
    </tr>`;
  }).join('');

  return data;
}

async function cargarMateriasParaPostular() {
  const selector = document.getElementById('materia-postulacion');
  if (!selector) return;

  selector.innerHTML = '<option value="">Cargando materias…</option>';
  const [{ data: materias, error: errorMaterias }, { data: postulaciones, error: errorPostulaciones }] = await Promise.all([
    db.from('materia').select('id_materia, nombre_materia').eq('estado_activo', true).order('nombre_materia'),
    db.from('v_postulaciones').select('id_materia, estado_autorizacion')
  ]);

  if (errorMaterias || errorPostulaciones) {
    selector.innerHTML = '<option value="">No fue posible cargar las materias</option>';
    mensajeCatalogo((errorMaterias || errorPostulaciones).message);
    return;
  }

  const solicitudesPorMateria = new Map(postulaciones.map(p => [String(p.id_materia), p.estado_autorizacion]));
  selector.innerHTML = '<option value="">-- Elige una asignatura activa --</option>';
  materias.forEach((materia) => {
    const estado = solicitudesPorMateria.get(String(materia.id_materia));
    const opcion = document.createElement('option');
    opcion.value = materia.id_materia;
    opcion.disabled = Boolean(estado);
    opcion.textContent = estado
      ? `${materia.nombre_materia} (solicitud ${estado.toLowerCase()})`
      : materia.nombre_materia;
    selector.appendChild(opcion);
  });

  if (!materias.length) {
    selector.innerHTML = '<option value="">No hay materias activas disponibles</option>';
  }
}

async function postular(evento) {
  if (evento) evento.preventDefault();
  limpiarMensajeCatalogo();
  const selector = document.getElementById('materia-postulacion');
  const boton = document.getElementById('btn-enviar-postulacion');
  const idMateria = Number(selector?.value);

  if (!idMateria) {
    mensajeCatalogo('Selecciona una materia activa antes de enviar la solicitud.');
    return;
  }
  if (!window.confirm('¿Confirmas que deseas enviar tu solicitud para asesorar esta materia?')) return;

  mostrarCargando(boton, true);
  const { error } = await db.rpc('postular_materia', { p_id_materia: idMateria });
  mostrarCargando(boton, false);

  if (error) {
    // Se conserva literalmente error.message para cumplir los mensajes de negocio.
    mensajeCatalogo(error.message);
    return;
  }

  mensajeCatalogo('Tu solicitud fue enviada y quedó pendiente de autorización.', 'success');
  await Promise.all([listarMisPostulaciones(), cargarMateriasParaPostular()]);
}

async function iniciarPostulacion() {
  const perfil = await iniciarPaginaProtegida();
  if (!perfil) return;
  if (!['Estudiante', 'Profesor'].includes(perfil.rol)) {
    window.location.replace('panel.html');
    return;
  }

  const formulario = document.getElementById('form-postulacion');
  formulario?.addEventListener('submit', postular);
  await Promise.all([cargarMateriasParaPostular(), listarMisPostulaciones()]);
}

async function cargarTablaDictamenes(estado, cuerpoId) {
  const cuerpo = document.getElementById(cuerpoId);
  if (!cuerpo) return;
  cuerpo.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>';

  let consulta = db.from('v_postulaciones')
    .select('id_asesor_materia, solicitante, rol_solicitante, nombre_materia, fecha_solicitud, fecha_dictamen, estado_autorizacion')
    .eq('estado_autorizacion', estado)
    .order('fecha_solicitud', { ascending: estado === 'Pendiente' });
  const { data, error } = await consulta;

  if (error) {
    cuerpo.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-rose-600">${escaparCatalogo(error.message)}</td></tr>`;
    return;
  }
  if (!data.length) {
    cuerpo.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">No hay postulaciones ${estado.toLowerCase()}s.</td></tr>`;
    return;
  }

  cuerpo.innerHTML = data.map(p => {
    const rol = p.rol_solicitante === 'Estudiante' ? 'Estudiante (tutor par)' : 'Profesor';
    const acciones = estado === 'Pendiente'
      ? `<div class="flex flex-wrap gap-2">
          <button type="button" data-dictaminar="aprobar" data-id="${p.id_asesor_materia}" class="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Aprobar</button>
          <button type="button" data-dictaminar="rechazar" data-id="${p.id_asesor_materia}" class="rounded bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">Rechazar</button>
        </div>`
      : `<span class="rounded border px-2 py-1 text-xs font-bold ${ESTILOS_ESTADO[estado]}">${estado}</span>`;
    return `<tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-medium text-slate-900">${escaparCatalogo(p.solicitante)}</td>
      <td class="px-4 py-3">${escaparCatalogo(rol)}</td>
      <td class="px-4 py-3">${escaparCatalogo(p.nombre_materia)}</td>
      <td class="px-4 py-3 text-slate-500">${fechaCatalogo(p.fecha_solicitud)}</td>
      <td class="px-4 py-3 text-slate-500">${fechaCatalogo(p.fecha_dictamen)}</td>
      <td class="px-4 py-3">${acciones}</td>
    </tr>`;
  }).join('');
}

async function listarPostulacionesPendientes() {
  await cargarTablaDictamenes('Pendiente', 'postulaciones-pendientes');
}

async function listarHistorialPostulaciones() {
  await Promise.all([
    cargarTablaDictamenes('Aprobada', 'postulaciones-aprobadas'),
    cargarTablaDictamenes('Rechazada', 'postulaciones-rechazadas')
  ]);
}

async function dictaminar(id, aprobar) {
  if (!aprobar && !window.confirm('¿Seguro que deseas rechazar esta postulación?')) return;
  const { error } = await db.rpc('dictaminar_postulacion', {
    p_id: Number(id),
    p_aprobar: Boolean(aprobar)
  });
  if (error) {
    mostrarError(error.message);
    return;
  }
  mostrarExito(aprobar ? 'Postulación aprobada y solicitante notificado.' : 'Postulación rechazada y solicitante notificado.');
  await Promise.all([listarPostulacionesPendientes(), listarHistorialPostulaciones()]);
}

async function iniciarAdminPostulaciones() {
  const perfil = await iniciarPaginaProtegida('Coordinador');
  if (!perfil) return;
  await Promise.all([listarPostulacionesPendientes(), listarHistorialPostulaciones()]);

  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-dictaminar]');
    if (!boton) return;
    dictaminar(boton.dataset.id, boton.dataset.dictaminar === 'aprobar');
  });
}
