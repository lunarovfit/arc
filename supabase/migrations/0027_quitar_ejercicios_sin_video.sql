-- ARC · fuera los ejercicios sin vídeo que Luna no va a grabar (en el historial y rutinas se ven como su sustituto)
-- Se quedan los pesos muertos (vídeos pendientes) y el press banca con barra (cuenta para el nivel de fuerza).
delete from public.content_exercises where id in ('ARC-003','ARC-005','ARC-008','ARC-010','ARC-024','ARC-025','ARC-031','ARC-032','ARC-033','ARC-034','ARC-035','ARC-038','ARC-039','ARC-040','ARC-044','ARC-045','ARC-046','ARC-047','ARC-048','ARC-056','ARC-061','ARC-062','ARC-063','ARC-064','ARC-066','ARC-068','ARC-074','ARC-X05');
-- Nota del ejercicio de dominadas actualizada
update public.content_exercises set note = 'No te preocupes si aún no te sale: abajo tienes sus variantes (chin up y con banda elástica) para ir llegando.' where id = 'ARC-007';
