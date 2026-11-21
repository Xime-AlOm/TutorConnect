// =====================================================================
// js/reportes.js · Reporte estadístico del coordinador (SCR-007 · TC-26)
// Requiere: js/supabase.js (db, ejecutar, mostrarError, mostrarCargando)
// =====================================================================

// ---------------------------------------------------------------------
// Utilidades de fechas y formato
// ---------------------------------------------------------------------
function fechaLocalISO(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function obtenerRangoRapido(tipo) {
  const hoy = new Date();
  const hoyISO = fechaLocalISO(hoy);

  if (tipo === 'semana') {
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes ... 6 = sábado
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diffLunes);
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
    return { desde: fechaLocalISO(lunes), hasta: fechaLocalISO(domingo) };
  }

  if (tipo === 'mes') {
    const primeroMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return { desde: fechaLocalISO(primeroMes), hasta: fechaLocalISO(ultimoMes) };
  }

  // «Todo el semestre» cubre de inicio a fin del semestre (incluye citas futuras agendadas)
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth(); // 0-indexed (7 = agosto)
  if (mes >= 7) {
    return { desde: `${anio}-08-01`, hasta: `${anio}-12-31`, hoy: hoyISO };
  }
  return { desde: `${anio}-01-15`, hasta: `${anio}-07-31`, hoy: hoyISO };
}

function formatearEstrellas(promedio) {
  if (promedio === null || promedio === undefined || Number.isNaN(Number(promedio))) {
    return { estrellas: '', texto: '—' };
  }
  const valor = Number(promedio);
  const llenas = Math.max(0, Math.min(5, Math.round(valor)));
  const estrellas = '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  return { estrellas, texto: valor.toFixed(2) };
}

