// Suscripciones con RevenueCat (compras de Apple).
// La clave "appl_..." es pública (va dentro de la app); se puede cambiar con VITE_RC_IOS_KEY.
// Mientras no haya clave, o fuera del iPhone, la app no bloquea nada.
import { Capacitor } from "@capacitor/core";

const DEFAULT_KEY = "appl_dnPsIwbdESQutxlbKgSKGKcaUnQ";
const KEY = String(import.meta.env.VITE_RC_IOS_KEY || DEFAULT_KEY).trim().replace(/^["']|["']$/g, "");
export const ENTITLEMENT = "premium";
export const enabled = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && KEY.startsWith("appl_");
export const MANAGE_URL = "https://apps.apple.com/account/subscriptions";

let mod = null;
const rc = async () => (mod ||= (await import("@revenuecat/purchases-capacitor")).Purchases);
const active = (info) => !!info?.entitlements?.active?.[ENTITLEMENT];

export async function init(userId) {
  if (!enabled) return false;
  const P = await rc();
  await P.configure({ apiKey: KEY, appUserID: userId });
  const { customerInfo } = await P.getCustomerInfo();
  return active(customerInfo);
}

export async function onChange(cb) {
  if (!enabled) return;
  const P = await rc();
  await P.addCustomerInfoUpdateListener((info) => cb(active(info)));
}

// Devuelve la oferta actual ("fundadora" o "default", la que marques como Current en RevenueCat)
export async function getPlans() {
  const P = await rc();
  const { current } = await P.getOfferings();
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
  const P = await rc();
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: pkg });
    return active(customerInfo);
  } catch (e) {
    if (e?.userCancelled || e?.code === "1" || e?.code === 1 || /cancel/i.test(e?.message || "")) return null;
    throw e;
  }
}

export async function restore() {
  const P = await rc();
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
