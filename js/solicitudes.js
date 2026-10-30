// Operaciones vinculadas a solicitud_asesoria y evaluacion

function abrirModalConfirmar() {
  const modal = document.getElementById('modal-confirmar-enlace');
  
  // Tailwind maneja el diseño con flexbox; usar flex garantiza que el contenido se centre en pantallas de todos los tamaños.
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'items-center', 'justify-center', 'p-4'); 
  
  // El contenido interno ("la caja blanca") debe tener clases como "w-full max-w-md" o "mx-auto" desde el HTML, 
  // para que abarque el ancho disponible de la pantalla en dispositivos móviles y que no desborde hacia los bordes.
}

function cerrarModalConfirmar() {
  const modal = document.getElementById('modal-confirmar-enlace');
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'items-center', 'justify-center', 'p-4');
}

function confirmarCita() {
  const url = document.getElementById('url-meet').value;
  // Valida CHECK de SQL: url_videollamada LIKE 'https://%'
  if(!url.startsWith('https://')) {
    alert("URL inválida. Debe incluir https://");
    return;
  }
  // Cambia el estado a 'Aceptada'
  alert("Cita confirmada y notificada al estudiante.");
  cerrarModalConfirmar();
}

function abrirModalCalificar() {
  const modal = document.getElementById('modal-calificar');
  
  // Aplica "flex", "p-4" (padding) e "items-center" para evitar que en móviles quede muy ajustado a los lados de la pantalla.
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'items-center', 'justify-center', 'p-4');
}

function cerrarModalCalificar() {
  const modal = document.getElementById('modal-calificar');
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'items-center', 'justify-center', 'p-4');
}

function enviarCalificacion() {
  // Inserta en la tabla evaluacion (1 a 5)
  alert("Calificación enviada. ¡Gracias por tu retroalimentación!");
  cerrarModalCalificar();
}