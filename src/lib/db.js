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
  let cr = await supabase.from("coach_clients").select("routine, mode, updated_at").eq("client_id", userId).order("updated_at", { ascending: false }).limit(1);
  if (cr.error) cr = await supabase.from("coach_clients").select("routine, updated_at").eq("client_id", userId).order("updated_at", { ascending: false }).limit(1);
  const row = !cr.error ? cr.data?.[0] : null;
  const coach = row ? { routine: row.routine?.length ? row.routine : null, mode: row.mode || "" } : null;
  return { profile: must(profile), sessions: must(sessions), habits: must(habits), media: must(media), coach };
}

export const updateProfile = (userId, patch) =>
  supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", userId).then(must);

export const addSession = (row) => supabase.from("workout_sessions").insert(row).select().single().then(must);

const val = (v) => (v === "" || v === undefined ? null : v);
// "food" guarda lo que has comido ese día; si aún no existe la columna en Supabase, se guarda lo demás
export const upsertHabit = async (userId, day, h) => {
  const row = { user_id: userId, day, water: val(h.water), steps: val(h.steps), sleep: val(h.sleep), weight: val(h.weight) };
  const r = await supabase.from("habits").upsert({ ...row, food: h.food && Object.keys(h.food).length ? h.food : null });
  if (r.error && /food/i.test(r.error.message || "")) return must(await supabase.from("habits").upsert(row));
  return must(r);
};

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
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  await supabase.auth.signOut().catch(() => {});
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
export const searchProfiles = (q) => supabase.rpc("search_profiles", { q }).then(must);
export const publicProfile = (nick) => supabase.rpc("public_profile", { nick }).then(must);
export const setProfilePublic = (userId, v) => supabase.from("profiles").update({ profile_public: v }).eq("id", userId).then(must);
export const setAvatarPending = (userId, url) => supabase.from("profiles").update({ avatar_pending: url }).eq("id", userId).then(must);
export const clearMyAvatar = () => supabase.rpc("clear_my_avatar").then(must);
export const pendingAvatars = () => supabase.rpc("pending_avatars").then(must);
export const reviewAvatar = (nick, ok) => supabase.rpc("review_avatar", { nick, ok }).then(must);
export async function uploadAvatar(userId, blob) {
  const path = `${userId}/${Date.now()}.jpg`;
  must(await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" }));
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
export const clearAvatar = (nick) => supabase.rpc("clear_avatar", { nick }).then(must);
export const avatarOf = (nick) => supabase.rpc("avatar_of", { nick }).then(must);

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

// ---------- Revisiones ----------
export const listCheckins = (clientId) => supabase.from("client_checkins").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).then(must);
export async function addCheckin(userId, { weight, waist, hip, feeling, files }) {
  const photos = [];
  for (let i = 0; i < files.length; i++) {
    const path = `${userId}/${Date.now()}_${i}.jpg`;
    must(await supabase.storage.from("checkins").upload(path, files[i], { contentType: "image/jpeg" }));
    photos.push(path);
  }
  const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));
  return supabase.from("client_checkins").insert({ weight: num(weight), waist: num(waist), hip: num(hip), feeling: feeling || null, photos }).select().single().then(must);
}
export async function checkinUrls(paths) {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from("checkins").createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries(data.map((d) => [d.path, d.signedUrl]));
}
