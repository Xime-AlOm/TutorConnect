/* =========================================================
   TutorConnect — js/supabase.js
   Conexión única con Supabase y funciones de interfaz
   que reutilizan todas las páginas.
   Requiere cargar antes el CDN de Supabase:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ========================================================= */

// 1. Datos del proyecto (Supabase > Project Settings > API).
//    Solo la clave pública "anon". La service_role NUNCA va aquí.
const SUPABASE_URL = 'https://vdeksifprzazbsohniga.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y6fiMx-jISNovoNzQiOVnA_LoX3WkcL';

// 2. Cliente único que usan todas las páginas.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------------------------------------------------
   ejecutar(nombre, parametros)
   Llama una función de la base de datos (RPC).
   Si falla, muestra el mensaje original y regresa null.
   Si sale bien, regresa los datos.
   --------------------------------------------------------- */
async function ejecutar(nombre, parametros = {}) {
  const { data, error } = await db.rpc(nombre, parametros);
  if (error) {
    mostrarError(error.message);
    return null;
  }
  return data;
}

/* ---------------------------------------------------------
   mostrarError(mensaje)
   Muestra el error en la zona roja de la página.
   Usa <div id="zona-error"></div> si existe; si no, la crea
   al inicio del <main> (o del <body>). Se puede cerrar con la ×.
   --------------------------------------------------------- */
function mostrarError(mensaje) {
  let zona = document.getElementById('zona-error');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'zona-error';
    const destino = document.querySelector('main') || document.body;
    destino.prepend(zona);
  }

  zona.className =
    'flex items-start justify-between gap-3 bg-red-50 border border-red-300 ' +
    'text-red-700 rounded-lg p-3 my-3 text-sm';
  zona.innerHTML = '';

  const texto = document.createElement('span');
  texto.textContent = mensaje; // textContent evita inyectar HTML

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.textContent = '×';
  cerrar.setAttribute('aria-label', 'Cerrar');
  cerrar.className = 'text-red-700 font-bold text-lg leading-none';
  cerrar.onclick = () => zona.classList.add('hidden');

  zona.append(texto, cerrar);
  zona.classList.remove('hidden');
}

/* ---------------------------------------------------------
   mostrarExito(mensaje)
   Toast verde en la esquina superior derecha por 3 segundos.
   --------------------------------------------------------- */
function mostrarExito(mensaje) {
  const toast = document.createElement('div');
  toast.textContent = mensaje;
  toast.className =
    'fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 ' +
    'rounded-lg shadow-lg text-sm';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ---------------------------------------------------------
   mostrarCargando(boton, activo)
   activo = true  → deshabilita el botón y pone «Procesando…» con spinner.
   activo = false → regresa el botón a como estaba.
   --------------------------------------------------------- */
function mostrarCargando(boton, activo) {
  if (!boton) return;

  if (activo) {
    boton.dataset.textoOriginal = boton.innerHTML; // guarda el texto
    boton.disabled = true;
    boton.classList.add('opacity-60', 'cursor-not-allowed');
    boton.innerHTML =
      '<span class="inline-block w-4 h-4 mr-2 align-middle border-2 ' +
      'border-current border-t-transparent rounded-full animate-spin"></span>' +
      'Procesando…';
  } else {
    boton.disabled = false;
    boton.classList.remove('opacity-60', 'cursor-not-allowed');
    if (boton.dataset.textoOriginal) {
      boton.innerHTML = boton.dataset.textoOriginal;
    }
  }
}
