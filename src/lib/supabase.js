import { createClient } from "@supabase/supabase-js";

// Datos públicos del proyecto de Supabase (no son secretos: van dentro de la app).
// Si existen en el .env o en Codemagic se usan esos; si no, estos.
const DEFAULT_URL = "https://pevnnozmxerxvpfkwapi.supabase.co";
const DEFAULT_KEY = "sb_publishable_ClQIFZINxFJxuU8lCT1rmg_fxMhY6oG";

const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");
const url = clean(import.meta.env.VITE_SUPABASE_URL) || DEFAULT_URL;
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY) || DEFAULT_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
