# Pendiente antes de publicar

## Pasos del teléfono (programado, falta probar en el móvil)
- Android: Health Connect. iOS: Apple Salud (en Xcode hay que activar HealthKit).
- En Hábitos, botón para conectar; luego los pasos se leen solos al abrir la pestaña.

## Notificaciones (programado, falta probar en el móvil)
- Aviso de fin de descanso con la app en segundo plano.
- Recordatorios en Ajustes: días y hora de entreno, beber agua y cierre del domingo.
- Push (más adelante): mensajes tuyos a todas las usuarias.

## Pago (decidido)
- Mensual: 4,99 €
- Anual: 29,99 € (el plan principal)
- De por vida: 59,99 € (opcional)
- 3 días de prueba gratis con todo abierto (oferta introductoria de Apple; se cobra el día 4 si no cancela)
- Recordatorio dentro de la app antes de que acabe la prueba
- Sin suscripción: versión gratis limitada (nivel, personaje, frase del día y hábitos). Se bloquean entrenos, nutrición, ranking y vídeos; los datos se conservan
- Pantalla de suscripción: cada plan con una imagen de cabecera que la coach sube y cambia desde su panel
- Precio de fundadora al lanzar: anual a 19,99 € para siempre para las primeras usuarias
- En iOS y Android se cobra con la compra integrada de Apple y Google (se quedan un 15 %). Stripe solo para la web.
- RevenueCat para gestionar las tres tiendas desde un sitio.
- La tabla `subscriptions` pasará a guardar el estado de acceso: prueba, suscrita, de por vida o sin acceso.
