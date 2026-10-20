// Suscripciones con RevenueCat (compras de Apple).
// La clave "appl_..." es pública (va dentro de la app); se puede cambiar con VITE_RC_IOS_KEY.
// Mientras no haya clave, o fuera del iPhone, la app no bloquea nada.
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";

const DEFAULT_KEY = "appl_dnPsIwbdESQutxlbKgSKGKcaUnQ";
const KEY = String(import.meta.env.VITE_RC_IOS_KEY || DEFAULT_KEY).trim().replace(/^["']|["']$/g, "");
export const ENTITLEMENT = "premium";
export const enabled = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && KEY.startsWith("appl_");
export const MANAGE_URL = "https://apps.apple.com/account/subscriptions";

const rc = () => Purchases; // ¡sin async! un plugin de Capacitor no se puede "await"-ear (se cuelga en .then)
// Premium si tiene el entitlement "premium" o, por si acaso, cualquier compra o suscripción activa
const active = (info) => !!(
  info?.entitlements?.active?.[ENTITLEMENT] ||
  Object.keys(info?.entitlements?.active || {}).length ||
  (info?.activeSubscriptions || []).length ||
  (info?.nonSubscriptionTransactions || []).some((t) => /arc_vida/.test(t?.productIdentifier || ""))
);

let readyResolve; const ready = new Promise((r) => (readyResolve = r));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export async function init(userId) {
  if (!enabled) return false;
  const P = rc();
  try { await P.configure({ apiKey: KEY, appUserID: userId }); } finally { readyResolve(); }
  const { customerInfo } = await P.getCustomerInfo();
  return active(customerInfo);
}

export async function onChange(cb) {
  if (!enabled) return;
  const P = rc();
  await P.addCustomerInfoUpdateListener((info) => cb(active(info)));
}

// Devuelve la oferta actual ("fundadora" o "default", la que marques como Current en RevenueCat)
export function getPlans() {
  return withTimeout(getPlansInner(), 20000).catch((e) => { throw new Error(stage + ": " + (e?.message || e)); });
}
let stage = "inicio";
async function getPlansInner() {
  stage = "cargando módulo de pagos";
  const P = rc();
  stage = "conectando con RevenueCat";
  await withTimeout(ready, 12000);
  stage = "pidiendo ofertas";
  const offerings = await P.getOfferings();
  stage = "leyendo ofertas";
  const current = offerings?.current;
  if (!current) return null;
  const pick = (type) => current.availablePackages.find((p) => p.packageType === type);
  return {
    id: current.identifier,
    annual: current.annual || pick("ANNUAL") || null,
    monthly: current.monthly || pick("MONTHLY") || null,
    lifetime: current.lifetime || pick("LIFETIME") || null,
  };
}

// true = ya es premium; null = la usuaria canceló; lanza error si falla
export async function buy(pkg) {
  const P = rc();
  await withTimeout(ready, 12000);
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: pkg });
    return active(customerInfo);
  } catch (e) {
    if (e?.userCancelled || e?.code === "1" || e?.code === 1 || /cancel/i.test(e?.message || "")) return null;
    throw e;
  }
}

export async function restore() {
  const P = rc();
  await withTimeout(ready, 12000);
  const { customerInfo } = await P.restorePurchases();
  return active(customerInfo);
}

// La prueba gratis es una oferta introductoria de precio 0
export const freeTrialDays = (pkg) => {
  const ip = pkg?.product?.introPrice;
  if (!ip || ip.price !== 0) return 0;
  const n = ip.periodNumberOfUnits || 1;
  return ip.periodUnit === "WEEK" ? n * 7 : ip.periodUnit === "MONTH" ? n * 30 : n;
};
