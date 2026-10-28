// Ajusta los archivos nativos después de "npx cap add android" / "npx cap add ios".
// Uso: node scripts/setup-native.cjs
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const done = [];

// ---------- ANDROID ----------
const manifest = path.join(root, "android/app/src/main/AndroidManifest.xml");
if (fs.existsSync(manifest)) {
  let m = fs.readFileSync(manifest, "utf8");
  if (!m.includes("android.permission.health.READ_STEPS")) {
    m = m.replace(/<application/, `<queries>
        <package android:name="com.google.android.apps.healthdata" />
    </queries>
    <uses-permission android:name="android.permission.health.READ_STEPS" />

    <application`);
  }
  if (!m.includes("PermissionsRationaleActivity")) {
    m = m.replace(/<\/application>/, `    <!-- Health Connect: pantalla de "por qué pedimos este permiso" -->
        <activity
            android:name="com.fit_up.health.capacitor.PermissionsRationaleActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity>
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity="com.fit_up.health.capacitor.PermissionsRationaleActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
    </application>`);
  }
  fs.writeFileSync(manifest, m);
  const vars = path.join(root, "android/variables.gradle");
  if (fs.existsSync(vars)) {
    let v = fs.readFileSync(vars, "utf8");
    v = v.replace(/minSdkVersion\s*=\s*(\d+)/, (all, n) => (Number(n) < 26 ? "minSdkVersion = 26" : all));
    fs.writeFileSync(vars, v);
  }
  // Notificaciones (Android 13+) y firma con la llave de Codemagic
  m = fs.readFileSync(manifest, "utf8");
  if (!m.includes("POST_NOTIFICATIONS")) {
    m = m.replace(/<uses-permission android:name="android.permission.INTERNET" \/>/, `<uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`);
    fs.writeFileSync(manifest, m);
  }
  const appGradle = path.join(root, "android/app/build.gradle");
  if (fs.existsSync(appGradle)) {
    let g = fs.readFileSync(appGradle, "utf8");
    if (!g.includes("CM_KEYSTORE_PATH")) {
      g = g.replace(/versionCode \d+/, 'versionCode((System.getenv("ARC_VERSION_CODE") ?: "1") as int)')
           .replace(/versionName "[^"]*"/, 'versionName(System.getenv("ARC_VERSION_NAME") ?: "1.0")')
           .replace(/    buildTypes \{\n        release \{/, `    signingConfigs {
        release {
            if (System.getenv("CM_KEYSTORE_PATH")) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release`);
      fs.writeFileSync(appGradle, g);
    }
  }
  done.push("Android: permisos de pasos y Health Connect añadidos");
}

// ---------- iOS ----------
const plist = path.join(root, "ios/App/App/Info.plist");
if (fs.existsSync(plist)) {
  let p = fs.readFileSync(plist, "utf8");
  if (!p.includes("NSHealthShareUsageDescription")) {
    p = p.replace(/<dict>/, `<dict>
	<key>NSHealthShareUsageDescription</key>
	<string>ARC lee tus pasos de Apple Salud para rellenar tus hábitos del día automáticamente.</string>
	<key>NSHealthUpdateUsageDescription</key>
	<string>ARC no escribe datos en Apple Salud.</string>`);
    fs.writeFileSync(plist, p);
  }
  done.push("iOS: textos de permiso de Apple Salud añadidos (falta activar HealthKit en Xcode)");
}

console.log(done.length ? done.join("\n") : "No hay carpetas android ni ios todavía. Ejecuta antes: npx cap add android");
