/* =========================================================
   TutorConnect — js/notificaciones.js
   T21 · TC-25 · RF-011 · Campana, bandeja de avisos y panel.
   Requiere cargar antes js/supabase.js (db, ejecutar, mostrarError)
   y js/sesion.js (lo llama iniciarPaginaProtegida al terminar).

   Los avisos los genera la base de datos con notificar() en cada
   cambio de estado. No hay tiempo real: la campana se consulta al
   cargar cada página (alcance V3).

   En la cabecera la página puede traer <button id="btn-campana">.
   Si no lo trae, se crea antes de #avatar-iniciales, así las
   7 páginas protegidas tienen la campana sin tocar su HTML.
   ========================================================= */

const MAX_AVISOS = 20; // últimos avisos que muestra la bandeja

const CLASE_CAMPANA =
  'relative text-white hover:text-slate-300 transition';
const ICONO_CAMPANA =
  '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
  'd="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>';

let campanaLista = false; // evita conectar dos veces los eventos

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */

// Escapa texto de la base de datos antes de meterlo en HTML
function textoSeguro(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// «hace 5 min», «hace 2 h», «ayer», «hace 3 días» o la fecha
function fechaRelativa(fechaIso) {
  const fecha = new Date(fechaIso);
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);

  if (minutos < 1) return 'justo ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------------------------------------------------------
   contarNoLeidas()
   Regresa cuántos avisos sin leer tiene el usuario y pinta el
   contador rojo (oculto si es 0, «9+» si hay más de 9).
   La política notificaciones_propias ya filtra por usuario.
   --------------------------------------------------------- */
async function contarNoLeidas() {
  const { count, error } = await db
    .from('notificacion')
    .select('id_notificacion', { count: 'exact', head: true })
    .eq('leida', false);

  if (error) {
    mostrarError(error.message);
    return 0;
  }
  pintarContador(count ?? 0);
  return count ?? 0;
}

function pintarContador(total) {
  const badge = document.getElementById('campana-contador');
  const boton = document.getElementById('btn-campana');
  if (!badge || !boton) return;

  if (total > 0) {
    badge.textContent = total > 9 ? '9+' : String(total);
    badge.classList.remove('hidden');
    boton.setAttribute('aria-label', `Notificaciones: ${total} sin leer`);
  } else {
    badge.classList.add('hidden');
    boton.setAttribute('aria-label', 'Notificaciones');
  }
}

/* ---------------------------------------------------------
   listarAvisos(limite)
   Últimos avisos del usuario, del más reciente al más antiguo.
   --------------------------------------------------------- */
async function listarAvisos(limite = MAX_AVISOS) {
  const { data, error } = await db
    .from('notificacion')
    .select('id_notificacion, mensaje, leida, fecha')
    .order('fecha', { ascending: false })
    .limit(limite);

  if (error) {
    mostrarError(error.message);
    return [];
  }
  return data;
}

// HTML de una lista de avisos; los no leídos van resaltados
function htmlAvisos(avisos) {
  if (!avisos.length) {
    return '<li class="px-4 py-6 text-sm text-slate-500 text-center">No tienes avisos</li>';
  }
  return avisos.map((a) => `
    <li class="px-4 py-3 border-b border-slate-100 last:border-b-0 ${a.leida ? 'bg-white' : 'bg-blue-50'}">
      <div class="flex items-start gap-2">
        <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.leida ? 'bg-transparent' : 'bg-rose-500'}"></span>
        <div>
          <p class="text-sm ${a.leida ? 'text-slate-600' : 'text-slate-900 font-semibold'}">${textoSeguro(a.mensaje)}</p>
          <p class="text-xs text-slate-400 mt-0.5">${fechaRelativa(a.fecha)}</p>
        </div>
      </div>
    </li>`).join('');
}

/* ---------------------------------------------------------
   marcarLeidas()
   Marca como leídos todos los avisos del usuario y deja el
   contador en 0.
   --------------------------------------------------------- */
async function marcarLeidas() {
  const resultado = await ejecutar('marcar_notificaciones_leidas');
  // ejecutar() regresa null tanto si falla como si la función es VOID;
  // por eso se vuelve a contar en lugar de suponer que quedó en 0.
  await contarNoLeidas();
  return resultado;
}

/* ---------------------------------------------------------
   abrirBandeja()
   Muestra los últimos 20 avisos (desplegable en computadora,
   ventana completa en celular). Los no leídos se ven resaltados
   y, al abrir, se marcan como leídos.
   --------------------------------------------------------- */
async function abrirBandeja() {
  const bandeja = document.getElementById('bandeja-avisos');
  const lista = document.getElementById('bandeja-lista');
  if (!bandeja || !lista) return;

  lista.innerHTML =
    '<li class="px-4 py-6 text-sm text-slate-400 text-center">Cargando…</li>';
  bandeja.classList.remove('hidden');
  document.getElementById('btn-campana').setAttribute('aria-expanded', 'true');

  const avisos = await listarAvisos();
  lista.innerHTML = htmlAvisos(avisos); // se pintan antes de marcarlos

  if (avisos.some((a) => !a.leida)) {
    await marcarLeidas();
    pintarAvisosPanel(); // el panel también se actualiza
  }
}

function cerrarBandeja() {
  const bandeja = document.getElementById('bandeja-avisos');
  if (!bandeja || bandeja.classList.contains('hidden')) return;
  bandeja.classList.add('hidden');
  document.getElementById('btn-campana').setAttribute('aria-expanded', 'false');
}

/* ---------------------------------------------------------
   Construcción de la campana y la bandeja en la cabecera
   --------------------------------------------------------- */
function crearCampana() {
  let boton = document.getElementById('btn-campana');

  // Páginas cuya cabecera aún no trae la campana: se crea junto al avatar
  if (!boton) {
    const avatar = document.getElementById('avatar-iniciales');
    if (!avatar) return null; // página sin cabecera (index.html)
    boton = document.createElement('button');
    boton.id = 'btn-campana';
    boton.type = 'button';
    boton.className = CLASE_CAMPANA;
    boton.innerHTML = ICONO_CAMPANA;
    avatar.before(boton);
  }

  boton.type = 'button';
  boton.setAttribute('aria-haspopup', 'true');
  boton.setAttribute('aria-expanded', 'false');

  // El punto fijo del diseño se cambia por el contador con número
  document.getElementById('campana-punto')?.remove();
  if (!document.getElementById('campana-contador')) {
    const badge = document.createElement('span');
    badge.id = 'campana-contador';
    badge.className =
      'hidden absolute -top-1.5 -right-2 min-w-[1.25rem] h-5 px-1 rounded-full ' +
      'bg-rose-500 text-white text-[10px] font-bold leading-5 text-center ' +
      'ring-2 ring-[#1B396A]';
    boton.appendChild(badge);
  }

  // Bandeja: ventana completa en celular, desplegable desde md
  const contenedor = document.createElement('div');
  contenedor.className = 'relative';
  boton.before(contenedor);
  contenedor.appendChild(boton);

  const bandeja = document.createElement('div');
  bandeja.id = 'bandeja-avisos';
  bandeja.setAttribute('role', 'dialog');
  bandeja.setAttribute('aria-label', 'Bandeja de avisos');
  bandeja.className =
    'hidden fixed inset-0 z-50 bg-white text-slate-900 flex flex-col ' +
    'md:absolute md:inset-auto md:right-0 md:top-full md:mt-3 md:w-96 ' +
    'md:max-h-[28rem] md:rounded-xl md:border md:border-slate-200 md:shadow-xl';
  bandeja.innerHTML = `
    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
      <h2 class="text-base font-bold">Avisos</h2>
      <button type="button" id="bandeja-cerrar" aria-label="Cerrar"
              class="text-slate-500 hover:text-slate-900 text-2xl leading-none">&times;</button>
    </div>
    <ul id="bandeja-lista" class="flex-1 overflow-y-auto"></ul>`;
  contenedor.appendChild(bandeja);

  return boton;
}

function conectarEventos(boton) {
  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    const bandeja = document.getElementById('bandeja-avisos');
    if (bandeja.classList.contains('hidden')) abrirBandeja();
    else cerrarBandeja();
  });

  document.getElementById('bandeja-cerrar')
    .addEventListener('click', cerrarBandeja);

  // Clic fuera de la bandeja o tecla Esc la cierran
  document.addEventListener('click', (e) => {
    const bandeja = document.getElementById('bandeja-avisos');
    if (bandeja && !bandeja.contains(e.target)) cerrarBandeja();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarBandeja();
  });
}

