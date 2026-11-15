
/* T15b. Requiere supabase.js, sesion.js y t15bSesionLista.
 * T15a: #grid-resultados, botones [data-id-franja], window.recargarBusqueda().
 * La reserva, el congelamiento y la notificación los hace la RPC, nunca el cliente.
 */
(() => {
  'use strict';
  const EXITO = 'Solicitud enviada. El asesor tiene hasta 24 h antes de la cita para responder.';
  const RESERVADO = 'Este horario ya fue reservado.';
  const modal = document.getElementById('modal-solicitar');
  let franja = null;
  let enviando = false;
  let version = 0;
  const porId = id => document.getElementById(id);
  const mensaje = error => error?.message || 'No fue posible conectar. Intenta nuevamente.';
  const fecha = valor => String(valor || '').split('-').reverse().join('/');
  const hora = valor => String(valor || '').slice(0, 5);

  function detalle(destino, etiqueta, valor) {
    const fila = document.createElement('div');
    const titulo = document.createElement('dt');
    titulo.className = 'font-semibold';
    titulo.textContent = etiqueta;
    const texto = document.createElement('dd');
    texto.textContent = valor || '—';
    fila.append(titulo, texto);
    destino.append(fila);
  }
  async function recargar() {
    try {
      if (typeof window.recargarBusqueda === 'function') await window.recargarBusqueda();
    } catch (_) {
      mostrarError('No se pudo actualizar la búsqueda. Recarga la página.');
    }
  }
  function errorModal(texto) {
    porId('solicitud-error').textContent = texto;
    porId('solicitud-error').hidden = false;
  }
  function cerrar() {
    if (enviando) return;
    version++;
    franja = null;
    modal.close();
  }

  window.solicitarAsesoria = async function solicitarAsesoria(idFranja) {
    if (!modal || enviando) return;
    const id = String(idFranja);
    if (!/^[1-9]\d*$/.test(id)) {
      mostrarError('El identificador del horario no es válido.');
      return;
    }
    const turno = ++version;
    try {
      const usuario = await window.t15bSesionLista;
      if (turno !== version || !usuario) return;
      if (usuario.rol !== 'Estudiante') {
        mostrarError('Solo los estudiantes pueden solicitar asesorías.');
        return;
      }
      franja = null;
      porId('solicitud-resumen').replaceChildren();
      porId('solicitud-error').hidden = true;
      porId('solicitud-aviso').hidden = true;
      porId('solicitud-cargando').hidden = false;
      porId('solicitud-confirmar').disabled = true;
      if (!modal.open) modal.showModal();
      const { data, error } = await db.from('v_franjas_disponibles')
        .select('*').eq('id_disponibilidad', id).maybeSingle();
      if (turno !== version) return;
      if (error) throw error;
      if (!data) {
        cerrar();
        mostrarError('Este horario ya no está disponible.');
        await recargar();
        return;
      }
      franja = data;
      const resumen = porId('solicitud-resumen');
      detalle(resumen, 'Asesor', data.asesor);
      detalle(resumen, 'Materia', data.nombre_materia);
      detalle(resumen, 'Fecha', fecha(data.fecha));
      detalle(resumen, 'Hora (Pachuca)', hora(data.hora_inicio));
      detalle(resumen, 'Modalidad', data.modalidad);
      detalle(resumen, 'Ubicación', data.modalidad === 'Virtual' ? 'Sesión virtual' : data.ubicacion_presencial);
      porId('solicitud-aviso').hidden = data.modalidad !== 'Virtual';
      porId('solicitud-confirmar').disabled = false;
    } catch (error) {
      if (turno === version) {
        if (modal.open) errorModal(mensaje(error));
        else mostrarError(mensaje(error));
      }
    } finally {
      if (turno === version) porId('solicitud-cargando').hidden = true;
    }
  };

  async function confirmar() {
    if (enviando || !franja) return;
    enviando = true;
    const boton = porId('solicitud-confirmar');
    boton.disabled = true;
    boton.textContent = 'Procesando…';
    porId('solicitud-cancelar').disabled = true;
    porId('solicitud-error').hidden = true;
    modal.setAttribute('aria-busy', 'true');
    let exito = false;
    try {
      const idSolicitud = await ejecutar('solicitar_asesoria', {
        p_id_disponibilidad: franja.id_disponibilidad
      }, { propagarError: true });
      if (idSolicitud == null) throw new Error('No se recibió la confirmación. Revisa Mis solicitudes antes de volver a intentar.');
      exito = true;
      modal.close();
      mostrarExito(EXITO);
      // Una falla del almacenamiento no debe convertir una reserva exitosa en error.
      try { sessionStorage.setItem('t15b-exito', EXITO); } catch (_) { /* opcional */ }
      setTimeout(() => window.location.assign('solicitudes.html'), 1400);
    } catch (error) {
      if (mensaje(error) === RESERVADO) {
        franja = null;
        modal.close();
        mostrarError(RESERVADO);
        await recargar();
      } else {
        errorModal(mensaje(error));
      }
    } finally {
      if (!exito) {
        enviando = false;
        boton.disabled = !franja;
        boton.textContent = 'Confirmar solicitud';
        porId('solicitud-cancelar').disabled = false;
        modal.removeAttribute('aria-busy');
      }
    }
  }
  if (modal) {
    porId('solicitud-confirmar').addEventListener('click', confirmar);
    porId('solicitud-cancelar').addEventListener('click', cerrar);
    modal.addEventListener('cancel', event => {
      event.preventDefault();
      cerrar();
    });
    porId('grid-resultados')?.addEventListener('click', event => {
      const boton = event.target.closest('[data-id-franja]');
      if (!boton || boton.disabled) return;
      event.preventDefault();
      window.solicitarAsesoria(boton.dataset.idFranja);
    });
  }

  async function cargarMisCitas() {
    const lista = porId('t15b-mis-citas');
    if (!lista) return;
    try {
      if (!await window.t15bSesionLista) return;
      const { data, error } = await db.from('v_mis_citas').select('*')
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      lista.replaceChildren();
      if (!data?.length) lista.textContent = 'Todavía no tienes solicitudes.';
      for (const cita of data || []) {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'bg-white border rounded-xl p-5 shadow-sm';
        const titulo = document.createElement('h2');
        titulo.className = 'font-bold text-lg';
        titulo.textContent = cita.nombre_materia;
        tarjeta.append(titulo);
        const datos = document.createElement('dl');
        datos.className = 'grid gap-3 sm:grid-cols-3 text-sm mt-3';
        detalle(datos, 'Solicitud', String(cita.id_solicitud_asesoria));
        detalle(datos, 'Estado', cita.estado_mostrado || cita.estado);
        detalle(datos, 'Asesor', cita.asesor);
        detalle(datos, 'Estudiante', cita.estudiante);
        detalle(datos, 'Fecha y hora (Pachuca)', `${fecha(cita.fecha)} ${hora(cita.hora_inicio)}`);
        detalle(datos, 'Modalidad', cita.modalidad);
        tarjeta.append(datos);
        lista.append(tarjeta);
      }
      try {
        if (sessionStorage.getItem('t15b-exito') === EXITO) {
          sessionStorage.removeItem('t15b-exito');
          mostrarExito(EXITO);
        }
      } catch (_) { /* opcional */ }
    } catch (error) {
      lista.textContent = 'No se pudieron cargar las solicitudes. Recarga para intentar otra vez.';
      mostrarError(mensaje(error));
    }
  }
  cargarMisCitas();
})();
