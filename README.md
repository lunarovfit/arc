# ARC by Lunarovx

App de entreno gamificada: React + Supabase (cuentas, base de datos y vídeos) + Capacitor (iOS y Android).

## 1. Crear la base de datos (una sola vez)

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto. Elige la región **Europe (Frankfurt o Paris)**: tus usuarias son de España y así cumples mejor el RGPD.
2. Ve a **SQL Editor**, pega entero el archivo `supabase/migrations/0001_arc.sql` y dale a **Run**. Esto crea las tablas, los permisos y la carpeta de vídeos.
   Después haz lo mismo con `supabase/migrations/0002_contenido.sql`: crea las tablas de frases, ejercicios, alimentos y recetas y las rellena con lo que ya tiene la app.
   Y por último `supabase/migrations/0003_ranking.sql`: el ranking semanal y las denuncias.
3. En **Authentication > URL Configuration** pon como *Site URL* la dirección de tu web (o `http://localhost:5173` mientras pruebas).
4. En **Project Settings > API** copia la *Project URL* y la *anon public key*.

## 2. Arrancar la app en tu ordenador

```bash
cp .env.example .env      # y pega ahí la URL y la anon key
npm install
npm run dev               # abre http://localhost:5173
```

## 3. Convertirte en coach

Regístrate en la app con tu correo. Después, en el SQL Editor de Supabase:

```sql
update public.profiles set role = 'coach'
where id = (select id from auth.users where email = 'TU-EMAIL');
```

Vuelve a entrar y en **Ajustes** verás el modo coach. Desde ahí:

- Subes imágenes de personajes y vídeos de ejercicios (hasta 500 MB por vídeo).
- Editas frases, recetas, ejercicios y alimentos. Los cambios les llegan a todas las usuarias al momento, sin sacar versión nueva.

## 4. Botón de eliminar cuenta

Apple obliga a que se pueda borrar la cuenta desde la app. Instala la [CLI de Supabase](https://supabase.com/docs/guides/cli) y ejecuta:

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF
supabase functions deploy delete-account
```

## 5. Probar en tu móvil Android

1. Instala [Android Studio](https://developer.android.com/studio) (gratis).
2. En tu móvil: Ajustes > Información del teléfono > toca 7 veces "Número de compilación" para activar las opciones de desarrollador. Después, en Opciones de desarrollador, activa "Depuración USB".
3. Conecta el móvil por cable y, en la carpeta `arc`:

```bash
npx cap add android      # solo la primera vez
npm run android          # compila, ajusta permisos y abre Android Studio
```

4. En Android Studio, elige tu móvil arriba y pulsa el botón ▶.

Para los pasos hace falta Health Connect (viene de serie en Android 14 o más; en versiones anteriores se instala desde Google Play).

Las notificaciones y los pasos solo funcionan en el móvil, no en `localhost`.

## 5. Publicar en iOS y Android

```bash
npx cap add ios
npx cap add android
npm run ios        # abre Xcode; en Signing & Capabilities añade "HealthKit" (necesitas un Mac y cuenta de Apple Developer, 99 $/año)
npm run android    # abre Android Studio (cuenta de Google Play, 25 $ una vez)
```

## 6. iPhone sin Mac: Codemagic + TestFlight

**En Apple (una sola vez)**
1. developer.apple.com > Certificates, IDs & Profiles > Identifiers > **+** > App IDs > App. Descripción `ARC`, Bundle ID explícito `com.lunarovx.arc` y marca **HealthKit**.
2. appstoreconnect.apple.com > Apps > **+** > Nueva app: iOS, nombre en la tienda, idioma español, Bundle ID `com.lunarovx.arc`, SKU `arc-lunarovx`. Apunta el número **Apple ID** que aparece en "Información de la app".
3. App Store Connect > Usuarios y acceso > Integraciones > App Store Connect API > **+**. Nombre `Codemagic`, acceso **App Manager**. Descarga el archivo `.p8` (solo se puede descargar una vez) y apunta el **Issuer ID** y el **Key ID**.

**Clave del certificado (una sola vez, en Windows)**
En la ventana negra: `ssh-keygen -t rsa -b 2048 -m PEM -f cert_key -q -N ""`. Se crea el archivo `cert_key`: su contenido es `CERTIFICATE_PRIVATE_KEY`. Guárdalo y no lo subas a GitHub.

**En GitHub y Codemagic**
1. Sube el proyecto a un repositorio **privado** de GitHub (sin `node_modules` ni `.env`).
2. En codemagic.io entra con GitHub y añade el repositorio.
3. Team settings > Integrations > Developer Portal: añade la clave con el nombre `ARC App Store Connect` (Issuer ID, Key ID y el `.p8`).
4. En la app de Codemagic > Environment variables, crea el grupo `arc` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `CERTIFICATE_PRIVATE_KEY`, marcadas como secretas. El Apple ID de la app ya está puesto en `codemagic.yaml`.
5. Start new build > workflow **iOS → TestFlight**. Tarda unos 15 minutos.
6. Instala TestFlight en tu iPhone: la app aparece ahí cuando Apple termina de procesarla.

## Qué se guarda y dónde

| Tabla | Qué guarda |
| --- | --- |
| `profiles` | Rol, respuestas del cuestionario, XP, gemas y el entreno en curso |
| `workout_sessions` | Cada entreno con sus series |
| `habits` | Pasos, agua, sueño y peso por día |
| `media` + carpeta `media` | Imágenes de personajes y vídeos de ejercicios |
| `content_quotes`, `content_exercises`, `content_foods`, `content_recipes` | Contenido que editas desde tu panel |
| `subscriptions` | Preparada para los pagos |

Cada usuaria solo puede ver y tocar sus datos. Solo las cuentas coach pueden subir archivos. La XP y las gemas se suman en el servidor, así que nadie puede hacerse trampas.

## Antes de publicar

- **Política de privacidad** publicada en una web y su enlace en `VITE_PRIVACY_URL`. La app guarda datos de salud y el registro pide consentimiento explícito.
- **Correos bonitos**: en *Authentication > Email Templates* traduce los correos de confirmación y de cambio de contraseña.
- **Enlaces de correo en el móvil**: para que el enlace de confirmación abra la app instalada hay que configurar *deep links* en Capacitor. Mientras tanto, la confirmación se hace en el navegador y luego se entra en la app con normalidad.
- **Vídeos de pago**: la carpeta de vídeos es pública para que carguen rápido. Si más adelante solo las suscriptoras pueden verlos, se cambia a enlaces firmados.