function calcularTasaRealizacion(realizadas, solicitadas) {
  if (!solicitadas || solicitadas <= 0) return '0.0%';
  return `${((realizadas / solicitadas) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------
// calcularTotales(filas): calcula la fila final de totales en JavaScript
// ---------------------------------------------------------------------
function calcularTotales(filas = []) {
  const totales = {
    solicitadas: 0,
    realizadas: 0,
    no_realizadas: 0,
    canceladas: 0,
    caducadas: 0,
    tasa_realizacion: '0.0%',
    promedio: null,
    materia_top: null,
  };

  if (!Array.isArray(filas) || filas.length === 0) {
    return totales;
  }

  let sumaPromedios = 0;
  let materiasConCalif = 0;

  filas.forEach((f) => {
    const sol = Number(f.solicitadas || 0);
    const real = Number(f.realizadas || 0);
    const noReal = Number(f.no_realizadas || 0);
    const canc = Number(f.canceladas || 0);
    const cad = Number(f.caducadas || 0);

    totales.solicitadas += sol;
    totales.realizadas += real;
    totales.no_realizadas += noReal;
    totales.canceladas += canc;
    totales.caducadas += cad;

    if (f.promedio !== null && f.promedio !== undefined) {
      sumaPromedios += Number(f.promedio);
      materiasConCalif += 1;
    }

    if (!totales.materia_top || sol > Number(totales.materia_top.solicitadas || 0)) {
      totales.materia_top = f;
    }
  });

  totales.tasa_realizacion = calcularTasaRealizacion(totales.realizadas, totales.solicitadas);
  totales.promedio = materiasConCalif > 0
    ? Number((sumaPromedios / materiasConCalif).toFixed(2))
    : null;

  return totales;
}

// ---------------------------------------------------------------------
// Control de estados visuales (Skeleton / Vacío / Contenido)
// ---------------------------------------------------------------------
function mostrarEstadoReporte(estado) {
  const skeleton = document.getElementById('reporte-skeleton');
  const vacio = document.getElementById('reporte-vacio');
  const contenido = document.getElementById('reporte-contenido');

  if (skeleton) skeleton.classList.toggle('hidden', estado !== 'cargando');
  if (vacio) vacio.classList.toggle('hidden', estado !== 'vacio');
  if (contenido) contenido.classList.toggle('hidden', estado !== 'datos');
}

// ---------------------------------------------------------------------
// Renderizado de tarjetas y tabla
// ---------------------------------------------------------------------
function pintarTarjetasReporte(totales) {
  document.getElementById('kpi-solicitadas').textContent = totales.solicitadas;
  document.getElementById('kpi-realizadas').textContent = totales.realizadas;
  document.getElementById('kpi-tasa-total').textContent = `(${totales.tasa_realizacion})`;
  document.getElementById('kpi-no-realizadas').textContent = totales.no_realizadas;
  document.getElementById('kpi-canceladas').textContent = totales.canceladas;

  const topMateriaEl = document.getElementById('kpi-top-materia');
  const topDetalleEl = document.getElementById('kpi-top-materia-detalle');
  if (totales.materia_top) {
    topMateriaEl.textContent = totales.materia_top.materia;
    topDetalleEl.textContent = `${totales.materia_top.solicitadas} solicitud(es)`;
  } else {
    topMateriaEl.textContent = '—';
    topDetalleEl.textContent = '';
  }

  const { estrellas, texto } = formatearEstrellas(totales.promedio);
  document.getElementById('kpi-promedio').textContent = texto;
  document.getElementById('kpi-estrellas').textContent = estrellas;
}

function pintarTablaReporte(filas, totales) {
  const tbody = document.getElementById('tabla-reporte-materias');
  const tfoot = document.getElementById('tabla-reporte-totales');
  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  filas.forEach((f) => {
    const sol = Number(f.solicitadas || 0);
    const real = Number(f.realizadas || 0);
    const noReal = Number(f.no_realizadas || 0);
    const canc = Number(f.canceladas || 0);
    const cad = Number(f.caducadas || 0);
    const tasa = calcularTasaRealizacion(real, sol);
    const calif = formatearEstrellas(f.promedio);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    const tdMateria = document.createElement('td');
    tdMateria.className = 'px-4 py-3 font-semibold text-slate-900';
    tdMateria.textContent = f.materia;

    const tdSol = document.createElement('td');
    tdSol.className = 'px-4 py-3 text-right font-semibold';
    tdSol.textContent = sol;

    const tdReal = document.createElement('td');
    tdReal.className = 'px-4 py-3 text-right text-emerald-700 font-semibold';
    tdReal.textContent = real;

    const tdTasa = document.createElement('td');
    tdTasa.className = 'px-4 py-3 text-right';
    const badgeTasa = document.createElement('span');
    badgeTasa.className = 'px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700';
    badgeTasa.textContent = tasa;
    tdTasa.appendChild(badgeTasa);

    const tdNoReal = document.createElement('td');
    tdNoReal.className = 'px-4 py-3 text-right text-amber-700';
    tdNoReal.textContent = noReal;

    const tdCanc = document.createElement('td');
    tdCanc.className = 'px-4 py-3 text-right text-rose-700';
    tdCanc.textContent = canc;

    const tdCad = document.createElement('td');
    tdCad.className = 'px-4 py-3 text-right text-slate-500';
    tdCad.textContent = cad;

    const tdProm = document.createElement('td');
    tdProm.className = 'px-4 py-3';
    if (calif.texto === '—') {
      tdProm.textContent = '—';
      tdProm.className += ' text-slate-400';
    } else {
      const spanEst = document.createElement('span');
      spanEst.className = 'text-amber-500 mr-1.5';
      spanEst.textContent = calif.estrellas;
      const spanNum = document.createElement('span');
      spanNum.className = 'font-semibold text-slate-800';
      spanNum.textContent = calif.texto;
      tdProm.append(spanEst, spanNum);
    }

    tr.append(tdMateria, tdSol, tdReal, tdTasa, tdNoReal, tdCanc, tdCad, tdProm);
    tbody.appendChild(tr);
  });

  // Fila final de totales calculada en JS
  const trTotal = document.createElement('tr');
  const califTotal = formatearEstrellas(totales.promedio);

  const celdas = [
    { texto: 'Total del periodo', clase: 'px-4 py-3 text-slate-900' },
    { texto: String(totales.solicitadas), clase: 'px-4 py-3 text-right' },
    { texto: String(totales.realizadas), clase: 'px-4 py-3 text-right text-emerald-700' },
    { texto: totales.tasa_realizacion, clase: 'px-4 py-3 text-right text-emerald-700' },
    { texto: String(totales.no_realizadas), clase: 'px-4 py-3 text-right text-amber-700' },
    { texto: String(totales.canceladas), clase: 'px-4 py-3 text-right text-rose-700' },
    { texto: String(totales.caducadas), clase: 'px-4 py-3 text-right text-slate-600' },
  ];

  celdas.forEach((c) => {
    const td = document.createElement('td');
    td.className = c.clase;
    td.textContent = c.texto;
    trTotal.appendChild(td);
  });

  const tdTotalProm = document.createElement('td');
  tdTotalProm.className = 'px-4 py-3';
  if (califTotal.texto === '—') {
    tdTotalProm.textContent = '—';
  } else {
    const sEst = document.createElement('span');
    sEst.className = 'text-amber-500 mr-1.5';
    sEst.textContent = califTotal.estrellas;
    const sNum = document.createElement('span');
    sNum.textContent = califTotal.texto;
    tdTotalProm.append(sEst, sNum);
  }
  trTotal.appendChild(tdTotalProm);
  tfoot.appendChild(trTotal);
}

// ---------------------------------------------------------------------
// generarReporte(desde, hasta): valida fechas y llama a reporte_materias
// ---------------------------------------------------------------------
async function generarReporte(desde, hasta) {
  if (!desde || !hasta) {
    mostrarError('Selecciona las fechas Desde y Hasta para generar el reporte.');
    return null;
  }

  if (desde > hasta) {
    mostrarError('La fecha «Desde» no puede ser mayor que la fecha «Hasta».');
    return null;
  }

  const zonaError = document.getElementById('zona-error');
  if (zonaError) zonaError.classList.add('hidden');

  const btn = document.getElementById('btn-generar-reporte');
  mostrarCargando(btn, true);
  mostrarEstadoReporte('cargando');

  try {
    const filas = await ejecutar('reporte_materias', {
      p_desde: desde,
      p_hasta: hasta,
    });

    // Si ejecutar() falló (ej. rol no autorizado), ya mostró error.message
    if (filas === null) {
      mostrarEstadoReporte('ninguno');
      return null;
    }

    document.getElementById('reporte-rango-texto').textContent =
      `Mostrando estadísticas del ${desde} al ${hasta}.`;

    if (filas.length === 0) {
      mostrarEstadoReporte('vacio');
      return [];
    }

    const totales = calcularTotales(filas);
    pintarTarjetasReporte(totales);
    pintarTablaReporte(filas, totales);
    mostrarEstadoReporte('datos');
    return filas;
  } finally {
    mostrarCargando(btn, false);
  }
}

// ---------------------------------------------------------------------
// Opcional: cargar promedio acumulado por asesor desde v_promedio_asesor
// ---------------------------------------------------------------------
async function cargarPromedioAsesores() {
  const bloque = document.getElementById('bloque-promedio-asesores');
  const tbody = document.getElementById('tabla-promedio-asesores');
  if (!bloque || !tbody) return;

  const { data: promedios, error } = await db
    .from('v_promedio_asesor')
    .select('id_asesor, promedio, num_evaluaciones')
    .order('promedio', { ascending: false });

  if (error || !promedios || promedios.length === 0) {
    bloque.classList.add('hidden');
    return;
  }

  const ids = promedios.map((p) => p.id_asesor);
  const { data: usuarios } = await db
    .from('usuario')
    .select('id_usuario, nombre_completo, rol')
    .in('id_usuario', ids);

  const mapaUsuarios = new Map((usuarios || []).map((u) => [u.id_usuario, u]));
  tbody.innerHTML = '';

  promedios.forEach((p) => {
    const u = mapaUsuarios.get(p.id_asesor);
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    const tdNombre = document.createElement('td');
    tdNombre.className = 'px-4 py-2.5 font-semibold text-slate-900';
    tdNombre.textContent = u ? u.nombre_completo : 'Asesor';

    const tdRol = document.createElement('td');
    tdRol.className = 'px-4 py-2.5 text-xs';
    tdRol.textContent = u && u.rol === 'Estudiante' ? 'Tutor par' : 'Profesor';

    const tdNum = document.createElement('td');
    tdNum.className = 'px-4 py-2.5 text-right';
    tdNum.textContent = p.num_evaluaciones;

    const tdCalif = document.createElement('td');
    tdCalif.className = 'px-4 py-2.5';
    const { estrellas } = formatearEstrellas(p.promedio);
    const sEst = document.createElement('span');
    sEst.className = 'text-amber-500 mr-1.5';
    sEst.textContent = estrellas;
    const sNum = document.createElement('span');
    sNum.className = 'font-semibold text-slate-800';
    sNum.textContent = Number(p.promedio).toFixed(1);
    tdCalif.append(sEst, sNum);

    tr.append(tdNombre, tdRol, tdNum, tdCalif);
    tbody.appendChild(tr);
  });

  bloque.classList.remove('hidden');
}

// ---------------------------------------------------------------------
// Arranque desde admin.html
// ---------------------------------------------------------------------
async function iniciarReportes() {
  const inputDesde = document.getElementById('reporte-desde');
  const inputHasta = document.getElementById('reporte-hasta');
  const btnGenerar = document.getElementById('btn-generar-reporte');
  const botonesRapidos = document.querySelectorAll('.btn-rapido-periodo');

  const marcarBotonActivo = (tipoActivo) => {
    botonesRapidos.forEach((btn) => {
      const activo = btn.dataset.periodo === tipoActivo;
      btn.className = activo
        ? 'btn-rapido-periodo px-3 py-2 border border-[#1B396A] bg-slate-100 text-[#1B396A] rounded-lg text-xs font-bold transition'
        : 'btn-rapido-periodo px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition';
    });
  };

  botonesRapidos.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tipo = btn.dataset.periodo;
      const { desde, hasta } = obtenerRangoRapido(tipo);
      inputDesde.value = desde;
      inputHasta.value = hasta;
      marcarBotonActivo(tipo);
      generarReporte(desde, hasta);
    });
  });

  btnGenerar.addEventListener('click', () => {
    marcarBotonActivo('');
    generarReporte(inputDesde.value, inputHasta.value);
  });

  // Carga inicial por defecto: inicio del semestre a hoy
  const semestre = obtenerRangoRapido('semestre');
  inputDesde.value = semestre.desde;
  inputHasta.value = semestre.hoy;
  marcarBotonActivo('');

  await generarReporte(semestre.desde, semestre.hoy);
  await cargarPromedioAsesores();
}