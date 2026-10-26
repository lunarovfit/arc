// Funciones que solo existen en la app instalada en el móvil (iOS y Android).
// En el navegador todo esto devuelve "no disponible" sin romper nada.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Health } from "capacitor-health";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

/* ---------------- PASOS ---------------- */

export async function stepsAvailable() {
  if (!isNative) return false;
  try { return (await Health.isHealthAvailable()).available; } catch { return false; }
}

// Pide permiso para leer los pasos (Apple Salud o Health Connect)
export async function connectSteps() {
  const res = await Health.requestHealthPermissions({ permissions: ["READ_STEPS"] });
  // iOS devuelve { READ_STEPS: true } y Android [{ READ_STEPS: true }]
  const list = Array.isArray(res?.permissions) ? res.permissions : [res?.permissions || {}];
  const granted = list.some((p) => p && p.READ_STEPS === true);
  // En iPhone Apple nunca dice si se ha denegado: se comprueba leyendo los pasos
  if (platform === "android" && !granted) throw new Error("no-permission");
  return true;
}

export async function stepsToday() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { aggregatedData } = await Health.queryAggregated({
    startDate: start.toISOString(), endDate: new Date().toISOString(), dataType: "steps", bucket: "day",
  });
  return Math.round((aggregatedData || []).reduce((s, d) => s + (d.value || 0), 0));
}

export async function openHealthSettings() {
  try {
    if (platform === "android") await Health.openHealthConnectSettings();
    else await Health.openAppleHealthSettings();
  } catch { /* nada que abrir */ }
}

export async function installHealthConnect() {
  try { await Health.showHealthConnectInPlayStore(); } catch { /* sin Play Store */ }
}

/* ---------------- NOTIFICACIONES ---------------- */

const REST_ID = 1;
const REMINDER_IDS = { train: 100, water: 200, sunday: 300, story: 400 }; // 100-107, 200-209, 300, 400-407

export const DEFAULT_REMINDERS = {
  train: { on: false, days: [2, 3, 5], time: "18:00" }, // 1 domingo … 7 sábado
  water: { on: false, times: ["11:00", "13:30", "17:00", "20:00"] },
  sunday: { on: false, time: "19:00" },
  story: { on: false, days: [4, 7], time: "21:00" },
};

export async function notificationsAllowed(ask = false) {
  if (!isNative) return false;
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== "granted" && ask) p = await LocalNotifications.requestPermissions();
  return p.display === "granted";
}

// Aviso de fin de descanso, por si la app está en segundo plano
export async function scheduleRest(endsAt, exerciseName) {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] });
    await LocalNotifications.schedule({ notifications: [{
      id: REST_ID, title: "Descanso terminado", body: exerciseName ? `A por la siguiente serie de ${exerciseName}.` : "A por la siguiente serie.",
      schedule: { at: new Date(endsAt), allowWhileIdle: true },
    }] });
  } catch { /* sin permiso: no pasa nada */ }
}
export async function cancelRest() {
  if (!isNative) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] }); } catch { /* nada */ }
}

const hm = (t) => { const [h, m] = (t || "18:00").split(":").map(Number); return { hour: h || 0, minute: m || 0 }; };

// Vuelve a programar todos los recordatorios según lo que eligió la usuaria
export async function applyReminders(r = DEFAULT_REMINDERS) {
  if (!isNative) return;
  const all = [...Array(8).keys()].map((i) => REMINDER_IDS.train + i)
    .concat([...Array(10).keys()].map((i) => REMINDER_IDS.water + i), [REMINDER_IDS.sunday], [...Array(8).keys()].map((i) => REMINDER_IDS.story + i));
  await LocalNotifications.cancel({ notifications: all.map((id) => ({ id })) });

  const list = [];
  if (r.train?.on) (r.train.days || []).forEach((weekday) => list.push({
    id: REMINDER_IDS.train + weekday, title: "Hoy toca entreno", body: "Tu siguiente nivel no se va a subir solo. Abre ARC y empieza.",
    schedule: { on: { weekday, ...hm(r.train.time) }, allowWhileIdle: true },
  }));
  if (r.water?.on) (r.water.times || []).slice(0, 10).forEach((t, i) => list.push({
    id: REMINDER_IDS.water + i, title: "Un vaso de agua", body: "Apúntalo en Hábitos para no perder la racha.",
    schedule: { on: hm(t), allowWhileIdle: true },
  }));
  if (r.sunday?.on) list.push({
    id: REMINDER_IDS.sunday, title: "Cierre de semana", body: "Pésate, mira tu ranking y piensa qué quieres mejorar la semana que viene.",
    schedule: { on: { weekday: 1, ...hm(r.sunday.time) }, allowWhileIdle: true },
  });
  const STORY_MSG = ["Presume tu día", "Comida, pump y pasos: crea tu historia de hoy en ARC y súbela."];
  if (r.story?.on) (r.story.days || []).forEach((weekday) => list.push({
    id: REMINDER_IDS.story + weekday, title: STORY_MSG[0], body: STORY_MSG[1], extra: { open: "story" },
    schedule: { on: { weekday, ...hm(r.story.time) }, allowWhileIdle: true },
  }));
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}

// Al tocar un aviso que abre algo dentro de la app (por ahora, la historia del día)
export function onReminderOpen(cb) {
  if (!isNative) return () => {};
  const h = LocalNotifications.addListener("localNotificationActionPerformed", (e) => { const o = e?.notification?.extra?.open; if (o) cb(o); });
  return () => { h.then?.((x) => x.remove()); };
}
