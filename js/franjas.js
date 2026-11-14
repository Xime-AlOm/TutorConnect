/* TutorConnect - agenda del asesor: solo materias con dictamen Aprobado. */

function textoSeguroFranja(valor) {
  const nodo = document.createElement('span');
  nodo.textContent = valor ?? '';
  return nodo.innerHTML;
}

function mostrarModalPublicar() {
  document.getElementById('modal-publicar')?.classList.remove('hidden');
}

function cerrarModalPublicar() {
  document.getElementById('modal-publicar')?.classList.add('hidden');
}

async function cargarMateriasAutorizadas() {
  const selector = document.getElementById('franja-materia');
  const { data, error } = await db
    .from('v_postulaciones')
    .select('id_materia, nombre_materia')
    .eq('estado_autorizacion', 'Aprobada')
    .order('nombre_materia');

  if (error) {
    mostrarError(error.message);
    return [];
  }

  const unicas = [...new Map(data.map(m => [m.id_materia, m])).values()];
  selector.innerHTML = '<option value="">Selecciona una materia autorizada</option>';
  unicas.forEach(materia => {
    const opcion = document.createElement('option');
    opcion.value = materia.id_materia;
    opcion.textContent = materia.nombre_materia;
    selector.appendChild(opcion);
  });
  return unicas;
}

async function listarMisFranjas() {
  const cuerpo = document.getElementById('mis-franjas');
  const { data, error } = await db
    .from('v_mi_agenda')
    .select('fecha, hora_inicio, nombre_materia, modalidad, ubicacion_presencial, estado_franja')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    mostrarError(error.message);
    return;
  }
  if (!data.length) {
    cuerpo.innerHTML = '<tr><td colspan="5" class="px-5 py-6 text-center text-slate-500">Todavía no has publicado horarios.</td></tr>';
    return;
  }

  cuerpo.innerHTML = data.map(f => {
    const hora = f.hora_inicio.slice(0, 5);
    const [h, m] = hora.split(':').map(Number);
    const fin = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `<tr class="hover:bg-slate-50">
      <td class="px-5 py-4">${textoSeguroFranja(f.fecha)}</td>
      <td class="px-5 py-4">${hora} - ${fin}</td>
      <td class="px-5 py-4 font-semibold text-slate-900">${textoSeguroFranja(f.nombre_materia)}</td>
      <td class="px-5 py-4">${textoSeguroFranja(f.modalidad)}${f.ubicacion_presencial ? ` · ${textoSeguroFranja(f.ubicacion_presencial)}` : ''}</td>
      <td class="px-5 py-4">${textoSeguroFranja(f.estado_franja)}</td>
    </tr>`;
  }).join('');
}

async function publicarNuevaFranja(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const boton = document.getElementById('btn-guardar-franja');
  const idMateria = Number(document.getElementById('franja-materia').value);
  const fecha = document.getElementById('franja-fecha').value;
  const hora = document.getElementById('franja-hora').value;
  const modalidad = document.getElementById('franja-modalidad').value;
  const ubicacion = document.getElementById('franja-ubicacion').value.trim();

  if (!idMateria) {
    mostrarError('Selecciona una materia autorizada.');
    return;
  }
  mostrarCargando(boton, true);
  const { error } = await db.rpc('publicar_franja', {
    p_id_materia: idMateria,
    p_fecha: fecha,
    p_hora: hora,
    p_modalidad: modalidad,
    p_ubicacion: modalidad === 'Presencial' ? ubicacion : null
  });
  mostrarCargando(boton, false);

  if (error) {
    mostrarError(error.message);
    return;
  }
  mostrarExito('Disponibilidad publicada correctamente.');
  formulario.reset();
  cerrarModalPublicar();
  await listarMisFranjas();
}

async function iniciarAgenda() {
  const perfil = await iniciarPaginaProtegida();
  if (!perfil) return;
  if (!['Estudiante', 'Profesor'].includes(perfil.rol) || !(await esAsesorAprobado())) {
    window.location.replace('panel.html');
    return;
  }

  const materias = await cargarMateriasAutorizadas();
  if (!materias.length) {
    window.location.replace('panel.html');
    return;
  }
  document.getElementById('form-publicar-franja')?.addEventListener('submit', publicarNuevaFranja);
  document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrarModalPublicar);
  document.getElementById('franja-modalidad')?.addEventListener('change', (evento) => {
    document.getElementById('grupo-ubicacion').classList.toggle('hidden', evento.target.value !== 'Presencial');
  });
  await listarMisFranjas();
}

document.addEventListener('DOMContentLoaded', iniciarAgenda);