/* ---------------------------------------------------------
   Tarjeta «Notificaciones» de panel.html
   Muestra los 5 avisos más recientes y el botón «Marcar leídas».
   --------------------------------------------------------- */
async function pintarAvisosPanel() {
  const lista = document.getElementById('lista-notificaciones');
  if (!lista) return; // solo existe en panel.html

  const avisos = await listarAvisos(5);
  lista.className = 'rounded-lg border border-slate-100 overflow-hidden';
  lista.innerHTML = htmlAvisos(avisos);

  const btn = document.getElementById('btn-marcar-leidas');
  if (btn) btn.classList.toggle('hidden', !avisos.some((a) => !a.leida));
}

function conectarPanel() {
  const btn = document.getElementById('btn-marcar-leidas');
  if (!btn) return;
  btn.setAttribute('role', 'button');
  btn.addEventListener('click', async () => {
    await marcarLeidas();
    await pintarAvisosPanel();
  });
}

/* ---------------------------------------------------------
   iniciarCampana()
   La llama iniciarPaginaProtegida() (js/sesion.js) cuando ya hay
   sesión, después de procesar_vencimientos(), para que los avisos
   de caducidad recién generados ya salgan en el contador.
   --------------------------------------------------------- */
async function iniciarCampana() {
  if (campanaLista) return contarNoLeidas();

  const boton = crearCampana();
  if (!boton) return 0;
  conectarEventos(boton);
  conectarPanel();
  campanaLista = true;

  const [total] = await Promise.all([contarNoLeidas(), pintarAvisosPanel()]);
  return total;
}
