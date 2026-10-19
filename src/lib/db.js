import { supabase } from "./supabase";

const must = ({ data, error }) => { if (error) throw error; return data; };

// Carga todo lo de la usuaria al iniciar sesión
export async function loadAll(userId) {
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [profile, sessions, habits, media] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("workout_sessions").select("*").eq("user_id", userId).order("performed_at", { ascending: true }),
    supabase.from("habits").select("*").eq("user_id", userId).gte("day", since),
    supabase.from("media").select("key, url"),
  ]);
  // Rutina que le ha puesto su coach (si la tabla aún no existe, se ignora)
  const cr = await supabase.from("coach_clients").select("routine, updated_at").eq("client_id", userId).not("routine", "is", null).order("updated_at", { ascending: false }).limit(1);
  const coachRoutine = !cr.error && cr.data?.[0]?.routine?.length ? cr.data[0].routine : null;
  return { profile: must(profile), sessions: must(sessions), habits: must(habits), media: must(media), coachRoutine };
}

export const updateProfile = (userId, patch) =>
  supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", userId).then(must);

export const addSession = (row) => supabase.from("workout_sessions").insert(row).select().single().then(must);

const val = (v) => (v === "" || v === undefined ? null : v);
export const upsertHabit = (userId, day, h) =>
  supabase.from("habits").upsert({ user_id: userId, day, water: val(h.water), steps: val(h.steps), sleep: val(h.sleep), weight: val(h.weight) }).then(must);

export const setMedia = (key, url, kind) => supabase.from("media").upsert({ key, url, kind, updated_at: new Date().toISOString() }).then(must);
export const deleteMedia = (key) => supabase.from("media").delete().eq("key", key).then(must);

export async function uploadFile(path, blob, contentType) {
  must(await supabase.storage.from("media").upload(path, blob, { upsert: true, contentType, cacheControl: "31536000" }));
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// Borra entrenos, hábitos y respuestas, pero mantiene la cuenta
export async function deleteMyData(userId) {
  must(await supabase.from("workout_sessions").delete().eq("user_id", userId));
  must(await supabase.from("habits").delete().eq("user_id", userId));
  must(await supabase.from("profiles").update({ onboarded: false, data: null, start_date: null, active_session: null }).eq("id", userId));
}

// Elimina la cuenta entera (obligatorio para publicar en la App Store)
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
  await supabase.auth.signOut();
}

// ---------- Contenido editable desde el panel de coach ----------
const CONTENT_TABLES = { quotes: "content_quotes", exercises: "content_exercises", foods: "content_foods", recipes: "content_recipes" };

export async function loadContent() {
  const [quotes, exercises, foods, recipes] = await Promise.all(
    Object.values(CONTENT_TABLES).map((t) => supabase.from(t).select("*").then(must))
  );
  const num = (v) => (v == null ? 0 : Number(v));
  return {
    quotes,
    exercises,
    foods: foods.map((f) => ({ ...f, p: num(f.p), c: num(f.c), f: num(f.f), tags: f.tags || [] })),
    recipes: recipes.map((r) => ({ ...r, steps: r.steps || [] })),
  };
}

export const saveContentRow = (table, row) => {
  const { updated_at, ...clean } = row;
  return supabase.from(CONTENT_TABLES[table]).upsert({ ...clean, updated_at: new Date().toISOString() }).then(must);
};
export const deleteContentRow = (table, id) => supabase.from(CONTENT_TABLES[table]).delete().eq("id", id).then(must);

// ---------- Ranking semanal ----------
export const loadRanking = (weeksAgo = 0) => supabase.rpc("weekly_ranking", { weeks_ago: weeksAgo }).then(must);
export const joinRanking = (userId, nickname, level) =>
  supabase.from("profiles").update({ nickname, rank_opt_in: true, level }).eq("id", userId).then(must);
export const leaveRanking = (userId) => supabase.from("profiles").update({ rank_opt_in: false }).eq("id", userId).then(must);
export const setLevel = (userId, level) => supabase.from("profiles").update({ level }).eq("id", userId).then(must);
export const reportNickname = (nickname, reason) => supabase.from("rank_reports").insert({ nickname, reason }).then(must);
export const listReports = () => supabase.from("rank_reports").select("*").eq("resolved", false).order("created_at", { ascending: false }).then(must);
export const dismissReport = (id) => supabase.from("rank_reports").update({ resolved: true }).eq("id", id).then(must);
export const hideFromRanking = (nick) => supabase.rpc("hide_from_ranking", { nick }).then(must);

// ---------- Asesoradas (solo coach) ----------
export const listClients = () => supabase.from("coach_clients").select("*").order("created_at", { ascending: true }).then(must);
export const addClient = (name, email) => supabase.from("coach_clients").insert({ name, email }).select().single().then(must);
export const updateClient = (id, patch) => supabase.from("coach_clients").update(patch).eq("id", id).select().single().then(must);
export const removeClient = (id) => supabase.from("coach_clients").delete().eq("id", id).then(must);
export async function clientData(clientId) {
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const [profile, sessions, habits] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientId).single(),
    supabase.from("workout_sessions").select("*").eq("user_id", clientId).order("performed_at", { ascending: true }),
    supabase.from("habits").select("*").eq("user_id", clientId).gte("day", since),
  ]);
  return { profile: must(profile), sessions: must(sessions), habits: must(habits) };
}
