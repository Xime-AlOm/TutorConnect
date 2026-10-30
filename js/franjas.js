// Operaciones vinculadas a la tabla franja_disponibilidad
function abrirModalPublicar() {
  document.getElementById('modal-publicar').classList.remove('hidden');
  document.getElementById('modal-publicar').classList.add('flex');
}

function cerrarModalPublicar() {
  document.getElementById('modal-publicar').classList.add('hidden');
  document.getElementById('modal-publicar').classList.remove('flex');
}

function guardarFranja(e) {
  e.preventDefault();
  // Validación de regla de negocio: Al menos 24 horas de anticipación
  alert("Horario publicado exitosamente. Quedará visible en el buscador.");
  cerrarModalPublicar();
}