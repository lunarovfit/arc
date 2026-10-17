import { useState } from "react";
import { supabase } from "./lib/supabase";
import { LegalSheet, LEGAL_CSS } from "./Legal.jsx";

export function Auth() {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [legal, setLegal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ err: true, text: translate(e.message) }); } finally { setBusy(false); }
  };

  const submit = () => run(async () => {
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else if (mode === "signup") {
      if (!consent) throw new Error("consent");
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { health_consent: true }, emailRedirectTo: window.location.origin } });
      if (error) throw error;
      if (!data.session) setMsg({ text: "Te hemos enviado un correo para confirmar tu cuenta. Ábrelo y vuelve aquí para entrar." });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      setMsg({ text: "Si ese correo tiene cuenta, te llegará un enlace para cambiar la contraseña." });
    }
  });

  return (
    <>
      <h1>{mode === "signup" ? "Crea tu cuenta" : mode === "forgot" ? "Recupera tu contraseña" : "Entra en tu arco"}</h1>
      <p className="sub">{mode === "signup" ? "Tu progreso se guarda en tu cuenta y lo tienes en cualquier móvil." : mode === "forgot" ? "Te mandamos un enlace a tu correo." : "Inicia sesión para seguir donde lo dejaste."}</p>

      <div className="field"><label>Correo</label><input className="in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {mode !== "forgot" && (
        <div className="field"><label>Contraseña</label><input className="in" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" && <div className="hint">Mínimo 8 caracteres.</div>}
        </div>
      )}
      {mode === "signup" && (
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Tengo 16 años o más, acepto los <button type="button" className="inlink" onClick={(e) => { e.preventDefault(); setLegal("terminos"); }}>términos</button> y la <button type="button" className="inlink" onClick={(e) => { e.preventDefault(); setLegal("privacidad"); }}>política de privacidad</button>, y que ARC guarde mis datos de salud (peso, sueño, pasos, entrenos y hábitos) para calcular mi plan.</span>
        </label>
      )}
      {msg && <div className={msg.err ? "err" : "note"} style={{ marginTop: 10 }}>{msg.text}</div>}

      <button className="btn ac" style={{ marginTop: 18 }} disabled={busy || !email || (mode !== "forgot" && password.length < 8) || (mode === "signup" && !consent)} onClick={submit}>
        {busy ? "Un momento…" : mode === "signup" ? "Crear cuenta" : mode === "forgot" ? "Enviar enlace" : "Entrar"}
      </button>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "login" && <button className="link" onClick={() => setMode("signup")}>No tengo cuenta: crear una</button>}
        {mode === "login" && <button className="link" onClick={() => setMode("forgot")}>He olvidado mi contraseña</button>}
        {mode !== "login" && <button className="link" onClick={() => setMode("login")}>Ya tengo cuenta: entrar</button>}
      </div>
      <style>{LEGAL_CSS}</style>
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
    </>
  );
}

export function NewPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <>
      <h1>Nueva contraseña</h1>
      <p className="sub">Escribe la contraseña que quieres usar a partir de ahora.</p>
      <div className="field"><label>Contraseña</label><input className="in" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {msg && <div className="err">{msg}</div>}
      <button className="btn ac" disabled={password.length < 8} onClick={async () => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setMsg(translate(error.message)); else onDone();
      }}>Guardar contraseña</button>
    </>
  );
}

function translate(m = "") {
  if (m === "consent") return "Para crear la cuenta tienes que aceptar la política de privacidad.";
  if (/invalid login credentials/i.test(m)) return "El correo o la contraseña no son correctos.";
  if (/email not confirmed/i.test(m)) return "Confirma tu correo con el enlace que te mandamos antes de entrar.";
  if (/already registered/i.test(m)) return "Ya hay una cuenta con ese correo. Prueba a entrar.";
  if (/password should be/i.test(m)) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (/rate limit/i.test(m)) return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  if (/failed to fetch|load failed|network/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.";
  if (/invalid api key|no api key/i.test(m)) return "La app no tiene bien puesta la clave de Supabase (VITE_SUPABASE_ANON_KEY).";
  if (/signups not allowed|signup is disabled/i.test(m)) return "El registro está desactivado en Supabase (Authentication > Sign In / Providers > Email).";
  return `No se ha podido completar. Detalle técnico: ${m || "sin mensaje"}`;
}
