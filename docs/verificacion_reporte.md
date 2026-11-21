# Verificación del Reporte de Coordinador (TC-26 · RF-012)

- **Periodo evaluado:** `2026-08-01` al `2026-11-20` (Semestre agosto – diciembre 2026)
- **Función verificada:** `reporte_materias(p_desde, p_hasta)` vs. consulta SQL directa sobre `solicitud_asesoria`, `franja_disponibilidad`, `materia` y `evaluacion`.

## 1. Consulta SQL directa utilizada

```sql
SELECT
  m.nombre_materia AS materia,
  COUNT(s.id_solicitud_asesoria) AS solicitadas,
  COUNT(*) FILTER (WHERE s.estado = 'Realizada') AS realizadas,
  COUNT(*) FILTER (WHERE s.estado IN ('No realizada', 'Sin registro')) AS no_realizadas,
  COUNT(*) FILTER (WHERE s.estado = 'Cancelada') AS canceladas,
  COUNT(*) FILTER (WHERE s.estado IN ('Caducada', 'Rechazada')) AS caducadas,
  ROUND(AVG(e.puntuacion), 2) AS promedio
FROM public.solicitud_asesoria s
JOIN public.franja_disponibilidad f ON f.id_disponibilidad = s.id_disponibilidad
JOIN public.materia m ON m.id_materia = f.id_materia
LEFT JOIN public.evaluacion e ON e.id_solicitud_asesoria = s.id_solicitud_asesoria
WHERE f.fecha BETWEEN DATE '2026-08-01' AND CURRENT_DATE
GROUP BY m.nombre_materia
ORDER BY solicitadas DESC;