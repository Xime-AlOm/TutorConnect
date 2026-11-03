// =============================================================
// js/supabase.js — TutorConnect
// Conexión única a Supabase y funciones de interfaz que usan
// todas las páginas (errores, éxito y botón "cargando").
// Requiere cargar ANTES la librería de Supabase:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// =============================================================

// 1. Datos del proyecto (Supabase → Project Settings → API).
//    Solo la clave pública "anon". La service_role NUNCA va aquí.
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY';

// 2. Cliente único que usa toda la aplicación.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Forma estándar de llamar funciones de la BD (cap. 12.5).
//    Si hay error, lo muestra en pantalla con su mensaje original
//    y regresa null. Si no, regresa lo que devolvió la función.
//    Nota: una función que no regresa nada (void) también da null;
//    en ese caso revisa si se mostró un error en pantalla.
async function ejecutar(nombre, parametros) {
  const { data, error } = await db.rpc(nombre, parametros);
  if (error) { mostrarError(error.message); return null; }
  return data;
}

// 4a. Muestra un error en la zona de error de la página (rojo y cerrable).
//     Usa <div id="zona-error"></div>; si la página no lo tiene, lo crea
//     al inicio del <main> (o del <body>).
function mostrarError(mensaje) {
  let zona = document.getElementById('zona-error');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'zona-error';
    const contenedor = document.querySelector('main') || document.body;
    contenedor.prepend(zona);
  }
  zona.innerHTML = `
    <div class="flex items-start justify-between gap-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
      <span></span>
      <button type="button" class="font-bold leading-none" aria-label="Cerrar">&times;</button>
    </div>`;
  zona.querySelector('span').textContent = mensaje; // textContent evita inyectar HTML
  zona.querySelector('button').onclick = () => (zona.innerHTML = '');
  zona.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 4b. Toast verde de 3 segundos en la esquina superior derecha (cap. 13.6).
function mostrarExito(mensaje) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded shadow-lg transition-opacity duration-300';
  toast.textContent = mensaje;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 4c. Pone un botón en modo "Procesando…" con spinner (activo = true)
//     o lo regresa a su texto original (activo = false).
function mostrarCargando(boton, activo) {
  if (!boton) return;
  if (activo) {
    boton.dataset.textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.classList.add('opacity-70', 'cursor-not-allowed');
    boton.innerHTML = `
      <span class="inline-flex items-center gap-2">
        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        Procesando…
      </span>`;
  } else {
    boton.disabled = false;
    boton.classList.remove('opacity-70', 'cursor-not-allowed');
    if (boton.dataset.textoOriginal) boton.innerHTML = boton.dataset.textoOriginal;
  }
}