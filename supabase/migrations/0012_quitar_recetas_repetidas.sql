-- =====================================================================
-- ARC by Lunarovx · quita recetas que se repetían con los platos nuevos de Luna
-- No se borran: se desactivan (puedes volver a activarlas en Editar contenido).
-- =====================================================================
update public.content_recipes set active = false where id in (
  'r003', -- Tortitas de avena con arándanos      → Crepe proteica de frutos rojos
  'r005', -- Pre-entreno exprés                   → Plátano y dátiles antes de entrenar
  'r011', -- Yogur proteico con plátano y frutos secos → Bol de yogur frutos del bosque
  'r012', -- Tortitas de arroz con jamón          → Tortitas con pavo y aguacate (con foto)
  'r015', -- Revuelto de claras con tostada       → Revuelto de atún, tomate y aguacate
  'r018', -- Bol de yogur con muesli y kiwi       → Bol de yogur frutos del bosque
  'r021', -- Ensalada de legumbres con atún       → Ensalada de pollo, garbanzos y rúcula
  'r026', -- Cottage con fruta y tortitas         → Tortitas dúo de atún con fresas
  'r027'  -- Revuelto con tortitas y aguacate     → Brunch completo de domingo
);
