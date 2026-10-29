import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";
import * as native from "./lib/native";
import { Auth, NewPassword } from "./Auth.jsx";
import { LegalSheet, LEGAL_CSS } from "./Legal.jsx";
import * as purchases from "./lib/purchases";
import { shareImage as nativeShare } from "./lib/share";

/* =====================================================================
   ARC by Lunarovx — vista previa v2
   Versión para publicar: inicio de sesión, datos y contenido en Supabase.
   Bloques editables: RULES, LEVELS, QUOTES, EXERCISES, DAY_TEMPLATES, FOODS, RECIPES
   ===================================================================== */

const RULES = {
  EPLEY_MAX_REPS: 10,
  ADHERENCE_WINDOW_DAYS: 30,
  ADHERENCE_MIN_DAYS: 7,      // antes de 7 días la adherencia no bloquea el nivel (nivel provisional)
  GAP_RESET_DAYS: 21,
  MIN_SESSIONS_PER_MONTH: 8,
  WATER_GLASS_ML: 250,
  WATER_GOAL_GLASSES: 8,
  STEPS_GOAL: 10000,
  SLEEP_GOAL_H: 7,
  XP_PER_SESSION: 40,
  GEMS_PER_SESSION: 5,
};

// Nivel 1 = punto de partida sin requisitos. Orden: de menos a más fuerza física construida.
// Rama femenina: ratio = (sentadilla + peso muerto) / peso corporal
// Rama masculina: ratio = (sentadilla + press banca + peso muerto) / peso corporal
const LV_MONTHS = [0, 1, 2, 3, 4, 6, 9, 12, 15, 18, 24, 36];
const LV_ADH = [0, 55, 60, 64, 68, 72, 76, 80, 83, 86, 89, 92];
const lv = (branch, i, name, series, line) => ({
  name, series, line, months: LV_MONTHS[i], adherence: LV_ADH[i],
  pullups: branch === "female" ? [0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 6, 8][i] : [0, 0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16][i],
  ratio: branch === "female" ? [0, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.1, 3.5][i] : [0, 1.5, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2, 4.6, 5.0, 5.5][i],
});
const LEVELS = {
  female: [
    ["Kobeni Higashiyama", "Chainsaw Man", "Llora, tiembla y aun así esquiva un cuchillo en el último segundo. Tiene unos reflejos que ya quisieran muchos. Empezar con miedo también es empezar."],
    ["Ochaco Uraraka", "My Hero Academia", "Su poder era hacer flotar cosas, pero se puso a aprender cuerpo a cuerpo para no depender de él. Aquí aprendes a mover tu propio peso."],
    ["Nami", "One Piece", "Pasó años ahorrando ella sola para liberar a su pueblo, sin que nadie lo supiera. Constancia de la que no se ve, un día detrás de otro."],
    ["Talia Yang", "Cyberpunk: Edgerunners 2", "Lo tenía todo en las torres corpo y eligió la calle. Rebelde, sin miedo y con prisa por vivir, aunque nadie entendiera por qué. Aquí la prisa se convierte en constancia."],
    ["Nobara Kugisaki", "Jujutsu Kaisen", "Se fue de su pueblo porque se le quedaba pequeño. Martillo, clavos y cero ganas de pedir permiso a nadie."],
    ["Lucy", "Cyberpunk: Edgerunners", "Netrunner de élite con un único sueño: llegar a la luna. Fría por fuera y con un foco que nada consigue romper."],
    ["Annie Leonhart", "Attack on Titan", "Su padre la entrenó desde pequeña y acabó siendo la mejor de su promoción en cuerpo a cuerpo. Tumbaba a Reiner, que le sacaba dos cabezas."],
    ["Mitsuri Kanroji", "Demon Slayer", "Tiene una fuerza ocho veces mayor de lo normal y la escondía porque la hacían sentir rara. Un día dejó de esconderse y se convirtió en Pilar. Tu fuerza no se pide perdón."],
    ["Mirko", "My Hero Academia", "Heroína número 5, pelea sola y a patadas. Perdió un brazo y una pierna en la guerra y siguió luchando con una sonrisa."],
    ["Mikasa Ackerman", "Attack on Titan", "La mejor de su promoción, capaz de tumbar titanes ella sola. Fuerza Ackerman, cabeza fría y una espalda que ya quisieras."],
    ["Yuki Tsukumo", "Jujutsu Kaisen", "Hechicera de grado especial: su técnica le suma masa a cada golpe. Se plantó sola ante Kenjaku. Libre, fuerte y sin dar explicaciones."],
    ["Maki Zenin", "Jujutsu Kaisen", "Su clan la trataba como si no valiera nada por no tener energía maldita. Entrenó hasta tener el cuerpo de Toji y le dio la vuelta a todo. Boss final."],
  ],
  male: [
    ["Reigen Arataka", "Mob Psycho 100", "Cero poderes, mucha labia y el mejor maestro de la serie. Para empezar no necesitas nada más que decidirte."],
    ["Denji", "Chainsaw Man", "Empezó comiendo pan duro y vendiendo órganos para pagar deudas. Sueños pequeños, hambre enorme."],
    ["Eijiro Kirishima", "My Hero Academia", "Su quirk no era vistoso y él lo sabía. Lo convirtió en el más duro de la clase a base de aguantar golpes."],
    ["David Martinez", "Cyberpunk: Edgerunners", "Un chaval de Santo Domingo que se puso un Sandevistan militar para cumplir el sueño de su madre. Lleva el cuerpo al límite, sin romperlo."],
    ["Ippo Makunouchi", "Hajime no Ippo", "Le pegaban en el instituto y acabó siendo campeón de Japón. Lo hizo dando miles de golpes al mismo saco."],
    ["Thorfinn", "Vinland Saga", "De guerrero lleno de rabia a hombre que ya no necesita pelear. Años de trabajo físico y por fin sabe para qué entrena."],
    ["D", "Cyberpunk: Edgerunners 2", "Netrunner de Snake Nation que lo perdió todo y lleva cada pérdida a cuestas. Entendió tarde que no podía hacerlo solo. La fuerza también es dejar que te ayuden."],
    ["Yuji Itadori", "Jujutsu Kaisen", "Lanza una bola de acero como si nada y encadena Black Flashes. Fuerza explosiva y un corazón que no se rinde."],
    ["Levi Ackerman", "Attack on Titan", "El soldado más fuerte de la humanidad. Precisión milimétrica, ni un movimiento de más y una mirada que lo dice todo."],
    ["Roronoa Zoro", "One Piece", "Entrena con pesas de toneladas mientras los demás duermen. Quiere ser el mejor espadachín del mundo y no se le olvida ni un día."],
    ["Sung Jinwoo", "Solo Leveling", "Era el cazador más débil del mundo. Cumplió su misión diaria sin fallar ni una y acabó siendo el más fuerte."],
    ["Toji Fushiguro", "Jujutsu Kaisen", "Cero energía maldita y el cuerpo humano al cien por cien. Fue capaz de tumbar a Gojo en su juventud. Boss final."],
  ],
};
for (const b of ["female", "male"]) LEVELS[b] = LEVELS[b].map(([name, series, line], i) => lv(b, i, name, series, line));

// Movimientos de cada personaje (se desbloquean al llegar a su nivel)
const MOVES = {
  "Kobeni Higashiyama": ["Reflejos al límite", "Sobrevivir"],
  "Ochaco Uraraka": ["Gravedad cero", "Cuerpo a cuerpo"],
  "Nami": ["Clima-Tact", "Estrategia"],
  "Talia Yang": ["Cromo y calle", "Rebeldía"],
  "Nobara Kugisaki": ["Resonancia", "Martillo y clavos"],
  "Lucy": ["Netrunner", "Monofilamento"],
  "Annie Leonhart": ["Patada baja", "Titán hembra"],
  "Mitsuri Kanroji": ["Respiración del amor", "Espada látigo"],
  "Mirko": ["Patada lunar", "Salto de conejo"],
  "Mikasa Ackerman": ["Fuerza Ackerman", "Equipo 3D"],
  "Yuki Tsukumo": ["Masa estelar", "Grado especial"],
  "Maki Zenin": ["Restricción celestial", "Armas malditas"],
  "Reigen Arataka": ["Labia infinita", "Golpe de sal"],
  "Denji": ["Motosierra", "Hambre"],
  "Eijiro Kirishima": ["Endurecimiento", "Roca inquebrantable"],
  "David Martinez": ["Sandevistan", "Cromo militar"],
  "Ippo Makunouchi": ["Dempsey Roll", "Gazelle Punch"],
  "Thorfinn": ["Dagas", "Sin enemigos"],
  "D": ["Netrunner", "Snake Nation"],
  "Yuji Itadori": ["Black Flash", "Puño divergente"],
  "Levi Ackerman": ["Fuerza Ackerman", "Corte giratorio"],
  "Roronoa Zoro": ["Santoryu", "Haki del rey"],
  "Sung Jinwoo": ["Monarca de las sombras", "Arise"],
  "Toji Fushiguro": ["Restricción celestial", "Asesino de hechiceros"],
};

// Tus skills: lo que has hecho tú para llegar hasta aquí, medido contra el arco completo
const SKILL_DEFS = [
  { key: "ratio", name: "Fuerza", fmt: (v) => `${v.toFixed(2)}x tu peso` },
  { key: "pullups", name: "Tirón", fmt: (v) => `${v} ${v === 1 ? "dominada" : "dominadas"}` },
  { key: "months", name: "Constancia", fmt: (v) => `${v} ${v === 1 ? "mes" : "meses"} sin parar` },
  { key: "adherence", name: "Disciplina", fmt: (v) => `${v}% de hábitos` },
];

function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(target); return; }
    let raf, t0;
    const step = (t) => { if (!t0) t0 = t; const k = Math.min(1, (t - t0) / ms); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function SkillRow({ def, have, rank, max, pct, nextPct, tag, delay, provisional }) {
  const n = useCountUp(rank);
  return (
    <div className={`sk-row ${tag ? "sk-" + tag : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="sk-hd">
        <span className="sk-name">{def.name}{tag === "top" && <em>Tu fuerte</em>}{tag === "low" && <em>Te frena</em>}</span>
        <span className="sk-lv">Nv <b>{Math.round(n)}</b><small>/{max}</small></span>
      </div>
      <div className="sk-bar">
        <div className="sk-fill" style={{ width: `${pct}%`, animationDelay: `${delay + 150}ms` }} />
        {nextPct != null && <i className="sk-next" style={{ left: `${nextPct}%` }} />}
      </div>
      <div className="sk-val">{provisional ? "Empieza a contar en tu día " + RULES.ADHERENCE_MIN_DAYS : def.fmt(have)}</div>
    </div>
  );
}

function Skills({ lv, L, stats, ev }) {
  if (!stats) return null;
  const max = L.length, next = ev.next;
  const nextPct = next ? ((ev.current + 1) / (max - 1)) * 100 : null; // la raya blanca: lo que pide el siguiente personaje
  const rows = SKILL_DEFS.map((d) => {
    const have = Number(stats[d.key]) || 0;
    const T = L.map((x) => x[d.key]);
    const prov = d.key === "adherence" && stats.provisional;
    const r = prov ? 1 : Math.max(1, T.filter((t) => have >= t).length); // cuántos niveles cumples en esta skill
    const part = r < max ? Math.max(0, Math.min(1, (have - T[r - 1]) / (T[r] - T[r - 1]))) : 0;
    const pct = Math.min(100, ((r - 1 + part) / (max - 1)) * 100);
    const short = !!next && !prov && d.key !== "pullups" && have < next[d.key];
    return { def: d, have, rank: r, pct, short, provisional: prov };
  });
  const hi = Math.max(...rows.map((r) => r.rank));
  const anyShort = rows.some((r) => r.short);
  const moves = MOVES[lv.name];
  return (
    <div className="skills">
      <div className="sk-title"><span>Tus skills</span><small>lo que te ha traído hasta aquí</small></div>
      {rows.map((r, i) => (
        <SkillRow key={r.def.key} {...r} max={max} nextPct={nextPct} delay={i * 90}
          tag={r.short ? "low" : anyShort && r.rank === hi ? "top" : null} />
      ))}
      {next && <div className="sk-legend"><i className="sk-next-dot" />{anyShort ? `La raya es lo que te pide ${next.name}` : `Ya cumples todo para ${next.name}`}</div>}
      {moves && (
        <div className="sk-moves">
          <small>Movimientos desbloqueados</small>
          <div>{moves.map((t, i) => <span key={t} className="sk-tag" style={{ animationDelay: `${500 + i * 120}ms` }}>{t}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// Modo gymrat: la misma rata para todas, con 9 fases. Requisitos según la rama.
const RAT_STAGES = [
  ["Chuminá", "La rata con ojeras que acaba de descubrir el gimnasio."],
  ["Enclenque", "Ya enseña bíceps, hay que creérselo."],
  ["Mantecado", "Se deshace en las series, pero ya se nota la masa."],
  ["Mazao", "La camiseta le pide perdón."],
  ["Bestia", "El banco está preocupado."],
  ["Leyenda", "El gimnasio se mide en antes y después de ella."],
];
const RAT_STEPS = [0, 2, 4, 6, 9, 11]; // equivalencia con los 12 niveles de anime
const RAT_LEVELS = Object.fromEntries(["female", "male"].map((b) => [b,
  RAT_STAGES.map(([name, line], i) => ({ ...LEVELS[b][RAT_STEPS[i]], name, series: "Modo gymrat", line })),
]));
// Modo clásico (sin personajes): los mismos requisitos, solo con número de nivel. Lo puede imponer la coach.
const CLASSIC_LINES = [
  "Has empezado. Lo más difícil ya está hecho.", "Primeras semanas sumando. El cuerpo empieza a entender de qué va esto.",
  "La constancia empieza a notarse en los pesos.", "Ya no es una prueba: es tu rutina.", "Más fuerza que cuando empezaste, y se ve.",
  "Medio arco. Lo que haces ya no lo hace cualquiera.", "Tus básicos se mueven con soltura.", "Disciplina de verdad: meses sin parar.",
  "Fuerza que se nota fuera del gym.", "Pocas llegan aquí. Tú sí.", "A un paso de lo más alto.", "Arco completo. Nivel máximo.",
];
const CLASSIC_LEVELS = Object.fromEntries(["female", "male"].map((b) => [b, LEVELS[b].map((l, i) => ({ ...l, name: `Nivel ${i + 1}`, series: "Tu arco", line: CLASSIC_LINES[i] }))]));
const ANIME_SRC = new Set(["Attack on Titan","Demon Slayer","Fullmetal Alchemist","Hajime no Ippo","Jujutsu Kaisen","My Hero Academia","Naruto","Neon Genesis Evangelion","One Piece","Vinland Saga","Dragon Ball","Haikyuu","Bleach","Haikyuu!!","Gurren Lagann","One Punch Man","Fullmetal Alchemist: Brotherhood","Black Clover","Fairy Tail"]);
// En modo sin personajes tampoco salen frases de anime
const pickQuote = (mode) => { const mine = QUOTES.filter((q) => q[2] === "ARC"), top = mine.filter((q) => q[1] === "Luna"); const base = mode === "clasico" || mode === "simple" ? QUOTES.filter((q) => !ANIME_SRC.has(q[2]) && q[2] !== "ARC") : QUOTES.filter((q) => ANIME_SRC.has(q[2])); const pool = [...base, ...mine, ...top, ...top]; const l = pool.length ? pool : QUOTES; return l[Math.floor(Math.random() * l.length)]; };
const levelsOf = (branch, mode) => (mode === "clasico" || mode === "simple" ? CLASSIC_LEVELS : LEVELS)[branch] || LEVELS.female;
// Imagen de un nivel: la que suba la coach o, en gymrat, la rata que viene con la app
const EX_VIDS = ["ARC-001", "ARC-002", "ARC-004", "ARC-006", "ARC-007", "ARC-009", "ARC-011", "ARC-012", "ARC-013", "ARC-014", "ARC-015", "ARC-016", "ARC-019", "ARC-020", "ARC-022", "ARC-023", "ARC-026", "ARC-027", "ARC-028", "ARC-029", "ARC-036", "ARC-037", "ARC-041", "ARC-042", "ARC-043", "ARC-049", "ARC-050", "ARC-054", "ARC-055", "ARC-060", "ARC-067", "ARC-069", "ARC-070", "ARC-073", "ARC-075", "ARC-076", "ARC-077", "ARC-078", "ARC-079", "ARC-080", "ARC-081", "ARC-082", "ARC-083", "ARC-084", "ARC-085", "ARC-087", "ARC-088", "ARC-M01", "ARC-M02", "ARC-M03", "ARC-M04", "ARC-M06", "ARC-M07", "ARC-M08", "ARC-M09", "ARC-X01", "ARC-X03"];
const BUNDLED_MEDIA = Object.fromEntries(EX_VIDS.map((id) => [`ex:${id}`, `/ejercicios/${id}.mp4`]));
// Imágenes que vienen dentro de la app; una foto subida después desde el panel las sustituye
const BUNDLED_IMG = { "lvl:female:3": "/personajes/talia.jpg", "lvl:male:6": "/personajes/d.jpg", "lvl:female:7": null };
const BUNDLED_SINCE = 1793011308383;
const mediaOr = (media, key) => { if (key in BUNDLED_IMG) { const t = Number((/\/(\d{13})\.\w+$/.exec(media[key] || "") || [])[1]); if (!(t > BUNDLED_SINCE)) return BUNDLED_IMG[key]; } const m = /^rat:(female|male):(\d)$/.exec(key); return media[key] || (m ? `/ratas/${m[1]}/rat-${m[2]}.png` : null); };
const levelKey = (branch, mode, i) => (mode === "clasico" ? `classic:${i}` : `lvl:${branch}:${i}`);


// [frase, quién, de dónde, explicación, tipo]
let QUOTES = [
  ["Nunca olvides por qué empezaste.", "Luna", "ARC", "El día que no te apetezca, acuérdate de cómo te sentías cuando decidiste cambiar. Ese motivo sigue ahí.", "leccion"],
  ["No voy a huir ni a retirar mi palabra. Ese es mi camino ninja.", "Naruto Uzumaki", "Naruto", "Si te has dicho que hoy entrenas, hoy entrenas. No te falles.", "cita"],
  ["Tú también puedes ser un héroe.", "All Might", "My Hero Academia", "Se lo dijo a un chaval sin poderes. Ese chaval acabó siendo el número uno.", "cita"],
  ["Elige aquello de lo que menos te vayas a arrepentir.", "Levi Ackerman", "Attack on Titan", "¿Te arrepentirás más de ir al gym sin ganas o de no haber ido? Ya lo sabes.", "cita"],
  ["Si muero intentándolo, al menos lo intenté.", "Monkey D. Luffy", "One Piece", "Luffy se mete en peleas que todos dan por perdidas. Lo que cuenta es plantarte, no tenerlo ganado de antemano. Hoy no hace falta el entreno perfecto, hace falta intentarlo.", "leccion"],
  ["No todo el que se esfuerza triunfa, pero todo el que ha triunfado se ha esforzado.", "Kamogawa", "Hajime no Ippo", "El esfuerzo no te asegura el resultado. Es lo único que te da opciones.", "cita"],
  ["El talento es algo que haces florecer. El instinto es algo que pules.", "Toru Oikawa", "Haikyuu!!", "Oikawa no era un genio y llegó arriba puliendo lo suyo cada día.", "cita"],
  ["Una lección sin dolor no tiene sentido. Nadie gana nada sin sacrificar algo a cambio.", "Edward Elric", "Fullmetal Alchemist: Brotherhood", "Las agujetas, el madrugón, el táper. Eso es lo que pagas a cambio.", "cita"],
  ["No importa lo fuerte que golpees. Importa lo fuerte que te pueden golpear y seguir avanzando.", "Rocky Balboa", "Rocky Balboa", "Una mala semana, un catarro, exámenes. Lo importante es volver el lunes.", "cita"],
  ["Un paso a la vez, un golpe a la vez, un asalto a la vez.", "Rocky Balboa", "Creed", "No pienses en el año entero. Piensa en esta serie.", "cita"],
  ["Odiaba cada minuto de entrenamiento, pero me decía: no abandones. Sufre ahora y vive el resto de tu vida como un campeón.", "Muhammad Ali", "Boxeo", "Ni a Ali le apetecía siempre. Lo hacía igual.", "cita"],
  ["Nadie va a venir a salvarte.", "David Goggins", "Ultrafondo", "Duro, pero liberador: el cambio depende de ti.", "cita"],
  ["Si ganas, vives. Si pierdes, mueres. Si no luchas, no puedes ganar.", "Eren Jaeger", "Attack on Titan", "No hace falta ganar hoy. Hace falta presentarse a la pelea.", "cita"],
  ["Quiero saber qué significa ser fuerte.", "Ippo Makunouchi", "Hajime no Ippo", "Ippo no sabía ni dar un puñetazo. Le movía la pregunta, no el talento.", "cita"],
  ["Un fracasado puede vencer a un genio a base de trabajo duro.", "Rock Lee", "Naruto", "Lee no podía usar ni ninjutsu ni genjutsu. Se hizo fuerte con lo único que le quedaba: entrenar.", "cita"],
  ["Las cicatrices en la espalda son la vergüenza de un espadachín.", "Roronoa Zoro", "One Piece", "Zoro nunca le da la espalda a un rival, ni aunque vaya a perder. Tú tampoco a la serie que te da miedo.", "cita"],
  ["El trabajo duro no sirve de nada si no crees en ti mismo.", "Naruto Uzumaki", "Naruto", "Puedes entrenar perfecto, pero si vas pensando que no puedes, el peso pesa el doble.", "cita"],
  ["Por muy débil o inútil que te sientas, enciende tu corazón, aprieta los dientes y sigue adelante.", "Kyojuro Rengoku", "Demon Slayer", "Para los días en que todo pesa más de la cuenta. Hoy también cuenta.", "cita"],
  ["No rendirme, esa es mi magia.", "Asta", "Black Clover", "Asta nació sin una gota de magia y aun así se plantó frente a todos. Tu talento es no dejarlo.", "cita"],
  ["Este mundo es cruel, pero también es muy bonito.", "Mikasa Ackerman", "Attack on Titan", "Hay entrenos que duelen y días que salen solos. Los dos forman parte del camino.", "cita"],
  ["Quien no es capaz de sacrificar nada, nunca podrá cambiar nada.", "Armin Arlert", "Attack on Titan", "Cambiar tu cuerpo cuesta algo: horas, sueño, excusas. Elige qué das a cambio.", "cita"],
  ["El miedo no es malo. Te dice cuál es tu debilidad, y cuando la conoces, puedes volverte más fuerte.", "Gildarts Clive", "Fairy Tail", "Ese ejercicio que evitas es justo el que más te va a hacer crecer.", "cita"],
  ["Levántate y camina. Sigue adelante. Tienes dos buenas piernas.", "Edward Elric", "Fullmetal Alchemist: Brotherhood", "Ed lo perdió casi todo y aun así se levantó. Tú también puedes con hoy.", "cita"],
  ["Los sueños de las personas nunca se acaban.", "Barbanegra", "One Piece", "Da igual cuánto tiempo lleves sin entrenar o cuántas veces lo hayas dejado. Siempre puedes volver.", "cita"],
  ["No le des a nadie el poder de decidir tu destino.", "Giyu Tomioka", "Demon Slayer", "Ni a quien te dice que no es para ti, ni a la voz de tu cabeza que lo repite.", "cita"],
  ["Pequeñas acciones con disciplina, repetidas cada día, crean resultados extraordinarios.", "", "ARC", "Una serie, un vaso de agua, un paseo. Por separado no parecen nada; sumados, te cambian.", "leccion"],
  ["Tu rutina escribe tus resultados.", "", "ARC", "No cuenta lo que haces un día, cuenta lo que haces casi todos.", "leccion"],
  ["Sigue apareciendo. A las oportunidades les encanta la repetición.", "", "ARC", "El progreso llega a quien vuelve, no a quien empieza más fuerte.", "leccion"],
  ["Crecer exige aceptar que durante un tiempo vas a hacer el ridículo.", "", "ARC", "Todo el mundo empezó sin saber usar las máquinas. Nadie te mira tanto como crees.", "leccion"],
  ["Tu mentalidad es un arma o una debilidad. Entrénala para que luche a tu favor, no en tu contra.", "", "ARC", "Cada vez que vas sin ganas, entrenas también la cabeza.", "leccion"],
  ["No lo llames meta si lo tratas como un deseo. Una meta tiene horario, coste y consecuencias. Si no tiene nada de eso, es solo una fantasía.", "", "ARC", "Ponle día y hora a tu entreno y deja de ser un deseo.", "leccion"],
  ["La disciplina pesa… pero el arrepentimiento siempre pesará más.", "Rock Lee", "Naruto", "Lee entrenaba hasta caer. Le dolía menos eso que quedarse con las ganas.", "leccion"],
];

/* ============================ ENTRENO ============================ */

// Base de datos de ejercicios de Luna (ARC-001 a ARC-068) + ARC-X: añadidos para tus rutinas, pendientes de tu ficha.
// [id, grupo, nombre, músculo, equipo, explicación simple, truquito]
const EX_DB = [
  ["ARC-001", "Pecho", "Flexiones", "Pectoral, tríceps, hombro anterior", "Peso corporal", "Apoyada en las manos y las puntas de los pies, bajas el pecho hacia el suelo flexionando los codos y vuelves a subir con el cuerpo recto como una tabla.", "Codos a unos 45° del cuerpo, no abiertos en cruz. Si no puedes con el suelo, apoya las manos en un banco y ve bajando la altura con las semanas."],
  ["ARC-002", "Pecho", "Press plano con mancuernas", "Pectoral", "Mancuernas", "Lo mismo que el press de banca con barra, pero cada brazo se mueve de forma independiente, así que exige más estabilidad.", "Baja las mancuernas hasta notar un estiramiento cómodo en el pecho, no hasta tocar el cuerpo. Bajar de más solo mete tensión en el hombro."],
  ["ARC-004", "Pecho", "Press de pecho en máquina", "Pectoral", "Máquina", "Empujas el peso hacia delante desde el pecho, con el recorrido ya guiado por la máquina.", "Aprieta los omóplatos entre sí antes de empezar cada repetición. Si no lo haces, el hombro se lleva parte del trabajo que debería hacer el pecho."],
  ["ARC-006", "Pecho", "Fondos en paralelas o banco", "Pectoral inferior, tríceps", "Peso corporal", "Bajas el cuerpo flexionando los codos y subes empujando, usando tu propio peso como carga.", "Inclina un poco el torso hacia delante si quieres más pecho; mantente más vertical si quieres más tríceps."],
  ["ARC-007", "Espalda", "Dominadas", "Dorsal ancho, bíceps", "Peso corporal", "Colgada de una barra con las palmas mirando hacia delante, tiras del cuerpo hacia arriba hasta pasar la barbilla por encima de la barra y bajas controlada.", "Antes de doblar los codos, baja los hombros alejándolos de las orejas. Piensa en llevar los codos al suelo, no en tirar con los brazos."],
  ["ARC-009", "Espalda", "Jalón al pecho agarre prono", "Dorsal ancho", "Polea", "Tiras de la barra desde arriba hacia el pecho, sentada con las piernas ancladas.", "Antes de tirar con el brazo, lleva primero los hombros hacia abajo y atrás. Así activas la espalda antes que el bíceps."],
  ["ARC-011", "Espalda", "Jalón unilateral en máquina (dorsal)", "Dorsal ancho", "Máquina", "Tiras de un asa con un solo brazo, llevando el codo hacia la cadera. Así trabajas cada lado de la espalda por separado y notas mejor el dorsal.", "Inclina un poco el torso hacia el lado que trabajas y no gires el cuerpo para ayudarte. Aguanta 1 segundo en la contracción."],
  ["ARC-012", "Espalda", "Remo en T", "Dorsal, trapecio medio, romboides", "Barra / máquina", "Inclinada hacia delante con una barra anclada por un extremo, tiras del peso hacia el abdomen. Se trabaja toda la espalda con mucha carga.", "Mantén el pecho alto y la espalda recta, y lleva los codos hacia atrás pegados al cuerpo. Si se te redondea la espalda, baja el peso."],
  ["ARC-013", "Espalda", "Remo agarre neutro sentado", "Dorsal, romboides", "Polea / máquina", "Sentada frente a la polea o la máquina, tiras del agarre con las palmas enfrentadas hacia tu abdomen, juntando los omóplatos.", "Primero lleva los hombros hacia atrás y luego los codos. Aguanta 1 segundo y vuelve despacio, sin inclinarte hacia delante al estirar."],
  ["ARC-014", "Espalda", "Remo agarre prono en máquina sentado", "Dorsal alto, trapecio, romboides", "Máquina", "Sentada con el pecho apoyado, tiras de las asas con las palmas hacia abajo y los codos abiertos, para trabajar la parte alta y media de la espalda.", "Agarre algo más abierto que los hombros. Lleva primero los hombros atrás y después los codos. Controla la vuelta: ahí se construye."],
  ["ARC-015", "Espalda", "Remo con mancuerna a una mano", "Dorsal, romboides", "Mancuerna", "Apoyas una rodilla y una mano en un banco, y tiras de la mancuerna con el otro brazo hacia la cadera.", "Evita rotar el torso al tirar. Si giras el cuerpo para ayudarte, es que el peso es demasiado alto."],
  ["ARC-016", "Espalda", "Remo con barra", "Dorsal, trapecio, romboides", "Barra", "Inclinada hacia delante con una barra en las manos, tiras de ella hacia el abdomen y la bajas controlada.", "Fija el torso desde el principio y no lo muevas. Si necesitas balancearte para subir la barra, baja el peso."],
  ["ARC-019", "Espalda", "Reverse fly en máquina", "Deltoide posterior, espalda alta", "Máquina", "Sentada mirando hacia el respaldo de la máquina, llevas los brazos hacia atrás y hacia los lados para trabajar la parte de atrás del hombro.", "Ajusta el asiento para que las asas queden a la altura del hombro y no encojas los hombros hacia las orejas."],
  ["ARC-020", "Espalda", "Face pull", "Deltoide posterior, trapecio, manguito", "Polea", "Con una cuerda en una polea a la altura de la cara, tiras hacia ti separando las manos, como si fueras a tocarte las orejas con los pulgares.", "Tira hacia la cara abriendo las manos y piensa en enseñar los codos. Usa poco peso y mucho control."],
  ["ARC-021", "Espalda", "Peso muerto convencional", "Espalda baja, glúteo, isquiotibiales", "Barra", "Levantas una barra cargada del suelo hasta quedar completamente de pie, manteniendo la espalda recta todo el recorrido.", "Antes de tirar, empuja el suelo con los pies y aprieta las axilas como si guardaras algo debajo. La barra siempre pegada a las piernas."],
  ["ARC-022", "Hombro", "Press militar con mancuernas", "Deltoide anterior y lateral, tríceps", "Mancuernas", "De pie o sentada, empujas las mancuernas desde la altura de los hombros hacia arriba.", "Aprieta el abdomen como si te fueran a dar un golpe en el estómago. Evita que la zona lumbar se arquee al empujar."],
  ["ARC-023", "Hombro", "Press de hombro en máquina", "Deltoide anterior y lateral", "Máquina", "Empujas el peso hacia arriba por encima de la cabeza, sentada, con el recorrido guiado.", "Baja solo hasta la altura de la barbilla/oreja, no más. Bajar en exceso mete tensión innecesaria en la articulación del hombro."],
  ["ARC-026", "Hombro", "Elevaciones laterales en máquina", "Deltoide lateral", "Máquina", "Sentada, abres los brazos hacia los lados contra las almohadillas hasta la altura de los hombros. La máquina guía el recorrido.", "Empuja con los codos, no con las manos. No subas por encima de la altura de los hombros y no encojas el trapecio."],
  ["ARC-027", "Hombro", "Elevaciones laterales en polea", "Deltoide lateral", "Polea", "Lo mismo que con mancuernas, pero con el cable de una polea baja, lo que mantiene tensión constante en todo el recorrido.", "Colócate algo alejada de la polea y deja que el brazo cruce ligeramente por delante del cuerpo al empezar; así el músculo trabaja desde el primer grado del movimiento."],
  ["ARC-028", "Hombro", "Elevaciones frontales con mancuernas", "Deltoide anterior", "Mancuernas", "De pie, levantas una o dos mancuernas hacia delante hasta la altura del hombro, con los brazos casi rectos.", "Sube solo hasta la altura de los ojos y baja lento. Si balanceas el cuerpo, la mancuerna pesa de más."],
  ["ARC-029", "Bíceps", "Curl de bíceps en máquina", "Bíceps braquial", "Máquina", "Sentada o de pie, flexionas el codo contra resistencia para acercar el peso al hombro.", "No uses impulso de los hombros. Si te cuesta subir sin balancearte, el peso es demasiado alto."],
  ["ARC-036", "Tríceps", "Extensión de tríceps trasnuca con mancuerna de pie", "Tríceps (cabeza larga)", "Mancuerna", "De pie, sujetas una mancuerna con las dos manos por encima de la cabeza, la bajas detrás de la nuca doblando los codos y la subes estirando los brazos.", "Codos apuntando al frente y cerca de la cabeza. Aprieta el abdomen para no arquear la espalda al subir."],
  ["ARC-037", "Tríceps", "Fondos de tríceps en banco", "Tríceps", "Peso corporal", "Apoyas las manos en un banco detrás de ti y bajas el cuerpo flexionando los codos.", "Cuanto más alejados tengas los pies del banco, más difícil se hace. Empieza con las rodillas flexionadas si es tu primera vez."],
  ["ARC-041", "Cuádriceps", "Extensión de cuádriceps", "Cuádriceps", "Máquina", "Sentada, extiendes las piernas contra una resistencia hasta quedar rectas.", "Agárrate a las asas laterales tirando hacia abajo. Fija tu cuerpo y evita que compenses con la cadera."],
  ["ARC-042", "Cuádriceps", "Sentadilla con multipower", "Cuádriceps, glúteo", "Multipower", "Sentadilla con la barra fijada a unos raíles, que guían el movimiento verticalmente.", "Coloca los pies un poco más adelantados que en una sentadilla libre. Como la barra va recta, necesitas ese ajuste para no forzar el tobillo."],
  ["ARC-043", "Cuádriceps", "Sentadilla goblet con mancuerna", "Cuádriceps, glúteo", "Mancuerna", "Sentadilla sujetando una mancuerna o pesa rusa pegada al pecho con ambas manos.", "Usa el peso como \"contrapeso\" para mantenerte erguida: te ayuda a bajar más profundo sin perder el equilibrio."],
  ["ARC-049", "Femoral", "Femoral tumbado", "Isquiotibiales", "Máquina", "Tumbada boca abajo, flexionas las rodillas llevando los talones hacia el glúteo contra resistencia.", "No levantes la cadera del banco al flexionar. Si la cadera sube, estás usando glúteo en vez de femoral."],
  ["ARC-050", "Femoral", "Femoral sentado", "Isquiotibiales", "Máquina", "Sentada, con las piernas estiradas sobre un rodillo, flexionas las rodillas llevando el rodillo hacia abajo/atrás.", "Mantén la espalda pegada al respaldo durante todo el recorrido; despegarla resta tensión al músculo que estás trabajando."],
  ["ARC-051", "Femoral", "Peso muerto rumano con mancuernas", "Isquiotibiales, glúteo", "Mancuernas", "Con las piernas casi rectas, bajas las mancuernas pegadas a las piernas manteniendo la espalda neutra, y vuelves a subir.", "La sensación de estiramiento en la parte de atrás del muslo es tu límite de bajada, no una distancia fija. Cuando notes ese tope, para ahí."],
  ["ARC-052", "Femoral", "Peso muerto rumano a una mano", "Isquiotibiales, glúteo", "Mancuerna", "Con una mancuerna en una mano, haces una bisagra de cadera: llevas el glúteo hacia atrás, bajas la mancuerna pegada a la pierna y vuelves a subir.", "Baja en 3-4 segundos y haz una micropausa abajo. Mantén la cadera cuadrada, sin girar el torso hacia el lado de la mancuerna."],
  ["ARC-054", "Glúteo y cadera", "Hip thrust en máquina", "Glúteo mayor", "Máquina", "Sentada con la espalda apoyada en el respaldo y el rodillo sobre la cadera, subes la cadera empujando con los talones hasta quedar en línea con el tronco.", "Mete la barbilla y mira al frente: así la espalda no se arquea y el trabajo se lo lleva el glúteo. Aguanta 1 segundo arriba apretando."],
  ["ARC-055", "Glúteo y cadera", "Hip thrust a una pierna", "Glúteo mayor", "Peso corporal / banco", "Igual que el hip thrust normal, pero con una sola pierna apoyada y la otra estirada en el aire, para trabajar cada lado por separado.", "Empieza por la pierna que peor te sale y repite el mismo número de repeticiones en la otra. Mantén la cadera nivelada, sin girar."],
  ["ARC-060", "Glúteo y cadera", "Abducción de cadera en máquina", "Glúteo medio", "Máquina", "Sentada, separas las piernas hacia fuera contra resistencia.", "Inclínate ligeramente hacia delante en el asiento. Cambia el ángulo y mejora cuánto trabaja el glúteo frente a la cadera."],
  ["ARC-067", "Abdomen", "Elevación de piernas", "Abdomen inferior, flexores de cadera", "Peso corporal", "Levantas las piernas (rectas o flexionadas) usando el abdomen, en vez del impulso de las caderas.", "Si notas que trabaja más la zona lumbar o la cadera que el abdomen, flexiona más las rodillas hasta que sea manejable con buena técnica."],
  ["ARC-069", "Espalda", "Remo en polea baja con barra", "Dorsal, romboides", "Polea", "Sentada en la polea baja con los pies apoyados, tiras de la barra hacia el abdomen con las palmas mirando hacia abajo y la espalda recta.", "Primero junta las escápulas y después dobla los codos. Llega con la barra al ombligo, no al pecho, y vuelve estirando los brazos sin encorvarte."],
  ["ARC-070", "Espalda", "Jalón unilateral en polea", "Dorsal ancho", "Polea", "Sentada de lado a la polea alta, tiras del agarre con un brazo llevando el codo hacia la cadera, y luego cambias de lado.", "Piensa en meter el codo en el bolsillo del pantalón. Si giras el tronco para ayudarte, baja el peso."],
  ["ARC-072", "Femoral", "Peso muerto rumano con barra", "Isquiotibiales, glúteo", "Barra", "De pie con la barra en las manos, bajas llevando la cadera hacia atrás con las rodillas un poco flexionadas, la barra pegada a las piernas, y subes apretando glúteo.", "Baja hasta notar que tira el femoral, no hasta el suelo. Espalda recta y barra rozando las piernas todo el rato."],
  ["ARC-073", "Espalda", "Dominada con banda elástica", "Dorsal ancho, bíceps", "Banda elástica", "Enganchas una banda a la barra y metes la rodilla o el pie dentro: te ayuda en la parte más difícil de la subida.", "Usa la banda que te deje hacer 6-8 buenas. Cuando te salgan fáciles, cambia a una más fina."],
  ["ARC-075", "Cuádriceps", "Sentadilla hack", "Cuádriceps, glúteo", "Máquina", "Con la espalda apoyada en el respaldo inclinado y los hombros bajo las almohadillas, bajas doblando las rodillas y vuelves a subir empujando la plataforma.", "Pies a la anchura de la cadera y espalda pegada al respaldo todo el recorrido. Baja hasta donde no se te despegue la zona lumbar."],
  ["ARC-076", "Cuádriceps", "Sentadilla péndulo", "Cuádriceps, glúteo", "Máquina", "En la máquina de péndulo, con los hombros bajo las almohadillas, bajas en arco doblando las rodillas y subes empujando con toda la planta del pie.", "Deja que las rodillas avancen por delante de los pies, que es lo que la hace tan buena para cuádriceps. Baja controlando, sin rebotar abajo."],
  ["ARC-077", "Abdomen", "Plancha arriba-abajo", "Core, hombro, tríceps", "Peso corporal", "Desde plancha sobre los antebrazos, subes apoyando una mano y luego la otra hasta plancha alta, y bajas otra vez a los codos.", "Que la cadera no se balancee de lado a lado: separa un poco los pies y aprieta glúteo. Alterna el brazo con el que empiezas."],
  ["ARC-078", "Cuádriceps", "Sentadilla búlgara con mancuernas", "Cuádriceps, glúteo", "Mancuernas + banco", "Con el empeine de atrás apoyado en un banco y una mancuerna en cada mano, bajas en vertical doblando la rodilla de delante y subes empujando con ese pie.", "Inclinar un poco el tronco hacia delante carga más el glúteo; más recta, más cuádriceps. Empieza con poco peso hasta pillar el equilibrio."],
  ["ARC-079", "Abdomen", "Rueda abdominal", "Recto abdominal, core", "Rueda", "De rodillas con la rueda en las manos, la llevas hacia delante estirando el cuerpo y vuelves tirando con el abdomen.", "Aprieta glúteo y no dejes que se hunda la zona lumbar. Llega solo hasta donde puedas volver sin arquear la espalda."],
  ["ARC-080", "Cuádriceps", "Sentadilla con peso corporal", "Cuádriceps, glúteo", "Peso corporal", "Con los pies a la anchura de los hombros y los brazos delante, bajas llevando la cadera atrás y abajo y vuelves a subir.", "Ideal para aprender el movimiento o calentar. Rodillas en la línea de las puntas y talones pegados al suelo."],
  ["ARC-081", "Abdomen", "Crunch en el suelo", "Recto abdominal", "Peso corporal", "Tumbada bocarriba con las rodillas dobladas, despegas los hombros del suelo curvando la espalda alta y bajas despacio.", "No tires del cuello: la barbilla un poco separada del pecho. Sube solo hasta despegar los omóplatos, el resto lo hacen los flexores de cadera."],
  ["ARC-082", "Glúteo y cadera", "Hip thrust con peso corporal", "Glúteo mayor", "Banco", "Con la espalda alta apoyada en un banco y los pies en el suelo, subes la cadera apretando glúteo hasta quedar recta y bajas despacio.", "Perfecto para aprender el movimiento o para hacer en casa. Mira al frente, no al techo, y aguanta un segundo arriba."],
  ["ARC-083", "Abdomen", "Escaladores", "Core, abdomen, hombro", "Peso corporal", "En plancha alta, llevas una rodilla hacia el pecho y la devuelves, alternando las piernas.", "Hombros encima de las manos y cadera baja. Despacio trabaja el core; rápido se convierte en cardio."],
  ["ARC-084", "Pecho", "Flexiones de rodillas", "Pectoral, tríceps, hombro anterior", "Peso corporal", "Como una flexión normal, pero con las rodillas apoyadas en el suelo: bajas el pecho hasta casi tocar y empujas.", "Cuerpo recto de rodillas a cabeza, sin sacar el culo. Es el paso previo para llegar a las flexiones completas."],
  ["ARC-085", "Pecho", "Flexiones inclinadas en banco", "Pectoral, tríceps, hombro anterior", "Banco", "Con las manos en un banco y el cuerpo recto, bajas el pecho hacia el borde y empujas hasta estirar los brazos.", "Cuanto más alto el apoyo, más fácil. Codos a unos 45 grados del cuerpo, no abiertos en cruz."],
  ["ARC-087", "Tríceps", "Extensión de tríceps tumbada con mancuernas", "Tríceps", "Mancuernas + banco", "Tumbada en un banco con una mancuerna en cada mano y los brazos estirados, doblas solo los codos bajando las mancuernas junto a la cabeza y vuelves a estirar.", "Los codos apuntan al techo y no se abren: solo se mueve el antebrazo. Baja despacio y controla el peso cerca de la cabeza."],
  ["ARC-088", "Espalda", "Chin up (dominada supina)", "Dorsal ancho, bíceps", "Barra", "Colgada de la barra con las palmas mirando hacia ti y las manos a la anchura de los hombros, subes hasta pasar la barbilla por encima y bajas controlando.", "Suele salir antes que la dominada normal porque ayuda más el bíceps. Baja hasta estirar los brazos del todo en cada repetición."],
  ["ARC-M01", "Movilidad", "Círculos de brazos", "Hombro", "Peso corporal", "De pie con los brazos estirados a los lados, haces círculos hacia delante y luego hacia atrás, de pequeños a grandes.", "10 hacia delante y 10 hacia atrás. Hombros lejos de las orejas."],
  ["ARC-M02", "Movilidad", "Movilidad de hombro con palo", "Hombro", "Palo o banda", "Con un palo agarrado muy abierto y los brazos estirados, lo pasas por encima de la cabeza hasta detrás y vuelves.", "Si no pasa sin doblar los codos, abre más el agarre. 10 repeticiones lentas."],
  ["ARC-M03", "Movilidad", "Rodilla al pecho de pie", "Glúteo y cadera", "Peso corporal", "De pie, subes una rodilla y la abrazas contra el pecho un segundo; bajas y cambias de pierna, caminando o en el sitio.", "Ponte de puntillas con la pierna de apoyo para ganar equilibrio. 8 por pierna."],
  ["ARC-M04", "Movilidad", "Balanceo de pierna adelante y atrás", "Cadera y femoral", "Peso corporal", "Apoyada en una pared o máquina, balanceas una pierna estirada hacia delante y hacia atrás, cada vez un poco más alto.", "El tronco quieto: se mueve la pierna, no la espalda. 10-12 por pierna."],
  ["ARC-M05", "Movilidad", "Balanceo de pierna lateral", "Aductores y glúteo medio", "Peso corporal", "De frente a una pared y apoyada con las manos, balanceas una pierna de lado a lado por delante del cuerpo.", "Abre un poco más en cada balanceo, sin forzar. 10-12 por pierna."],
  ["ARC-M06", "Movilidad", "Zancada de corredor", "Flexor de cadera", "Peso corporal", "En zancada larga con las manos en el suelo a los lados del pie de delante, llevas la cadera hacia delante y hacia atrás.", "La rodilla de atrás puede ir apoyada. 8 balanceos por lado, sin rebotes."],
  ["ARC-M07", "Movilidad", "World's greatest stretch", "Cadera, espalda alta y hombro", "Peso corporal", "Desde la zancada de corredor, apoyas la mano contraria en el suelo y abres el otro brazo hacia el techo girando el pecho.", "Sigue la mano con la mirada. 5 por lado. Calienta casi todo el cuerpo en un solo ejercicio."],
  ["ARC-M08", "Movilidad", "Cadera 90/90", "Cadera", "Suelo", "Sentada en el suelo con las dos rodillas dobladas a 90 grados, giras las piernas de un lado a otro.", "Pecho alto y sin usar las manos si puedes. 6-8 cambios lentos."],
  ["ARC-M09", "Movilidad", "Plancha con rotación", "Abdomen y hombro", "Peso corporal", "En plancha sobre los codos, giras el cuerpo hacia un lado hasta quedar en plancha lateral y vuelves al centro.", "Cadera alta, sin hundirla al girar. 5 por lado, controlado."],
  // Añadidos (no están en tu base de datos): revisa y escribe tu propia ficha
  ["ARC-X01", "Cuádriceps", "Sentadilla búlgara en Smith", "Cuádriceps, glúteo", "Multipower + banco", "Con el empeine de atrás apoyado en un banco y la barra guiada sobre la espalda, bajas en vertical doblando la rodilla de delante.", "Pie de delante más adelantado = más glúteo; más cerca de la barra = más cuádriceps."],
  ["ARC-X02", "Femoral", "Peso muerto rumano en Smith", "Isquiotibiales, glúteo", "Multipower", "Bisagra de cadera con la barra guiada: llevas el glúteo hacia atrás y la barra baja pegada a las piernas.", "Para cuando notes el estiramiento del femoral, no cuando la barra llegue abajo."],
  ["ARC-X03", "Glúteo y cadera", "Patada de glúteo en polea", "Glúteo mayor", "Polea", "Con la tobillera enganchada a una polea baja, llevas la pierna hacia atrás desde la cadera y vuelves despacio.", "Inclínate un poco hacia delante y no arquees la zona lumbar al subir la pierna."],
  ["ARC-X04", "Pecho", "Press banca con barra", "Pectoral, tríceps", "Barra", "Tumbada en el banco, bajas la barra hasta el pecho y la empujas hasta estirar los brazos.", "Omóplatos juntos y pies firmes en el suelo; la barra baja a la altura del esternón."],
  ["CARDIO", "Cardio", "Cardio (cinta inclinada, bici o elíptica)", "Corazón y piernas", "Máquina", "Ritmo en el que puedas hablar pero te cueste un poco.", "Si vas con poco tiempo, mejor 20 minutos que nada."],
  ["MOVILIDAD", "Movilidad", "Movilidad y estiramientos", "Todo el cuerpo", "Peso corporal", "Cadera, tobillos, espalda alta y hombros, sin prisa.", "Respira lento y no fuerces el estiramiento."],
];

const EX_EXTRA = {
  "ARC-042": { lift: "squat" },   // sentadilla en multipower cuenta para tu ratio
  "ARC-021": { lift: "deadlift" },
  "ARC-X04": { lift: "bench" },
  "ARC-007": { pull: true, note: "No te preocupes si aún no te sale: abajo tienes sus variantes (chin up y con banda elástica) para ir llegando." },
  "CARDIO": { unit: "min" },
  "MOVILIDAD": { unit: "min" },
};

let GROUPS = [...new Set(EX_DB.map((e) => e[1]))];
let EXERCISES = Object.fromEntries(EX_DB.map(([id, group, n, muscle, equip, simple, tip]) => [id, { id, group, n, muscle, equip, simple, tip, ...(EX_EXTRA[id] || {}) }]));

// sesiones guardadas con la versión anterior
const LEGACY_EX = { sentadilla: "ARC-042", pesoMuerto: "ARC-021", pressBanca: "ARC-X04", dominadas: "ARC-007", hipThrust: "ARC-054", rumano: "ARC-051", bulgaras: "ARC-X01", prensa: "ARC-075", curlFemoral: "ARC-049", abduccion: "ARC-060", remo: "ARC-016", remoMancuerna: "ARC-015", pressMilitar: "ARC-022", elevLaterales: "ARC-026", jalon: "ARC-009", fondos: "ARC-006", flexiones: "ARC-001", crunch: "ARC-081", elevPiernas: "ARC-067", plancha: "ARC-077", cardio: "CARDIO", movilidad: "MOVILIDAD" };

// Días al estilo ARC: [ejercicio, series, reps, RIR, descanso en s]
const DAY_TEMPLATES = {
  piernaGluteo: { name: "Pierna y glúteo", ex: [["ARC-042", 4, "6–8", 2, 150], ["ARC-X01", 3, "8–10 por pierna", 2, 120], ["ARC-X02", 3, "8–10", 2, 120], ["ARC-049", 3, "10–12", 1, 90], ["ARC-060", 3, "12–15", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  espaldaBiceps: { name: "Espalda y bíceps", ex: [["ARC-007", 4, "máx.", 1, 150], ["ARC-009", 3, "8–10", 2, 120], ["ARC-013", 3, "10–12", 1, 90], ["ARC-011", 3, "10–12 por brazo", 1, 90], ["ARC-029", 3, "10–12", 1, 60], ["ARC-026", 3, "12–15", 1, 60]] },
  gluteoFemoral: { name: "Glúteo y femoral", ex: [["ARC-054", 4, "8–10", 1, 120], ["ARC-021", 3, "4–6", 2, 180], ["ARC-050", 3, "10–12", 1, 90], ["ARC-X03", 3, "12–15", 1, 60], ["ARC-067", 3, "10–15", 1, 60]] },
  empuje: { name: "Pecho, hombro y tríceps", ex: [["ARC-002", 3, "8–10", 2, 120], ["ARC-004", 3, "10–12", 1, 90], ["ARC-023", 3, "8–10", 2, 90], ["ARC-027", 3, "12–15", 1, 60], ["ARC-036", 3, "10–12", 1, 60]] },
  cuadriceps: { name: "Cuádriceps", ex: [["ARC-042", 4, "6–8", 2, 150], ["ARC-075", 3, "10–12", 1, 120], ["ARC-041", 3, "12–15", 1, 60], ["ARC-078", 3, "10 por pierna", 2, 90]] },
  calistenia: { name: "Calistenia y core", ex: [["ARC-007", 4, "máx.", 1, 120], ["ARC-001", 3, "máx.", 1, 90], ["ARC-006", 3, "máx.", 1, 90], ["ARC-067", 3, "10–15", 1, 60], ["ARC-077", 3, "30–45", 0, 60], ["ARC-083", 3, "20", 1, 45]] },
  cardioAbs: { name: "Cardio y abdominales", ex: [["CARDIO", 1, "30", 0, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"], ["ARC-067", 3, "10–15", 1, 60], ["ARC-077", 3, "45", 0, 60]] },
  fullA: { name: "Full body A", ex: [["ARC-042", 4, "6–8", 2, 150], ["ARC-054", 3, "8–10", 1, 120], ["ARC-009", 3, "8–10", 2, 90], ["ARC-004", 3, "10–12", 1, 90], ["ARC-026", 3, "12–15", 1, 60], ["ARC-077", 3, "30–45", 0, 60]] },
  torsoA: { name: "Torso A", ex: [["ARC-X04", 4, "6–8", 2, 150], ["ARC-009", 3, "8–10", 2, 120], ["ARC-022", 3, "8–10", 2, 90], ["ARC-013", 3, "10–12", 1, 90], ["ARC-026", 3, "12–15", 1, 60], ["ARC-036", 3, "10–12", 1, 60], ["ARC-029", 3, "10–12", 1, 60]] },
  piernaA: { name: "Pierna A", ex: [["ARC-042", 4, "6–8", 2, 180], ["ARC-051", 3, "8–10", 2, 120], ["ARC-075", 3, "10–12", 1, 120], ["ARC-049", 3, "10–12", 1, 90], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  torsoB: { name: "Torso B", ex: [["ARC-007", 4, "máx.", 1, 150], ["ARC-002", 3, "8–10", 2, 120], ["ARC-016", 3, "8–10", 2, 120], ["ARC-004", 3, "10–12", 1, 90], ["ARC-020", 3, "12–15", 1, 60], ["ARC-036", 3, "10–12", 1, 60], ["ARC-029", 3, "10–12", 1, 60]] },
  piernaB: { name: "Pierna B", ex: [["ARC-021", 3, "4–6", 2, 180], ["ARC-X01", 3, "8–10 por pierna", 2, 120], ["ARC-054", 3, "8–10", 1, 120], ["ARC-041", 3, "12–15", 1, 60], ["ARC-050", 3, "10–12", 1, 60], ["ARC-067", 3, "10–15", 1, 60]] },
  hombroBrazo: { name: "Hombro y brazos", ex: [["ARC-022", 3, "8–10", 2, 90], ["ARC-026", 3, "12–15", 1, 60], ["ARC-019", 3, "12–15", 1, 60], ["ARC-029", 3, "10–12", 1, 60], ["ARC-036", 3, "10–12", 1, 60], ["ARC-037", 3, "máx.", 1, 60]] },
  fullMA: { name: "Full body A", ex: [["ARC-042", 4, "6–8", 2, 180], ["ARC-X04", 4, "6–8", 2, 150], ["ARC-009", 3, "8–10", 2, 90], ["ARC-022", 3, "8–10", 2, 90], ["ARC-049", 3, "10–12", 1, 60], ["ARC-077", 3, "30–45", 0, 60]] },
  fullMB: { name: "Full body B", ex: [["ARC-021", 3, "4–6", 2, 180], ["ARC-007", 4, "máx.", 1, 150], ["ARC-002", 3, "8–10", 2, 120], ["ARC-013", 3, "10–12", 1, 90], ["ARC-026", 3, "12–15", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  fullMC: { name: "Full body C", ex: [["ARC-075", 3, "10–12", 1, 120], ["ARC-X04", 3, "8–10", 2, 120], ["ARC-016", 3, "8–10", 2, 120], ["ARC-041", 3, "12–15", 1, 60], ["ARC-027", 3, "12–15", 1, 60], ["ARC-036", 3, "10–12", 1, 60], ["ARC-029", 3, "10–12", 1, 60]] },
  fullB: { name: "Full body B", ex: [["ARC-021", 3, "4–6", 2, 180], ["ARC-007", 4, "máx.", 1, 150], ["ARC-075", 3, "10–12", 1, 120], ["ARC-013", 3, "10–12", 1, 90], ["ARC-023", 3, "8–10", 2, 90], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  // Prioridad glúteo: casi nada de pecho, mucho glúteo y pierna, espalda y hombro para la postura
  fullGA: { name: "Full body A", ex: [["ARC-054", 4, "8–10", 1, 120], ["ARC-042", 3, "6–8", 2, 150], ["ARC-009", 3, "8–10", 2, 90], ["ARC-022", 3, "8–10", 2, 90], ["ARC-060", 3, "12–15", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  fullGB: { name: "Full body B", ex: [["ARC-021", 3, "4–6", 2, 180], ["ARC-X01", 3, "8–10 por pierna", 2, 120], ["ARC-050", 3, "10–12", 1, 90], ["ARC-013", 3, "10–12", 1, 90], ["ARC-026", 3, "12–15", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  gluteoA: { name: "Glúteo A", ex: [["ARC-054", 4, "8–10", 1, 120], ["ARC-042", 3, "6–8", 2, 150], ["ARC-X01", 3, "8–10 por pierna", 2, 120], ["ARC-060", 3, "12–15", 1, 60], ["ARC-X03", 3, "12–15 por pierna", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  gluteoB: { name: "Glúteo y femoral", ex: [["ARC-021", 3, "4–6", 2, 180], ["ARC-072", 3, "8–10", 2, 120], ["ARC-050", 3, "10–12", 1, 90], ["ARC-055", 3, "10–12 por pierna", 1, 60], ["ARC-060", 3, "15–20", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  piernaQ: { name: "Pierna y glúteo", ex: [["ARC-076", 3, "8–10", 2, 120], ["ARC-075", 3, "10–12", 1, 120], ["ARC-078", 3, "8–10 por pierna", 2, 90], ["ARC-054", 3, "10–12", 1, 90], ["ARC-041", 3, "12–15", 1, 60]] },
  gluteoC: { name: "Glúteo C", ex: [["ARC-054", 3, "12–15", 1, 90], ["ARC-078", 3, "10 por pierna", 2, 90], ["ARC-051", 3, "10–12", 1, 90], ["ARC-060", 3, "15–20", 1, 60], ["ARC-X03", 3, "12–15 por pierna", 1, 60], ["ARC-081", 3, "12–15", 1, 60, "abs"]] },
  superiorA: { name: "Espalda y hombro", ex: [["ARC-009", 3, "8–10", 2, 120], ["ARC-013", 3, "10–12", 1, 90], ["ARC-022", 3, "8–10", 2, 90], ["ARC-026", 3, "12–15", 1, 60], ["ARC-019", 3, "12–15", 1, 60], ["ARC-036", 2, "10–12", 1, 60], ["ARC-029", 2, "10–12", 1, 60]] },
  superiorB: { name: "Hombro, espalda y brazos", ex: [["ARC-011", 3, "10–12 por brazo", 1, 90], ["ARC-015", 3, "10–12", 1, 90], ["ARC-022", 3, "8–10", 2, 90], ["ARC-027", 3, "12–15", 1, 60], ["ARC-001", 2, "máx.", 1, 60], ["ARC-029", 3, "10–12", 1, 60], ["ARC-036", 3, "10–12", 1, 60]] },
};
const SPLITS_GLUTE = {
  2: ["fullGA", "fullGB"],
  3: ["gluteoA", "superiorA", "gluteoB"],
  4: ["gluteoA", "superiorA", "piernaQ", "gluteoB"],
  5: ["gluteoA", "superiorA", "piernaQ", "gluteoB", "superiorB"],
  6: ["gluteoA", "superiorA", "piernaQ", "gluteoB", "superiorB", "gluteoC"],
  7: ["gluteoA", "superiorA", "piernaQ", "gluteoB", "superiorB", "gluteoC", "cardioAbs"],
};
const SPLITS = {
  2: ["fullA", "fullB"],
  3: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral"],
  4: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje"],
  5: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje", "cuadriceps"],
  6: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje", "cuadriceps", "calistenia"],
  7: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje", "cuadriceps", "calistenia", "cardioAbs"],
};
const SPLITS_MALE = {
  2: ["fullMA", "fullMB"],
  3: ["fullMA", "fullMB", "fullMC"],
  4: ["torsoA", "piernaA", "torsoB", "piernaB"],
  5: ["torsoA", "piernaA", "torsoB", "piernaB", "hombroBrazo"],
  6: ["torsoA", "piernaA", "torsoB", "piernaB", "hombroBrazo", "calistenia"],
  7: ["torsoA", "piernaA", "torsoB", "piernaB", "hombroBrazo", "calistenia", "cardioAbs"],
};
// cada básico que cuenta para el nivel tiene que aparecer en la semana
const LIFT_HOME = {
  squat: { ex: "ARC-042", prefer: ["piernaGluteo", "gluteoA", "cuadriceps", "fullA", "fullGA", "piernaQ"] },
  deadlift: { ex: "ARC-021", prefer: ["gluteoFemoral", "gluteoB", "fullB", "fullGB", "piernaGluteo"] },
  bench: { ex: "ARC-X04", prefer: ["empuje", "fullA", "espaldaBiceps"] },
};
const FOCUS = [
  { id: "gluteo", label: "Glúteo y pierna" },
  { id: "equilibrado", label: "Todo por igual" },
  { id: "superior", label: "Tren superior" },
];
const focusOf = (p) => p?.focus || (p?.branch === "male" ? "equilibrado" : "gluteo");
const UPPER_DAYS = ["superiorA", "superiorB", "espaldaBiceps", "empuje", "torsoA", "torsoB", "hombroBrazo", "calistenia", "fullA", "fullB", "fullGA", "fullGB", "fullMA", "fullMB", "fullMC"];
function buildRoutine(days, branch, profile = {}) {
  const focus = focusOf({ ...profile, branch });
  const S = focus === "gluteo" ? SPLITS_GLUTE : focus === "superior" || branch === "male" ? SPLITS_MALE : SPLITS;
  const keys = S[days] || S[3];
  const plan = keys.map((k) => ({ key: k, ex: [...DAY_TEMPLATES[k].ex] }));
  const lifts = branch === "male" && focus !== "gluteo" ? ["squat", "deadlift", "bench"] : ["squat", "deadlift"];
  // En déficit: 15-20 min de cardio al final de dos días de tren superior (o de los dos primeros)
  if (profile.goal === "deficit") {
    const ups = plan.filter((d) => UPPER_DAYS.includes(d.key) && !d.ex.some(([id]) => id === "CARDIO"));
    (ups.length ? ups : plan).slice(0, 2).forEach((d) => d.ex.push(["CARDIO", 1, "15–20", 0, 60]));
  }
  for (const l of lifts) {
    const has = plan.some((d) => d.ex.some(([id]) => EXERCISES[id].lift === l));
    if (has) continue;
    const key = LIFT_HOME[l].prefer.find((k) => plan.some((d) => d.key === k));
    const target = plan.find((d) => d.key === key) || plan[0];
    target.ex.unshift([LIFT_HOME[l].ex, 3, "4–6", 2, 180]);
  }
  return plan.map((d, i) => ({
    id: "ABCDEFG"[i],
    name: DAY_TEMPLATES[d.key].name,
    ex: d.ex.map(([id, sets, reps, rir, rest, pick]) => ({ id, sets, reps, rir, rest, ...(pick ? { pick } : {}) })),
  }));
}

/* ============================ NUTRICIÓN ============================ */

// Base de datos de Luna (por 100 g). tofu y soja texturizada añadidos para la versión vegetariana.
let FOODS = {
  panIntegral: { n: "Pan integral", p: 10, c: 49, f: 1.3 },
  panCristal: { n: "Pan cristal", p: 7.3, c: 43, f: 2.3 },
  panHamburguesa: { n: "Pan de hamburguesa integral", p: 11, c: 40, f: 4.8 },
  maxiTortilla: { n: "Maxi tortilla de trigo", p: 8.4, c: 50, f: 5.8 },
  basePizza: { n: "Base de pizza", p: 6.5, c: 53.4, f: 4.4 },
  avena: { n: "Avena", p: 12.2, c: 59.9, f: 7.1 },
  arroz: { n: "Arroz", p: 5.8, c: 82.2, f: 0.8 },
  pasta: { n: "Pasta", p: 13, c: 71, f: 1.5 },
  patata: { n: "Patata cocida", p: 1.7, c: 15.7, f: 0.1 },
  noquis: { n: "Ñoquis", p: 4.5, c: 37.6, f: 0.4 },
  tortitasArroz: { n: "Tortitas de arroz/maíz", p: 7.5, c: 80, f: 1.7 },
  platano: { n: "Plátano", p: 1, c: 26, f: 0.5 },
  arandanos: { n: "Arándanos", p: 0.7, c: 11, f: 0 },
  datiles: { n: "Dátiles", p: 2.2, c: 68, f: 0.5 },
  pavo: { n: "Pechuga de pavo 90%", p: 19.5, c: 1, f: 1.3 },
  jamon: { n: "Jamón serrano", p: 33.5, c: 1, f: 12 },
  pollo: { n: "Pechuga de pollo", p: 21.4, c: 0, f: 3.1 },
  tirasPollo: { n: "Tiras de pechuga de pollo", p: 23.4, c: 0.6, f: 0.6 },
  hambPollo: { n: "Hamburguesa de pollo magra", p: 22, c: 0.5, f: 5.4 },
  terneraPicada: { n: "Ternera picada magra", p: 21.5, c: 1.4, f: 5 },
  merluza: { n: "Merluza", p: 19, c: 0, f: 1.3 },
  salmon: { n: "Salmón", p: 20, c: 0, f: 16 },
  salmonAhumado: { n: "Salmón ahumado", p: 22, c: 0.5, f: 9.1 },
  lomoAtun: { n: "Lomo de atún", p: 20, c: 0.5, f: 1 },
  huevo: { n: "Huevo M", p: 12.4, c: 1, f: 10 },
  claras: { n: "Claras de huevo", p: 11, c: 0.5, f: 0.5 },
  proteina: { n: "Proteína en polvo", p: 80, c: 6.7, f: 3.3 },
  yogurProt: { n: "Yogur +proteínas", p: 10, c: 3.7, f: 0.5 },
  quesoBatido: { n: "Queso fresco batido", p: 8, c: 3.5, f: 0.5 },
  quesoBurgos: { n: "Queso burgos 0%", p: 12.3, c: 4.4, f: 0.2 },
  quesoCrema: { n: "Queso crema light", p: 9, c: 4.8, f: 8.3 },
  mozzarella: { n: "Mozzarella rallada", p: 21, c: 2.5, f: 21 },
  lecheSemi: { n: "Leche semidesnatada", p: 3.1, c: 4.8, f: 1.6 },
  aove: { n: "AOVE", p: 0, c: 0, f: 100 },
  aguacate: { n: "Aguacate", p: 2, c: 15.2, f: 14.7 },
  guacamole: { n: "Guacamole", p: 1.9, c: 3.8, f: 13.7 },
  cremaCacahuete: { n: "Crema de cacahuete 100%", p: 30, c: 12, f: 47 },
  frutosSecos: { n: "Frutos secos naturales", p: 21.9, c: 19, f: 48 },
  cacao: { n: "Cacao puro desgrasado", p: 25.5, c: 16.3, f: 16 },
  verduras: { n: "Verduras", p: 2, c: 6, f: 0.4 },
  tomateFrito: { n: "Tomate frito con AOVE", p: 1.5, c: 9.5, f: 3.5 },
  salsaTomate: { n: "Salsa de tomate y albahaca", p: 1.8, c: 5.2, f: 0.1 },
  tortillaIntegral: { n: "Tortilla de trigo integral", p: 8.1, c: 50, f: 7.8 },
  muesli: { n: "Muesli 0% crunchy", p: 8.8, c: 52, f: 12 },
  lentejas: { n: "Lentejas a la jardinera", p: 3.5, c: 9, f: 1.5 },
  legumbres: { n: "Legumbres cocidas", p: 8.2, c: 10.7, f: 0.4 },
  atun: { n: "Atún al natural", p: 21, c: 0.9, f: 1.2 },
  emperador: { n: "Emperador", p: 18.2, c: 3, f: 6.2 },
  batata: { n: "Batata", p: 1.6, c: 26, f: 5 },
  lecheAlmendras: { n: "Leche de almendras 0%", p: 0.5, c: 0, f: 1.5 },
  cremaVerduras: { n: "Crema de verduras", p: 0.8, c: 4.5, f: 0.8 },
  cremaLentejas: { n: "Crema de lentejas (Hacendado)", p: 4.6, c: 6.1, f: 2.2 },
  cremaCalabaza: { n: "Crema de calabaza y zanahoria (Hacendado)", p: 0.9, c: 4.2, f: 2.8 },
  parrilladaVerduras: { n: "Parrillada de verduras congelada (Hacendado)", p: 2.2, c: 10, f: 0 },
  pimientoCongelado: { n: "Pimiento troceado congelado (Hacendado)", p: 0.9, c: 4.5, f: 0.4 },
  panSemillas: { n: "Pan de semillas (Hacendado)", p: 11, c: 43, f: 8 },
  panCenteno: { n: "Pan de centeno 82% con masa madre (Hacendado)", p: 5.5, c: 41, f: 1.3 },
  panIntegralHorno: { n: "Pan 100% integral (El Horno de Mercadona)", p: 9.1, c: 38, f: 2.5 },
  panMasaMadre: { n: "Pan de masa madre integral o de centeno (panadería)", p: 9, c: 44, f: 1.5 },
  tortitasLegumbres: { n: "Tortitas de legumbres (Hacendado)", p: 25, c: 55, f: 3.1 },
  tomateUntar: { n: "Tomate para untar con AOVE (Hacendado)", p: 0.9, c: 3.7, f: 4.8 },
  guisantes: { n: "Guisantes congelados (Hacendado)", p: 6, c: 11, f: 0.4 },
  aguaCoco: { n: "Agua de coco (Hacendado)", p: 0, c: 5, f: 0 },
  uvas: { n: "Uvas", p: 0.7, c: 17, f: 0.2 },
  kiwi: { n: "Kiwi", p: 1.1, c: 11, f: 0.4 },
  mermelada: { n: "Mermelada 0%", p: 0.6, c: 11.5, f: 0 },
  cottage: { n: "Queso cottage", p: 13, c: 1.6, f: 4 },
  tortillaMaiz: { n: "Tortilla de maíz", p: 4.3, c: 37, f: 2.6 },
  pina: { n: "Piña", p: 0.5, c: 14, f: 0 },
  tofu: { n: "Tofu firme", p: 15, c: 2, f: 8 },
  soja: { n: "Soja texturizada", p: 50, c: 30, f: 1 },
  fresas: { n: "Fresas", p: 0.7, c: 7.7, f: 0.3 },
  frutosRojos: { n: "Frutos rojos congelados", p: 1, c: 9, f: 0.3 },
  chia: { n: "Semillas de chía", p: 17, c: 8, f: 31 },
  udon: { n: "Fideos udon (cocidos)", p: 2.6, c: 21, f: 0.4 },
  pastaLentejas: { n: "Pasta de lentejas rojas", p: 25, c: 50, f: 2.5 },
  lomoCerdo: { n: "Lomo de cerdo magro", p: 21, c: 0, f: 6 },
  hambTernera: { n: "Hamburguesa de ternera magra", p: 20, c: 1, f: 10 },
  salsaBBQ: { n: "Salsa barbacoa", p: 1, c: 40, f: 0.5 },
};

const VEG_SWAP = {
  lomoCerdo: "soja", hambTernera: "soja",
  pollo: "soja", tirasPollo: "soja", hambPollo: "soja", terneraPicada: "soja",
  merluza: "tofu", salmon: "tofu", lomoAtun: "tofu", salmonAhumado: "quesoBurgos",
  pavo: "quesoBurgos", jamon: "quesoBurgos",
};

const LIMITS = { chia: 15, salsaBBQ: 20, aove: 20, cremaCacahuete: 30, frutosSecos: 30, aguacate: 100, guacamole: 80, mozzarella: 60, quesoCrema: 60, proteina: 45, jamon: 120 };

// items: [alimento, "p"|"c"|"f" (se ajusta) o gramos fijos]
let RECIPES = [
  { slot: "desayuno", mode: "sencilla", name: "Tostadas de pavo y tomate", items: [["panIntegral", "c"], ["pavo", "p"], ["verduras", 50], ["aove", "f"]], how: "Tuesta el pan, ralla tomate por encima, un chorrito de aceite y el pavo. El pavo, con un 90% de carne como mínimo." },
  { slot: "desayuno", mode: "sencilla", name: "Porridge proteico de cacao", items: [["avena", "c"], ["lecheSemi", 200], ["proteina", "p"], ["cremaCacahuete", "f"]], how: "Avena con la leche 2 minutos al micro, mezcla la proteína de chocolate (te da el sabor sin tener que añadir cacao) y pon la crema de cacahuete encima." },
  { slot: "desayuno", mode: "sanji", name: "Tortitas de avena con arándanos", off: true, items: [["avena", "c"], ["claras", "p"], ["platano", 40], ["arandanos", 50], ["cremaCacahuete", "f"]],
    steps: ["Tritura la avena con las claras y el plátano hasta tener una masa lisa.", "Sartén antiadherente a fuego medio, vierte cucharones pequeños y dales la vuelta cuando salgan burbujas.", "Apila, cubre con los arándanos y termina con la crema de cacahuete un poco templada."] },
  { slot: "desayuno", mode: "sanji", name: "Tostada de aguacate, salmón y huevo poché", items: [["panCristal", "c"], ["aguacate", "f"], ["salmonAhumado", "p"], ["huevo", 60]],
    steps: ["Agua a punto de hervir con un chorrito de vinagre; haz un remolino y deja caer el huevo 3 minutos.", "Machaca el aguacate con sal, limón y pimienta y úntalo en el pan tostado.", "Coloca el salmón y el huevo encima y abre la yema justo al servir."] },

  { slot: "pre", mode: "sencilla", name: "Pre-entreno exprés", off: true, items: [["datiles", "c"], ["yogurProt", "p"]], how: "Unos dátiles y un yogur proteico 30–45 minutos antes de entrenar." },

  { slot: "comida", mode: "sencilla", name: "Pollo con arroz y verduras", items: [["pollo", "p"], ["arroz", "c"], ["verduras", 150], ["aove", "f"]], how: "Pollo a la plancha, arroz hervido y verduras salteadas con el aceite." },
  { slot: "comida", mode: "sencilla", name: "Pasta boloñesa ligera", items: [["pasta", "c"], ["terneraPicada", "p"], ["salsaTomate", 100], ["aove", "f"]], how: "Dora la carne con el aceite, añade la salsa y mézclala con la pasta cocida." },
  { slot: "comida", mode: "sanji", name: "Poke de salmón", items: [["arroz", "c"], ["salmon", "p"], ["verduras", 100], ["aguacate", "f"]],
    steps: ["Cuece el arroz y aliña en templado con un poco de vinagre de arroz y una pizca de azúcar o edulcorante.", "Corta el salmón en dados y marínalo 10 minutos con soja, jengibre y sésamo.", "Monta el bol: arroz, salmón, verduras en tiras (pepino, zanahoria, cebolla morada) y el aguacate en láminas."] },
  { slot: "comida", mode: "sanji", name: "Burritos de pollo gratinados", items: [["maxiTortilla", "c"], ["tirasPollo", "p"], ["verduras", 100], ["mozzarella", 20], ["guacamole", "f"]],
    steps: ["Saltea el pollo con pimiento y cebolla y sazona con comino, pimentón y ajo en polvo.", "Rellena las tortillas, enróllalas y cúbrelas con la mozzarella.", "Horno a 200 °C unos 8 minutos hasta gratinar. Sirve con el guacamole."] },
  { slot: "comida", mode: "sanji", name: "Ñoquis con atún y tomate", items: [["noquis", "c"], ["lomoAtun", "p"], ["tomateFrito", 60], ["verduras", 80], ["aove", "f"]],
    steps: ["Marca los ñoquis en la sartén con el aceite hasta que queden dorados por fuera.", "Sella el lomo de atún en dados 1 minuto por cada lado.", "Junta todo con el tomate y las verduras y termina con albahaca fresca."] },

  { slot: "merienda", mode: "sencilla", name: "Yogur proteico con plátano y frutos secos", off: true, items: [["yogurProt", "p"], ["platano", "c"], ["frutosSecos", "f"]], how: "Yogur, plátano en rodajas y frutos secos por encima." },
  { slot: "merienda", mode: "sencilla", name: "Tortitas de arroz con jamón", off: true, items: [["tortitasArroz", "c"], ["jamon", "p"], ["quesoCrema", "f"]], how: "Unta el queso crema en las tortitas y pon el jamón encima. Tortitas sin aditivos: solo arroz o maíz y sal." },
  { slot: "merienda", mode: "sanji", name: "Mug cake de chocolate o vainilla", items: [["avena", "c"], ["proteina", "p"], ["claras", 60], ["cacao", 10], ["cremaCacahuete", "f"]],
    steps: ["Mezcla en una taza la avena molida, la proteína y una pizca de levadura. Sabrá a lo que sepa tu proteína: de chocolate o de vainilla.", "Si es de chocolate y lo quieres más intenso, añade el cacao. Si es de vainilla, no lo pongas.", "Añade las claras y un chorrito de agua hasta tener una masa espesa.", "Micro 60–90 segundos y pon la crema de cacahuete encima para que se funda."] },

  { slot: "cena", mode: "sencilla", name: "Merluza al horno con patata", items: [["merluza", "p"], ["patata", "c"], ["verduras", 200], ["aove", "f"]], how: "Merluza y patata en rodajas al horno a 200 °C con verduras y aceite." },
  { slot: "cena", mode: "sencilla", name: "Revuelto de claras con tostada", off: true, items: [["claras", "p"], ["huevo", 60], ["verduras", 100], ["panIntegral", "c"], ["aove", "f"]], how: "Revuelto de huevo y claras con las verduras y pan tostado al lado." },
  { slot: "cena", mode: "sanji", name: "Pizza proteica casera", items: [["basePizza", "c"], ["tomateFrito", 50], ["pavo", "p"], ["verduras", 80], ["mozzarella", "f"]],
    steps: ["Precalienta el horno a 220 °C con la bandeja dentro.", "Extiende el tomate, reparte el pavo y las verduras y termina con la mozzarella.", "Hornea 10–12 minutos sobre la bandeja caliente para que la base quede crujiente."] },
  { slot: "cena", mode: "sanji", name: "Hamburguesa de pollo completa", items: [["panHamburguesa", "c"], ["hambPollo", "p"], ["verduras", 80], ["guacamole", "f"]],
    steps: ["Haz la hamburguesa a la plancha 4 minutos por lado a fuego medio-alto.", "Tuesta el pan por dentro en la misma sartén.", "Monta con lechuga, tomate, cebolla y el guacamole como salsa."] },
  { slot: "desayuno", mode: "sencilla", name: "Bol de yogur con muesli y kiwi", off: true, items: [["yogurProt", "p"], ["muesli", "c"], ["kiwi", 100], ["frutosSecos", "f"]], how: "Todo en un bol o en un táper para llevar." },
  { slot: "desayuno", mode: "sencilla", name: "Tostadas de queso batido y mermelada", items: [["panIntegral", "c"], ["quesoBatido", "p"], ["mermelada", 20], ["aove", "f"]], how: "Pan tostado con un hilo de aceite, queso batido y mermelada encima." },
  { slot: "desayuno", mode: "sencilla", name: "Tortitas con crema de cacahuete y plátano", items: [["tortitasArroz", "c"], ["platano", 60], ["cremaCacahuete", "f"], ["proteina", "p"]], how: "Unta la crema, pon el plátano y acompaña con un batido de proteína en agua o bebida vegetal." },
  { slot: "comida", mode: "sencilla", name: "Ensalada de legumbres con atún", off: true, items: [["legumbres", "c"], ["atun", "p"], ["verduras", 150], ["aove", "f"]], how: "Legumbres de bote enjuagadas, atún, verduras picadas y aceite. Aguanta perfecta en táper." },
  { slot: "comida", mode: "sencilla", name: "Wrap de pollo para llevar", items: [["tortillaIntegral", "c"], ["tirasPollo", "p"], ["verduras", 80], ["guacamole", "f"]], how: "Pollo a la plancha, lechuga, tomate y guacamole; enróllalo en papel de aluminio." },
  { slot: "comida", mode: "sanji", name: "Arroz con ternera al curry", items: [["arroz", "c"], ["terneraPicada", "p"], ["verduras", 150], ["aove", "f"]],
    steps: ["Sofríe cebolla, ajo y pimiento con el aceite y añade la carne hasta que se dore.", "Agrega una cucharada de curry, un poco de comino y un chorrito de agua; deja reducir 5 minutos.", "Sirve sobre el arroz con cilantro o perejil. Al día siguiente en táper está incluso mejor."] },
  { slot: "comida", mode: "sanji", name: "Emperador con batata asada", items: [["emperador", "p"], ["batata", "c"], ["verduras", 150], ["aove", "f"]],
    steps: ["Batata en gajos al horno a 200 °C unos 25 minutos con pimentón y sal.", "Marca el emperador en la plancha bien caliente 2–3 minutos por lado, que quede jugoso.", "Termina con limón, ajo picado y perejil por encima."] },
  { slot: "merienda", mode: "sencilla", name: "Batido de proteína y plátano", items: [["lecheAlmendras", 250], ["proteina", "p"], ["platano", "c"], ["cremaCacahuete", "f"]], how: "Todo a la batidora con hielo. Si comes fuera, lleva la proteína en un bote y mezcla en el momento." },
  { slot: "merienda", mode: "sencilla", name: "Cottage con fruta y tortitas", off: true, items: [["cottage", "p"], ["tortitasArroz", "c"], ["arandanos", 80], ["frutosSecos", "f"]], how: "Cottage con arándanos y frutos secos, y las tortitas al lado." },
  { slot: "desayuno", mode: "sencilla", name: "Revuelto con tortitas y aguacate", off: true, items: [["claras", "p"], ["huevo", 60], ["tortitasArroz", "c"], ["aguacate", "f"]], how: "Revuelto de huevo y claras, tortitas al lado y aguacate en láminas. Sin gluten ni lácteos." },
  { slot: "desayuno", mode: "sanji", name: "Pancakes de plátano sin harina", items: [["platano", "c"], ["claras", "p"], ["huevo", 60], ["arandanos", 60], ["cremaCacahuete", "f"]],
    steps: ["Machaca el plátano con un tenedor y bátelo con el huevo y las claras.", "Sartén antiadherente a fuego bajo, cucharadas pequeñas y vuelta cuando cuajen los bordes.", "Sirve con los arándanos y la crema de cacahuete templada por encima."] },
  { slot: "merienda", mode: "sencilla", name: "Tortitas con pavo y aguacate", items: [["tortitasArroz", "c"], ["pavo", "p"], ["aguacate", "f"]], how: "Aguacate machacado sobre las tortitas y el pavo encima. Fiambre con un 90% de carne como mínimo y tortitas sin aditivos (solo arroz o maíz y sal)." },
  { slot: "desayuno", mode: "sanji", name: "Bowl morado de arándanos", items: [["arandanos", 120], ["platano", "c"], ["proteina", "p"], ["muesli", 20], ["cremaCacahuete", "f"]],
    steps: ["Congela el plátano en rodajas la noche anterior.", "Tritura los arándanos congelados, el plátano y la proteína con un chorrito de agua hasta que quede espeso como un helado.", "Sírvelo en un bol frío y decora."],
    plate: "Haz filas rectas por encima: muesli, rodajas de plátano y un hilo de crema de cacahuete cruzando el bol." },
  { slot: "desayuno", mode: "sanji", name: "Tostadas sushi", items: [["panCristal", "c"], ["quesoCrema", "f"], ["salmonAhumado", "p"], ["aguacate", 40]],
    steps: ["Tuesta el pan y úntalo con el queso crema.", "Coloca el salmón en pliegues, como si fueran pétalos.", "Pon el aguacate en láminas finas y termina con sésamo y un chorrito de soja."],
    plate: "Corta cada tostada en tres tiras para que parezcan piezas de sushi." },
  { slot: "desayuno", mode: "sencilla", name: "Overnight oats de tarta de queso", items: [["avena", "c"], ["yogurProt", "p"], ["quesoBatido", 80], ["mermelada", 20], ["arandanos", 50], ["frutosSecos", "f"]],
    how: "La noche antes, mezcla en un tarro la avena, el yogur y el queso batido. Por la mañana, mermelada, arándanos y frutos secos encima.",
    plate: "En tarro de cristal se ven las capas: queda precioso para la foto." },
  { slot: "comida", mode: "sanji", name: "Tacos de pollo con guacamole", items: [["tortillaMaiz", "c"], ["tirasPollo", "p"], ["verduras", 100], ["guacamole", "f"]],
    steps: ["Marina el pollo 10 minutos con lima, pimentón, comino y ajo en polvo.", "Hazlo a la plancha bien caliente hasta que se dore por fuera.", "Calienta las tortillas en la sartén vacía 20 segundos por lado y rellena con pollo, cebolla morada, col y guacamole."],
    plate: "Sírvelos de pie, apoyados unos contra otros, con un gajo de lima al lado." },
  { slot: "comida", mode: "sanji", name: "Onigiris de atún", items: [["arroz", "c"], ["atun", "p"], ["verduras", 80], ["aguacate", "f"]],
    steps: ["Cuece el arroz y aliña en templado con un poco de vinagre de arroz.", "Mezcla el atún con un poco de queso crema o mayonesa ligera.", "Con las manos mojadas, forma triángulos de arroz con el atún dentro. Acompaña con pepino y aguacate."],
    plate: "Pon una tira de alga en la base de cada triángulo: parecen sacados de un anime." },
  { slot: "comida", mode: "sanji", name: "Lasaña boloñesa fit", items: [["pasta", "c"], ["terneraPicada", "p"], ["tomateFrito", 80], ["verduras", 120], ["mozzarella", "f"]],
    steps: ["Sofríe la carne con cebolla, zanahoria y calabacín picados y añade el tomate.", "Monta capas de láminas de lasaña, boloñesa y un poco de mozzarella en una fuente pequeña.", "Horno a 200 °C 25 minutos, los últimos 5 con el gratinador."],
    plate: "Déjala reposar 5 minutos antes de cortar y saldrá una porción perfecta. Aguanta genial en táper." },
  { slot: "merienda", mode: "sanji", name: "Nice cream de chocolate", items: [["platano", "c"], ["proteina", "p"], ["cacao", 8], ["cremaCacahuete", "f"]],
    steps: ["Congela el plátano en rodajas.", "Tritúralo con la proteína, el cacao y un chorrito de leche o bebida vegetal hasta que quede cremoso.", "Al congelador 15 minutos si lo quieres más firme."],
    plate: "Sirve en bola con una cuchara de helado y la crema de cacahuete fundida por encima." },
  { slot: "merienda", mode: "sencilla", name: "Brochetas de fruta con dip de yogur", items: [["yogurProt", "p"], ["pina", "c"], ["kiwi", 80], ["arandanos", 50], ["cremaCacahuete", "f"]],
    how: "Ensarta piña, kiwi y arándanos en palillos. Mezcla el yogur con la crema de cacahuete para mojar.",
    plate: "Alterna los colores en cada brocheta: amarillo, verde, morado." },
  { slot: "merienda", mode: "sanji", name: "Cheesecake en vaso", items: [["muesli", "c"], ["quesoBatido", "p"], ["mermelada", 25], ["arandanos", 50], ["cremaCacahuete", "f"]],
    steps: ["Pon el muesli en el fondo de un vaso y aplasta un poco.", "Bate el queso con unas gotas de vainilla y edulcorante y échalo encima.", "Termina con la mermelada y los arándanos. Nevera 20 minutos."],
    plate: "En vaso transparente se ven las tres capas. Si lo llevas fuera, en tarro con tapa." },
  { slot: "cena", mode: "sanji", name: "Huevos al purgatorio", items: [["tomateFrito", 120], ["verduras", 100], ["huevo", 120], ["claras", "p"], ["panIntegral", "c"], ["aove", "f"]],
    steps: ["Sofríe pimiento y cebolla con el aceite, añade el tomate y una pizca de comino y pimentón.", "Haz huecos y casca los huevos; reparte las claras alrededor.", "Tapa a fuego bajo 6–8 minutos hasta que la clara cuaje y la yema siga líquida."],
    plate: "Sírvelo en la misma sartén con perejil por encima y el pan tostado para mojar." },
  { slot: "cena", mode: "sanji", name: "Bowl hawaiano de pollo y piña", items: [["arroz", "c"], ["pollo", "p"], ["pina", 80], ["verduras", 100], ["aguacate", "f"]],
    steps: ["Pollo en dados salteado con soja y un poco de jengibre.", "Marca la piña en la misma sartén hasta que se caramelice.", "Monta el bol con arroz, pollo, piña, verduras y aguacate."],
    plate: "Coloca cada ingrediente en su sección del bol, como una rueda de colores." },
  { slot: "cena", mode: "sencilla", name: "Crema de verduras con pollo", items: [["cremaVerduras", 300], ["pollo", "p"], ["panIntegral", "c"], ["aove", "f"]], how: "Calienta la crema y acompaña con pollo a la plancha y pan." },
  { slot: "cena", mode: "sanji", name: "Tortilla de patata fit", items: [["patata", "c"], ["claras", "p"], ["huevo", 120], ["verduras", 60], ["aove", "f"]],
    steps: ["Patata en láminas finas y cebolla al micro 8 minutos tapadas, removiendo a la mitad.", "Bate los huevos con las claras y sal, mezcla con la patata y deja reposar 5 minutos.", "Sartén pequeña con el aceite a fuego medio-bajo, cuaja 4 minutos, dale la vuelta con un plato y 2 minutos más."] },
  // ---- Platos reales de Luna (con foto) ----
  {"id": "rl01", "slot": "desayuno", "mode": "sencilla", "name": "Bol de yogur frutos del bosque", "items": [["yogurProt", "p"], ["frutosRojos", 100], ["platano", "c"], ["chia", 10]], "how": "Yogur en un bol, plátano en rodajas haciendo una media luna, frutos rojos congelados en una esquina y chía y canela por encima. Usa yogur sin azúcares añadidos: los de sabor suelen llevar mucho.", "plate": "Espolvorea la canela solo en una mitad: queda precioso con el contraste."},
  {"id": "rl02", "slot": "comida", "mode": "sanji", "name": "Bowl de salmón, lentejas y ñoquis", "items": [["salmon", "p"], ["legumbres", 100], ["noquis", "c"], ["verduras", 120]], "steps": ["Salmón al horno o airfryer a 200 °C unos 10–12 minutos con sal y limón.", "Dora los ñoquis en una sartén antiadherente sin aceite hasta que estén crujientes por fuera.", "Monta el bol con lechuga, pepino, las lentejas de bote (las del Mercadona van genial) bien enjuagadas, los ñoquis y el salmón encima."]},
  {"id": "rl03", "slot": "comida", "mode": "sencilla", "name": "Ensalada de pollo, garbanzos y rúcula", "items": [["pollo", "p"], ["legumbres", "c"], ["verduras", 120], ["aguacate", "f"]], "how": "Pollo a la plancha en tiras, garbanzos de bote enjuagados, rúcula, pepino y el aguacate en gajos. Sal en escamas por encima. Los garbanzos de bote del Mercadona van genial; enjuágalos bien."},
  {"id": "rl04", "slot": "comida", "mode": "sencilla", "name": "Fusilli de lentejas con pollo", "items": [["pastaLentejas", "c"], ["pollo", "p"], ["verduras", 120], ["aguacate", "f"]], "how": "Cuece la pasta de lentejas 7–8 minutos (se pasa rápido). Sirve con el pollo a la plancha, canónigos, pepino y aguacate. Sin gluten y con un montón de proteína. Mira que la pasta sea 100% harina de lentejas, sin mezcla de trigo."},
  {"id": "rl05", "slot": "desayuno", "mode": "sencilla", "name": "Avena cremosa de plátano y arándanos", "items": [["avena", "c"], ["claras", "p"], ["platano", 50], ["arandanos", 50], ["chia", 5]], "how": "Mezcla la avena con las claras, un chorrito de leche o agua y la chía. Micro 2 minutos removiendo a la mitad. Encima, plátano, arándanos y canela."},
  {"id": "rl06", "slot": "comida", "mode": "sanji", "name": "Udon de pollo con huevo poché", "items": [["udon", "c"], ["pollo", "p"], ["huevo", 60], ["verduras", 100], ["aove", "f"]], "steps": ["Pollo en dados a la plancha con el aceite hasta que se dore bien.", "Saltea las espinacas 1 minuto en la misma sartén y calienta el udon 2 minutos con un chorrito de soja.", "Huevo poché: agua casi hirviendo con vinagre, remolino y 3 minutos. Ponlo encima de todo y rompe la yema al comer."]},
  {"id": "rl07", "slot": "comida", "mode": "sencilla", "name": "Táper de cerdo con batata asada", "items": [["lomoCerdo", "p"], ["batata", "c"], ["patata", 100], ["verduras", 200], ["aove", "f"]], "how": "Batata en rodajas y patata en dados al horno a 200 °C 25 minutos. Verduras salteadas (judías, brócoli, champiñón, pimiento) y el lomo en tiras a la plancha. Perfecto para llevar."},
  {"id": "rl08", "slot": "cena", "mode": "sencilla", "name": "Revuelto de atún, tomate y aguacate", "items": [["huevo", 120], ["atun", "p"], ["verduras", 100], ["aguacate", "f"]], "how": "Revuelve los huevos con el atún escurrido a fuego medio. Sirve con tomate en rodajas y aguacate con sal."},
  {"id": "rl09", "slot": "merienda", "mode": "sencilla", "name": "Tortitas dúo de atún con fresas", "items": [["tortitasArroz", "c"], ["atun", "p"], ["cottage", 30], ["aguacate", "f"], ["salsaBBQ", 10], ["fresas", 100]], "how": "Una tortita con cottage y atún; la otra con aguacate machacado, atún y un hilo de salsa barbacoa. Fresas al lado. Tortitas solo de arroz o maíz y sal, sin aceite de palma ni azúcar. Ojo con la barbacoa: casi la mitad es azúcar, usa poca o una zero.", "plate": "Dos tortitas, dos sabores: así no te aburres nunca."},
  {"id": "rl10", "slot": "cena", "mode": "sencilla", "name": "Pollo desmechado con salsa de yogur", "items": [["pollo", "p"], ["verduras", 180], ["yogurProt", 60], ["aove", "f"]], "how": "Pollo cocido o a la plancha desmechado con dos tenedores. Zanahoria rallada, lechuga y una cucharada de yogur con ajo en polvo, perejil y sal como salsa. Para la salsa, yogur natural o proteico sin azúcar añadido."},
  {"id": "rl11", "slot": "cena", "mode": "sencilla", "name": "Ternera picada con cherrys", "items": [["terneraPicada", "p"], ["verduras", 150], ["aove", "f"]], "how": "Dora la carne picada a fuego fuerte sin removerla mucho para que quede tostadita. Sirve con cherrys con orégano y lechuga."},
  {"id": "rl12", "slot": "comida", "mode": "sencilla", "name": "Ternera, cottage y aguacate", "items": [["terneraPicada", "p"], ["cottage", 100], ["aguacate", "f"]], "how": "Carne picada bien dorada con sal y pimienta, cottage al lado y aguacate en gajos con sal en escamas. Sin cocinar casi nada y con mucha proteína. Cottage y carne picada: mira la etiqueta, que la carne sea magra (máx. 10% de grasa)."},
  {"id": "rl13", "slot": "desayuno", "mode": "sencilla", "name": "Burger, huevos y kiwi", "items": [["hambTernera", "p"], ["huevo", 120], ["kiwi", "c"]], "how": "Hamburguesa a la plancha 3–4 minutos por lado, huevos a la plancha o revueltos en la misma sartén y kiwi en rodajas. Desayuno salado que sacia hasta la comida. Hamburguesa con un 90% de carne como mínimo y sin fécula, almidón ni rellenos (mira los ingredientes)."},
  {"id": "rl14", "slot": "merienda", "mode": "sencilla", "name": "Yogur rosa de fresas y chía", "items": [["yogurProt", "p"], ["fresas", "c"], ["frutosRojos", 50], ["chia", 10], ["proteina", 10]], "how": "Yogur de fresa o natural, fresas en láminas, frutos rojos congelados, chía y un poco de proteína espolvoreada por encima. Si el yogur es de fresa, que sea sin azúcares añadidos."},
  {"id": "rl15", "slot": "pre", "mode": "sencilla", "name": "Plátano y dátiles antes de entrenar", "items": [["platano", "c"], ["datiles", 20]], "how": "Un plátano y un par de dátiles 30–45 minutos antes de entrenar. Energía rápida y nada pesada."},
  {"id": "rl16", "slot": "desayuno", "mode": "sanji", "name": "Crepe proteica de frutos rojos", "items": [["avena", "c"], ["claras", "p"], ["proteina", 15], ["yogurProt", 100], ["frutosRojos", 80]], "steps": ["Tritura la avena con las claras, la proteína y unos cuantos frutos rojos hasta tener una masa líquida.", "Sartén antiadherente grande a fuego medio, vierte toda la masa y extiéndela como una crepe. Vuelta cuando se despegue.", "Cubre con el yogur, el resto de frutos rojos y un poco de proteína espolvoreada."]},
  {"id": "rl17", "slot": "desayuno", "mode": "sanji", "name": "Brunch completo de domingo", "items": [["huevo", 120], ["panIntegral", "c"], ["pollo", "p"], ["aguacate", "f"], ["yogurProt", 125], ["arandanos", 50]], "steps": ["Tuesta el pan y úntalo con el aguacate machacado con sal y pimienta.", "Pon por encima el pollo desmechado.", "Revuelve los huevos a fuego bajo para que queden jugosos.", "Al lado, yogur con arándanos y canela."], "plate": "Plato grande con el revuelto y la tostada, y el yogur en un bol aparte."},
  {"id": "rl18", "slot": "desayuno", "mode": "sencilla", "name": "Tostadas de centeno con tomate y jamón", "items": [["panCenteno", "c"], ["tomateUntar", 30], ["jamon", 40], ["yogurProt", "p"], ["uvas", 80]], "how": "Tuesta el pan de centeno, unta el tomate (el de bote ya lleva su aceite) y pon el jamón encima. Quítale la grasa blanca si quieres. De postre, un puñado de uvas, y un yogur proteico al lado para llegar a tu proteína."},
];

const SLOT_NAMES = { pre: "Pre-entreno", desayuno: "Desayuno", mediaManana: "Media mañana", comida: "Comida", merienda: "Merienda", cena: "Cena" };
const SLOT_RECIPES = { mediaManana: "merienda" }; // media mañana usa recetas de merienda
const MEAL_PLANS = {
  3: { desayuno: 0.3, comida: 0.4, cena: 0.3 },
  4: { desayuno: 0.25, comida: 0.35, merienda: 0.15, cena: 0.25 },
  5: { desayuno: 0.2, mediaManana: 0.1, comida: 0.3, merienda: 0.15, cena: 0.25 },
};
// para filtrar recetas según lo que la persona quiere quitar
let FOOD_TAGS = {
  pescado: ["merluza", "salmon", "salmonAhumado", "lomoAtun", "atun", "emperador"],
  lacteos: ["yogurProt", "quesoBatido", "quesoBurgos", "quesoCrema", "mozzarella", "lecheSemi", "proteina", "cottage"],
  huevo: ["huevo", "claras"],
  cerdo: ["jamon", "lomoCerdo"],
  gluten: ["panIntegral", "panCristal", "panSemillas", "panCenteno", "panIntegralHorno", "panMasaMadre", "panHamburguesa", "maxiTortilla", "tortillaIntegral", "basePizza", "pasta", "noquis", "avena", "muesli", "udon"],
};
const EXCLUDE_OPTS = [["pescado", "Pescado"], ["lacteos", "Lácteos"], ["huevo", "Huevo"], ["cerdo", "Cerdo"], ["gluten", "Gluten"]];
// Fotos de platos que vienen dentro de la app (la coach puede cambiarlas desde Editar contenido)
const REC_IMG = new Set(["r008", "r029", "rl01", "rl02", "rl03", "rl04", "rl05", "rl06", "rl07", "rl08", "rl09", "rl10", "rl11", "rl12", "rl13", "rl14", "rl15", "rl16", "rl17", "rl18"]);
const recImg = (media, id) => media[`rec:${id}`] || (REC_IMG.has(id) ? `/recetas/${id}.jpg` : null);
let TUPPER = new Set(["Pollo con arroz y verduras", "Pasta boloñesa ligera", "Poke de salmón", "Ñoquis con atún y tomate", "Bol de yogur con muesli y kiwi", "Ensalada de legumbres con atún", "Wrap de pollo para llevar", "Arroz con ternera al curry", "Emperador con batata asada", "Batido de proteína y plátano", "Yogur proteico con plátano y frutos secos", "Tortitas de arroz con jamón", "Tortilla de patata fit", "Porridge proteico de cacao", "Tortitas con pavo y aguacate", "Overnight oats de tarta de queso", "Onigiris de atún", "Lasaña boloñesa fit", "Cheesecake en vaso", "Tacos de pollo con guacamole", "Bowl de salmón, lentejas y ñoquis", "Ensalada de pollo, garbanzos y rúcula", "Fusilli de lentejas con pollo", "Táper de cerdo con batata asada", "Pollo desmechado con salsa de yogur"]);
// Iconos de los modos de cocina (línea fina, mismo estilo que el resto de la app)
function CookIcon({ mode, size = 26 }) {
  const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      {mode === "sencilla" && <>
        <path {...P} d="M3 12h18a9 8 0 0 1-18 0Z" /><path {...P} d="M8 20.5h8" />
        <path {...P} stroke="#D48B92" d="M13 2.5 10.5 6.5h3L11 10.5" />
      </>}
      {mode === "todas" && <>
        <path {...P} d="M6 3v5a2 2 0 0 0 4 0V3M8 3v18" />
        <path {...P} d="M17 21V3c-2.2 1.6-3 4.6-3 7.5 0 1.4 1.3 2.5 3 2.5" />
      </>}
      {mode === "sanji" && <>
        <path {...P} d="M7 14.5a3.8 3.8 0 0 1-.6-7.5A5.2 5.2 0 0 1 12 3.5a5.2 5.2 0 0 1 5.6 3.5 3.8 3.8 0 0 1-.6 7.5Z" />
        <path {...P} d="M7 14.5V20h10v-5.5M7 17.2h10" />
        <path {...P} stroke="#D48B92" d="M19.5 1.8l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z" fill="#D48B92" />
      </>}
    </svg>
  );
}

// Gustos del cuestionario: cada opción agrupa alimentos de la base de datos
const FOOD_PREFS = [
  ["pollo", "Pollo", ["pollo", "tirasPollo", "hambPollo"]],
  ["pavo", "Pavo y fiambre", ["pavo", "jamon"]],
  ["ternera", "Ternera", ["terneraPicada", "hambTernera"]],
  ["cerdo", "Cerdo", ["lomoCerdo"]],
  ["salmon", "Salmón", ["salmon", "salmonAhumado"]],
  ["atun", "Atún", ["atun", "lomoAtun"]],
  ["blanco", "Pescado blanco", ["merluza", "emperador"]],
  ["huevo", "Huevos", ["huevo", "claras"]],
  ["lacteos", "Yogur y queso", ["yogurProt", "quesoBatido", "cottage", "quesoCrema", "mozzarella", "quesoBurgos"]],
  ["avena", "Avena", ["avena", "muesli"]],
  ["arroz", "Arroz", ["arroz"]],
  ["pasta", "Pasta y ñoquis", ["pasta", "pastaLentejas", "noquis", "udon"]],
  ["patata", "Patata y batata", ["patata", "batata"]],
  ["legumbres", "Legumbres", ["legumbres", "lentejas", "guisantes"]],
  ["pan", "Pan y tortitas", ["panIntegral", "panCristal", "panSemillas", "panCenteno", "panIntegralHorno", "panMasaMadre", "tortitasArroz", "tortitasLegumbres", "tortillaIntegral", "tortillaMaiz", "maxiTortilla", "panHamburguesa", "basePizza"]],
  ["aguacate", "Aguacate", ["aguacate", "guacamole"]],
  ["frutosRojos", "Frutos rojos", ["arandanos", "frutosRojos", "fresas"]],
  ["platano", "Plátano", ["platano", "datiles"]],
  ["cacao", "Chocolate", ["cacao"]],
  ["cacahuete", "Crema de cacahuete", ["cremaCacahuete", "frutosSecos"]],
];
const prefFoods = (ids = []) => new Set(FOOD_PREFS.filter(([id]) => ids.includes(id)).flatMap(([, , foods]) => foods));
// Ordena recetas: primero las que llevan lo que te gusta; quita las que llevan lo que no (si queda alguna)
function byTaste(list, profile) {
  const like = prefFoods(profile.likes), hate = prefFoods(profile.dislikes);
  const ok = hate.size ? list.filter((r) => !r.items.some(([f]) => hate.has(f))) : list;
  const pool = ok.length ? ok : list;
  if (!like.size) return pool;
  const score = (r) => new Set(r.items.map(([f]) => f).filter((f) => like.has(f))).size;
  return [...pool].sort((a, b) => score(b) - score(a));
}
const COOK_OPTS = [["sencilla", "Modo fácil"], ["todas", "Un poco de todo"], ["sanji", "Modo Sanji (cocinitas)"]];

/* ============================ CONTENIDO EDITABLE ============================
   Frases, ejercicios, alimentos y recetas se pueden editar desde el panel de coach.
   Lo de arriba son los valores de fábrica; applyContent() los sustituye por los guardados.
   ======================================================================== */

const LIFT_OPTS = [["", "No cuenta para el nivel"], ["squat", "Sentadilla (nivel)"], ["deadlift", "Peso muerto (nivel)"], ["bench", "Press banca (nivel)"], ["pull", "Dominadas (extra)"]];
const TAG_OPTS = EXCLUDE_OPTS;

// Ejercicios que se quitaron: en el historial y en rutinas guardadas se ven como su sustituto
const EX_REMAP = { "ARC-065": "ARC-081", "ARC-071": "ARC-054", "ARC-030": "ARC-029", "ARC-018": "ARC-019", "ARC-057": "ARC-X03", "ARC-058": "ARC-X03", "ARC-059": "ARC-X03", "ARC-053": "ARC-072", "ARC-017": "ARC-009" , "ARC-003": "ARC-002", "ARC-005": "ARC-004", "ARC-008": "ARC-073", "ARC-010": "ARC-009", "ARC-074": "ARC-073", "ARC-024": "ARC-022", "ARC-025": "ARC-026", "ARC-031": "ARC-029", "ARC-032": "ARC-029", "ARC-033": "ARC-029", "ARC-034": "ARC-036", "ARC-035": "ARC-036", "ARC-038": "ARC-075", "ARC-039": "ARC-075", "ARC-040": "ARC-075", "ARC-044": "ARC-042", "ARC-045": "ARC-078", "ARC-046": "ARC-X01", "ARC-047": "ARC-078", "ARC-048": "ARC-078", "ARC-X05": "ARC-042", "ARC-056": "ARC-082", "ARC-061": "ARC-X03", "ARC-064": "ARC-081", "ARC-066": "ARC-077", "ARC-068": "ARC-083" };
// Textos de ejercicios sin género (la app es para chicas y chicos). También corrige lo que venga de Supabase.
const NEUTRAL_TXT = [
  ["Apoyada en las manos y las puntas de los pies", "Con las manos y las puntas de los pies en el suelo"],
  ["Colgada de una barra", "Colgándote de una barra"], ["Colgada de la barra", "Colgándote de la barra"],
  ["sentada con las piernas ancladas", "en el asiento con las piernas ancladas"],
  ["Inclinada hacia delante", "Con el torso inclinado hacia delante"],
  ["De pie o sentada", "De pie o en un banco"], [", sentada, con el recorrido", ", desde el asiento, con el recorrido"],
  ["Sentada o de pie", "En el asiento o de pie"], ["Sentada en la polea baja", "En el asiento de la polea baja"],
  ["Sentada de lado a la polea alta", "De lado a la polea alta, en el asiento"], ["Sentada en el suelo", "En el suelo"],
  ["Sentada con ", "En el asiento, con "], ["Sentada frente", "En el asiento, frente"], ["Sentada mirando", "En el asiento, mirando"],
  ["Sentada, ", "En el asiento, "], ["Tumbada boca abajo", "Boca abajo en la máquina"], ["Tumbada bocarriba", "Bocarriba"],
  ["Tumbada en un banco", "Bocarriba en un banco"], ["Tumbada en el banco", "Bocarriba en el banco"],
  ["Apoyada en una pared o máquina", "Apoyando una mano en una pared o máquina"], ["y apoyada con las manos", "con las manos apoyadas en ella"],
  ["Cúmplete a ti misma", "No te falles"], ["Si vas justa de tiempo", "Si vas con poco tiempo"], ["ir al gym cansada", "ir al gym sin ganas"],
];
const neutralTxt = (t) => (typeof t === "string" ? NEUTRAL_TXT.reduce((a, [f, r]) => a.split(f).join(r), t) : t);

function withFallback(obj) {
  for (const v of Object.values(obj)) if (v && typeof v === "object") { if (v.simple) v.simple = neutralTxt(v.simple); if (v.tip) v.tip = neutralTxt(v.tip); }
  return new Proxy(obj, {
    get(t, k) {
      if (k in t || typeof k !== "string" || !/^(ARC-|CARDIO|MOVILIDAD|EX-)/.test(k)) return t[k];
      if (EX_REMAP[k] && EX_REMAP[k] in t) return t[EX_REMAP[k]];
      return { id: k, group: "Otros", n: "Ejercicio eliminado", muscle: "", equip: "", simple: "", tip: "" };
    },
  });
}
EXERCISES = withFallback(EXERCISES);

function buildDefaultContent() {
  const tagsOf = (id) => Object.entries(FOOD_TAGS).filter(([, ids]) => ids.includes(id)).map(([t]) => t);
  return {
    quotes: QUOTES.map(([text, who, source, why, kind], i) => ({ id: `q${String(i + 1).padStart(3, "0")}`, text, who, source, why, kind: kind || "cita", active: true })),
    exercises: Object.values(EXERCISES).map((e, i) => ({ id: e.id, grp: e.group, name: e.n, muscle: e.muscle, equip: e.equip, simple: e.simple, tip: e.tip, note: e.note || "", lift: e.pull ? "pull" : e.lift || "", unit: e.unit || "", sort: i })),
    foods: Object.entries(FOODS).map(([id, f]) => ({ id, name: f.n, p: f.p, c: f.c, f: f.f, tags: tagsOf(id) })),
    recipes: RECIPES.map((r, i) => ({ id: r.id || `r${String(i + 1).padStart(3, "0")}`, slot: r.slot, mode: r.mode, name: r.name, items: r.items, how: r.how || "", steps: r.steps || [], plate: r.plate || "", tupper: TUPPER.has(r.name), active: !r.off, sort: i })),
  };
}
const DEFAULT_CONTENT = buildDefaultContent();
applyContent(DEFAULT_CONTENT); // así las recetas por defecto también tienen id (para sus fotos)

function applyContent(c) {
  const quotes = c.quotes?.length ? c.quotes : DEFAULT_CONTENT.quotes;
  const exercises = c.exercises?.length ? c.exercises : DEFAULT_CONTENT.exercises;
  const foods = c.foods?.length ? c.foods : DEFAULT_CONTENT.foods;
  const recipes = c.recipes?.length ? c.recipes : DEFAULT_CONTENT.recipes;
  const act = quotes.filter((q) => q.active !== false);
  QUOTES = (act.length ? act : DEFAULT_CONTENT.quotes).map((q) => [q.text, q.who, q.source, neutralTxt(q.why), q.kind]);
  const sorted = [...exercises].sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.id.localeCompare(b.id));
  EXERCISES = withFallback(Object.fromEntries(sorted.map((e) => [e.id, {
    id: e.id, group: e.grp, n: e.name, muscle: e.muscle || "", equip: e.equip || "", simple: e.simple || "", tip: e.tip || "",
    note: e.note || undefined, unit: e.unit || undefined, lift: e.lift && e.lift !== "pull" ? e.lift : undefined, pull: e.lift === "pull" || undefined,
  }])));
  GROUPS = [...new Set(sorted.map((e) => e.grp))];
  FOODS = Object.fromEntries(foods.map((f) => [f.id, { n: f.name, p: Number(f.p) || 0, c: Number(f.c) || 0, f: Number(f.f) || 0 }]));
  FOOD_TAGS = Object.fromEntries(TAG_OPTS.map(([t]) => [t, foods.filter((f) => (f.tags || []).includes(t)).map((f) => f.id)]));
  RECIPES = [...recipes].filter((r) => r.active !== false).sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999))
    .map((r) => ({ ...r, items: (r.items || []).filter(([food]) => FOODS[food]), steps: r.steps?.length ? r.steps : null }))
    .filter((r) => r.items.some(([, role]) => typeof role === "string"));
  TUPPER = new Set(RECIPES.filter((r) => r.tupper).map((r) => r.name));
}

// Ejercicios que usan las rutinas: no se pueden borrar
const EX_IN_USE = new Set([...Object.values(DAY_TEMPLATES).flatMap((d) => d.ex.map(([id]) => id)), ...Object.values(LIFT_HOME).map((l) => l.ex)]);


const ACTIVITY = [
  { id: 1.3, label: "Poco movimiento", hint: "Casi todo el día sin moverte de la silla, menos de 5.000 pasos" },
  { id: 1.45, label: "Algo activa", hint: "5.000–8.000 pasos y 2–3 entrenos" },
  { id: 1.6, label: "Activa", hint: "8.000–12.000 pasos y 3–5 entrenos" },
  { id: 1.75, label: "Muy activa", hint: "Trabajo físico o más de 12.000 pasos y 5+ entrenos" },
];
const GOALS = [
  { id: "deficit", label: "Perder grasa", adj: -0.15 },
  { id: "mant", label: "Mantener y recomponer", adj: 0 },
  { id: "superavit", label: "Ganar músculo", adj: 0.08 },
];
const TRAIN_TIMES = [
  { id: "early", label: "Antes de las 9:00" },
  { id: "mid", label: "Mediodía" },
  { id: "late", label: "Tarde o noche" },
];

/* ============================ LÓGICA ============================ */

const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function epley(kg, reps) {
  kg = Number(kg); reps = Number(reps);
  if (!reps || reps < 1) return 0;
  if (reps > RULES.EPLEY_MAX_REPS) return null;
  if (!kg) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

function activeMonths(dates) {
  const days = dates.map((d) => new Date(d)).sort((a, b) => a - b);
  let start = 0;
  for (let i = 1; i < days.length; i++) if ((days[i] - days[i - 1]) / 864e5 > RULES.GAP_RESET_DAYS) start = i;
  const streak = days.slice(start);
  if (!streak.length || (Date.now() - streak[streak.length - 1]) / 864e5 > RULES.GAP_RESET_DAYS) return 0;
  let months = 0, cursor = streak[0];
  while (true) {
    const end = new Date(cursor.getTime() + 30 * 864e5);
    if (end > new Date()) break;
    if (streak.filter((d) => d >= cursor && d < end).length >= RULES.MIN_SESSIONS_PER_MONTH) months++;
    cursor = end;
  }
  return months;
}

const dayMet = (h) => [(h.water || 0) >= RULES.WATER_GOAL_GLASSES, (h.steps || 0) >= RULES.STEPS_GOAL, (h.sleep || 0) >= RULES.SLEEP_GOAL_H].filter(Boolean).length >= 2;

function adherenceInfo(habits, startDate) {
  const today = new Date();
  const start = new Date(startDate + "T00:00:00");
  const span = Math.max(1, Math.min(RULES.ADHERENCE_WINDOW_DAYS, Math.floor((today - start) / 864e5) + 1));
  let met = 0;
  for (let i = 0; i < span; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const h = habits[dkey(d)];
    if (h && dayMet(h)) met++;
  }
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const h = habits[dkey(d)];
    if (h && dayMet(h)) streak++;
    else if (i > 0) break;
  }
  return { pct: Math.round((met / span) * 100), span, streak, provisional: span < RULES.ADHERENCE_MIN_DAYS };
}

function currentWeight(state) {
  const days = Object.keys(state.habits).filter((k) => state.habits[k].weight).sort();
  return days.length ? Number(state.habits[days[days.length - 1]].weight) : Number(state.profile.weight);
}

function bestLifts(state, untilDate) {
  const p = state.profile;
  const best = { squat: epley(p.squat.kg, p.squat.reps) || 0, bench: epley(p.bench.kg, p.bench.reps) || 0, deadlift: epley(p.deadlift.kg, p.deadlift.reps) || 0 };
  let pullups = Number(p.pullups) || 0;
  state.sessions.filter((s) => !untilDate || s.date <= untilDate).forEach((s) => s.exercises.forEach((e) => {
    const ex = EXERCISES[e.exId];
    e.sets.forEach((st) => {
      if (st.type === "W" || !st.done) return;
      if (ex?.lift) { const v = epley(st.kg, st.reps); if (v) best[ex.lift] = Math.max(best[ex.lift], v); }
      if (ex?.pull) pullups = Math.max(pullups, Number(st.reps) || 0);
    });
  }));
  return { best, pullups };
}

const ratioOf = (branch, best, bw) => (bw ? (best.squat + best.deadlift + (branch === "male" ? best.bench : 0)) / bw : 0);

const FACTORS = [
  { key: "ratio", label: "Fuerza relativa", fmt: (v) => `${v.toFixed(2)}x` },
  { key: "pullups", label: "Dominadas estrictas", fmt: (v) => `${v}`, optional: true }, // extra: suma, pero no frena el nivel
  { key: "months", label: "Meses sin parar", fmt: (v) => `${v}` },
  { key: "adherence", label: "Adherencia 30 días", fmt: (v) => `${v}%` },
];

function evaluate(branch, stats, mode) {
  const L = levelsOf(branch, mode);
  const val = (k) => (k === "adherence" && stats.provisional ? Infinity : stats[k] ?? 0);
  const reach = (k) => { let idx = 0; L.forEach((lv, i) => { if (val(k) >= lv[k]) idx = i; }); return idx; };
  const perFactor = Object.fromEntries(FACTORS.map((f) => [f.key, reach(f.key)]));
  const CORE = FACTORS.filter((f) => !f.optional);
  const current = Math.min(...CORE.map((f) => perFactor[f.key]));
  const next = L[current + 1] || null;
  let progress = 1;
  if (next) {
    progress = Math.min(...CORE.map((f) => {
      const a = L[current][f.key], b = next[f.key], v = val(f.key);
      return b <= a ? 1 : Math.max(0, Math.min(1, (v - a) / (b - a)));
    }));
  }
  const limiter = CORE.reduce((m, f) => (perFactor[f.key] < perFactor[m.key] ? f : m), CORE[0]);
  return { current, next, progress, perFactor, limiter };
}

function macroTargets(p, restDay) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.branch === "male" ? 5 : -161);
  const goal = GOALS.find((g) => g.id === p.goal);
  let kcal = bmr * p.activity * (1 + goal.adj);
  kcal = Math.max(kcal, bmr);
  const h = p.height / 100;
  const ref = p.weight / (h * h) > 27 ? 27 * h * h : p.weight;
  const prot = ref * (p.goal === "deficit" ? 2.0 : 1.8);
  let fat = Math.max(0.8 * ref, (0.25 * kcal) / 9);
  let carb = (kcal - prot * 4 - fat * 9) / 4;
  if (carb < 50) { fat = Math.max(0.6 * ref, fat - ((50 - carb) * 4) / 9); carb = (kcal - prot * 4 - fat * 9) / 4; }
  if (restDay) carb *= 0.8; // días de descanso: menos hidratos, misma proteína
  carb = Math.max(carb, 0);
  return { kcal: Math.round(prot * 4 + carb * 4 + fat * 9), p: Math.round(prot), c: Math.round(carb), f: Math.round(fat), bmr: Math.round(bmr) };
}

function solveRecipe(recipe, target, veg) {
  const items = recipe.items.filter(([food]) => FOODS[food]).map(([food, r]) => {
    const f = veg && VEG_SWAP[food] && FOODS[VEG_SWAP[food]] ? VEG_SWAP[food] : food;
    return typeof r === "number" ? { food: f, g: r, fixed: true } : { food: f, role: r, g: 0 };
  });
  for (let k = 0; k < 5; k++) {
    for (const role of ["p", "c", "f"]) {
      const it = items.find((x) => x.role === role);
      if (!it) continue;
      const others = items.filter((x) => x !== it).reduce((s, x) => s + (FOODS[x.food][role] * x.g) / 100, 0);
      it.g = Math.max(0, Math.min(((target[role] - others) / FOODS[it.food][role]) * 100, LIMITS[it.food] ?? 350));
    }
  }
  items.forEach((x) => { if (!x.fixed) x.g = Math.round(x.g / 5) * 5; });
  const tot = items.reduce((s, x) => ({ p: s.p + (FOODS[x.food].p * x.g) / 100, c: s.c + (FOODS[x.food].c * x.g) / 100, f: s.f + (FOODS[x.food].f * x.g) / 100 }), { p: 0, c: 0, f: 0 });
  tot.kcal = tot.p * 4 + tot.c * 4 + tot.f * 9;
  return { items: items.filter((x) => x.g > 0), tot };
}

/* ============================ UI BASE ============================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.arc{overflow-x:hidden;width:100%;--bg:#000;--sf:#0E0E11;--sf2:#16161A;--ln:#26262B;--tx:#fff;--dm:rgba(255,255,255,.6);--ac:#D48B92;--ok:rgba(110,231,183,.14);--okl:#6EE7B7;--wu:#F5B454;
font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;display:flex;justify-content:center}
.arc *{box-sizing:border-box}
.phone{width:100%;max-width:430px;padding:calc(18px + env(safe-area-inset-top)) 18px calc(100px + env(safe-area-inset-bottom))}
.top{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.top b{font-weight:800;letter-spacing:.04em;font-size:15px}
.top .by{color:var(--dm);font-size:13px}
.top .xp{margin-left:auto;font-size:13px;color:var(--dm)}
h1{font-size:26px;font-weight:800;line-height:1.1;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:15px;font-weight:700;margin:28px 0 12px}
.sub{color:var(--dm);font-size:14px;line-height:1.5;margin:0 0 18px}
.field{margin-bottom:14px}
.field label{display:block;font-size:13px;color:var(--dm);margin-bottom:6px}
.row{display:flex;gap:8px}
.in{width:100%;background:var(--sf);border:1px solid var(--ln);color:var(--tx);border-radius:12px;padding:12px;font:inherit;font-size:16px}
.arc button:focus-visible,.in:focus{outline:2px solid var(--ac);outline-offset:2px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{background:var(--sf);border:1px solid var(--ln);color:var(--tx);border-radius:999px;padding:9px 14px;font:inherit;font-size:14px;cursor:pointer}
.chip.on{background:#fff;color:#000;border-color:#fff;font-weight:600}
.skills{background:var(--sf);border:1px solid var(--ln);border-radius:20px;padding:16px;margin-top:10px}
.sk-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}
.sk-title span{font-weight:800;font-size:15px}
.sk-title small{font-size:12px;color:var(--dm)}
.sk-row{padding:9px 0}
.sk-hd{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;margin-bottom:7px}
.sk-name{font-weight:700;display:flex;align-items:center;gap:8px}
.sk-name em{font-style:normal;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px}
.sk-top .sk-name em{background:rgba(110,231,183,.14);color:var(--okl)}
.sk-low .sk-name em{background:rgba(212,139,146,.14);color:var(--ac)}
.sk-lv{font-size:12px;color:var(--dm)}
.sk-lv b{color:#fff;font-size:16px;font-variant-numeric:tabular-nums;margin-left:3px}
.sk-lv small{font-size:11px}
.sk-bar{position:relative;height:8px;border-radius:99px;background:var(--ln)}
.sk-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#fff,var(--ac));transform-origin:left;position:relative;overflow:hidden}
.sk-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);transform:translateX(-100%)}
.sk-next{position:absolute;top:-3px;width:2px;height:14px;border-radius:2px;background:#fff;opacity:.85;transform:translateX(-1px)}
.sk-val{font-size:12px;color:var(--dm);margin-top:6px}
.sk-legend{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dm);margin-top:4px}
.sk-next-dot{width:2px;height:12px;border-radius:2px;background:#fff;display:inline-block}
.sk-moves{border-top:1px solid var(--ln);margin-top:12px;padding-top:12px}
.sk-moves small{display:block;font-size:12px;color:var(--dm);margin-bottom:8px}
.sk-moves div{display:flex;flex-wrap:wrap;gap:6px}
.sk-tag{font-size:12px;font-weight:700;color:var(--ac);border:1px solid rgba(212,139,146,.45);background:rgba(212,139,146,.08);border-radius:999px;padding:4px 10px}
@media (prefers-reduced-motion:no-preference){
.sk-row{animation:rise .5s ease-out both}
.sk-fill{animation:skGrow .9s cubic-bezier(.2,.8,.2,1) both}
.sk-fill::after{animation:shine 1.1s ease-in-out 1.1s both}
.sk-low .sk-name em{animation:blink 2.4s ease-in-out 1.5s infinite}
.sk-tag{animation:popIn .45s cubic-bezier(.2,.9,.3,1.4) both}
@keyframes skGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes shine{to{transform:translateX(100%)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes popIn{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
/* Más movimiento en toda la app */
.page>*{animation:rise .45s ease-out both}
.page>*:nth-child(2){animation-delay:.06s}.page>*:nth-child(3){animation-delay:.12s}.page>*:nth-child(4){animation-delay:.18s}.page>*:nth-child(5){animation-delay:.24s}.page>*:nth-child(n+6){animation-delay:.3s}
.hero img{animation:heroIn 1.4s cubic-bezier(.2,.8,.2,1) both}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.18) 50%,transparent 65%);transform:translateX(-120%);animation:sweep 1.4s ease-in-out .5s both;pointer-events:none}
@keyframes heroIn{from{transform:scale(1.12);filter:brightness(.4)}to{transform:none;filter:none}}
@keyframes sweep{to{transform:translateX(120%)}}
.btn,.chip,.cook-opt,.glass,.tab{transition:transform .12s ease}
.btn:active,.chip:active,.glass:active{transform:scale(.96)}
.chip.on,.cook-opt.on{animation:pop .28s ease-out}
.glass.on::after{animation:fillUp .45s ease-out both}
@keyframes fillUp{from{height:0}}
.bar i{animation:skGrow .9s cubic-bezier(.2,.8,.2,1) both;transform-origin:left}
.tab.on{animation:tabOn .3s ease-out}
@keyframes tabOn{0%{transform:translateY(0)}40%{transform:translateY(-3px)}100%{transform:none}}
.xp{display:inline-block;animation:xpBump .5s cubic-bezier(.2,.9,.3,1.5)}
@keyframes xpBump{0%{transform:scale(1)}40%{transform:scale(1.25);color:var(--ac)}100%{transform:scale(1)}}
.toast{animation:toastIn .35s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes toastIn{from{transform:translate(-50%,-20px);opacity:0}}
}
.tab{position:relative}
.tab.on::before{content:"";position:absolute;top:0;left:50%;width:22px;height:2px;margin-left:-11px;border-radius:2px;background:var(--ac)}
.sug{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;background:var(--sf2);border:1px solid var(--ln);border-radius:14px;padding:10px 12px;margin:-2px 0 10px;font-size:13px;line-height:1.45;color:var(--dm)}
.sug i{font-style:normal;font-weight:800;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;background:var(--ln);color:#fff}
.sug span{flex:1;min-width:170px}
.sug button{background:#fff;color:#000;border:0;border-radius:999px;font:inherit;font-size:12px;font-weight:700;padding:6px 12px;cursor:pointer;margin-left:32px}
.sug-up{border-color:rgba(110,231,183,.35)}.sug-up i{background:var(--okl);color:#000}
.sug-down{border-color:rgba(245,180,84,.4)}.sug-down i{background:var(--wu);color:#000}
.sug-new i{background:var(--ac);color:#000}
.bodymap{display:flex;justify-content:center;gap:18px;margin:14px 0 6px}
.bodymap>div{display:flex;flex-direction:column;align-items:center;gap:4px}
.bodymap small{font-size:11px;color:var(--dm)}
.bm-m{cursor:pointer;transition:fill .3s;transform-box:fill-box;transform-origin:center}
.mw-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--dm);margin:4px 0 10px}
.mw-legend span{display:flex;align-items:center;gap:6px}
.mw-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.mw-alert{font-size:13px;line-height:1.45;border-radius:12px;padding:10px 12px;margin:8px 0}
.mw-alert.over{background:rgba(248,113,113,.1);color:#FCA5A5}
.mw-alert.rec{background:rgba(245,180,84,.1);color:var(--wu)}
.mw-list{margin-top:6px}
.mw-row{display:grid;grid-template-columns:82px 1fr 66px 74px;align-items:center;gap:8px;width:100%;background:none;border:0;border-bottom:1px solid var(--ln);color:var(--tx);font:inherit;font-size:13px;padding:9px 0;cursor:pointer;text-align:left}
.mw-row.on .mw-n{color:var(--ac);font-weight:700}
.mw-bar{position:relative;height:6px;border-radius:99px;background:var(--ln)}
.mw-bar div{height:100%;border-radius:99px;transform-origin:left}
.mw-bar i{position:absolute;top:-3px;width:1px;height:12px;background:rgba(255,255,255,.35)}
.mw-v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.mw-v small{font-weight:400;color:var(--dm);font-size:11px}
.mw-row em{font-style:normal;font-size:11px;font-weight:700;text-align:right}
.lv-none{color:var(--dm)}.lv-low{color:rgba(212,139,146,.75)}.lv-mid,.lv-acc{color:var(--ac)}.lv-ok{color:var(--okl)}.lv-over{color:#F87171}
.exmus{margin:4px 0 8px}
@media (prefers-reduced-motion:no-preference){.bm-m{animation:popIn .4s ease-out both}.mw-bar div{animation:skGrow .8s cubic-bezier(.2,.8,.2,1) both}.sug{animation:rise .4s ease-out both}}
.shop{background:var(--sf);border:1px solid var(--ln);border-radius:18px;padding:14px 16px;margin-top:18px}
.shop-hd{all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;width:100%}
.shop-hd span{font-size:13px;color:var(--ac)}
.shop ul{list-style:none;margin:10px 0 0;padding:0}
.shop li{padding:10px 0;border-top:1px solid var(--ln);display:flex;flex-direction:column;gap:3px}
.shop li b{font-size:14px}
.shop li span{font-size:13px;color:var(--dm);line-height:1.45}
.rphoto{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:14px;display:block;margin-bottom:12px;border:1px solid var(--ln)}
.fin{position:fixed;inset:0;z-index:38;background:#000;display:flex;flex-direction:column;align-items:center;text-align:center;overflow-y:auto;overflow-x:hidden;padding:calc(30px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom))}
.fin-rays{position:absolute;left:50%;top:22%;width:720px;height:720px;margin:-360px 0 0 -360px;background:repeating-conic-gradient(from 0deg,rgba(212,139,146,.13) 0deg 7deg,transparent 7deg 20deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 18%,transparent 62%);mask:radial-gradient(circle,#000 18%,transparent 62%);pointer-events:none}
.fin-stage{position:relative;width:230px;height:250px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fin-img{width:210px;height:240px;border-radius:26px;overflow:hidden;border:2px solid rgba(212,139,146,.7);box-shadow:0 0 70px rgba(212,139,146,.4)}
.fin-img img{width:100%;height:100%;object-fit:cover;object-position:top}
.fin-mark{filter:drop-shadow(0 0 30px rgba(212,139,146,.6))}
.fin-shout{position:relative;font-size:40px;line-height:1.02;font-weight:900;letter-spacing:-.02em;margin:18px 0 6px;font-style:italic;background:linear-gradient(180deg,#fff 30%,#D48B92);-webkit-background-clip:text;background-clip:text;color:transparent}
.fin-sub{position:relative;color:var(--dm);font-size:15px;margin:0 0 18px;max-width:320px}
.fin-stats{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;max-width:380px}
.fin-stats div{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:10px 4px}
.fin-stats b{display:block;font-size:17px;font-variant-numeric:tabular-nums}
.fin-stats span{font-size:11px;color:var(--dm)}
.fin-pr{position:relative;margin-top:12px;font-weight:700;color:var(--okl);background:rgba(110,231,183,.1);border-radius:999px;padding:7px 14px;font-size:13px}
.fin-coach{position:relative;margin-top:14px;width:100%;max-width:380px;text-align:left}
.fin-coach small{display:block;color:var(--dm);font-size:12px;margin-bottom:6px}
.fin-btn{position:relative;margin-top:auto;max-width:380px}
@media (prefers-reduced-motion:no-preference){
.fin{animation:fadeIn .25s ease-out both}
.fin-rays{animation:spin 18s linear infinite,fadeIn 1s ease-out both}
.fin-img,.fin-mark{animation:slam .7s cubic-bezier(.2,.9,.25,1.25) .1s both}
.fin-shout{animation:shout .6s cubic-bezier(.2,.9,.3,1.5) .55s both}
.fin-sub{animation:rise .5s ease-out .85s both}
.fin-stats div{animation:rise .45s ease-out both}
.fin-stats div:nth-child(1){animation-delay:.9s}.fin-stats div:nth-child(2){animation-delay:.97s}.fin-stats div:nth-child(3){animation-delay:1.04s}.fin-stats div:nth-child(4){animation-delay:1.11s}
.fin-pr{animation:popIn .5s cubic-bezier(.2,.9,.3,1.4) 1.5s both}
.fin-btn{animation:rise .5s ease-out 1.3s both}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slam{0%{transform:scale(1.8) rotate(-6deg);opacity:0;filter:blur(8px)}60%{opacity:1;filter:none}100%{transform:none}}
@keyframes shout{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.12) rotate(-2deg);opacity:1}85%{transform:scale(.97) rotate(1deg)}100%{transform:none}}
}
.redit-name{flex:1;font-weight:700;margin-right:10px;padding:8px 12px}
.redit-ex{display:grid;grid-template-columns:1fr 46px 10px 70px auto;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--ln)}
.redit-ex .in{padding:8px 6px;text-align:center}
.redit-n span{display:block;font-size:14px}.redit-n small{display:block;font-size:11px;color:var(--dm);margin-top:2px}
.redit-x{color:var(--dm);text-align:center}
.redit-btns{display:flex;gap:2px}
.redit-btns button{background:var(--sf2);border:1px solid var(--ln);color:var(--tx);border-radius:8px;width:28px;height:30px;font:inherit;font-size:12px;cursor:pointer}
.fac.extra{opacity:.85}.fac.extra em{font-style:normal;font-size:11px;font-weight:700;color:var(--dm);border:1px solid var(--ln);border-radius:999px;padding:1px 7px;margin-left:6px}
.exvid{display:block;width:100%;height:320px;object-fit:contain;border-radius:14px;border:1px solid var(--ln);background:#000;margin:4px 0 10px;cursor:pointer}
.slots{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.slot{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.slot .chip{padding:6px 4px;font-size:12px;text-align:center}
.slot-img{aspect-ratio:3/4;border-radius:10px;border:1px solid var(--ln);background:var(--sf);overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--dm);font:inherit;font-size:13px;padding:0;cursor:pointer}
.slot-img img{width:100%;height:100%;object-fit:cover}
.cook-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cook-opt{background:var(--sf);border:1px solid var(--ln);color:var(--tx);border-radius:16px;padding:14px 8px 12px;font:inherit;font-size:13px;line-height:1.25;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;transition:transform .15s}
.cook-opt:active{transform:scale(.97)}
.cook-opt.on{background:#fff;color:#000;border-color:#fff;font-weight:600}
.hint{font-size:12px;color:var(--dm);margin-top:6px;line-height:1.45}
.err{font-size:12px;color:#FCA5A5;margin-top:6px}
.btn{width:100%;background:#fff;color:#000;border:0;border-radius:14px;padding:15px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;margin-top:10px}
.btn.ac{background:var(--ac);color:#000}
.btn:disabled{opacity:.4;cursor:default}
.btn.ghost{background:none;color:var(--dm);border:1px solid var(--ln);font-weight:600}
.link{background:none;border:0;color:var(--dm);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:0}
.lift{display:grid;grid-template-columns:1fr 84px 70px;gap:8px;align-items:center;margin-bottom:8px;font-size:14px}
.quote{padding:6px 0 4px}
.quote p{font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-.01em;margin:0 0 14px}
.quote .who{font-size:14px;font-weight:600}
.quote .from{font-size:13px;color:var(--dm)}
.quote .why{font-size:14px;line-height:1.5;color:var(--dm);margin:12px 0 0;padding-left:12px;border-left:2px solid var(--ac)}
.gauge{display:flex;flex-direction:column;align-items:center;margin-top:8px}
.name{font-size:28px;font-weight:800;letter-spacing:-.02em;text-align:center;line-height:1.05;margin-top:0}
.series{font-size:13px;color:var(--dm);margin-top:4px;text-align:center}
.line{font-size:14px;line-height:1.5;text-align:center;margin:10px 8px 0;color:var(--dm)}
.prov{font-size:12px;color:var(--ac);text-align:center;margin-top:8px}
.fac{padding:12px 0;border-bottom:1px solid var(--ln)}
.fac .hd{display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px}
.bar{height:4px;background:var(--ln);border-radius:4px;overflow:hidden}
.bar i{display:block;height:100%;background:#fff}
.fac.ok .bar i{background:var(--okl)}
.note{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:14px;font-size:14px;line-height:1.5;margin-top:14px}
.chart{background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:14px 14px 8px;margin-bottom:10px}
.chart .hd{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;margin-bottom:6px}
.chart .hd b{font-size:18px}
.empty{font-size:13px;color:var(--dm);padding:18px 0 14px}
.kcal{font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1}
.macros{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
.macros div{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px}
.macros b{display:block;font-size:20px}
.macros span{font-size:12px;color:var(--dm)}
.seg{display:flex;background:var(--sf);border:1px solid var(--ln);border-radius:12px;padding:3px;margin-bottom:10px}
.seg button{flex:1;background:none;border:0;color:var(--dm);font:inherit;font-size:13px;padding:9px;border-radius:9px;cursor:pointer}
.seg button.on{background:#fff;color:#000;font-weight:700}
.meal{border-top:1px solid var(--ln);padding:16px 0}
.meal .hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:8px}
.meal .hd b{font-size:16px}
.meal .hd span{font-size:12px;color:var(--dm);text-align:right}
.rname{font-size:15px;font-weight:700;margin:12px 0 6px}
.food{display:flex;justify-content:space-between;font-size:14px;padding:4px 0}
.food em{font-style:normal;font-variant-numeric:tabular-nums}
.steps{margin:10px 0 0;padding-left:20px;font-size:14px;line-height:1.55;color:var(--dm)}
.steps li{margin-bottom:4px}
.day{background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:16px;margin-bottom:10px}
.day .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.day .hd b{font-size:16px}
.day small{display:block;font-size:13px;color:var(--dm);line-height:1.6}
.sbtn{background:#fff;color:#000;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}
.wstrip{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 14px}
.wstrip-d{display:flex;gap:6px}
.wd{display:flex;flex-direction:column;align-items:center;gap:5px;font-size:11px;color:var(--dm);width:26px}
.wd i{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--ln);display:block}
.wd.on i{background:var(--ac);border-color:var(--ac);box-shadow:0 0 12px rgba(212,139,146,.45)}
.wd.now span{color:#fff;font-weight:700}
.wd.now i{border-color:#fff}
.wstrip-c{font-size:13px;color:var(--dm);white-space:nowrap}
.wstrip-c b{color:#fff;font-size:18px}
.today{position:relative;overflow:hidden;border-radius:20px;padding:20px 18px 16px;margin-bottom:14px;background:radial-gradient(120% 90% at 100% 0%,rgba(212,139,146,.38),transparent 60%),linear-gradient(160deg,#1a1216,#0E0E11 70%);border:1px solid rgba(212,139,146,.35)}
.today-tag{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ac);font-weight:700}
.today-name{font-size:28px;font-weight:800;line-height:1.1;margin:6px 0 10px;letter-spacing:-.01em}
.today-meta{display:flex;flex-wrap:wrap;gap:6px}
.today-meta span{font-size:12px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.today-sub{font-size:13px;color:var(--dm);margin:12px 0 14px}
.today-go{width:100%;background:#fff;color:#000;border:0;border-radius:14px;padding:14px;font:inherit;font-weight:800;font-size:16px;cursor:pointer}
.today-go:active{transform:scale(.98)}
.today-xp{text-align:center;font-size:12px;color:var(--dm);margin-top:9px}
.day-t{display:flex;align-items:center;gap:12px;min-width:0}
.day-t b{display:block}
.day-t small{font-size:12px!important;line-height:1.4!important}
.day-n{flex:none;width:34px;height:34px;border-radius:10px;background:var(--sf2);border:1px solid var(--ln);display:grid;place-items:center;font-weight:800;font-size:15px}
.day.next{border-color:rgba(212,139,146,.45)}
.day.next .day-n{background:var(--ac);color:#000;border-color:var(--ac)}
.day .exrow{padding:7px 0;border-top:1px solid var(--ln)}
.day .hd{margin-bottom:10px;gap:10px}
.steps-now{display:flex;align-items:baseline;gap:8px;margin:2px 0 4px}
.steps-now b{font-size:34px;font-weight:800;letter-spacing:-.01em}
.steps-now span{color:var(--dm);font-size:14px}
.dgrid{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:3px;aspect-ratio:9/16;max-height:52vh;margin:0 auto;background:#000;border-radius:14px;overflow:hidden}
.dslot .dex{font-style:normal;font-size:10.5px;line-height:1.3;color:var(--dm);text-align:center;padding:0 10px;opacity:.8}
.dbadge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(10,10,12,.85);border-left:3px solid var(--ac);border-radius:8px;padding:6px 10px;pointer-events:none;white-space:nowrap}
.dslot{position:relative}
.dslot .dwk{position:absolute;left:0;right:0;bottom:18%;padding:22px 9px 8px;display:flex;flex-direction:column;gap:1px;text-align:left;background:linear-gradient(transparent,rgba(0,0,0,.85));pointer-events:none}
.dslot .dwk{align-items:flex-start}
.dslot .dwk small{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#D48B92}
.dslot .dwk b{font-size:13px;font-weight:800;color:#fff;line-height:1.15}
.dslot .dwk em{font-style:normal;font-size:9.5px;color:rgba(255,255,255,.8)}
.dbadge small{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--dm);font-weight:700}
.dbadge b{font-size:20px;font-weight:800}
.dbadge em{font-style:normal;font-size:11px;color:var(--dm);font-weight:600}
.dslot{position:relative;overflow:hidden;border:0;border-radius:0;background:var(--sf2);color:var(--dm);font:inherit;font-size:13px;cursor:pointer;display:grid;place-items:center;padding:0}
.dslot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dslot span{display:flex;flex-direction:column;align-items:center;gap:4px}
.dslot span b{font-size:28px;color:#fff;font-weight:400}
.dsteps{background:radial-gradient(120% 80% at 100% 0%,rgba(212,139,146,.45),transparent 60%),#0E0E11;position:absolute;inset:0;justify-content:center}
.dsteps small{color:var(--ac);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.dsteps b{font-size:26px!important;font-weight:800!important}
.dsteps em{font-style:normal;font-size:10px;color:var(--dm)}
.dcard{display:flex;align-items:center;gap:14px;width:100%;text-align:left;margin:12px 0;padding:14px 16px;border-radius:16px;border:1px solid rgba(212,139,146,.35);background:linear-gradient(120deg,rgba(212,139,146,.18),rgba(212,139,146,.03));color:#fff;font:inherit;cursor:pointer}
.dcard-ic{display:grid;grid-template-columns:1fr 1fr;gap:2px;width:34px;height:52px;flex:none;background:#000;border:1px solid var(--ln);border-radius:7px;overflow:hidden}
.dcard-ic i{background:var(--ac);border-radius:2px}
.dcard-ic i{background:#3a3a40}.dcard-ic i:nth-child(1),.dcard-ic i:nth-child(4){background:var(--ac)}
.dcard-t{flex:1;min-width:0}
.dcard-t b{display:block;font-size:15px}
.dcard-t small{display:block;color:var(--dm);font-size:12.5px;margin-top:2px;line-height:1.35}
.dcard-go{font-size:26px;color:var(--ac)}
.kpi.tap{cursor:pointer;position:relative}
.kpi .kpi-sh{position:absolute;top:10px;right:10px;color:var(--dm)}
.hb .hd .shr-mini{background:none;border:0;color:var(--ac);font:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.ntop{margin-top:16px;padding:18px;border-radius:20px;border:1px solid var(--ln);background:radial-gradient(120% 90% at 100% 0%,rgba(212,139,146,.22),transparent 60%),var(--sf)}
.ntop .kcal{font-size:48px}
.ntop .kcal span{font-size:15px;font-weight:600;color:var(--dm);margin-left:8px;letter-spacing:0}
.mbar{display:flex;gap:3px;height:10px;margin:14px 0 4px;border-radius:99px;overflow:hidden}
.mbar i{display:block;min-width:4px}
.ntop .macros{margin-top:10px}
.ntop .macros div{background:rgba(255,255,255,.04);position:relative;padding-left:12px}
.ntop .macros i{position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px}
.mlist{display:grid;gap:14px;margin-top:6px}
.mcard{border-radius:20px;overflow:hidden;background:var(--sf);border:1px solid var(--ln)}
.mhead{display:flex;gap:14px;align-items:center;padding:14px 16px 12px}
.mthumb{flex:none;width:74px;height:74px;border-radius:16px;display:grid;place-items:center;color:var(--ac);background:radial-gradient(100% 100% at 80% 0%,rgba(212,139,146,.3),transparent 70%),var(--sf2);border:1px solid var(--ln);overflow:hidden}
.mthumb.ph img{width:100%;height:100%;object-fit:cover}
.mhead-t{min-width:0;flex:1}
.mslot{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);font-weight:800}
.mslot span{color:var(--dm);letter-spacing:.02em;text-transform:none;font-weight:600}
.mname{font-size:17px;font-weight:800;line-height:1.2;margin-top:2px;text-wrap:balance}
.mmac{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:12px;color:var(--dm)}
.mmac span{display:inline-flex;align-items:center;gap:5px}
.mmac i{width:7px;height:7px;border-radius:50%;display:inline-block}
.mmac .tp{border:1px solid var(--ln);border-radius:99px;padding:1px 8px}
.mswap{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 16px;padding:8px 0;border-top:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.mswap span{font-size:12px;color:var(--dm)}
.mswap button{background:var(--sf2);border:1px solid var(--ln);color:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.mswap button:first-child{width:34px;padding:6px 0}
.mbody{padding:6px 16px 12px}
.mpills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.mpills span{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:4px 9px;border-radius:99px;background:var(--sf2);border:1px solid var(--ln)}
.mpills span.k{background:#fff;color:#000;font-weight:800;border-color:#fff}
.mpills span.tp{color:var(--dm)}
.mpills i{width:7px;height:7px;border-radius:50%;display:inline-block}
.mfoods .food{border-bottom:1px solid var(--ln);padding:7px 0}
.mfoods .food:last-child{border-bottom:0}
.mprep{margin-top:8px}
.mprep summary{cursor:pointer;font-size:14px;font-weight:700;color:var(--ac);list-style:none;padding:6px 0}
.mprep summary::-webkit-details-marker{display:none}
.mprep summary::after{content:" +";}
.mprep[open] summary::after{content:" –"}
.eatbar{height:8px;border-radius:99px;background:rgba(255,255,255,.1);margin:12px 0 2px;overflow:hidden}
.eatbar i{display:block;height:100%;background:var(--ac);border-radius:99px}
.mcard.done{border-color:rgba(110,231,183,.45)}
.meat{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.eatbtn{flex:1;min-width:150px;background:#fff;color:#000;border:0;border-radius:12px;padding:11px;font:inherit;font-weight:800;font-size:14px;cursor:pointer}
.eatbtn.on{background:rgba(110,231,183,.14);color:var(--okl);border:1px solid rgba(110,231,183,.45)}
.eatedit{background:var(--sf2);border:1px solid var(--ln);color:#fff;border-radius:12px;padding:11px 14px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}
.food.edit{align-items:center}
.gin{display:inline-flex;align-items:center;gap:6px;color:var(--dm)}
.gin .in{width:78px;padding:7px 9px;text-align:right}
.extras{margin-top:14px;border-radius:20px;border:1px dashed var(--ln);padding:14px 16px}
.xadd{display:grid;gap:8px;margin-top:10px}
.xrow{display:flex;gap:8px}
.xrow .in{flex:1;min-width:0}
.xrow .eatbtn{flex:none;min-width:0;padding:11px 18px}
.eatbtn:disabled{opacity:.4}
.xdel{background:none;border:0;color:var(--dm);font:inherit;cursor:pointer;margin-left:6px}
.gtabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:10px -16px 0;padding:0 16px}
.gtabs .chip{flex:none}
.gsrc{margin-top:10px;font-size:12px;color:var(--dm)}
.gsrc summary{cursor:pointer}
.gsrc li span{font-size:11.5px}
.shop-ex-t{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ac);font-weight:800;margin:14px 0 8px}
.shop-ex{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.shop-ex div{display:flex;flex-direction:column;gap:3px}
.shop-ex img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px;border:1px solid var(--ln)}
.shop-ex b{font-size:13px;margin-top:4px}
.shop-ex small{font-size:11.5px;color:var(--dm);line-height:1.35}
.picks{margin-top:12px;padding:10px;border-radius:14px;background:var(--sf2);border:1px solid var(--ln)}
.picks-t{font-size:12px;color:var(--dm);display:flex;align-items:center;gap:8px;margin-bottom:8px}
.mtag{background:#1E8E5A;color:#fff;font-weight:800;font-size:10.5px;letter-spacing:.04em;padding:2px 7px;border-radius:6px}
.picks-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none}
.pick{flex:none;width:120px;display:flex;flex-direction:column;gap:2px}
.pick img{width:120px;height:120px;object-fit:cover;border-radius:10px}
.pick b{font-size:12px;line-height:1.25;margin-top:4px}
.pick small{font-size:10.5px;color:var(--dm);line-height:1.3}
.pick.bread{background:none;border:0;padding:0;text-align:left;color:inherit;font:inherit;cursor:pointer;justify-content:flex-start}
.pick.bread img,.pick.bread .pimg{outline:2px solid transparent;outline-offset:-2px;transition:outline-color .15s}
.pick.bread.on img,.pick.bread.on .pimg{outline-color:var(--ac)}
.pick.bread.on b{color:var(--ac)}
.want-opts{display:flex;flex-direction:column;gap:10px}
.want-opt{display:flex;flex-direction:column;gap:4px;text-align:left;padding:14px;border-radius:14px;background:var(--sf2);border:1.5px solid var(--ln);color:inherit;font:inherit;cursor:pointer}
.want-opt b{font-size:15px}
.want-opt span{font-size:12.5px;color:var(--dm);line-height:1.4}
.want-opt.on{border-color:var(--ac)}
.want-opt.on b{color:var(--ac)}
.pimg{box-sizing:border-box;flex:none;width:120px;height:120px;border-radius:10px;background:var(--sf);border:1px solid var(--ln);display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-size:12px;font-weight:600;color:var(--dm)}
.hist{display:flex;justify-content:space-between;font-size:14px;padding:10px 0;border-bottom:1px solid var(--ln)}
.hist span:last-child{color:var(--dm)}
.tk-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.tk-top b{font-size:17px}
.tk-stats{display:flex;gap:26px;padding-bottom:14px;border-bottom:1px solid var(--ln);margin-bottom:6px}
.tk-stats span{display:block;font-size:12px;color:var(--dm)}
.tk-stats b{font-size:17px;font-variant-numeric:tabular-nums}
.ex{padding:18px 0;border-bottom:1px solid var(--ln)}
.ex .hd{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ex .hd b{font-size:16px;color:var(--ac)}
.ex .tgt{font-size:13px;color:var(--dm);margin:2px 0 10px}
.ex .note-in{background:none;border:0;color:var(--tx);font:inherit;font-size:16px;width:100%;padding:4px 0 8px}
.ex .note-in::placeholder{color:var(--dm)}
.rest{background:none;border:0;color:var(--ac);font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:0 0 10px}
.dots{background:none;border:0;color:var(--tx);font-size:20px;cursor:pointer;padding:0 4px;line-height:1}
.menu{display:flex;gap:8px;margin:4px 0 10px}
.sets{width:100%;border-collapse:separate;border-spacing:0 4px;font-size:14px}
.sets th{font-size:11px;color:var(--dm);font-weight:600;text-align:center;padding-bottom:2px}
.sets td{text-align:center;padding:5px 2px}
.sets tr.done td{background:var(--ok)}
.sets tr.done td:first-child{border-radius:10px 0 0 10px}
.sets tr.done td:last-child{border-radius:0 10px 10px 0}
.sets .lbl{background:none;border:0;color:var(--tx);font:inherit;font-weight:700;cursor:pointer;width:28px}
.sets .lbl.w{color:var(--wu)}
.sets .prev{color:var(--dm);font-size:13px}
.sets input{width:100%;max-width:62px;background:var(--sf2);border:1px solid var(--ln);color:var(--tx);border-radius:8px;padding:7px 4px;text-align:center;font:inherit;font-weight:700;font-size:16px}
.chk{width:30px;height:30px;border-radius:8px;border:1px solid var(--ln);background:var(--sf2);color:transparent;cursor:pointer;font-size:16px;font-weight:800}
.chk.on{background:var(--okl);border-color:var(--okl);color:#000}
.add{width:100%;background:var(--sf);border:1px solid var(--ln);color:var(--tx);border-radius:10px;padding:10px;font:inherit;font-size:14px;cursor:pointer;margin-top:6px}
.restbar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;background:var(--ac);color:#000;z-index:5}
.restbar div{width:100%;max-width:430px;display:flex;align-items:center;gap:10px;padding:14px 18px 20px}
.restbar b{font-size:20px;font-variant-numeric:tabular-nums;margin-right:auto}
.restbar button{background:rgba(0,0,0,.12);border:0;border-radius:9px;padding:8px 11px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;color:#000}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:flex-end;justify-content:center;z-index:10}
.modal .box{background:var(--sf);border-top:1px solid var(--ln);border-radius:20px 20px 0 0;width:100%;max-width:430px;padding:20px 18px 30px;max-height:85vh;overflow:auto}
.glasses{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.glass{width:34px;height:42px;border:1.5px solid var(--ln);border-radius:4px 4px 10px 10px;background:none;cursor:pointer;position:relative;overflow:hidden;padding:0}
.glass.on{border-color:var(--ac)}
.glass.on::after{content:"";position:absolute;left:0;right:0;bottom:0;height:70%;background:var(--ac);opacity:.8}
.hb{padding:16px 0;border-bottom:1px solid var(--ln)}
.hb .hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.hb .hd b{font-size:16px}
.hb .hd span{font-size:13px;color:var(--dm)}
.tips{margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.6;color:var(--dm)}
.stat3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.stat3 div{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px}
.stat3 b{display:block;font-size:20px}
.stat3 span{font-size:12px;color:var(--dm)}
.toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#fff;color:#000;font-weight:700;font-size:14px;padding:10px 16px;border-radius:999px;z-index:20}
.nav{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:center;background:rgba(0,0,0,.94);border-top:1px solid var(--ln)}
.nav div{display:flex;width:100%;max-width:430px}
.tab{flex:1;background:none;border:0;color:var(--dm);font:inherit;font-size:12px;padding:14px 0 calc(20px + env(safe-area-inset-bottom));cursor:pointer}
.tab.on{color:#fff;font-weight:700}
.hero{position:relative;border-radius:22px;overflow:hidden;background:var(--sf);border:1px solid var(--ln);margin-top:22px;aspect-ratio:4/5}
.hero-row{display:grid;grid-template-columns:42% 1fr;gap:14px;align-items:center;margin-top:22px}
.hero-row .hero{margin-top:0;aspect-ratio:3/4;border-radius:18px}
.hero-side{min-width:0;display:flex;flex-direction:column}
.hero-side .name{font-size:22px;text-align:left;line-height:1.1}
.hero-side .series{text-align:left;margin-top:2px}
.hero-side svg{margin:4px auto 0;max-width:190px!important}
.hero-next{margin-top:2px}
.hero-next .bar{height:5px}
.hero-next span{display:block;font-size:12px;color:var(--dm);margin-top:6px;line-height:1.35}
.hero img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.hero-txt{position:absolute;left:0;right:0;bottom:0;padding:60px 18px 18px;background:linear-gradient(transparent,rgba(0,0,0,.92))}
.hero-txt .name{margin-top:0;text-align:left}
.hero-txt .series{text-align:left}
.lvrow{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--ln);font-size:14px}
.lvrow small{display:block;color:var(--dm);font-size:12px;font-weight:400}
.thumb{width:40px;height:50px;border-radius:9px;background:var(--sf);border:1px solid var(--ln);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--dm);font-size:13px}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top}
.media{width:100%;border-radius:14px;border:1px solid var(--ln);background:#000;display:block;margin-top:6px}
.exname{background:none;border:0;color:var(--ac);font:inherit;font-size:16px;font-weight:700;text-align:left;cursor:pointer;padding:0}
.play{display:inline-block;font-size:10px;margin-right:6px;vertical-align:2px}
.exrow{display:flex;justify-content:space-between;width:100%;background:none;border:0;color:var(--dm);font:inherit;font-size:13px;padding:4px 0;cursor:pointer;text-align:left;gap:10px}
.exrow span:first-child{color:var(--tx)}
.plate{font-size:13px;line-height:1.5;margin:10px 0 0;padding-left:12px;border-left:2px solid var(--ac)}
.mycard{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.mycard div{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px}
.mycard span{display:block;font-size:12px;color:var(--dm)}
.mycard b{font-size:22px}
.rkrow{display:flex;align-items:center;gap:12px;padding:11px 8px;border-bottom:1px solid var(--ln);font-size:14px}
.rkrow.me{background:var(--sf);border-radius:12px;border-bottom-color:transparent}
.rkrow .pos{width:26px;text-align:center;color:var(--dm);font-variant-numeric:tabular-nums;font-weight:700}
.rkrow .pos.top{color:var(--ac)}
.rkrow .who{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.rkrow .who small{display:block;color:var(--dm);font-size:12px}
.rkrow b{font-variant-numeric:tabular-nums}
.hint a{color:var(--ac)}
.srcs{margin-top:22px;border:1px solid var(--ln);border-radius:14px;padding:12px 14px;background:var(--sf)}
.srcs summary{cursor:pointer;font-weight:700;font-size:14px}
.src{display:block;padding:10px 0;border-top:1px solid var(--ln);color:var(--tx);text-decoration:none;font-size:13px;line-height:1.4}
.src b{display:block;font-size:13px}.src span{color:var(--dm);text-decoration:underline;text-decoration-color:rgba(255,255,255,.25)}
.hist-r{display:inline-flex;align-items:center;gap:8px}
.shr-btn{background:none;border:0;color:var(--ac);padding:2px;cursor:pointer;display:inline-flex}
.shr .box{max-height:92vh}
.shr-prev{margin:12px auto;width:62%;aspect-ratio:9/16;border-radius:16px;overflow:hidden;border:1px solid var(--ln);background:var(--sf2);display:flex;align-items:center;justify-content:center;color:var(--dm);font-size:13px}
.shr-prev img{width:100%;height:100%;object-fit:cover;display:block}
.shr-prev{padding:0;cursor:pointer;color:var(--dm)}
.shr-empty{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:15px;color:var(--tx);font-weight:700;text-align:center;padding:0 14px}
.shr-empty b{width:56px;height:56px;border-radius:50%;background:var(--ac);color:#000;font-size:34px;line-height:56px;font-weight:600}
.shr-empty small{font-size:12px;color:var(--dm);font-weight:500}
.shr-tip{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px}
.shr-tip-box{background:var(--sf);border:1px solid var(--ac);border-radius:18px;padding:20px 18px;max-width:340px;text-align:center;animation:popIn .3s ease-out both}
.shr-tip-box b{display:block;font-size:17px;line-height:1.35}
.shr-tip-box p{color:var(--dm);font-size:14px;margin:8px 0 14px}
.fin-share{margin-top:10px}
.qc{display:block;width:100%;text-align:left;background:none;border:0;color:var(--tx);font:inherit;cursor:pointer;padding:6px 0 2px}
.qc p{font-size:19px;line-height:1.32;margin:0 0 8px}
.qc .who{font-size:13px}.qc .from{font-weight:400;color:var(--dm)}
.qc-more{display:inline-block;margin-top:8px;font-size:12px;color:var(--ac)}
.prize{margin-top:12px;border-radius:16px;padding:14px;background:linear-gradient(135deg,rgba(212,139,146,.22),rgba(212,139,146,.04));border:1px solid rgba(212,139,146,.45)}
.prize-hd{display:flex;align-items:center;gap:8px}
.prize-ic{width:26px;height:26px;border-radius:50%;background:var(--ac);color:#000;display:flex;align-items:center;justify-content:center;font-size:14px}
.prize-hd b{font-size:15px}
.prize p{font-size:14px;line-height:1.5;margin:8px 0 10px}
.prize-links{display:flex;gap:16px;align-items:center;font-size:13px}
.prize-links a{color:var(--ac);font-weight:700;text-decoration:none}
.prize small{display:block;margin-top:10px;font-size:11px;line-height:1.4;color:var(--dm)}
.stw{margin-top:14px;background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px 14px}
.stw-hd{display:flex;justify-content:space-between;align-items:baseline}
.stw-hd span{font-size:13px;color:var(--dm)}.stw-hd b{font-size:20px}.stw-hd b small{font-size:12px;color:var(--dm);font-weight:500}
.stw-bars{position:relative;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;height:110px;margin:12px 0 4px;align-items:end}
.stw-goal{position:absolute;left:0;right:0;border-top:1px dashed rgba(255,255,255,.45);z-index:1;pointer-events:none}
.stw-col{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
.stw-bar{width:100%;border-radius:6px 6px 2px 2px;background:rgba(212,139,146,.55);animation:fillUp .6s ease-out both}
.stw-bar.ok{background:var(--ac)}
.stw-col small{font-size:11px;color:var(--dm)}.stw-col small.today{color:var(--tx);font-weight:700}
.stw-v{font-size:13px;line-height:1.45;margin:8px 0 0;padding:8px 10px;border-radius:10px;background:var(--sf2)}
.stw-v.ok{color:var(--okl)}.stw-v.mid{color:var(--wu)}.stw-v.low{color:#F28B82}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0 0}
.kpi{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:11px 12px}
.kpi small{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--dm)}
.kpi b{display:block;font-size:22px;font-weight:800;margin:3px 0 7px;font-variant-numeric:tabular-nums}
.kpi b span{font-size:13px;color:var(--dm);font-weight:600}
.kpi .bar{height:5px}
.kpi .dots{display:flex;gap:3px}.kpi .dots i{flex:1;height:5px;border-radius:3px;background:var(--sf2)}.kpi .dots i.on{background:var(--ac)}
.nextcard.in{margin:0 0 12px;background:none;border:0;padding:0}
.nextcard{margin-top:12px;background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:14px 14px 4px}
.nc-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.nc-top small{color:var(--dm);font-size:12px}.nc-top b{font-size:16px}
.nc-lim{font-size:14px;line-height:1.45;color:var(--dm);margin:8px 0 6px}.nc-lim b{color:var(--tx)}
.fold{margin-top:10px;background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:0 14px}
.fold.in{margin:0;background:none;border:0;border-top:1px solid var(--ln);border-radius:0;padding:0}
.fold summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:13px 0;cursor:pointer;font-weight:700;font-size:15px}
.fold.in summary{font-size:13px;font-weight:600;color:var(--dm);padding:11px 0}
.fold summary::-webkit-details-marker{display:none}
.fold summary i{font-style:normal;color:var(--ac);font-size:20px;transition:transform .2s}
.fold[open] summary i{transform:rotate(45deg)}
.fold-p{margin:0 0 14px;font-size:14px;line-height:1.55;color:var(--dm)}
.fold .skills{margin:0 0 14px;padding:0;background:none;border:0}
.fold .sk-title{display:none}
.sfoot{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 0 10px;color:var(--dm)}
.sfoot-icons{display:flex;gap:14px}
.sfoot-icons a{width:46px;height:46px;border-radius:50%;border:1px solid var(--ln);background:var(--sf);display:flex;align-items:center;justify-content:center;color:var(--tx)}
.sfoot span{font-size:13px;font-weight:600;letter-spacing:.02em}
.lvinfo{margin-top:18px;background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:0 14px}
.lvinfo summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:13px 0;cursor:pointer;font-weight:700;font-size:15px}
.lvinfo summary::-webkit-details-marker{display:none}
.lvinfo summary i{font-style:normal;color:var(--ac);font-size:20px;transition:transform .2s}
.lvinfo[open] summary i{transform:rotate(45deg)}
.lvinfo p{margin:0 0 14px;font-size:14px;line-height:1.55;color:var(--dm)}
.steps-tile{background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:14px 16px;margin:16px 0 4px}
.st-top{display:flex;justify-content:space-between;align-items:center}
.st-top small{color:var(--dm);font-size:13px}
.st-src{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dm)}
.st-num{display:flex;align-items:baseline;gap:6px;margin:4px 0 10px}
.st-num b{font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
.st-num span{color:var(--dm);font-size:14px}
.st-num em{margin-left:auto;font-style:normal;font-size:12px;font-weight:700;color:#000;background:var(--okl);border-radius:999px;padding:3px 9px}
.hk.mini{padding:10px 12px}.hk.mini .hk-hd{margin-bottom:4px}.hk.mini .link{font-size:12px}
.hk{margin-top:12px;background:var(--sf2);border:1px solid var(--ln);border-radius:14px;padding:12px 14px}
.hk-hd{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.hk-hd div{flex:1}.hk-hd b{display:block;font-size:15px}.hk-hd small{color:var(--dm);font-size:12px}
.hk-st{font-size:12px;font-weight:700;color:var(--dm);border:1px solid var(--ln);border-radius:999px;padding:4px 9px}
.hk-st.on{color:#000;background:var(--okl);border-color:var(--okl)}
.hk p{font-size:13px;line-height:1.5;margin:0 0 10px}
.abspick{background:var(--sf2);border:1px solid var(--ln);border-radius:14px;padding:10px 12px;margin:0 0 12px}
.abspick small{display:block;color:var(--dm);font-size:12px;margin-bottom:8px}
.abspick .chips{gap:6px}.abspick .chip{padding:7px 11px;font-size:13px}
button.rkrow{width:100%;background:none;border:0;border-bottom:1px solid var(--ln);color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.rk-list .rkrow{animation:rise .4s ease-out both}
.rk-open{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:none;border:0;color:var(--tx);font:inherit;font-size:14px;text-align:left;padding:0;cursor:pointer}
.rkrow .go{color:var(--dm);font-size:20px}
.av{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:var(--sf2);color:var(--tx);font-weight:800;border:1px solid var(--ln)}
.av img{width:100%;height:100%;object-fit:cover;object-position:50% 12%}
.av.photo img{object-position:center}
.av.ring{border:2px solid var(--ac);box-shadow:0 0 0 3px rgba(212,139,146,.18)}
.av.none{color:var(--dm)}
.wkcard{display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#17171B,#0E0E11);border:1px solid var(--ln);border-radius:18px;padding:14px 16px;margin-top:6px}
.wkring{position:relative;width:84px;height:84px;flex:none}
.wkring div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.wkring b{font-size:22px;line-height:1}.wkring small{font-size:11px;color:var(--dm)}
.wkinfo{flex:1;min-width:0}
.wkpos{display:block;font-size:15px;margin-bottom:8px}.wkpos b{color:var(--ac);font-size:18px}
.wkinfo>small{display:block;color:var(--dm);font-size:12px;margin-top:8px}
.wkdays{display:flex;gap:5px}
.wkdays span{flex:1;max-width:30px;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--dm);background:var(--sf2);border:1px solid var(--ln)}
.wkdays span.on{background:var(--ac);color:#000;border-color:var(--ac);animation:pop .4s ease-out both}
.wkdays span.today{border-color:#fff}
.wkdays.big{margin-top:14px;justify-content:space-between}.wkdays.big span{max-width:38px}
.rk-search{display:flex;align-items:center;gap:8px;background:var(--sf);border:1px solid var(--ln);border-radius:999px;padding:0 14px;margin-top:14px;color:var(--dm)}
.rk-search input{flex:1;background:none;border:0;color:var(--tx);font:inherit;font-size:15px;padding:11px 0;outline:none;min-width:0}
.rk-search button{background:none;border:0;color:var(--dm);font-size:14px;cursor:pointer}
.rk-found{margin-top:6px}
.podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;align-items:end;gap:8px;margin:22px 0 8px}
.pd{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:0;color:var(--tx);font:inherit;padding:0;cursor:pointer;min-width:0;animation:rise .55s cubic-bezier(.2,.9,.3,1.2) both}
.pd.p1{animation-delay:.05s}.pd.p2{animation-delay:.18s}.pd.p3{animation-delay:.3s}
.pd .pn{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px}
.pd small{font-size:12px;color:var(--dm);font-variant-numeric:tabular-nums}
.pd.me .pn{color:var(--ac)}
.pd .step{width:100%;margin-top:8px;border-radius:14px 14px 4px 4px;background:linear-gradient(180deg,#232329,#121215);border:1px solid var(--ln);border-bottom:0;display:flex;justify-content:center;padding-top:10px;transform-origin:bottom;animation:stepUp .7s cubic-bezier(.2,.9,.3,1.1) both}
.pd .step span{font-size:22px;font-weight:900;color:var(--dm)}
.pd.p1 .step{height:96px;background:linear-gradient(180deg,rgba(212,139,146,.45),rgba(212,139,146,.06));border-color:rgba(212,139,146,.5)}
.pd.p1 .step span{color:#fff;font-size:28px}
.pd.p2 .step{height:68px;animation-delay:.12s}.pd.p3 .step{height:50px;animation-delay:.24s}
.pd.p1 .av.ring{box-shadow:0 0 0 4px rgba(245,199,107,.25),0 0 28px rgba(212,139,146,.45);border-color:#F5C76B}
.pd .crown{position:absolute;top:-20px;z-index:2;animation:crown 2.4s ease-in-out infinite}
.pd.vacio{opacity:.35;cursor:default}
.podium.sk div{height:150px;border-radius:14px;background:var(--sf);animation:blink 1.2s infinite}
.podium.sk div:nth-child(2){height:190px}
@keyframes stepUp{from{transform:scaleY(0)}to{transform:none}}
@keyframes crown{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-4px) rotate(6deg)}}
.confetti{position:fixed;inset:0;pointer-events:none;z-index:19;overflow:hidden}
.confetti i{position:absolute;top:-20px;height:12px;border-radius:2px;animation:fall 2.4s cubic-bezier(.3,.6,.5,1) forwards}
@keyframes fall{to{top:105%;transform:rotate(720deg) translateX(40px)}}
.lastwin{display:flex;gap:10px}
.lastwin button{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px 6px;color:var(--tx);font:inherit;cursor:pointer;min-width:0}
.lastwin b{font-size:14px}.lastwin small{font-size:12px;color:var(--dm);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-legal{position:fixed;inset:0;z-index:40;background:#000;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)}
.rk-legal-top{display:flex;justify-content:flex-end;padding:12px 18px;border-bottom:1px solid var(--ln)}
.rk-legal iframe{flex:1;border:0;width:100%;background:#000}
.arc .inlink{background:none;border:0;padding:0;font:inherit;color:var(--ac);text-decoration:underline;cursor:pointer}
.pend{display:block;font-size:12px;color:var(--wu);margin-top:2px}
.myprof{display:flex;gap:14px;align-items:center;background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:14px}
.myprof-av{background:none;border:0;padding:0;cursor:pointer}
.prof-hd{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding-top:6px}
.prof-hd h1{font-size:22px;margin:6px 0 0}.prof-hd h1 small{font-size:14px;color:var(--dm)}
.prof-hd .av{animation:popIn .4s ease-out both}
.lvtag{font-size:12px;font-weight:700;letter-spacing:.04em;color:#000;background:var(--ac);border-radius:999px;padding:4px 10px}
.mbar{display:grid;grid-template-columns:110px 1fr 28px;align-items:center;gap:10px;font-size:13px;margin:7px 0}
.mbar span{color:var(--dm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbar div{height:10px;background:var(--sf2);border-radius:99px;overflow:hidden}
.mbar i{display:block;height:100%;background:var(--ac);border-radius:99px;transform-origin:left;animation:skGrow .7s ease-out both}
.mbar b{text-align:right;font-variant-numeric:tabular-nums}
.wk8{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;align-items:end;height:90px;margin-top:6px}
.wk8 div{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
.wk8 i{width:100%;background:var(--ac);border-radius:6px 6px 2px 2px;animation:fillUp .7s ease-out both}
.wk8 small{font-size:11px;color:var(--dm)}
.rk-hero{background:radial-gradient(120% 100% at 50% 0%,rgba(212,139,146,.28),transparent 70%),var(--sf);border:1px solid var(--ln);border-radius:18px;padding:22px 16px 16px;text-align:center;margin:6px 0 14px}
.rk-hero p{margin:12px 0 0;font-weight:700}
.rk-hero-pod{display:flex;justify-content:center;align-items:flex-end;gap:6px;height:90px}
.rk-hero-pod span{width:54px;border-radius:10px 10px 3px 3px;background:#1D1D22;border:1px solid var(--ln);transform-origin:bottom;animation:stepUp .7s cubic-bezier(.2,.9,.3,1.1) both;display:flex;justify-content:center}
.rk-hero-pod .b1{height:80px;background:linear-gradient(180deg,rgba(212,139,146,.55),rgba(212,139,146,.08));padding-top:0;align-items:flex-start}
.rk-hero-pod .b1 svg{margin-top:-24px;animation:crown 2.4s ease-in-out infinite}
.rk-hero-pod .b2{height:56px;animation-delay:.12s}.rk-hero-pod .b3{height:40px;animation-delay:.24s}
.edrow{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--ln);color:var(--tx);font:inherit;font-size:14px;padding:12px 0;cursor:pointer}
.edrow span{display:block;line-height:1.4}
.edrow small{display:block;color:var(--dm);font-size:12px;margin-top:3px}
.ingr{background:var(--sf);border:1px solid var(--ln);border-radius:12px;padding:10px;margin-bottom:8px}
textarea.in{resize:vertical;line-height:1.5}
.tour{min-height:calc(100vh - 120px);display:flex;flex-direction:column}
.tour-dots{display:flex;gap:6px;margin-top:4px}
.tour-dots i{height:4px;flex:1;border-radius:4px;background:var(--ln)}
.tour-dots i.on{background:var(--ac)}
.tour-h{font-size:30px;margin:28px 0 14px}
.tour-p{font-size:17px;line-height:1.5;margin:0 0 12px}
.tour-p.dim{color:var(--dm);font-size:15px}
.tour-list>div{padding:14px 0;border-bottom:1px solid var(--ln)}
.tour-list b{display:block;font-size:16px;margin-bottom:4px}
.tour-list span{display:block;font-size:14px;line-height:1.5;color:var(--dm)}
.tour-ok{display:block;font-style:normal;color:var(--okl);font-size:14px;margin-top:8px}
.fwall{margin:4px -16px 18px;display:flex;flex-direction:column;gap:8px;overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.fwall-row{display:flex;gap:8px;width:max-content;animation:fwall linear infinite}
.fwall-row.rev{animation-direction:reverse}
.fwall-row img{width:118px;height:118px;object-fit:cover;border-radius:16px;flex:none;background:var(--sf)}
@keyframes fwall{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion: reduce){.fwall-row{animation:none}}
.chip.no.on{background:transparent;color:var(--ac);border-color:var(--ac);text-decoration:line-through}
.vars{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.var{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:3px;min-width:0}
.var-th{aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:var(--sf2);border:1px solid var(--ln);display:flex;align-items:center;justify-content:center;color:var(--dm);font-size:18px}
.var-th video,.var-th img{width:100%;height:100%;object-fit:cover}
.var b{font-size:12.5px;line-height:1.25;margin-top:4px}
.var small{font-size:11px;color:var(--dm)}
.wk{background:var(--sf);border:1px solid var(--ln);border-radius:18px;padding:16px}
.wk-main b{font-size:44px;line-height:1}.wk-main b span{font-size:22px;color:var(--dm)}
.wk-main small{display:block;color:var(--dm);margin:4px 0 10px}
.wk .stat3{margin-top:14px}
.warm{background:var(--sf);border:1px solid var(--ln);border-radius:18px;padding:14px 16px;margin:4px 0 18px}
.warm-hd{all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%}
.warm-hd span{display:flex;flex-direction:column}.warm-hd small{color:var(--dm);font-size:12.5px;margin-top:2px}
.warm-hd i{font-style:normal;font-size:24px;color:var(--ac);line-height:1}
.warm-tips{margin:12px 0 14px;padding-left:18px}.warm-tips li{font-size:14px;color:var(--dm);line-height:1.5;margin-bottom:4px}
img[src^="/ratas/"]{object-fit:contain!important;object-position:center bottom!important;padding:8% 6% 4%;background:radial-gradient(ellipse at 50% 70%,rgba(212,139,146,.14),transparent 65%)}
.thumb img[src^="/ratas/"]{padding:4%}
.social{margin-top:28px;display:flex;flex-direction:column;gap:10px}
.social-row{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--ln);border-radius:16px;background:var(--sf);color:var(--tx);text-decoration:none}
.social-row i{display:flex;width:40px;height:40px;border-radius:12px;align-items:center;justify-content:center;color:#fff;background:linear-gradient(45deg,#f9a03f,#e1306c 50%,#833ab4)}
.social-row span{flex:1;display:flex;flex-direction:column}.social-row b{font-size:15px}.social-row small{font-size:12.5px;color:var(--dm);margin-top:2px}
.social-row em{font-style:normal;color:var(--dm);font-size:22px}
.tour-actions{margin-top:auto;padding-top:24px;display:flex;flex-direction:column;align-items:center;gap:14px}
select.in{appearance:none}
.tags{display:flex;gap:6px;margin-top:10px}
.tags span{font-size:11px;border:1px solid var(--ln);border-radius:999px;padding:3px 8px;color:var(--dm)}
.splash{position:fixed;inset:0;background:#000;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;pointer-events:none}
.splash-glow{position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(212,139,146,.35),transparent 65%)}
.splash-mark{position:relative;filter:drop-shadow(0 0 24px rgba(212,139,146,.45))}
.splash-word{font-weight:800;letter-spacing:.5em;font-size:13px;margin-top:6px;padding-left:.5em;position:relative}
.lvup{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.96);display:flex;flex-direction:column;align-items:center;padding:calc(36px + env(safe-area-inset-top)) 24px calc(28px + env(safe-area-inset-bottom));text-align:center;overflow:hidden}
.lvup-glow{position:absolute;top:22%;left:50%;width:420px;height:420px;margin-left:-210px;border-radius:50%;background:radial-gradient(circle,rgba(212,139,146,.32),transparent 62%)}
.lvup-tag{position:relative;font-size:13px;color:var(--dm);letter-spacing:.04em}
.lvup-from{position:relative;font-size:15px;color:var(--dm);margin-top:8px;text-decoration:line-through;text-decoration-color:rgba(212,139,146,.8)}
.lvup-stage{position:relative;width:220px;height:260px;margin:22px 0 8px;display:flex;align-items:center;justify-content:center}
.lvup-img{width:200px;height:250px;border-radius:24px;overflow:hidden;border:1px solid rgba(212,139,146,.6);box-shadow:0 0 60px rgba(212,139,146,.35)}
.lvup-img img{width:100%;height:100%;object-fit:cover;object-position:top}
.lvup-spark{position:absolute;left:50%;top:50%;opacity:0}
.lvup-title{position:relative;font-size:15px;font-weight:600;color:var(--ac);margin:10px 0 2px}
.lvup-name{position:relative;font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.lvup-line{position:relative;font-size:15px;line-height:1.5;color:var(--dm);max-width:320px;margin:10px 0 0}
.lvup-btn{position:relative;margin-top:auto;max-width:380px}
@media (prefers-reduced-motion:no-preference){
.fill{transition:stroke-dashoffset .9s ease;animation:fillIn 1.2s cubic-bezier(.2,.8,.2,1) both}
@keyframes fillIn{from{stroke-dashoffset:var(--len)}}
.chk.on{animation:pop .28s ease-out}
@keyframes pop{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.splash{animation:splashOut .45s ease-in 1.05s both}
.splash-glow{animation:glow 1.2s ease-out both}
.splash-mark{animation:markIn .8s cubic-bezier(.2,.9,.2,1.2) both}
.splash-word{animation:rise .6s ease-out .35s both}
@keyframes splashOut{to{opacity:0}}
@keyframes glow{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes markIn{from{transform:scale(.6) rotate(-20deg);opacity:0}to{transform:none;opacity:1}}
@keyframes rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
.lvup{animation:fadeIn .3s ease-out both}
.lvup-glow{animation:pulse 2.4s ease-in-out .5s infinite}
.lvup-from{animation:rise .5s ease-out .15s both}
.lvup-img{animation:reveal .9s cubic-bezier(.2,.9,.2,1.1) .35s both}
.lvup-spark{animation:burst 1.1s ease-out both}
.lvup-title{animation:rise .5s ease-out .9s both}
.lvup-name{animation:rise .5s ease-out 1s both}
.lvup-line{animation:rise .5s ease-out 1.15s both}
.lvup-btn{animation:rise .5s ease-out 1.3s both}
@keyframes fadeIn{from{opacity:0}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.12);opacity:1}}
@keyframes reveal{from{transform:scale(.5);opacity:0;filter:blur(12px) brightness(3)}to{transform:none;opacity:1;filter:none}}
@keyframes burst{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}25%{opacity:1}100%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(1) rotate(90deg);opacity:0}}
}
@media (prefers-reduced-motion:reduce){.splash{display:none}.lvup-spark{display:none}}
`;

const LOGO_D = "M1292.5 1869.4C1169.3 1859.0 1054.2 1814.9 953.7 1739.6C905.0 1703.1 856.6 1654.0 818.8 1602.7C809.6 1590.2 787.9 1558.3 783.0 1550.1C781.5 1547.6 777.9 1541.7 775.0 1537.0C772.1 1532.3 768.4 1526.0 766.7 1523.0C765.1 1520.0 762.9 1516.4 762.0 1515.0C761.1 1513.6 757.5 1507.3 754.0 1501.0C750.5 1494.7 746.9 1488.2 746.0 1486.5C745.1 1484.8 742.4 1479.9 740.0 1475.5C737.7 1471.1 735.4 1467.0 735.0 1466.5C734.6 1466.0 732.7 1462.6 730.8 1459.0C721.7 1442.2 719.3 1438.0 714.7 1430.5C698.0 1403.7 685.1 1387.1 667.0 1368.9C650.0 1351.8 628.7 1335.3 608.5 1323.5C598.2 1317.5 574.9 1306.4 564.0 1302.3C561.0 1301.1 555.4 1299.0 551.5 1297.5C524.5 1287.1 477.9 1275.7 439.0 1270.0C435.4 1269.4 429.8 1268.6 426.5 1268.0C423.2 1267.5 415.1 1266.4 408.5 1265.5C401.9 1264.7 393.1 1263.5 389.0 1263.0C375.5 1261.3 350.3 1258.6 332.5 1257.0C325.9 1256.4 316.4 1255.5 311.5 1255.0C306.6 1254.5 296.2 1253.6 288.5 1253.0C265.3 1251.1 262.5 1250.7 262.5 1249.0C262.5 1247.3 265.0 1247.0 288.0 1245.0C295.4 1244.4 304.9 1243.5 309.0 1243.0C313.1 1242.5 321.7 1241.6 328.0 1241.0C334.3 1240.4 343.1 1239.5 347.5 1239.0C351.9 1238.5 360.0 1237.6 365.5 1237.0C394.5 1233.9 422.2 1229.3 457.5 1221.9C461.4 1221.1 463.3 1220.6 480.5 1216.0C496.7 1211.7 527.6 1200.8 541.0 1194.8C543.5 1193.7 547.5 1191.9 550.0 1190.8C552.5 1189.7 558.1 1187.0 562.5 1184.8C569.9 1181.1 573.5 1179.1 586.0 1172.2C593.5 1168.1 621.1 1149.6 627.5 1144.4C663.9 1114.9 697.7 1078.2 719.2 1045.0C727.9 1031.5 736.5 1017.8 739.0 1013.5C745.3 1002.6 774.1 958.7 788.2 938.5C802.4 918.1 833.8 877.9 846.0 864.5C908.6 795.7 955.1 757.1 1027.0 714.2C1060.2 694.4 1106.7 673.3 1147.5 659.3C1191.1 644.5 1240.0 633.7 1287.5 628.6C1390.4 617.4 1499.9 633.3 1596.0 673.4C1615.3 681.5 1640.2 693.3 1650.5 699.2C1653.8 701.1 1660.1 704.6 1664.5 707.0C1677.9 714.2 1705.6 732.3 1723.9 745.9C1753.9 768.1 1789.2 801.0 1813.8 829.5C1839.1 858.9 1864.0 894.8 1885.5 932.8C1890.0 940.8 1891.0 943.4 1890.1 944.3C1888.8 945.6 1887.4 944.2 1871.5 926.7C1862.3 916.4 1832.2 888.2 1820.5 878.8C1800.4 862.7 1776.4 846.1 1754.5 833.1C1742.7 826.0 1704.7 806.6 1694.0 802.1C1638.5 778.7 1600.9 768.8 1548.0 763.6C1513.1 760.1 1476.4 760.9 1441.5 765.9C1429.3 767.6 1409.4 771.4 1399.2 773.9C1396.9 774.5 1393.3 775.4 1391.2 775.9C1380.3 778.5 1356.6 785.7 1349.0 788.7C1348.2 789.0 1344.1 790.5 1340.0 792.0C1320.5 798.9 1277.6 819.4 1260.5 829.9C1256.7 832.3 1252.2 835.0 1250.5 836.0C1217.8 854.9 1178.9 885.8 1146.1 919.0C1105.5 960.0 1075.2 1001.9 1050.6 1051.0C1029.3 1093.6 1015.9 1132.3 1007.1 1176.5C997.8 1223.6 997.8 1276.7 1007.1 1325.0C1015.1 1366.6 1028.5 1406.1 1047.5 1444.2C1059.9 1469.0 1084.4 1507.2 1102.2 1529.6C1134.0 1569.7 1175.5 1608.2 1219.9 1639.0C1225.3 1642.8 1243.4 1654.1 1252.0 1659.1C1256.1 1661.5 1260.8 1664.2 1262.5 1665.2C1267.9 1668.3 1301.3 1684.5 1307.5 1687.0C1308.6 1687.4 1311.2 1688.6 1313.3 1689.5C1316.8 1691.0 1323.3 1693.5 1339.0 1699.2C1344.3 1701.1 1353.8 1704.1 1360.8 1706.1C1362.5 1706.6 1365.5 1707.4 1367.2 1707.9C1388.1 1713.9 1419.2 1720.0 1444.0 1722.9C1469.0 1725.9 1476.9 1726.3 1505.5 1726.3C1533.9 1726.3 1543.9 1725.7 1566.5 1722.9C1579.8 1721.2 1597.1 1718.5 1603.5 1717.0C1614.8 1714.5 1616.9 1714.0 1622.0 1712.9C1626.9 1711.8 1634.8 1709.8 1645.0 1707.0C1653.8 1704.5 1672.3 1698.7 1676.5 1697.0C1677.6 1696.6 1683.5 1694.3 1689.5 1691.9C1695.5 1689.6 1703.3 1686.4 1706.8 1684.8C1710.2 1683.3 1713.2 1682.0 1713.5 1682.0C1713.9 1682.0 1734.2 1672.4 1743.0 1668.1C1757.3 1660.9 1786.1 1644.0 1802.9 1632.7C1815.0 1624.7 1842.4 1604.3 1852.0 1596.1C1867.3 1583.2 1882.3 1569.7 1894.1 1558.3C1901.0 1551.5 1907.2 1546.0 1907.9 1546.0C1908.5 1546.0 1909.0 1546.8 1909.0 1547.8C1909.0 1552.1 1859.5 1622.3 1845.2 1638.2C1842.6 1641.1 1836.8 1647.8 1832.5 1653.0C1816.3 1672.3 1783.1 1704.4 1758.5 1724.6C1710.8 1763.6 1650.2 1798.3 1586.6 1822.9C1521.7 1848.0 1463.5 1862.3 1400.5 1868.6C1376.9 1870.9 1315.6 1871.4 1292.5 1869.4ZM1482.2 1560.8C1481.6 1560.1 1480.2 1552.5 1479.0 1544.0C1476.1 1522.4 1469.7 1490.9 1463.8 1469.1C1452.6 1427.3 1437.3 1394.1 1416.1 1365.0C1390.9 1330.5 1350.1 1301.1 1305.0 1285.2C1300.3 1283.5 1294.9 1281.7 1293.0 1281.1C1291.1 1280.5 1287.5 1279.4 1285.0 1278.6C1282.5 1277.8 1275.5 1276.0 1269.5 1274.6C1250.7 1270.1 1251.5 1270.2 1233.5 1267.0C1215.3 1263.7 1210.9 1263.1 1177.0 1259.0C1156.3 1256.5 1144.8 1255.2 1121.0 1253.0C1114.7 1252.4 1105.7 1251.5 1101.0 1251.0C1093.0 1250.1 1070.6 1248.2 1063.0 1247.7C1060.7 1247.6 1059.4 1247.0 1059.2 1245.9C1058.9 1244.1 1062.7 1243.4 1086.0 1241.0C1091.8 1240.4 1099.9 1239.5 1104.0 1239.0C1108.1 1238.5 1115.8 1237.6 1121.0 1237.0C1150.9 1233.5 1184.8 1228.7 1206.5 1224.9C1209.8 1224.3 1214.8 1223.4 1217.5 1223.0C1231.6 1220.5 1235.8 1219.7 1238.5 1218.9C1240.2 1218.4 1245.5 1217.1 1250.5 1216.0C1267.0 1212.2 1293.1 1203.8 1304.8 1198.4C1307.7 1197.1 1310.2 1196.0 1310.4 1196.0C1311.6 1196.0 1331.3 1186.3 1338.3 1182.3C1378.2 1159.5 1407.8 1130.9 1430.8 1093.0C1454.6 1053.7 1468.7 1011.0 1478.9 947.0C1481.2 932.3 1481.7 930.5 1483.5 930.5C1485.2 930.5 1485.7 932.1 1487.6 943.5C1499.8 1016.1 1522.0 1072.0 1556.1 1116.0C1573.9 1139.0 1603.2 1164.3 1627.0 1177.2C1646.6 1187.9 1657.0 1192.4 1675.5 1198.4C1691.7 1203.7 1700.8 1206.3 1713.5 1209.0C1715.7 1209.5 1719.5 1210.3 1722.0 1210.9C1737.9 1214.4 1767.3 1218.7 1789.5 1220.9C1819.2 1223.8 1840.0 1225.2 1881.5 1227.0C1894.7 1227.6 1915.4 1228.5 1927.5 1229.0C1939.6 1229.5 1960.8 1230.4 1974.5 1231.0C1988.2 1231.6 2009.0 1232.5 2020.5 1233.0C2032.0 1233.5 2052.8 1234.4 2066.5 1235.0C2153.1 1238.6 2244.7 1243.4 2245.7 1244.3C2247.5 1246.2 2242.4 1246.8 2221.8 1247.4C2209.0 1247.7 2185.7 1248.5 2170.0 1249.0C2154.3 1249.5 2122.2 1250.4 2098.5 1251.0C2074.8 1251.5 2037.0 1252.4 2014.5 1253.0C1992.0 1253.5 1953.5 1254.5 1929.0 1255.1C1820.0 1257.7 1783.2 1260.3 1734.5 1269.0C1694.7 1276.2 1669.3 1284.0 1640.1 1298.2C1585.9 1324.6 1549.7 1362.5 1522.8 1421.2C1508.2 1453.3 1498.5 1487.4 1489.5 1538.5C1485.9 1559.3 1484.5 1563.5 1482.2 1560.8Z";
function Logo({ height = 22 }) {
  return (
    <svg height={height} width={height * 1.5890} viewBox="258 621 1991 1253" aria-hidden="true" style={{ display: "block" }}>
      <path fill="#fff" fillRule="evenodd" d={LOGO_D} />
    </svg>
  );
}

function ArcGauge({ total, current, progress }) {
  const cx = 150, cy = 150, r = 120, a0 = (150 * Math.PI) / 180, sweep = (240 * Math.PI) / 180, gap = 0.035, seg = sweep / total;
  const pt = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const path = (s, e) => { const [x0, y0] = pt(s), [x1, y1] = pt(e); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  return (
    <svg viewBox="0 10 300 215" width="100%" style={{ maxWidth: 300, display: "block" }} role="img" aria-label={`Nivel ${current + 1} de ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const s = a0 + i * seg + gap / 2, e = a0 + (i + 1) * seg - gap / 2, len = r * (e - s);
        return (
          <g key={i}>
            <path d={path(s, e)} stroke={i <= current ? "#fff" : "#26262B"} strokeWidth={i <= current ? 10 : 8} fill="none" strokeLinecap="round" />
            {i === current + 1 && progress > 0 && (
              <path className="fill" d={path(s, e)} stroke="#D48B92" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - progress)} style={{ "--len": len }} />
            )}
          </g>
        );
      })}
      <text x="150" y="150" textAnchor="middle" fill="#fff" fontSize="64" fontWeight="800" fontFamily="Plus Jakarta Sans">{current + 1}</text>
      <text x="150" y="176" textAnchor="middle" fill="rgba(255,255,255,.6)" fontSize="13" fontFamily="Plus Jakarta Sans">de {total}</text>
    </svg>
  );
}

function LineChart({ points, empty }) {
  if (points.length < 2) return <div className="empty">{empty}</div>;
  const W = 320, H = 110, P = 6;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const sy = (y) => H - P - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gráfica de evolución">
      <path d={d} fill="none" stroke="#D48B92" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill="#fff" />)}
    </svg>
  );
}

/* ============================ CUESTIONARIO ============================ */

const DEFAULT_PROFILE = {
  mode: "otaku", branch: "female", age: 21, height: 165, weight: 60, activity: 1.45, goal: "mant", veg: false, trainTime: "mid",
  days: 3, meals: 4, cook: "sencilla", eatOut: false, exclude: [], likes: [], dislikes: [],
  months: 4, pullups: 0, squat: { kg: 60, reps: 5 }, bench: { kg: 35, reps: 6 }, deadlift: { kg: 80, reps: 4 },
};

function Questionnaire({ initial, editing, onSave, onCancel }) {
  const [q, setQ] = useState(initial);
  const set = (k, v) => setQ({ ...q, [k]: v });
  const setLift = (l, k, v) => setQ({ ...q, [l]: { ...q[l], [k]: v } });
  const lifts = q.branch === "male" ? ["squat", "bench", "deadlift"] : ["squat", "deadlift"];
  const LN = { squat: "Sentadilla", bench: "Press banca", deadlift: "Peso muerto" };
  const num = (v) => (v === "" ? "" : Number(v));
  const tooMany = lifts.some((l) => q[l].reps > RULES.EPLEY_MAX_REPS);
  const ok = q.age && q.height && q.weight && !tooMany;
  const simple = q.mode === "simple";
  return (
    <>
      <h1>{editing ? "Tus datos" : "Empecemos por ti"}</h1>
      <p className="sub">{editing ? "Si cambias algo, tu plan de comidas se recalcula." : (simple ? "Con esto preparamos tu rutina y tu plan de comidas. Solo te lo preguntamos una vez." : "Con esto calculamos tu nivel de partida y tu plan de comidas. Solo te lo preguntamos una vez.")}</p>

      <div className="field"><label>¿Qué quieres de ARC?</label>
        <div className="want-opts">
          <button className={`want-opt ${simple ? "" : "on"}`} onClick={() => simple && set("mode", "otaku")}>
            <b>Subir de nivel con personajes</b>
            <span>Subes de nivel con tu fuerza real, tu constancia y tus hábitos, y vas desbloqueando personajes de anime. Además de todo lo de entrenos y comidas.</span>
          </button>
          <button className={`want-opt ${simple ? "on" : ""}`} onClick={() => set("mode", "simple")}>
            <b>Solo registrar entrenos y comidas</b>
            <span>Sin niveles ni personajes: tu rutina, tus series, tus comidas y tus hábitos, y ya. Puedes cambiarlo cuando quieras.</span>
          </button>
        </div>
      </div>
      <div className="field"><label>{simple ? "Sexo" : "Rama del arco"}</label>
        <div className="chips">{[["female", simple ? "Mujer" : "Femenina"], ["male", simple ? "Hombre" : "Masculina"]].map(([v, l]) => <button key={v} className={`chip ${q.branch === v ? "on" : ""}`} onClick={() => set("branch", v)}>{l}</button>)}</div>
        {simple && <div className="hint">Para calcular tus calorías y tu rutina.</div>}
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}><label>Edad</label><input className="in" type="number" value={q.age} onChange={(e) => set("age", num(e.target.value))} /></div>
        <div className="field" style={{ flex: 1 }}><label>Altura (cm)</label><input className="in" type="number" value={q.height} onChange={(e) => set("height", num(e.target.value))} /></div>
        <div className="field" style={{ flex: 1 }}><label>Peso (kg)</label><input className="in" type="number" value={q.weight} onChange={(e) => set("weight", num(e.target.value))} /></div>
      </div>
      <div className="field"><label>¿Cuánto te mueves?</label>
        <div className="chips">{ACTIVITY.map((a) => <button key={a.id} className={`chip ${q.activity === a.id ? "on" : ""}`} onClick={() => set("activity", a.id)}>{a.label}</button>)}</div>
        <div className="hint">{ACTIVITY.find((a) => a.id === q.activity)?.hint}</div>
      </div>
      <div className="field"><label>Objetivo</label>
        <div className="chips">{GOALS.map((g) => <button key={g.id} className={`chip ${q.goal === g.id ? "on" : ""}`} onClick={() => set("goal", g.id)}>{g.label}</button>)}</div>
      </div>
      <div className="field"><label>¿Qué quieres priorizar en tus entrenos?</label>
        <div className="chips">{FOCUS.map((f) => <button key={f.id} className={`chip ${focusOf(q) === f.id ? "on" : ""}`} onClick={() => set("focus", f.id)}>{f.label}</button>)}</div>
        <div className="hint">{focusOf(q) === "gluteo" ? "Más días de glúteo y pierna, espalda y hombro para la postura y casi nada de pecho." : focusOf(q) === "superior" ? "Más espalda, pecho, hombro y brazos, sin dejar la pierna." : "Un reparto equilibrado de todo el cuerpo."}</div>
      </div>
      <div className="field"><label>¿A qué hora sueles entrenar?</label>
        <div className="chips">{TRAIN_TIMES.map((t) => <button key={t.id} className={`chip ${q.trainTime === t.id ? "on" : ""}`} onClick={() => set("trainTime", t.id)}>{t.label}</button>)}</div>
      </div>
      <div className="field"><label>Alimentación</label>
        <div className="chips">
          <button className={`chip ${!q.veg ? "on" : ""}`} onClick={() => set("veg", false)}>Como de todo</button>
          <button className={`chip ${q.veg ? "on" : ""}`} onClick={() => set("veg", true)}>Vegetariana</button>
        </div>
      </div>

      <h2>Entreno y comidas</h2>
      <div className="field"><label>¿Cuántos días a la semana quieres entrenar?</label>
        <div className="chips">{[2, 3, 4, 5, 6, 7].map((d) => <button key={d} className={`chip ${q.days === d ? "on" : ""}`} onClick={() => set("days", d)}>{d}</button>)}</div>
      </div>
      <div className="field"><label>¿Cuántas comidas haces al día?</label>
        <div className="chips">{[3, 4, 5].map((m) => <button key={m} className={`chip ${q.meals === m ? "on" : ""}`} onClick={() => set("meals", m)}>{m}</button>)}</div>
      </div>
      <div className="field"><label>¿Qué ganas tienes de cocinar?</label>
        <div className="cook-opts">{COOK_OPTS.map(([v, l]) => <button key={v} className={`cook-opt ${q.cook === v ? "on" : ""}`} onClick={() => set("cook", v)}><CookIcon mode={v} /><span>{l}</span></button>)}</div>
        <div className="hint">{q.cook === "sanji" ? "Recetas más elaboradas, con sus pasos." : q.cook === "todas" ? "Mezcla de platos rápidos y elaborados." : "Platos de 5 minutos para el día a día."}</div>
      </div>
      <div className="field"><label>¿Comes a menudo fuera de casa?</label>
        <div className="chips">
          <button className={`chip ${q.eatOut ? "on" : ""}`} onClick={() => set("eatOut", true)}>Sí, llevo táper</button>
          <button className={`chip ${!q.eatOut ? "on" : ""}`} onClick={() => set("eatOut", false)}>No, como en casa</button>
        </div>
      </div>
      <div className="field"><label>¿Qué es lo que más te gusta comer?</label>
        <div className="chips">{FOOD_PREFS.map(([v, l]) => {
          const on = (q.likes || []).includes(v);
          return <button key={v} className={`chip ${on ? "on" : ""}`} onClick={() => setQ({ ...q, likes: on ? q.likes.filter((x) => x !== v) : [...(q.likes || []), v], dislikes: (q.dislikes || []).filter((x) => x !== v) })}>{l}</button>;
        })}</div>
        <div className="hint">Te saldrán primero las recetas que lo lleven.</div>
      </div>
      <div className="field"><label>¿Y lo que no te gusta nada?</label>
        <div className="chips">{FOOD_PREFS.map(([v, l]) => {
          const on = (q.dislikes || []).includes(v);
          return <button key={v} className={`chip no ${on ? "on" : ""}`} onClick={() => setQ({ ...q, dislikes: on ? q.dislikes.filter((x) => x !== v) : [...(q.dislikes || []), v], likes: (q.likes || []).filter((x) => x !== v) })}>{l}</button>;
        })}</div>
        <div className="hint">Las recetas que lo lleven no te saldrán.</div>
      </div>
      <div className="field"><label>¿Alguna alergia o algo que no comas?</label>
        <div className="chips">{EXCLUDE_OPTS.map(([v, l]) => {
          const on = q.exclude.includes(v);
          return <button key={v} className={`chip ${on ? "on" : ""}`} onClick={() => set("exclude", on ? q.exclude.filter((x) => x !== v) : [...q.exclude, v])}>{l}</button>;
        })}</div>
      </div>

      <h2>Tus marcas</h2>
      <p className="sub" style={{ marginBottom: 10 }}>Tu mejor serie reciente: peso y repeticiones (de 1 a 10).{simple ? " Así ves tu progreso desde el primer día." : ""}</p>
      {lifts.map((l) => (
        <div className="lift" key={l}>
          <span>{LN[l]}</span>
          <input className="in" type="number" aria-label={`${LN[l]} kg`} value={q[l].kg} onChange={(e) => setLift(l, "kg", num(e.target.value))} />
          <input className="in" type="number" aria-label={`${LN[l]} repeticiones`} value={q[l].reps} onChange={(e) => setLift(l, "reps", num(e.target.value))} />
        </div>
      ))}
      {tooMany && <div className="err">Usa una serie de 10 repeticiones o menos para estimar bien tu fuerza.</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <div className="field" style={{ flex: 1 }}><label>Dominadas estrictas</label><input className="in" type="number" value={q.pullups} onChange={(e) => set("pullups", num(e.target.value))} /></div>
        <div className="field" style={{ flex: 1 }}><label>Meses entrenando</label><input className="in" type="number" value={q.months} onChange={(e) => set("months", num(e.target.value))} /></div>
      </div>
      <div className="hint" style={{ marginTop: -8 }}>Cuentan los meses seguidos sin parar más de {RULES.GAP_RESET_DAYS} días.</div>

      <button className="btn ac" disabled={!ok} style={{ opacity: ok ? 1 : 0.4, marginTop: 22 }} onClick={() => onSave(q)}>{editing ? "Guardar cambios" : "Empezar mi arco"}</button>
      {editing && <button className="btn ghost" onClick={onCancel}>Volver</button>}
    </>
  );
}

/* ============================ IMÁGENES Y VÍDEOS ============================ */

const MEDIA_PREFIX = "arc-media:";
const MAX_MEDIA_BYTES = 4.5e6; // límite de la vista previa; en producción va a Supabase Storage

async function readFile(file, maxW = 640, q = 0.85) {
  const raw = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  if (!file.type.startsWith("image/") || file.type === "image/gif") return raw;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = raw; });
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", q);
}

// Recorta la foto en cuadrado (para la foto de perfil)
async function squareImage(file, size = 400) {
  const raw = await readFile(file, 1400);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = raw; });
  const side = Math.min(img.width, img.height), c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}

function MediaPicker({ label, accept, onPick, onError }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className="chip" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Subiendo…" : label}</button>
      <input ref={ref} type="file" accept={accept} hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        try { setBusy(true); await onPick(f); } catch (err) { onError?.(err.message || "No se pudo subir el archivo."); } finally { setBusy(false); }
      }} />
    </>
  );
}

const ytEmbed = (url) => { const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null; };
const isImage = (src) => src.startsWith("data:image") || /\.(gif|png|jpe?g|webp)(\?|$)/i.test(src);

function MediaView({ src }) {
  if (!src) return null;
  if (isImage(src)) return <img className="media" src={src} alt="" />;
  const yt = ytEmbed(src);
  if (yt) return <iframe className="media" style={{ aspectRatio: "9/16", maxHeight: 520 }} src={yt} title="Vídeo del ejercicio" allow="autoplay; encrypted-media" allowFullScreen />;
  return <video className="media" src={src} autoPlay loop muted playsInline controls />;
}

// Familias de ejercicios: dentro de cada ficha salen sus variantes
const VARIANTS = [["ARC-054", "ARC-082", "ARC-055"], ["ARC-007", "ARC-088", "ARC-073"], ["ARC-009", "ARC-011", "ARC-070"], ["ARC-012", "ARC-013", "ARC-014", "ARC-015", "ARC-016", "ARC-069"], ["ARC-019", "ARC-020"], ["ARC-026", "ARC-027"], ["ARC-022", "ARC-023"], ["ARC-001", "ARC-084", "ARC-085", "ARC-002", "ARC-004", "ARC-X04"], ["ARC-036", "ARC-087", "ARC-037"], ["ARC-042", "ARC-075", "ARC-076", "ARC-043", "ARC-080"], ["ARC-X01", "ARC-078"], ["ARC-049", "ARC-050"], ["ARC-021", "ARC-072", "ARC-051", "ARC-052", "ARC-X02"], ["ARC-060", "ARC-X03"], ["ARC-077", "ARC-079", "ARC-081", "ARC-083", "ARC-067"]];
const variantsOf = (id) => (VARIANTS.find((f) => f.includes(id)) || []).filter((v) => v !== id && v in EXERCISES);

function VariantList({ exId, media, onPick }) {
  const list = variantsOf(exId);
  if (!list.length) return null;
  return (
    <>
      <h2 style={{ marginTop: 18 }}>Variantes</h2>
      <div className="vars">
        {list.map((v) => {
          const src = media[`ex:${v}`];
          const vid = src && !/youtu/.test(src) && !/\.(gif|png|jpe?g|webp)(\?|$)/i.test(src);
          return (
            <button key={v} className="var" onClick={() => onPick(v)}>
              <div className="var-th">{src ? (vid ? <video src={src} muted autoPlay loop playsInline preload="metadata" /> : /youtu/.test(src) ? <span>▶</span> : <img src={src} alt="" loading="lazy" />) : <span>▶</span>}</div>
              <b>{EXERCISES[v].n}</b><small>{EXERCISES[v].equip}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}

function TechniqueModal({ exId: startId, media, coach, setMedia, uploadMedia, onClose }) {
  const [exId, setExId] = useState(startId);
  const key = `ex:${exId}`;
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const src = media[key];
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>{EXERCISES[exId].n}</h1>
        <p className="hint" style={{ marginTop: 0 }}>{EXERCISES[exId].muscle} · {EXERCISES[exId].equip}</p>
        <ExerciseMuscles exId={exId} />
        {src ? <MediaView src={src} /> : <div className="empty">{coach ? "Este ejercicio aún no tiene vídeo. Sube uno o pega un enlace." : "Pronto tendrás aquí el vídeo de la técnica."}</div>}
        {EXERCISES[exId].note && <div className="note">{EXERCISES[exId].note}</div>}
        <h2 style={{ marginTop: 18 }}>Cómo se hace</h2>
        <p className="sub" style={{ marginBottom: 0 }}>{EXERCISES[exId].simple}</p>
        <h2 style={{ marginTop: 18 }}>Truquito</h2>
        <p className="sub" style={{ marginBottom: 0 }}>{EXERCISES[exId].tip}</p>
        <VariantList exId={exId} media={media} onPick={setExId} />
        {exId.startsWith("ARC-X") && coach && <p className="hint">Ejercicio añadido fuera de tu base de datos: revisa la ficha.</p>}
        {coach && (
          <div style={{ marginTop: 14 }}>
            <div className="row">
              <input className="in" placeholder="Enlace de YouTube, mp4 o GIF" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="sbtn" onClick={() => { if (url.trim()) { setMedia(key, url.trim()); setUrl(""); } }}>Guardar</button>
            </div>
            <div className="chips" style={{ marginTop: 10 }}>
              <MediaPicker label="Subir vídeo o GIF" accept="video/*,image/*" onPick={(f) => uploadMedia(key, f)} onError={setErr} />
              {src && <button className="chip" onClick={() => setMedia(key, null)}>Quitar</button>}
            </div>
            {err && <div className="err">{err}</div>}
          </div>
        )}
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

/* ============================ INICIO ============================ */

// Inicio sin niveles: para quien solo quiere registrar sus entrenos
// Abajo del todo: Instagram de la app y asesorías 1:1
const APP_IG = "arcworkoutapp"; // usuario de Instagram de la app (sin @). Vacío = no sale.
const COACH_IG = "lunarovx";
const IgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
);
function SocialLinks() {
  return (
    <div className="social">
      <a className="social-row" href={`https://ig.me/m/${COACH_IG}`} target="_blank" rel="noopener noreferrer">
        <i><IgIcon /></i><span><b>Asesorías 1:1 con Luna</b><small>Escríbeme a @{COACH_IG}</small></span><em>›</em>
      </a>
    </div>
  );
}

// Frase del día compacta: el "por qué" se abre al tocar
function QuoteCard({ quote }) {
  const [qq, who, from, why, kind] = quote;
  return (
    <div className="quote qc">
      <p>{kind === "cita" ? `“${qq}”` : qq}</p>
      <div className="who">{who ? <>{who} <span className="from">· {from}</span></> : <span className="from">{from}</span>}</div>
      {why && <div className="why">{why}</div>}
    </div>
  );
}

const YtIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1c1.9.4 9.4.4 9.4.4s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.5zM9.6 15.6V8.4L15.8 12z" /></svg>
);
// Pie de la pantalla principal: Instagram y YouTube de la app
function SocialFooter() {
  return (
    <div className="sfoot">
      <div className="sfoot-icons">
        <a href={`https://instagram.com/${APP_IG}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram de ARC"><IgIcon /></a>
        <a href={`https://youtube.com/@${APP_IG}`} target="_blank" rel="noopener noreferrer" aria-label="YouTube de ARC"><YtIcon /></a>
      </div>
      <span>@{APP_IG}</span>
    </div>
  );
}

// Pasos de hoy en la pantalla principal
function StepsTile({ state }) {
  const h = state.habits[dkey()] || {};
  const n = Number(h.steps) || 0, goal = RULES.STEPS_GOAL;
  return (
    <div className="steps-tile">
      <div className="st-top">
        <small>Pasos de hoy</small>
        {state.profile?.stepsLinked && <span className="st-src"><HealthIcon size={14} /> Apple Salud</span>}
      </div>
      <div className="st-num"><b>{n.toLocaleString("es-ES")}</b><span>/ {goal.toLocaleString("es-ES")}</span>{n >= goal && <em>Meta cumplida</em>}</div>
      <div className="bar"><i style={{ width: `${Math.min(100, (n / goal) * 100)}%`, background: "var(--ac)" }} /></div>
    </div>
  );
}

function HomeSimple({ state, stats, quote, ratioPoints, weightPoints }) {
  const [qq, who, from, why, kind] = quote;
  const ws = weekStart().toISOString().slice(0, 10);
  const week = state.sessions.filter((s) => s.date.slice(0, 10) >= ws);
  const goal = state.profile.days || 3;
  const vol = week.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.filter((x) => x.done && x.type !== "W").reduce((c, x) => c + (Number(x.kg) || 0) * (Number(x.reps) || 0), 0), 0), 0);
  const routine = activeRoutine(state.profile);
  const last = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <>
      <div className="quote">
        <p>{kind === "cita" ? `“${qq}”` : qq}</p>
        <div className="who">{who}</div>
        <div className="from">{from}</div>
        <div className="why">{why}</div>
      </div>
      <StepsTile state={state} />
      <h2>Tu semana</h2>
      <div className="wk">
        <div className="wk-main"><b>{week.length}<span>/{goal}</span></b><small>entrenos esta semana</small>
          <div className="bar"><i style={{ width: `${Math.min(100, (week.length / goal) * 100)}%`, background: "var(--ac)" }} /></div>
        </div>
        <div className="stat3">
          <div><b>{Math.round(vol).toLocaleString("es-ES")}</b><span>Kg movidos</span></div>
          <div><b>{stats.streak}</b><span>Días de racha</span></div>
          <div><b>{state.sessions.length}</b><span>Entrenos en total</span></div>
        </div>
      </div>
      {last && <p className="hint">Último entreno: {new Date(last.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</p>}
      <MuscleWeek sessions={state.sessions} routine={routine} />
      <h2>Tu progreso</h2>
      <div className="chart">
        <div className="hd"><span>Fuerza relativa</span><b>{stats.ratio.toFixed(2)}x</b></div>
        <LineChart points={ratioPoints} empty="Registra tu primer entreno para ver la curva." />
      </div>
      <div className="chart">
        <div className="hd"><span>Peso corporal</span><b>{currentWeight(state)} kg</b></div>
        <LineChart points={weightPoints} empty="Apunta tu peso en Hábitos dos días para ver la tendencia." />
      </div>
      <SocialLinks />
      <SocialFooter />
    </>
  );
}

function Home({ state, stats, ev, quote, media, coach, setMedia, uploadMedia }) {
  const [shareSteps, setShareSteps] = useState(false);
  const [dayStory, setDayStory] = useState(false);
  useEffect(() => { const h = () => setDayStory(true); window.addEventListener("arc-story", h); return () => window.removeEventListener("arc-story", h); }, []);
  const branch = state.profile.branch;
  const mode = state.profile.mode || "otaku";
  const L = levelsOf(branch, mode);
  const lv = L[ev.current];
  const [err, setErr] = useState("");
  const [vb, setVb] = useState(branch); // rama que se ve en "El arco completo" (la coach puede cambiarla)
  const ratioPoints = useMemo(() => {
    const pts = [{ x: new Date(state.profile.startDate).getTime(), y: ratioOf(branch, bestLifts({ ...state, sessions: [] }).best, Number(state.profile.weight)) }];
    [...state.sessions].sort((a, b) => a.date.localeCompare(b.date)).forEach((s) => {
      pts.push({ x: new Date(s.date).getTime(), y: ratioOf(branch, bestLifts(state, s.date).best, currentWeight(state)) });
    });
    return pts;
  }, [state, branch]);
  const weightPoints = Object.keys(state.habits).filter((k) => state.habits[k].weight).sort().map((k) => ({ x: new Date(k).getTime(), y: Number(state.habits[k].weight) }));
  const [qq, who, from, why, kind] = quote;
  const heroImg = mediaOr(media, levelKey(branch, mode, ev.current)) || AVATAR[branch];
  if (mode === "simple") return <HomeSimple state={state} stats={stats} quote={quote} ratioPoints={ratioPoints} weightPoints={weightPoints} />;
  const ws = weekStart().toISOString().slice(0, 10);
  const weekN = state.sessions.filter((s) => s.date.slice(0, 10) >= ws).length;
  const goalDays = state.profile.days || 3;
  const stepsToday = Number((state.habits[dkey()] || {}).steps) || 0;
  const lim = ev.next ? FACTORS.find((f) => f.key === ev.limiter.key) : null;
  return (
    <>
      <QuoteCard quote={quote} />

      <div className="hero-row">
        <div className="hero">
          <img src={heroImg} alt={lv.name} />
        </div>
        <div className="hero-side">
          <div className="name">{lv.name}</div>
          <div className="series">{lv.series}</div>
          <ArcGauge total={L.length} current={ev.current} progress={ev.progress} />
          {ev.next ? (
            <div className="hero-next">
              <div className="bar"><i style={{ width: `${Math.round(ev.progress * 100)}%`, background: "var(--ac)" }} /></div>
              <span>{Math.round(ev.progress * 100)}% hacia {ev.next.name}</span>
            </div>
          ) : <div className="hero-next"><span>Arco completado</span></div>}
        </div>
      </div>
      {stats.provisional && <div className="gauge"><div className="prov">Nivel provisional: la adherencia empieza a contar en tu día {RULES.ADHERENCE_MIN_DAYS}.</div></div>}

      <div className="kpis">
        <div className="kpi tap" role="button" tabIndex={0} aria-label="Compartir tus pasos" onClick={() => setShareSteps(true)}>
          <span className="kpi-sh"><ShareIcon /></span>
          <small>Pasos hoy</small>
          <b>{String(stepsToday).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</b>
          <div className="bar"><i style={{ width: `${Math.min(100, (stepsToday / RULES.STEPS_GOAL) * 100)}%`, background: "var(--ac)" }} /></div>
        </div>
        <div className="kpi">
          <small>Esta semana</small>
          <b>{weekN}<span>/{goalDays}</span></b>
          <div className="bar"><i style={{ width: `${Math.min(100, (weekN / goalDays) * 100)}%`, background: "var(--ac)" }} /></div>
        </div>
        <div className="kpi">
          <small>Racha</small>
          <b>{stats.streak}<span> días</span></b>
          <div className="dots">{Array.from({ length: 7 }).map((_, i) => <i key={i} className={i < Math.min(7, stats.streak) ? "on" : ""} />)}</div>
        </div>
      </div>

      <DayStoryCard onOpen={() => setDayStory(true)} />
      {shareSteps && <StepsShareSheet habits={state.habits} nick={state.nickname} onClose={() => setShareSteps(false)} onDay={() => { setShareSteps(false); setDayStory(true); }} />}
      {dayStory && <DayStorySheet habits={state.habits} sessions={state.sessions} onClose={() => setDayStory(false)} />}
      {ev.next ? (
        <details className="fold">
          <summary><span>¿Cómo subo de nivel?</span><i aria-hidden="true">+</i></summary>
          <div className="nextcard in">
          <div className="nc-top"><small>Siguiente nivel</small><b>{ev.next.name}</b></div>
          {lim && (
            <p className="nc-lim">Lo que más te falta: <b>{lim.label.toLowerCase()}</b>{!(lim.key === "adherence" && stats.provisional) && <> · {lim.fmt(stats[lim.key])} de {lim.fmt(ev.next[lim.key])}</>}</p>
          )}
          {FACTORS.filter((f) => !f.optional).map((f) => {
              const need = ev.next[f.key], have = stats[f.key];
              const prov = f.key === "adherence" && stats.provisional;
              const ok = prov || have >= need;
              return (
                <div key={f.key} className={`fac ${ok ? "ok" : ""}`}>
                  <div className="hd"><span>{f.label}</span><span>{prov ? "Aún sin contar" : `${f.fmt(have)} / ${f.fmt(need)}`}</span></div>
                  <div className="bar"><i style={{ width: `${prov ? 100 : Math.min(100, need ? (have / need) * 100 : 100)}%` }} /></div>
                </div>
              );
            })}
            {ev.next.pullups > 0 && (
              <div className="fac extra">
                <div className="hd"><span>Dominadas <em>extra</em></span><span>{stats.pullups} / {ev.next.pullups}</span></div>
                <p className="hint" style={{ margin: "2px 0 0" }}>{stats.pullups >= ev.next.pullups ? "Las tienes. Suman en tus skills, aunque no hacen falta para subir." : "No hacen falta para subir de nivel. Si las consigues, suman en tus skills."}</p>
              </div>
            )}
            {ev.next.pullups > 0 && (
              <div className="fac extra">
                <div className="hd"><span>Dominadas <em>extra</em></span><span>{stats.pullups} / {ev.next.pullups}</span></div>
                <p className="hint" style={{ margin: "2px 0 0" }}>No hacen falta para subir de nivel. Si las consigues, suman en tus skills.</p>
              </div>
            )}
        </div>
        </details>
      ) : <div className="note">Has completado el arco. No queda nadie por encima.</div>}

      <details className="fold">
        <summary><span>Tus skills</span><i aria-hidden="true">+</i></summary>
        <Skills lv={lv} L={L} stats={stats} ev={ev} />
      </details>

      <details className="fold">
        <summary><span>Tu progreso</span><i aria-hidden="true">+</i></summary>
        <div className="chart">
          <div className="hd"><span>Fuerza relativa</span><b>{stats.ratio.toFixed(2)}x</b></div>
          <LineChart points={ratioPoints} empty="Registra tu primer entreno para ver la curva." />
        </div>
        <div className="chart">
          <div className="hd"><span>Peso corporal</span><b>{currentWeight(state)} kg</b></div>
          <LineChart points={weightPoints} empty="Apunta tu peso en Hábitos dos días para ver la tendencia." />
        </div>
        <div className="stat3" style={{ margin: "10px 0 14px" }}>
          <div><b>{state.sessions.length}</b><span>Entrenos</span></div>
          <div><b>{stats.streak}</b><span>Días de racha</span></div>
          <div><b>{state.gems}</b><span>Gemas</span></div>
        </div>
      </details>

      {lv.line && (
        <details className="fold">
          <summary><span>Sobre {lv.name}</span><i aria-hidden="true">+</i></summary>
          <p className="fold-p">{lv.line}</p>
        </details>
      )}

      <details className="fold" open={coach || undefined}>
        <summary><span>{coach ? "El arco completo" : "Personajes por desbloquear"}</span><i aria-hidden="true">+</i></summary>
      {coach && <>
        <div className="seg">
          <button className={vb === "female" ? "on" : ""} onClick={() => setVb("female")}>Femenina</button>
          <button className={vb === "male" ? "on" : ""} onClick={() => setVb("male")}>Masculina</button>
        </div>
        <p className="hint" style={{ marginTop: -4 }}>Modo coach: sube una imagen para cada personaje. Mejor en vertical y con fondo oscuro.</p>
      </>}
      {err && <div className="err">{err}</div>}
      {(vb === "ratF" ? RAT_LEVELS.female : vb === "ratM" ? RAT_LEVELS.male : mode === "clasico" && !coach ? CLASSIC_LEVELS[branch] : LEVELS[vb]).map((l, i) => {
        const key = vb === "ratF" ? `rat:female:${i}` : vb === "ratM" ? `rat:male:${i}` : mode === "clasico" && !coach ? `classic:${i}` : `lvl:${vb}:${i}`;
        const img = mediaOr(media, key);
        const mine = vb === "ratF" || vb === "ratM" ? mode === "gymrat" && vb === (branch === "male" ? "ratM" : "ratF") : mode !== "gymrat" && vb === branch;
        if (!coach && i <= ev.current) return null;
        return (
          <div key={l.name} className="lvrow" style={{ opacity: mine && i > ev.current && !coach ? 0.4 : 1 }}>
            <div className="thumb">{img ? <img src={img} alt="" /> : <span>{i + 1}</span>}</div>
            <div style={{ flex: 1, minWidth: 0, fontWeight: mine && i === ev.current ? 700 : 400 }}>{l.name}<small>{l.ratio.toFixed(1)}x tu peso · {l.months} {l.months === 1 ? "mes" : "meses"} · {l.adherence}% hábitos</small></div>
            {coach && (
              <div className="chips" style={{ width: "100%", paddingLeft: 52 }}>
                <MediaPicker label={img ? "Cambiar" : "Imagen"} accept="image/*" onPick={(f) => uploadMedia(key, f)} onError={setErr} />
                {img && <button className="chip" onClick={() => setMedia(key, null)}>×</button>}
              </div>
            )}
          </div>
        );
      })}
      </details>

      <SocialLinks />
      <SocialFooter />
    </>
  );
}

/* ============================ ENTRENOS ============================ */

function lastSetsFor(sessions, exId) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const e = sessions[i].exercises.find((x) => x.exId === exId);
    if (e) return e.sets;
  }
  return null;
}

function sessionEx(e, sessions) {
  const prev = lastSetsFor(sessions, e.id);
  const timed = EXERCISES[e.id].unit;
  const sets = prev
    ? prev.map((s) => ({ type: s.type, kg: s.kg, reps: s.reps, done: false }))
    : [...(timed ? [] : [{ type: "W", kg: "", reps: "", done: false }]), ...Array.from({ length: e.sets }, () => ({ type: "N", kg: "", reps: timed ? String(e.reps).split("–")[0] : "", done: false }))];
  return { exId: e.id, rest: e.rest, note: "", range: e.reps, sets, target: timed ? `${e.sets} × ${e.reps} ${timed}` : `${e.sets} × ${e.reps} · RIR ${e.rir}`, ...(e.pick ? { pick: e.pick, auto: !e.chosen } : {}) };
}
function newSession(day, sessions) {
  return { dayId: day.id, dayName: day.name, start: Date.now(), exercises: day.ex.map((e) => sessionEx(e, sessions)) };
}

// Hueco de abdominales: la persona elige uno o varios de todos los que hay
const ABS_IDS = () => Object.values(EXERCISES).filter((e) => e.group === "Abdomen").map((e) => e.id);
function AbsPicker({ active, ei, sessions, setActive }) {
  const picked = new Set(active.exercises.filter((x) => x.pick === "abs").map((x) => x.exId));
  const toggle = (id) => {
    const list = active.exercises;
    if (picked.has(id)) {
      if (picked.size === 1) return;
      setActive({ ...active, exercises: list.filter((x) => !(x.pick === "abs" && x.exId === id)) });
      return;
    }
    const timed = EXERCISES[id].unit;
    const entry = sessionEx({ id, sets: 3, reps: timed ? "30–45" : "12–15", rir: 1, rest: 60, pick: "abs", chosen: true }, sessions);
    const cur = list[ei];
    const untouched = cur.auto && !cur.sets.some((st) => st.done) && picked.size === 1;
    const last = list.reduce((a, x, i) => (x.pick === "abs" ? i : a), ei);
    setActive({ ...active, exercises: untouched ? list.map((x, i) => (i === ei ? entry : x)) : [...list.slice(0, last + 1), entry, ...list.slice(last + 1)] });
  };
  return (
    <div className="abspick">
      <small>Elige tus abdominales (uno o varios)</small>
      <div className="chips">{ABS_IDS().map((id) => <button key={id} className={`chip ${picked.has(id) ? "on" : ""}`} onClick={() => toggle(id)}>{EXERCISES[id].n}</button>)}</div>
    </div>
  );
}

function HistoryModal({ exId, sessions, onClose }) {
  const [range, setRange] = useState(90);
  const pts = sessions.filter((s) => range === 0 || Date.now() - new Date(s.date) <= range * 864e5).map((s) => {
    const e = s.exercises.find((x) => x.exId === exId);
    if (!e) return null;
    const best = Math.max(0, ...e.sets.filter((x) => x.done && x.type !== "W").map((x) => epley(x.kg, x.reps) || 0));
    return best ? { x: new Date(s.date).getTime(), y: Math.round(best * 10) / 10, date: s.date } : null;
  }).filter(Boolean);
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>{EXERCISES[exId].n}</h1>
        <p className="sub">1RM estimado por sesión (series de 10 reps o menos).</p>
        <div className="seg">{[[30, "1 mes"], [90, "3 meses"], [180, "6 meses"], [0, "Todo"]].map(([v, l]) => <button key={v} className={range === v ? "on" : ""} onClick={() => setRange(v)}>{l}</button>)}</div>
        <div className="chart"><LineChart points={pts} empty="Aún no hay suficientes sesiones en este periodo." /></div>
        {pts.slice().reverse().map((p) => <div className="hist" key={p.date}><span>{new Date(p.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span><span>{p.y} kg</span></div>)}
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function SwapModal({ exId, onPick, onClose }) {
  const group = EXERCISES[exId].group;
  const opts = Object.values(EXERCISES).filter((e) => e.group === group && e.id !== exId);
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>Cambiar por otro de {group.toLowerCase()}</h1>
        <p className="sub">Por si la máquina está ocupada o no la tiene tu gimnasio.</p>
        {opts.length === 0 && <div className="empty">No hay alternativas en este grupo.</div>}
        {opts.map((e) => (
          <button key={e.id} className="exrow" style={{ padding: "11px 0", borderBottom: "1px solid var(--ln)" }} onClick={() => onPick(e.id)}>
            <span>{e.n}</span><span>{e.equip}</span>
          </button>
        ))}
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

/* ===================== PROGRESIÓN Y MÚSCULOS ===================== */

// "6–8", "8–10 por pierna", "15", "máx." → [mín, máx] de repeticiones
function parseRange(str) {
  const m = String(str || "").match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const one = String(str || "").match(/^(\d+)/);
  return one ? [Number(one[1]), Number(one[1])] : null;
}

function sessionsWith(sessions, exId, n) {
  const out = [];
  for (let i = sessions.length - 1; i >= 0 && out.length < n; i--) {
    const e = sessions[i].exercises.find((x) => x.exId === exId);
    const sets = e?.sets.filter((s) => s.done && s.type !== "W" && s.reps !== "");
    if (sets?.length) out.push(sets);
  }
  return out;
}

const roundKg = (kg) => Math.round(kg * 2) / 2; // de 0,5 en 0,5 kg

// Doble progresión: primero repeticiones, luego peso. Si dos sesiones seguidas no llegas al mínimo, baja.
function suggestFor(sessions, exId, rangeStr) {
  const ex = EXERCISES[exId];
  if (ex.unit) return null;
  const [last, before] = sessionsWith(sessions, exId, 2);
  const range = parseRange(rangeStr);
  if (!last) return { dir: "new", text: "Primera vez: elige un peso con el que acabes cada serie sabiendo que podrías hacer 1 o 2 repeticiones más." };
  const reps = last.map((s) => Number(s.reps) || 0);
  const kg = Math.max(...last.map((s) => Number(s.kg) || 0));
  if (!range) { // "máx." (dominadas, flexiones…): batir el total de repeticiones
    const total = reps.reduce((a, b) => a + b, 0);
    return { dir: "hold", text: `La última vez sumaste ${total} repeticiones. Hoy intenta llegar a ${total + 1} o más.` };
  }
  const [lo, hi] = range;
  if (!kg) return reps.every((r) => r >= hi)
    ? { dir: "up", text: `Hiciste todas las series a ${hi} o más. Hoy añade algo de peso o pasa a una versión más difícil.` }
    : { dir: "hold", text: `Intenta sumar una repetición por serie hasta llegar a ${hi}.` };
  if (reps.every((r) => r >= hi)) {
    const inc = kg >= 40 ? 2.5 : kg >= 10 ? 2 : 1;
    const next = roundKg(kg + inc);
    return { dir: "up", kg: next, text: `Hiciste todas las series a ${hi} o más con ${kg} kg. Toca subir: prueba con ${next} kg.` };
  }
  const fail = (sets) => sets.some((s) => (Number(s.reps) || 0) < lo);
  if (fail(last) && before && fail(before)) {
    const next = roundKg(kg * 0.9);
    return { dir: "down", kg: next, text: `Dos sesiones sin llegar a ${lo} repeticiones. Baja a ${next} kg, haz todas las series bien y vuelve a subir.` };
  }
  return { dir: "hold", kg, text: `Mantén ${kg} kg e intenta sumar una repetición. Cuando hagas ${hi} en todas las series, subes.` };
}

function Suggest({ s, onApply }) {
  if (!s) return null;
  const icon = { up: "↑", down: "↓", hold: "=", new: "★" }[s.dir];
  return (
    <div className={`sug sug-${s.dir}`}>
      <i>{icon}</i>
      <span>{s.text}</span>
      {s.kg != null && s.dir !== "hold" && onApply && <button onClick={onApply}>Usar {s.kg} kg</button>}
    </div>
  );
}

// Músculos del mapa. "acc" = no hace falta llegar a 10 series, solo avisamos si te pasas.
const MUSCLES = [
  ["pecho", "Pecho", /pectoral/],
  ["hombro", "Hombro", /deltoide|hombro|manguito/],
  ["espalda", "Espalda", /dorsal|romboide|trapecio|espalda alta/],
  ["biceps", "Bíceps", /b[ií]ceps/],
  ["triceps", "Tríceps", /tr[ií]ceps/],
  ["abdomen", "Abdomen", /abdom|core|oblicuo|recto/],
  ["lumbar", "Lumbar", /lumbar|espalda baja/, true],
  ["gluteo", "Glúteo", /gl[uú]teo/],
  ["cuadriceps", "Cuádriceps", /cu[aá]driceps/],
  ["femoral", "Femoral", /isquio/],
  ["aductores", "Aductores", /aductor/, true],
  ["gemelo", "Gemelo", /gemelo|s[oó]leo/],
];
const MUSCLE_NAME = Object.fromEntries(MUSCLES.map(([k, n]) => [k, n]));

// Lo que nombras primero cuenta como serie entera; lo demás, como media serie
// Correcciones donde el orden del texto no refleja el músculo que más trabaja
const MUSCLE_FIX = { "ARC-021": { gluteo: 1, femoral: 1, lumbar: 0.5, espalda: 0.5 } };
function musclesOf(exId) {
  if (MUSCLE_FIX[exId]) return MUSCLE_FIX[exId];
  const parts = String(EXERCISES[exId]?.muscle || "").toLowerCase().split(",");
  const out = {};
  parts.forEach((p, i) => MUSCLES.forEach(([k, , re]) => { if (re.test(p)) out[k] = Math.max(out[k] || 0, i === 0 ? 1 : 0.5); }));
  return out;
}

function weeklyDone(sessions, days = 7) {
  const from = Date.now() - days * 864e5;
  const sets = {}, last = {};
  sessions.filter((s) => new Date(s.date).getTime() >= from).forEach((s) => {
    const per = {};
    s.exercises.forEach((e) => {
      const n = e.sets.filter((x) => x.done && x.type !== "W").length;
      Object.entries(musclesOf(e.exId)).forEach(([k, w]) => { per[k] = (per[k] || 0) + n * w; });
    });
    Object.entries(per).forEach(([k, v]) => {
      sets[k] = (sets[k] || 0) + v;
      if (v >= 3) last[k] = Math.max(last[k] || 0, new Date(s.date).getTime());
    });
  });
  return { sets, last };
}

function weeklyPlanned(routine) {
  const sets = {};
  routine.forEach((d) => d.ex.forEach((e) => Object.entries(musclesOf(e.id)).forEach(([k, w]) => { sets[k] = (sets[k] || 0) + e.sets * w; })));
  return sets;
}

const muscleLevel = (v, acc) => (v > 20 ? "over" : v >= 10 ? "ok" : acc ? (v > 0 ? "acc" : "none") : v >= 6 ? "mid" : v > 0 ? "low" : "none");
const LEVEL_TXT = { over: "Te pasas", ok: "Ideal", mid: "Casi", low: "Poco", acc: "Bien", none: "Sin trabajar" };

// Cuerpo de frente y de espaldas con la forma real de cada músculo. "m" = se dibuja también su espejo.
const TORSO_F = "M33 35 Q29 50 34.5 60 Q37 75 37 90 Q39 102 50 106 Q61 102 63 90 Q63 75 65.5 60 Q71 50 67 35 Q58 30.5 50 30.5 Q42 30.5 33 35 Z";
const TORSO_B = "M32 36 Q29 52 35 64 Q37 78 36.5 92 Q38 108 50 112 Q62 108 63.5 92 Q63 78 65 64 Q71 52 68 36 Q58 30 50 30 Q42 30 32 36 Z";
const BODY = {
  front: [
    ["base", "ellipse", { cx: 50, cy: 15, rx: 8.5, ry: 10 }],
    ["base", "path", { d: "M45 23 L55 23 L56.5 32 L43.5 32 Z" }],
    ["base", "path", { d: TORSO_F }],
    ["base", "path", { d: "M21.5 72 Q18 82 17.5 92 Q19 96 21.5 95 Q25 84 27.5 73 Z" }, 1],
    ["base", "ellipse", { cx: 18.8, cy: 100, rx: 3, ry: 4.6 }, 1],
    ["base", "ellipse", { cx: 42, cy: 157, rx: 4.6, ry: 3.6 }, 1],
    ["base", "ellipse", { cx: 41.5, cy: 201.5, rx: 4.8, ry: 3 }, 1],
    ["hombro", "path", { d: "M33.5 34.5 Q25 34.5 22.5 43.5 Q21.8 50 23.8 54.5 Q28 47.5 34.5 44.5 Q36.5 39 33.5 34.5 Z" }, 1],
    ["pecho", "path", { d: "M35.5 37 Q42.5 34.8 49.4 36.8 L49.4 51.5 Q42 55 36 51 Q33 46 35.5 37 Z" }, 1],
    ["biceps", "path", { d: "M23.6 55.5 Q21 62.5 22 70 Q24.2 74 27 70.5 Q29.2 62 28.8 51.8 Q25.6 52 23.6 55.5 Z" }, 1],
    ["abdomen", "path", { d: "M43.4 55.5 Q43.4 54.5 44.4 54.5 L49.3 54.5 L49.3 62.5 L43.4 62.5 Z" }, 1],
    ["abdomen", "path", { d: "M43.4 64 L49.3 64 L49.3 72 L43.4 72 Z" }, 1],
    ["abdomen", "path", { d: "M43.6 73.5 L49.3 73.5 L49.3 81.5 L43.8 81.5 Z" }, 1],
    ["abdomen", "path", { d: "M44 83 L49.3 83 L49.3 97 Q46.5 95 44.5 90 Z" }, 1],
    ["abdomen", "path", { d: "M36 53.5 Q37.5 60 38.3 70 Q39.3 80 42.4 89 L42.4 56.5 Q39.5 54.5 36 53.5 Z" }, 1],
    ["cuadriceps", "path", { d: "M37.6 101 Q34 115 35 132 Q36 146 40 154 Q45 152.5 47 144 Q48.2 125 47 109 Q43 104 37.6 101 Z" }, 1],
    ["aductores", "path", { d: "M47.6 107 Q49.6 109 49.6 113 L49.2 131 Q47.6 129 47.2 121 Z" }, 1],
    ["gemelo", "path", { d: "M38 162 Q36 175 38 190 Q40 196.5 42 196.5 Q44 182 45.6 165 Q42 159.5 38 162 Z" }, 1],
  ],
  back: [
    ["base", "ellipse", { cx: 50, cy: 15, rx: 8.5, ry: 10 }],
    ["base", "path", { d: "M45 23 L55 23 L56.5 31 L43.5 31 Z" }],
    ["base", "path", { d: TORSO_B }],
    ["base", "path", { d: "M21.5 73 Q18 83 17.5 93 Q19 97 21.5 96 Q25 85 27.5 74 Z" }, 1],
    ["base", "ellipse", { cx: 18.8, cy: 101, rx: 3, ry: 4.6 }, 1],
    ["base", "ellipse", { cx: 42, cy: 158, rx: 4.6, ry: 3.6 }, 1],
    ["base", "path", { d: "M38.6 186 L45 186 L44 198 L40 198 Z" }, 1],
    ["base", "ellipse", { cx: 41.5, cy: 201.5, rx: 4.8, ry: 3 }, 1],
    ["espalda", "path", { d: "M50 25 L56 30 Q64 32.5 68 36 Q58.5 39.5 54.5 50 L50 59 L45.5 50 Q41.5 39.5 32 36 Q36 32.5 44 30 Z" }],
    ["hombro", "path", { d: "M32.5 35.5 Q24.5 36 22.5 44.5 Q22 50.5 23.8 54.5 Q28.5 48 35 45 Q36 39.5 32.5 35.5 Z" }, 1],
    ["espalda", "path", { d: "M36.2 43 Q33 56 37 70 Q41 80 46 84.5 L48.8 66 L48 55.5 Q42 46.5 36.2 43 Z" }, 1],
    ["triceps", "path", { d: "M23.2 55 Q20.6 62.5 22.5 71.5 Q26 73.5 28 66.5 Q29.2 58.5 28.2 52.5 Q25.2 51.5 23.2 55 Z" }, 1],
    ["lumbar", "path", { d: "M44.2 81 Q47 86.5 50 87.5 Q53 86.5 55.8 81 L55 93 Q50 95 45 93 Z" }],
    ["gluteo", "path", { d: "M37.4 95 Q35.8 104 38.5 111.5 Q43 116.5 49.5 114.5 L49.5 97.5 Q44 93.5 37.4 95 Z" }, 1],
    ["femoral", "path", { d: "M37.5 115.5 Q35 129 37 145 Q39 153 42 155 Q46 150 47.5 140 Q48.6 126 48.2 116.5 Q43 118.5 37.5 115.5 Z" }, 1],
    ["gemelo", "path", { d: "M37.6 161 Q35 171 37.6 183 Q40 189 42 188 Q45 179 46.2 167 Q43 159 37.6 161 Z" }, 1],
  ],
};
const MIRROR = "translate(100 0) scale(-1 1)";

// Versión femenina: hombros más estrechos, cintura marcada, cadera y glúteo más anchos, y moño
const TORSO_FF = "M35 35 Q32 48 37 58 Q41.2 68 40.4 77 Q35.4 90 34.4 99 Q40 109.5 50 111.5 Q60 109.5 65.6 99 Q64.6 90 59.6 77 Q58.8 68 63 58 Q68 48 65 35 Q58 30.5 50 30.5 Q42 30.5 35 35 Z";
const TORSO_BF = "M34.5 36 Q31.5 50 37.5 62 Q41.6 72 40.6 82 Q35.6 94 34.6 104 Q39 115.5 50 117.5 Q61 115.5 65.4 104 Q64.4 94 59.4 82 Q58.4 72 62.5 62 Q68.5 50 65.5 36 Q58 30 50 30 Q42 30 34.5 36 Z";
const BUN = ["base", "ellipse", { cx: 50, cy: 3.6, rx: 5.6, ry: 4.6 }];
const BODY_F = {
  front: [
    BUN, ...BODY.front.slice(0, 2),
    ["base", "path", { d: TORSO_FF }],
    ...BODY.front.slice(3, 5).map((e) => [...e.slice(0, 4), 2.6]),
    ...BODY.front.slice(5, 7),
    ["hombro", "path", { d: "M35.5 34.5 Q27.5 34.5 25.6 43 Q25.1 49 26.9 53 Q30.6 46.5 36.1 44 Q38 39 35.5 34.5 Z" }, 1],
    ["pecho", "path", { d: "M37.2 39 Q38 37 43 36.8 Q48.6 37.2 49.4 39.4 L49.4 46.5 Q48.6 54 43.2 54.2 Q37.4 53.8 36.4 47.8 Q35.8 42.6 37.2 39 Z" }, 1],
    [...BODY.front[9].slice(0, 4), 2.6],
    ...BODY.front.slice(10, 14),
    ["abdomen", "path", { d: "M38.4 55 Q40.8 61.5 41.4 68 Q41.4 78 42.8 90 L42.8 57 Q40.8 55.4 38.4 55 Z" }, 1],
    ["cuadriceps", "path", { d: "M36.3 102 Q32.4 116 34 132 Q35.5 146 40 154 Q45 152.5 47 144 Q48.3 125 47.5 110.5 Q43 105.5 36.3 102 Z" }, 1],
    ...BODY.front.slice(16),
  ],
  back: [
    BUN, ...BODY.back.slice(0, 2),
    ["base", "path", { d: TORSO_BF }],
    ...BODY.back.slice(3, 5).map((e) => [...e.slice(0, 4), 2.6]),
    ...BODY.back.slice(5, 8),
    ["espalda", "path", { d: "M50 25 L55 29.5 Q61 32 65 35.6 Q57 39 54 48 L50 56 L46 48 Q43 39 35 35.6 Q39 32 45 29.5 Z" }],
    ["hombro", "path", { d: "M34.8 35.6 Q27 36 25.2 44 Q24.8 50 26.6 54 Q31 47.6 37 45 Q38 39.6 34.8 35.6 Z" }, 1],
    ["espalda", "path", { d: "M38 43.5 Q36 55 40 68 Q43 77 46.4 82 L48.8 65 L48 55 Q43 46.6 38 43.5 Z" }, 1],
    [...BODY.back[11].slice(0, 4), 2.6],
    ["lumbar", "path", { d: "M44.4 84 Q47 89 50 90 Q53 89 55.6 84 L55 96 Q50 98 45 96 Z" }],
    ["gluteo", "path", { d: "M35.7 96 Q33.4 106 36.7 115 Q42.5 121 49.5 118.5 L49.5 98 Q43 93.5 35.7 96 Z" }, 1],
    ["femoral", "path", { d: "M36.5 119.5 Q34.2 132 36.5 146 Q38.8 153.5 42 155 Q46 150 47.5 140 Q48.6 128 48.2 120.5 Q43 122.5 36.5 119.5 Z" }, 1],
    ...BODY.back.slice(15),
  ],
};
let BODY_FEMALE = false; // lo fija activeRoutine con la rama de la usuaria

function BodyMap({ fill, size = 300, onPick, female = BODY_FEMALE }) {
  const B = female ? BODY_F : BODY;
  const Tag = { circle: "circle", rect: "rect", ellipse: "ellipse", path: "path" };
  const fig = (side) => (
    <svg viewBox="12 -2 76 209" width={size * 0.37} height={size} aria-hidden="true">
      {B[side].flatMap(([k, t, p, m, dx], i) => {
        const El = Tag[t];
        const base = k === "base";
        const props = { ...p, fill: base ? "#1A1A1F" : fill(k), stroke: "#000", strokeWidth: base ? 0.6 : 0.9, strokeLinejoin: "round", className: base ? "" : "bm-m", style: base ? undefined : { animationDelay: `${i * 22}ms` }, onClick: !base && onPick ? () => onPick(k) : undefined };
        const el = dx ? <g transform={`translate(${dx} 0)`}><El {...props} /></g> : <El {...props} />;
        return m ? [<g key={i}>{el}</g>, <g key={i + "m"} transform={MIRROR}>{el}</g>] : [<g key={i}>{el}</g>];
      })}
    </svg>
  );
  return (
    <div className="bodymap">
      <div>{fig("front")}<small>Delante</small></div>
      <div>{fig("back")}<small>Detrás</small></div>
    </div>
  );
}

const LEVEL_FILL = { none: "#26262B", low: "rgba(212,139,146,.3)", mid: "rgba(212,139,146,.6)", acc: "rgba(212,139,146,.6)", ok: "#D48B92", over: "#F87171" };

function MuscleWeek({ sessions, routine, initial }) {
  const [view, setView] = useState(initial || (sessions.length ? "hecho" : "plan"));
  const [pick, setPick] = useState(null);
  const done = useMemo(() => weeklyDone(sessions), [sessions]);
  const plan = useMemo(() => weeklyPlanned(routine), [routine]);
  const data = view === "hecho" ? done.sets : plan;
  const lvl = (k) => muscleLevel(data[k] || 0, MUSCLES.find((m) => m[0] === k)[3]);
  const recovering = view === "hecho" ? MUSCLES.filter(([k]) => done.last[k] && Date.now() - done.last[k] < 48 * 36e5) : [];
  const over = MUSCLES.filter(([k]) => lvl(k) === "over");
  const rows = MUSCLES.map(([k, n, , acc]) => ({ k, n, v: Math.round((data[k] || 0) * 10) / 10, l: muscleLevel(data[k] || 0, acc) }))
    .sort((a, b) => (a.k === pick ? -1 : b.k === pick ? 1 : b.v - a.v));
  const ago = (t) => { const h = (Date.now() - t) / 36e5; return h < 20 ? "hoy" : h < 44 ? "ayer" : "hace 2 días"; };
  return (
    <div className="mw">
      <div className="seg">
        <button className={view === "hecho" ? "on" : ""} onClick={() => setView("hecho")}>Lo que has hecho (7 días)</button>
        <button className={view === "plan" ? "on" : ""} onClick={() => setView("plan")}>Lo que pide tu rutina</button>
      </div>
      <BodyMap fill={(k) => (pick && pick !== k ? "#1F1F24" : LEVEL_FILL[lvl(k)])} onPick={(k) => setPick(pick === k ? null : k)} />
      <div className="mw-legend">
        {[["low", "Poco"], ["ok", "Ideal (10–20)"], ["over", "Te pasas (+20)"]].map(([l, t]) => <span key={l}><i style={{ background: LEVEL_FILL[l] }} />{t}</span>)}
      </div>
      {over.length > 0 && <div className="mw-alert over">{view === "plan" ? "Tu rutina" : "Esta semana"} carga mucho {over.map(([, n]) => n.toLowerCase()).join(", ")}. Más de 20 series a la semana cuesta recuperarlas y no suele dar más resultado.</div>}
      {recovering.length > 0 && <div className="mw-alert rec">Recuperándose: {recovering.map(([k, n]) => `${n.toLowerCase()} (${ago(done.last[k])})`).join(", ")}. Deja unas 48 horas antes de volver a darles fuerte.</div>}
      {view === "hecho" && sessions.length === 0 && <div className="empty">Cuando termines entrenos verás aquí tus series de la semana.</div>}
      <div className="mw-list">
        {rows.map((r) => (
          <button key={r.k} className={`mw-row ${pick === r.k ? "on" : ""}`} onClick={() => setPick(pick === r.k ? null : r.k)}>
            <span className="mw-n">{r.n}</span>
            <div className="mw-bar"><div style={{ width: `${Math.min(100, (r.v / 24) * 100)}%`, background: LEVEL_FILL[r.l] }} /><i style={{ left: `${(10 / 24) * 100}%` }} /><i style={{ left: `${(20 / 24) * 100}%` }} /></div>
            <span className="mw-v">{r.v} <small>series</small></span>
            <em className={`lv-${r.l}`}>{LEVEL_TXT[r.l]}</em>
          </button>
        ))}
      </div>
      <p className="hint">Cuenta como serie entera el músculo principal de cada ejercicio y como media serie los que ayudan. Entre 10 y 20 series por músculo a la semana es donde más se progresa según los estudios.</p>
    </div>
  );
}

function ExerciseMuscles({ exId }) {
  const m = musclesOf(exId);
  if (!Object.keys(m).length) return null;
  return (
    <div className="exmus">
      <BodyMap size={210} fill={(k) => (m[k] === 1 ? "#D48B92" : m[k] ? "rgba(212,139,146,.38)" : "#26262B")} />
      <div className="mw-legend" style={{ justifyContent: "center" }}>
        <span><i style={{ background: "#D48B92" }} />Principal: {Object.keys(m).filter((k) => m[k] === 1).map((k) => MUSCLE_NAME[k]).join(", ")}</span>
        {Object.values(m).some((v) => v < 1) && <span><i style={{ background: "rgba(212,139,146,.38)" }} />Ayuda: {Object.keys(m).filter((k) => m[k] < 1).map((k) => MUSCLE_NAME[k]).join(", ")}</span>}
      </div>
    </div>
  );
}

function Tracker({ active, sessions, setActive, onFinish, onCancel, media, coach, setMedia, uploadMedia, onRest, onRestCancel, hideVideos }) {
  const [now, setNow] = useState(Date.now());
  const [restEnd, setRestEndRaw] = useState(null);
  const restName = useRef("");
  // Además del contador en pantalla, en el móvil programa un aviso por si la app está en segundo plano
  const setRestEnd = (v, name) => {
    if (name) restName.current = name;
    setRestEndRaw(v);
    if (v) onRest?.(v, restName.current); else onRestCancel?.();
  };
  const [menu, setMenu] = useState(null);
  const [hist, setHist] = useState(null);
  const [tech, setTech] = useState(null);
  const [swap, setSwap] = useState(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (restEnd && now >= restEnd) setRestEndRaw(null); }, [now, restEnd]);

  const upd = (ei, fn) => setActive({ ...active, exercises: active.exercises.map((e, i) => (i === ei ? fn(e) : e)) });
  const updSet = (ei, si, patch) => upd(ei, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));

  let volume = 0, done = 0;
  active.exercises.forEach((e) => e.sets.forEach((s) => {
    if (s.done && s.type !== "W") { done++; if (!EXERCISES[e.exId].unit) volume += (Number(s.kg) || 0) * (Number(s.reps) || 0); }
  }));

  return (
    <>
      <div className="tk-top">
        <button className="link" onClick={() => { onRestCancel?.(); onCancel(); }}>Descartar</button>
        <b>{active.dayName}</b>
        <button className="sbtn" style={{ background: "var(--ac)" }} onClick={() => (done ? (onRestCancel?.(), onFinish(volume, done)) : setMsg("Marca al menos una serie para guardar el entreno."))}>Terminar</button>
      </div>
      {msg && <div className="err" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="tk-stats">
        <div><span>Tiempo</span><b>{mmss((now - active.start) / 1000)}</b></div>
        <div><span>Volumen</span><b>{volume.toLocaleString("es-ES")} kg</b></div>
        <div><span>Series</span><b>{done}</b></div>
      </div>

      {active.exercises.map((e, ei) => {
        const ex = EXERCISES[e.exId];
        const prev = lastSetsFor(sessions, e.exId);
        const hasVideo = !!media[`ex:${e.exId}`];
        let n = 0;
        return (
          <div className="ex" key={e.exId}>
            <div className="hd">
              <button className="exname" onClick={() => setTech(e.exId)}>{hasVideo && <span className="play">▶</span>}{ex.n}</button>
              <button className="dots" aria-label="Opciones" onClick={() => setMenu(menu === ei ? null : ei)}>⋮</button>
            </div>
            {hasVideo && !hideVideos && !ytEmbed(media[`ex:${e.exId}`]) && (isImage(media[`ex:${e.exId}`])
              ? <img className="exvid" src={media[`ex:${e.exId}`]} alt="" onClick={() => setTech(e.exId)} />
              : <video className="exvid" src={media[`ex:${e.exId}`]} autoPlay loop muted playsInline preload="auto" onClick={() => setTech(e.exId)} />)}
            <div className="tgt">{e.target}</div>
            {e.pick === "abs" && active.exercises.findIndex((x) => x.pick === "abs") === ei && <AbsPicker active={active} ei={ei} sessions={sessions} setActive={setActive} />}
            {(() => {
              const sug = suggestFor(sessions, e.exId, e.range || (e.target.match(/× ([^·]+)/) || [])[1]);
              return <Suggest s={sug} onApply={sug?.kg != null ? () => upd(ei, (x) => ({ ...x, sets: x.sets.map((st) => (st.type === "W" || st.done ? st : { ...st, kg: String(sug.kg) })) })) : null} />;
            })()}
            {ex.note && <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>{ex.note}</p>}
            {menu === ei && (
              <div className="menu chips">
                <button className="chip" onClick={() => { setTech(e.exId); setMenu(null); }}>Ver técnica</button>
                {!ex.unit && <button className="chip" onClick={() => { setHist(e.exId); setMenu(null); }}>Historial y gráfica</button>}
                <button className="chip" onClick={() => { setSwap(ei); setMenu(null); }}>Cambiar por otro</button>
                <button className="chip" onClick={() => { setActive({ ...active, exercises: active.exercises.filter((_, i) => i !== ei) }); setMenu(null); }}>Quitar</button>
              </div>
            )}
            <input className="note-in" placeholder="Notas: sensaciones, RIR, técnica…" value={e.note} onChange={(ev) => upd(ei, (x) => ({ ...x, note: ev.target.value }))} />
            <button className="rest" onClick={() => { const opts = [60, 90, 120, 150, 180]; upd(ei, (x) => ({ ...x, rest: opts[(opts.indexOf(x.rest) + 1) % opts.length] })); }}>Descanso: {mmss(e.rest)}</button>
            <table className="sets">
              <thead><tr><th>Serie</th><th>Anterior</th><th>{ex.unit ? "" : "Kg"}</th><th>{ex.unit ? (ex.unit === "s" ? "Seg" : "Min") : "Reps"}</th><th>✓</th></tr></thead>
              <tbody>
                {e.sets.map((s, si) => {
                  if (s.type !== "W") n++;
                  const p = prev?.[si];
                  const prevTxt = !p || p.reps === "" ? "—" : ex.unit ? `${p.reps} ${ex.unit}` : `${p.kg}kg × ${p.reps}`;
                  return (
                    <tr key={si} className={s.done ? "done" : ""}>
                      <td><button className={`lbl ${s.type === "W" ? "w" : ""}`} title="Toca para cambiar entre calentamiento y serie efectiva" onClick={() => !ex.unit && updSet(ei, si, { type: s.type === "W" ? "N" : "W" })}>{s.type === "W" ? "W" : n}</button></td>
                      <td className="prev">{prevTxt}</td>
                      <td>{ex.unit ? null : <input type="number" inputMode="decimal" aria-label="Kilos" value={s.kg} onChange={(ev) => updSet(ei, si, { kg: ev.target.value })} />}</td>
                      <td><input type="number" inputMode="numeric" aria-label={ex.unit ? "Tiempo" : "Repeticiones"} value={s.reps} onChange={(ev) => updSet(ei, si, { reps: ev.target.value })} /></td>
                      <td><button className={`chk ${s.done ? "on" : ""}`} aria-label="Completar serie" onClick={() => { updSet(ei, si, { done: !s.done }); if (!s.done) setRestEnd(Date.now() + e.rest * 1000, ex.n); }}>✓</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="add" onClick={() => upd(ei, (x) => { const last = x.sets[x.sets.length - 1] || { kg: "", reps: "" }; return { ...x, sets: [...x.sets, { type: "N", kg: last.kg, reps: last.reps, done: false }] }; })}>+ Añadir serie</button>
          </div>
        );
      })}

      <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => setAdding(true)}>+ Añadir ejercicio</button>
      <p className="hint" style={{ marginTop: -4, textAlign: "center" }}>Solo para el entreno de hoy: tu rutina no cambia.</p>

      {restEnd && (
        <div className="restbar"><div>
          <b>Descanso {mmss(Math.max(0, (restEnd - now) / 1000))}</b>
          <button onClick={() => setRestEnd(restEnd - 15000)}>−15 s</button>
          <button onClick={() => setRestEnd(restEnd + 15000)}>+15 s</button>
          <button onClick={() => setRestEnd(null)}>Saltar</button>
        </div></div>
      )}
      {hist && <HistoryModal exId={hist} sessions={sessions} onClose={() => setHist(null)} />}
      {tech && <TechniqueModal exId={tech} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} onClose={() => setTech(null)} />}
      {adding && <ExercisePicker onClose={() => setAdding(false)} onPick={(id) => { setActive({ ...active, exercises: [...active.exercises, sessionEx({ id, sets: 3, reps: EXERCISES[id].unit ? "30" : "8–12", rir: 2, rest: 90 }, sessions)] }); setAdding(false); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50); }} />}
      {swap !== null && <SwapModal exId={active.exercises[swap].exId} onClose={() => setSwap(null)} onPick={(id) => { upd(swap, (x) => ({ ...x, exId: id })); setSwap(null); }} />}
    </>
  );
}

/* ===================== RUTINA PROPIA ===================== */

const DAY_IDS = "ABCDEFG";
// La rutina que usa la app: la automática o la que ha montado la usuaria
const normDays = (days) => days.map((d, i) => ({ id: DAY_IDS[i], name: d.name || `Día ${DAY_IDS[i]}`, ex: (d.ex || []).map((e) => (EX_REMAP[e.id] ? { ...e, id: EX_REMAP[e.id] } : e)).filter((e) => EXERCISES[e.id]).map((e) => ({ rir: 2, rest: 90, ...e, sets: Number(e.sets) || 3, reps: e.reps || "8–12" })) }));
function activeRoutine(profile) {
  BODY_FEMALE = profile?.branch === "female";
  if (profile?.coachRoutine?.length) return normDays(profile.coachRoutine); // la que pone la coach manda
  if (profile?.routineMode === "custom" && profile.customRoutine?.length) return normDays(profile.customRoutine);
  return buildRoutine(profile?.days || 3, profile?.branch, profile || {});
}

function ExercisePicker({ onPick, onClose }) {
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState(null);
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = Object.values(EXERCISES).filter((e) => !["CARDIO", "MOVILIDAD"].includes(e.id) && e.group !== "Movilidad" && (!grp || e.group === grp) && (!q || norm(`${e.n} ${e.muscle} ${e.equip} ${e.group}`).includes(norm(q))));
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>Añadir ejercicio</h1>
        <input className="in" autoFocus placeholder="Buscar: jalón, hip thrust, polea…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" style={{ margin: "10px 0" }}>{GROUPS.filter((g) => g !== "Cardio" && g !== "Movilidad").map((g) => <button key={g} className={`chip ${grp === g ? "on" : ""}`} onClick={() => setGrp(grp === g ? null : g)}>{g}</button>)}</div>
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {list.map((e) => (
            <button key={e.id} className="exrow" style={{ padding: "11px 0", borderBottom: "1px solid var(--ln)" }} onClick={() => onPick(e.id)}>
              <span>{e.n}<small style={{ display: "block", color: "var(--dm)", fontSize: 12 }}>{e.muscle}</small></span><span>{e.group}</span>
            </button>
          ))}
          {list.length === 0 && <div className="empty">No hay ejercicios con esa búsqueda.</div>}
        </div>
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function RoutineEditor({ days, onChange, onDone }) {
  const [pickFor, setPickFor] = useState(null);
  const upDay = (i, fn) => onChange(days.map((d, j) => (j === i ? fn(d) : d)));
  const upEx = (i, k, patch) => upDay(i, (d) => ({ ...d, ex: d.ex.map((e, j) => (j === k ? { ...e, ...patch } : e)) }));
  const move = (i, k, dir) => upDay(i, (d) => { const ex = [...d.ex]; const t = k + dir; if (t < 0 || t >= ex.length) return d; [ex[k], ex[t]] = [ex[t], ex[k]]; return { ...d, ex }; });
  return (
    <div className="redit">
      {days.map((d, i) => (
        <div className="day" key={i}>
          <div className="hd">
            <input className="in redit-name" value={d.name} placeholder={`Día ${DAY_IDS[i]}`} onChange={(e) => upDay(i, (x) => ({ ...x, name: e.target.value }))} aria-label="Nombre del día" />
            {days.length > 1 && <button className="link" onClick={() => onChange(days.filter((_, j) => j !== i))}>Borrar día</button>}
          </div>
          {d.ex.length === 0 && <p className="hint">Este día aún no tiene ejercicios.</p>}
          {d.ex.map((e, k) => (
            <div className="redit-ex" key={k}>
              <div className="redit-n">
                <span>{EXERCISES[e.id].n}</span>
                <small>{EXERCISES[e.id].muscle}</small>
              </div>
              <input className="in" type="number" inputMode="numeric" min="1" max="10" value={e.sets} onChange={(ev) => upEx(i, k, { sets: ev.target.value })} aria-label="Series" />
              <span className="redit-x">×</span>
              <input className="in" value={e.reps} onChange={(ev) => upEx(i, k, { reps: ev.target.value })} aria-label="Repeticiones" />
              <div className="redit-btns">
                <button aria-label="Subir" onClick={() => move(i, k, -1)}>↑</button>
                <button aria-label="Bajar" onClick={() => move(i, k, 1)}>↓</button>
                <button aria-label="Quitar" onClick={() => upDay(i, (x) => ({ ...x, ex: x.ex.filter((_, j) => j !== k) }))}>✕</button>
              </div>
            </div>
          ))}
          <button className="add" onClick={() => setPickFor(i)}>+ Añadir ejercicio</button>
        </div>
      ))}
      {days.length < 7 && <button className="btn ghost" onClick={() => onChange([...days, { name: `Día ${DAY_IDS[days.length]}`, ex: [] }])}>+ Añadir día</button>}
      <button className="btn" onClick={onDone}>Listo</button>
      {pickFor !== null && <ExercisePicker onClose={() => setPickFor(null)} onPick={(id) => { upDay(pickFor, (d) => ({ ...d, ex: [...d.ex, { id, sets: 3, reps: "8–12", rir: 2, rest: 90 }] })); setPickFor(null); }} />}
    </div>
  );
}

// Calentamiento y movilidad (arriba del todo en Entrenos)
const WARM_LIST = ["ARC-M01", "ARC-M02", "ARC-M03", "ARC-M04", "ARC-M06", "ARC-M07", "ARC-M08", "ARC-M09"];
const WARM_TIPS = ["Unos 5–10 minutos antes de entrenar.", "Una vuelta a todos, en este orden, sin prisa y sin rebotes.", "Luego, en el primer ejercicio, 2–3 series de aproximación subiendo el peso (las «W» del registro)."];

function WarmUp({ media, onTech }) {
  const [open, setOpen] = useState(false);
  const list = WARM_LIST.filter((id) => id in EXERCISES);
  return (
    <div className="warm">
      <button className="warm-hd" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span><b>Calentamiento y movilidad</b><small>Antes de entrenar, 5–10 minutos</small></span><i>{open ? "−" : "+"}</i>
      </button>
      {open && <>
        <ul className="warm-tips">{WARM_TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
        {list.length === 0 ? <p className="hint">Pronto tendrás aquí los ejercicios.</p> : (
          <div className="vars">
            {list.map((v) => {
              const src = media[`ex:${v}`];
              const vid = src && !/youtu/.test(src) && !/\.(gif|png|jpe?g|webp)(\?|$)/i.test(src);
              return (
                <button key={v} className="var" onClick={() => onTech(v)}>
                  <div className="var-th">{src ? (vid ? <video src={src} muted autoPlay loop playsInline preload="metadata" /> : /youtu/.test(src) ? <span>▶</span> : <img src={src} alt="" loading="lazy" />) : <span>▶</span>}</div>
                  <b>{EXERCISES[v].n}</b><small>{EXERCISES[v].muscle}</small>
                </button>
              );
            })}
          </div>
        )}
      </>}
    </div>
  );
}

// Músculos y duración aproximada de un día de rutina
function dayInfo(d) {
  const groups = [...new Set(d.ex.map((e) => (e.pick === "abs" ? "Abdomen" : EXERCISES[e.id]?.group)).filter(Boolean))];
  const sec = d.ex.reduce((a, e) => a + (e.id === "CARDIO" ? (parseInt(e.reps) || 30) * 60 : (Number(e.sets) || 3) * ((Number(e.rest) || 90) + 45)), 0);
  return { groups, min: Math.max(15, Math.round(sec / 300) * 5) };
}
function WeekStrip({ sessions, goal }) {
  const ws = weekStart();
  const done = new Set(sessions.filter((s) => new Date(s.date) >= ws).map((s) => (new Date(s.date).getDay() + 6) % 7));
  const today = (new Date().getDay() + 6) % 7;
  return (
    <div className="wstrip">
      <div className="wstrip-d">{["L", "M", "X", "J", "V", "S", "D"].map((l, i) => <div key={l} className={`wd${done.has(i) ? " on" : ""}${i === today ? " now" : ""}`}><span>{l}</span><i /></div>)}</div>
      <div className="wstrip-c"><b>{done.size}</b>/{goal} esta semana</div>
    </div>
  );
}

function Workouts({ state, routine, onStart, setDays, setProfile, media, coach, setMedia, uploadMedia }) {
  const [shareS, setShareS] = useState(null);
  const fromCoach = !!state.coachRoutine?.length;
  const mode = fromCoach ? "coach" : state.profile.routineMode || "auto";
  const custom = state.profile.customRoutine || [];
  const [editing, setEditing] = useState(false);
  const autoDays = () => buildRoutine(state.profile.days || 3, state.profile.branch, state.profile).map((d) => ({ name: d.name, ex: d.ex.map(({ id, sets, reps, rir, rest, pick }) => ({ id, sets, reps, rir, rest, ...(pick ? { pick } : {}) })) }));
  const [tech, setTech] = useState(null);
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState(null);
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const last = state.sessions[state.sessions.length - 1];
  const li = last ? routine.findIndex((d) => d.id === last.dayId) : -1;
  const next = routine.length ? routine[(li + 1) % routine.length] : null;
  const doneToday = !!last && new Date(last.date).toDateString() === new Date().toDateString();
  const lastAgo = (id) => {
    const s = [...state.sessions].reverse().find((x) => x.dayId === id);
    if (!s) return "";
    const n = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(s.date).setHours(0, 0, 0, 0)) / 864e5);
    return n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
  };
  const lib = Object.values(EXERCISES).filter((e) => (!grp || e.group === grp) && (!q || norm(`${e.n} ${e.muscle} ${e.equip} ${e.group}`).includes(norm(q))));
  return (
    <>
      <h1>Entrenos</h1>
      <WeekStrip sessions={state.sessions} goal={fromCoach ? routine.length : state.profile.days || routine.length} />
      {next && !(mode === "custom" && (editing || custom.length === 0)) && (
        <div className="today">
          <div className="today-tag">{doneToday ? "Hoy ya has entrenado · el siguiente" : "Hoy toca"}</div>
          <div className="today-name">{next.name}</div>
          <div className="today-meta">{dayInfo(next).groups.slice(0, 4).map((g) => <span key={g}>{g}</span>)}</div>
          <div className="today-sub">{next.ex.length} ejercicios · unos {dayInfo(next).min} min{lastAgo(next.id) ? ` · última vez ${lastAgo(next.id)}` : ""}</div>
          <button className="today-go" onClick={() => onStart(next)}>Empezar entreno</button>
          <div className="today-xp">+{RULES.XP_PER_SESSION} XP · +{RULES.GEMS_PER_SESSION} gemas al terminar</div>
        </div>
      )}
      <WarmUp media={media} onTech={setTech} />
      {!fromCoach && <div className="seg">
        <button className={mode === "auto" ? "on" : ""} onClick={() => { setProfile({ routineMode: "auto" }); setEditing(false); }}>Según mis objetivos</button>
        <button className={mode === "custom" ? "on" : ""} onClick={() => setProfile({ routineMode: "custom" })}>Mi propia rutina</button>
      </div>}
      {mode === "auto" && (
        <div className="field"><label>Días por semana</label>
          <div className="chips">{[2, 3, 4, 5, 6, 7].map((d) => <button key={d} className={`chip ${state.profile.days === d ? "on" : ""}`} onClick={() => setDays(d)}>{d}</button>)}</div>
          <label style={{ marginTop: 14 }}>Prioridad</label>
          <div className="chips">{FOCUS.map((f) => <button key={f.id} className={`chip ${focusOf(state.profile) === f.id ? "on" : ""}`} onClick={() => setProfile({ focus: f.id })}>{f.label}</button>)}</div>
        </div>
      )}
      {mode === "custom" && custom.length === 0 && (
        <div className="note">
          <b>Monta tu rutina</b>
          <p className="sub" style={{ margin: "6px 0 0" }}>Si ya tienes una rutina, apúntala aquí y la app te registra las series, te avisa de cuándo subir peso y te pinta los músculos que trabajas.</p>
          <button className="btn" onClick={() => { setProfile({ customRoutine: autoDays() }); setEditing(true); }}>Empezar desde la automática</button>
          <button className="btn ghost" onClick={() => { setProfile({ customRoutine: [{ name: "Día A", ex: [] }] }); setEditing(true); }}>Empezar de cero</button>
        </div>
      )}
      {mode === "custom" && custom.length > 0 && editing && (
        <>
          <RoutineEditor days={custom} onChange={(d) => setProfile({ customRoutine: d })} onDone={() => setEditing(false)} />
          <h2>Así queda tu semana</h2>
          <MuscleWeek sessions={state.sessions} routine={routine} initial="plan" />
        </>
      )}
      {mode === "custom" && custom.length > 0 && !editing && <button className="btn ghost" style={{ marginBottom: 6 }} onClick={() => setEditing(true)}>Editar mi rutina</button>}
      {!(mode === "custom" && (editing || custom.length === 0)) && routine.map((d) => (
        <div className={`day${next && d.id === next.id ? " next" : ""}`} key={d.id}>
          <div className="hd"><div className="day-t"><span className="day-n">{d.id}</span><div><b>{d.name}</b><small>{dayInfo(d).groups.slice(0, 3).join(" · ")}{lastAgo(d.id) ? ` · ${lastAgo(d.id)}` : ""}</small></div></div><button className="sbtn" onClick={() => onStart(d)}>Empezar</button></div>
          {d.ex.map((e) => (
            <button key={e.id} className="exrow" onClick={() => setTech(e.id)}>
              <span>{e.pick === "abs" ? "Abdominales (eliges tú)" : <>{media[`ex:${e.id}`] && <span className="play">▶</span>}{EXERCISES[e.id].n}</>}</span>
              <span>{e.sets} × {e.reps}{EXERCISES[e.id].unit ? ` ${EXERCISES[e.id].unit}` : ""}</span>
            </button>
          ))}
        </div>
      ))}
      <p className="hint">{coach ? "Modo coach: toca cualquier ejercicio para subir su vídeo o pegar el enlace." : "Toca un ejercicio para ver cómo se hace y su truquito."}</p>
      {!(mode === "custom" && editing) && <><h2>Tus músculos</h2>
      <MuscleWeek sessions={state.sessions} routine={routine} /></>}
      <h2>Biblioteca de ejercicios</h2>
      <input className="in" placeholder="Buscar: hip thrust, polea, glúteo…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: "10px 0" }}>{GROUPS.map((g) => <button key={g} className={`chip ${grp === g ? "on" : ""}`} onClick={() => setGrp(grp === g ? null : g)}>{g}</button>)}</div>
      {lib.slice(0, 40).map((e) => (
        <button key={e.id} className="exrow" style={{ padding: "10px 0", borderBottom: "1px solid var(--ln)" }} onClick={() => setTech(e.id)}>
          <span>{media[`ex:${e.id}`] && <span className="play">▶</span>}{e.n}</span><span>{e.group}</span>
        </button>
      ))}
      <h2>Últimos entrenos</h2>
      {state.sessions.length === 0 && <div className="empty">Aquí aparecerán tus sesiones cuando termines la primera.</div>}
      {state.sessions.slice().reverse().slice(0, 8).map((s) => (
        <div className="hist" key={s.id}>
          <span>{s.dayName || "Entreno"}</span>
          <span className="hist-r">{new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {mmss(s.dur)} · {s.volume.toLocaleString("es-ES")} kg
            <button className="shr-btn" aria-label="Compartir este entreno" onClick={() => setShareS(s)}><ShareIcon /></button></span>
        </div>
      ))}
      {shareS && (() => { const d = shareDataFor(shareS, state.sessions); return <ShareSheet session={d.session} prs={d.prs} levelImg={state.profile.mode === "simple" ? null : mediaOr(media, levelKey(state.profile.branch, state.profile.mode || "otaku", state.savedLevel || 0))} nick={state.nickname} onClose={() => setShareS(null)} />; })()}
      {tech && <TechniqueModal exId={tech} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} onClose={() => setTech(null)} />}
    </>
  );
}

/* ============================ NUTRICIÓN ============================ */

function recipeAllowed(r, profile) {
  return r.items.every(([food]) => {
    const f = profile.veg && VEG_SWAP[food] && FOODS[VEG_SWAP[food]] ? VEG_SWAP[food] : food;
    return !profile.exclude.some((tag) => FOOD_TAGS[tag]?.includes(f));
  });
}

// Consejos de compra: lo que más se cuela sin darte cuenta
const SHOP_TIPS = [
  ["Fiambre de pavo o pollo", "Con un 90% de carne como mínimo. Los baratos llevan fécula, azúcar y agua para dar peso."],
  ["Tortitas de arroz o maíz", "Que lleven solo el cereal y sal. Nada de aceite de palma, azúcar ni sabores."],
  ["Legumbres de bote", "Las del Mercadona son buenas: legumbre, agua y sal. Enjuágalas siempre."],
  ["Salsas", "Barbacoa, ketchup y teriyaki pueden ser un 30–50% azúcar. Usa poca o la versión zero."],
  ["Yogures", "Natural o proteico sin azúcares añadidos. Los «de sabor» y los «0%» a veces llevan bastante azúcar."],
  ["Verduras congeladas", "Las bolsas de verduras congeladas (Mercadona y casi todos los súper tienen) suelen llevar solo verduras: mira que no tengan salsas ni aceite añadido. Cocina varias bolsas de golpe, guárdalas en tápers y luego solo montas el plato."],
  ["Carne picada y hamburguesas", "Truco: pídela magra en la carnicería, con poca grasa. Si la compras en el súper, que sea de buena calidad: mira los ingredientes, 90% de carne mínimo y sin rellenos. Si pone «preparado de carne», a la estantería."],
  ["Crema de cacahuete", "100% cacahuete. Si lleva aceite de palma o azúcar, a la estantería."],
  ["Pan «integral»", "Que el primer ingrediente sea harina integral (o de centeno), no harina de trigo con salvado. Y ojo: «elaborado con masa madre» no es lo mismo que «100% masa madre»."],
  ["Tomate para untar", "El de bote con AOVE es comodísimo y ya lleva el aceite: una cucharada (30 g) son unas 20 kcal. Así no hace falta echar más aceite a la tostada."],
];
// Productos de ejemplo (fotos de Luna en el Mercadona)
const SHOP_EXAMPLES = [
  ["crema-lentejas", "Crema de lentejas", "70 kcal · 4,6 g prot. por 100 g. La más completa: lleva legumbre."],
  ["crema-calabaza", "Crema de calabaza y zanahoria", "48 kcal por 100 g. Ligera, añádele tu proteína al lado."],
  ["parrillada", "Parrillada de verduras", "55 kcal por 100 g, 0 g de grasa. Solo verduras y patata asada."],
  ["pimiento", "Pimiento troceado", "28 kcal por 100 g. Solo pimiento: perfecto para revueltos y salteados."],
  ["pan-semillas", "Pan de semillas", "294 kcal y 11 g de proteína por 100 g. Viene en 2 panes de 85 g."],
  ["pan-centeno", "Pan de centeno 82%", "Con masa madre. 118 kcal y 4,6 g de fibra la rebanada de 55 g."],
  ["pan-integral", "Pan 100% integral (El Horno)", "223 kcal y 9 g de proteína por 100 g. Vienen 2 panes de 82 g."],
  ["tomate-untar", "Tomate para untar", "64 kcal por 100 g, ya lleva su AOVE. Una cucharada son unas 20 kcal."],
  ["jamon", "Jamón serrano", "33,5 g de proteína por 100 g. Lleva bastante sal: con 2–3 lonchas vale."],
  ["yogur-prot", "Yogur +proteínas natural", "52 kcal y 10 g de proteína por 100 g. Solo leche desnatada y fermentos."],
  ["queso-batido", "Queso fresco batido 0%", "46 kcal y 8 g de proteína por 100 g."],
  ["tortitas-legumbres", "Tortitas de legumbres", "100 kcal y 6,8 g de proteína el paquetito de 27 g. Sin gluten."],
  ["guisantes", "Guisantes congelados", "82 kcal, 6 g de proteína y 5 g de fibra por 100 g. Solo guisantes."],
  ["agua-coco", "Agua de coco", "20 kcal por 100 ml, sin azúcar añadido. Para hidratarte antes o durante el entreno: un vaso (250 ml) son 50 kcal."],
];
// Productos del súper que encajan con cada ingrediente de las recetas
const SHOP_PICKS = {
  cremaVerduras: [["crema-lentejas", "Crema de lentejas", "70 kcal/100 g · la que más proteína tiene"], ["crema-calabaza", "Crema de calabaza y zanahoria", "48 kcal/100 g"]],
  verduras: [["parrillada", "Parrillada de verduras", "55 kcal/100 g · 0 g grasa"], ["pimiento", "Pimiento troceado", "28 kcal/100 g"]],
  tortitasArroz: [["tortitas-legumbres", "Tortitas de legumbres", "100 kcal y 6,8 g prot. el paquetito"]],
  yogurProt: [["yogur-prot", "Yogur +proteínas natural", "52 kcal · 10 g prot./100 g"]],
  quesoBatido: [["queso-batido", "Queso fresco batido 0%", "46 kcal · 8 g prot./100 g"]],
  jamon: [["jamon", "Jamón serrano", "248 kcal · 33,5 g prot./100 g"]],
  tomateUntar: [["tomate-untar", "Tomate para untar", "64 kcal/100 g · ya lleva AOVE"]],
  guisantes: [["guisantes", "Guisantes congelados", "82 kcal · 6 g prot./100 g"]],
};
// Panes: en cada receta con pan eliges cuál usas y se recalculan las cantidades
const BREADS = [
  ["panIntegral", "Pan integral", null, "Cualquier integral de verdad", 0, ""],
  ["panCenteno", "Centeno 82%", "pan-centeno", "118 kcal la rebanada de 55 g", 55, "rebanada"],
  ["panIntegralHorno", "100% integral", "pan-integral", "184 kcal el pan de 82 g", 82, "pan"],
  ["panSemillas", "De semillas", "pan-semillas", "250 kcal el pan de 85 g", 85, "pan"],
  ["panMasaMadre", "Masa madre de panadería", null, "Unas 95 kcal la rebanada de 40 g", 40, "rebanada"],
];
const BREAD_IDS = new Set(["panCristal", ...BREADS.map(([id]) => id)]);
const breadUnits = (food, g) => {
  const b = BREADS.find(([id]) => id === food); if (!b || !b[4] || !(g > 0)) return "";
  const n = Math.max(0.5, Math.round((g / b[4]) * 2) / 2);
  return ` · ${String(n).replace(".", ",")} ${b[5]}${n > 1 ? "s" : ""}`;
};
function BreadPick({ value, onPick }) {
  return (
    <div className="picks">
      <div className="picks-t"><span className="mtag">Mercadona</span> Elige tu pan y se ajustan las cantidades</div>
      <div className="picks-row">{BREADS.filter(([id]) => FOODS[id]).map(([id, n, img, d]) => (
        <button className={`pick bread${value === id ? " on" : ""}`} key={id} onClick={() => onPick(id)} aria-pressed={value === id}>
          {img ? <img src={`/compra/${img}.jpg`} alt="" loading="lazy" /> : <span className="pimg">{id === "panMasaMadre" ? "De tu panadería" : "El que tengas en casa"}</span>}
          <b>{n}</b><small>{d}</small>
        </button>
      ))}</div>
      <p className="hint" style={{ margin: "8px 0 0" }}>Pro tip: si puedes, compra pan de masa madre en tu panadería (moreno, integral o de centeno). Pídelo cortado, congélalo y tuesta las rebanadas directamente del congelador. Sacia muchísimo.</p>
    </div>
  );
}
function ShopPicks({ items, pre }) {
  const seen = new Set();
  const picks = [...items.flatMap((it) => SHOP_PICKS[it.food] || []), ...(pre ? [["agua-coco", "Agua de coco", "Para antes o durante el entreno · 50 kcal el vaso"]] : [])].filter(([img]) => !seen.has(img) && seen.add(img));
  if (!picks.length) return null;
  return (
    <div className="picks">
      <div className="picks-t"><span className="mtag">Mercadona</span> Buenas opciones para esta receta</div>
      <div className="picks-row">{picks.map(([img, n, d]) => <div className="pick" key={img}><img src={`/compra/${img}.jpg`} alt={n} loading="lazy" /><b>{n}</b><small>{d}</small></div>)}</div>
    </div>
  );
}
// Guía de nutrición: pestañas con consejos (las fuentes, siempre al final)
const GUIDE = [
  { id: "compra", label: "Compra", intro: "Lo que más se cuela sin darte cuenta y cómo elegir bien en el súper." },
  { id: "pan", label: "Pan", intro: "El pan no es el enemigo: lo que importa es cuál eliges y cuánto.", items: [
    ["Mejor que mejor: de panadería", "Pan de masa madre de una panadería de tu zona, tipo pan moreno, integral o de centeno. Suele llevar menos ingredientes y una fermentación más larga."],
    ["Pídelo cortado y congélalo", "Al llegar a casa, a rebanadas al congelador. Las tuestas directamente congeladas: siempre tienes pan bueno y no se te pone duro."],
    ["Sacia más", "Al llevar más fibra que el pan blanco, llena más con la misma cantidad y te aguanta más hasta la siguiente comida."],
    ["Pésalo la primera vez", "El pan denso pesa más de lo que parece. Pesa una rebanada una vez y ya sabes cuánto es en la app."],
    ["Lee la etiqueta", "Que el primer ingrediente sea harina integral o de centeno. «Elaborado con masa madre» no es lo mismo que «100% masa madre»."],
    ["En la app", "En cada receta con pan puedes elegir cuál usas y las cantidades se ajustan solas."],
  ] },
  { id: "agua", label: "Hidratación", intro: "Beber suficiente se nota en el entreno, en la piel y hasta en el hambre.", items: [
    ["Cuánta agua", "Como referencia, unos 2 litros al día en mujeres y 2,5 en hombres contando lo que viene en la comida. Si entrenas, sudas mucho o hace calor, más."],
    ["El truco del color", "Si tu pis es amarillo clarito, vas bien. Si es oscuro, te falta agua."],
    ["Botella siempre a la vista", "Un vaso al levantarte, otro con cada comida y la botella en la mesa o en la mochila. Si la ves, bebes."],
    ["Antes y durante el entreno", "Llega hidratada al gym y ve bebiendo a sorbos entre series. En entrenos largos o con mucho calor, el agua de coco es una buena opción: 20 kcal por 100 ml y lleva potasio."],
    ["¿Sed o hambre?", "A veces confundimos sed con ganas de picar. Antes de picar entre horas, prueba con un vaso de agua."],
    ["También cuentan", "Infusiones, agua con gas y bebidas 0% cuentan. Con moderación las que llevan edulcorante, si te ayudan a beber más."],
  ] },
  { id: "cafe", label: "Cafeína", intro: "Ayuda a rendir en el entreno, pero tiene su límite y su horario.", items: [
    ["Cuánta es mucha", "En adultos sanos, hasta unos 400 mg al día se consideran seguros, y no más de 200 mg de golpe. En embarazo, máximo 200 mg al día. Si tienes menos de 18 años, el límite es más bajo: unos 3 mg por kilo al día."],
    ["Para entrenar", "Lo que se usa en estudios son unos 3 mg por kilo de peso entre 30 y 60 minutos antes. Para 60 kg, unos 180 mg: dos cafés de filtro o un pre-entreno suave."],
    ["Cuidado con el sueño", "La cafeína puede afectar al sueño hasta 6 horas después. Si entrenas por la tarde, mejor un pre-entreno sin cafeína o café solo por la mañana."],
    ["Cuánta lleva cada cosa (aprox.)", "Espresso: 60–80 mg · Café de filtro (200 ml): 90 mg · Té negro (taza): 50 mg · Cola (lata): 32 mg · Red Bull (250 ml): 80 mg · Monster (500 ml): 160 mg · Pre-entreno: 150–300 mg por cacito (mira la etiqueta)."],
    ["Ojo con sumarla", "Café por la mañana, bebida energética por la tarde y pre-entreno: se pasa de 400 mg sin darte cuenta."],
    ["Si te sienta mal", "Nervios, taquicardia o ansiedad: baja la dosis. No a todo el mundo le sienta igual."],
  ] },
  { id: "prote", label: "Proteína", intro: "Es lo que más cuesta llegar y lo que más se nota para ganar músculo.", items: [
    ["Cuánta", "Para ganar músculo o mantenerlo mientras pierdes grasa, entre 1,6 y 2,2 g por kilo de peso al día. La app ya te lo calcula."],
    ["Repártela", "Mejor en 3–5 comidas con 20–40 g cada una que todo de golpe en la cena."],
    ["Fuentes fáciles", "Pollo, pavo, huevos y claras, atún, yogur proteico, queso batido, legumbres y tofu. El batido de proteína es comida, no magia: solo te ayuda a llegar."],
    ["Truco", "Empieza cada plato pensando en la proteína y luego monta el resto alrededor."],
  ] },
  { id: "fuera", label: "Comer fuera", intro: "Comer fuera no rompe tu plan si sabes elegir.", items: [
    ["Pide a la plancha", "Carne o pescado a la plancha con ensalada o verduras es casi siempre la opción más fácil de cuadrar."],
    ["Salsas aparte", "Pide la salsa y el aliño aparte y pon tú la cantidad."],
    ["El táper, tu mejor amigo", "Cocina dos o tres raciones a la vez y llévatelas. En la app, si marcas que comes fuera, te salen primero las recetas que aguantan en táper."],
    ["Un día no es la semana", "Si un día te pasas, no compenses sin comer al día siguiente. Vuelve a tu plan normal y ya está."],
    ["Apúntalo igual", "Aunque sea aproximado, apúntalo en «Picoteos y extras». Lo que no se apunta, no existe… pero cuenta igual."],
  ] },
];
const GUIDE_SOURCES = {
  agua: ["EFSA (2010). Scientific Opinion on Dietary Reference Values for water."],
  cafe: ["EFSA (2015). Scientific Opinion on the safety of caffeine.", "Guest NS et al. (2021). ISSN position stand: caffeine and exercise performance.", "Drake C et al. (2013). Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed."],
  prote: ["Morton RW et al. (2018). Meta-analysis of protein supplementation and resistance training.", "Jäger R et al. (2017). ISSN position stand: protein and exercise."],
};
function NutriGuide() {
  const [tab, setTab] = useState(null);
  const g = GUIDE.find((x) => x.id === tab);
  return (
    <div className="shop">
      <div className="shop-hd" style={{ cursor: "default" }}><b>Guía</b>{tab && <button className="link" onClick={() => setTab(null)}>Cerrar</button>}</div>
      <div className="gtabs" role="tablist">{GUIDE.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} className={`chip ${tab === x.id ? "on" : ""}`} onClick={() => setTab(tab === x.id ? null : x.id)}>{x.label}</button>)}</div>
      {!g && <p className="hint" style={{ margin: "6px 0 0" }}>Compra, pan, agua, cafeína, proteína y comer fuera: toca una pestaña.</p>}
      {g && <p className="hint" style={{ margin: "8px 0 0" }}>{g.intro}</p>}
      {g?.id === "compra" && <ShopTips />}
      {g?.items && <ul>{g.items.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>}
      {g?.id === "pan" && <div className="shop-ex" style={{ marginTop: 10 }}>{SHOP_EXAMPLES.filter(([img]) => img.startsWith("pan-")).map(([img, n, d]) => <div key={img}><img src={`/compra/${img}.jpg`} alt={n} loading="lazy" /><b>{n}</b><small>{d}</small></div>)}</div>}
      {g && GUIDE_SOURCES[g.id] && <details className="gsrc"><summary>Fuentes</summary><ul>{GUIDE_SOURCES[g.id].map((x) => <li key={x}><span>{x}</span></li>)}</ul></details>}
    </div>
  );
}
function ShopTips() {
  return <>
    <ul>{SHOP_TIPS.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
    <div className="shop-ex-t">Ejemplos que uso yo (Mercadona)</div>
    <div className="shop-ex">{SHOP_EXAMPLES.map(([img, n, d]) => <div key={img}><img src={`/compra/${img}.jpg`} alt={n} loading="lazy" /><b>{n}</b><small>{d}</small></div>)}</div>
    <p className="hint" style={{ margin: "8px 0 0" }}>En otros supermercados hay parecidos: mira que lleven solo verduras (o legumbre) y poco aceite. Todos están en la app para apuntarlos en «Picoteos y extras».</p>
  </>;
}

// Picoteos y extras: lo que comes fuera del plan también cuenta
function Extras({ eaten, setEaten, totOf }) {
  const [food, setFood] = useState("");
  const [g, setG] = useState("");
  const [q, setQ] = useState("");
  const list = Object.entries(eaten).filter(([k]) => k.startsWith("extra:"));
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const opts = Object.entries(FOODS).filter(([, f]) => !q || norm(f.n).includes(norm(q))).sort((a, b) => a[1].n.localeCompare(b[1].n)).slice(0, 60);
  const add = () => {
    const grams = Math.round(Number(g)); if (!food || !(grams > 0)) return;
    const items = [{ food, g: grams }];
    setEaten({ ...eaten, [`extra:${Date.now()}`]: { name: FOODS[food].n, items, tot: totOf(items) } });
    setFood(""); setG(""); setQ("");
  };
  return (
    <div className="extras">
      <div className="mslot">Picoteos y extras</div>
      <p className="hint" style={{ margin: "4px 0 10px" }}>Apunta también lo pequeño: un puñado de frutos secos, una galleta, la leche del café o un trozo de chocolate. Son los que más se olvidan y los que más se notan al final del día.</p>
      {list.map(([k, e]) => (
        <div className="food" key={k}><span>{e.name} · {Math.round(e.items[0].g)} g</span><em>{Math.round(e.tot.kcal)} kcal <button className="xdel" aria-label={`Quitar ${e.name}`} onClick={() => { const n = { ...eaten }; delete n[k]; setEaten(n); }}>✕</button></em></div>
      ))}
      <div className="xadd">
        <input className="in" placeholder="Buscar alimento…" value={q} onChange={(e) => { setQ(e.target.value); setFood(""); }} aria-label="Buscar alimento" />
        <select className="in" value={food} onChange={(e) => setFood(e.target.value)} aria-label="Alimento">
          <option value="">Elige el alimento</option>
          {opts.map(([id, f]) => <option key={id} value={id}>{f.n}</option>)}
        </select>
        <div className="xrow"><input className="in" type="number" inputMode="numeric" placeholder="Gramos" value={g} onChange={(e) => setG(e.target.value)} aria-label="Gramos" /><button className="eatbtn" disabled={!food || !(Number(g) > 0)} onClick={add}>Apuntar</button></div>
      </div>
    </div>
  );
}

function Nutrition({ profile, setCook, media = {}, eaten = {}, setEaten = () => {} }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({}); // cantidades cambiadas antes de apuntar la comida
  const [rest, setRest] = useState(false);
  const [pick, setPick] = useState({});
  const [bread, setBreadS] = useState(() => { try { return localStorage.getItem("arc-pan") || ""; } catch { return ""; } });
  const setBread = (id) => { setBreadS(id); setDraft({}); try { localStorage.setItem("arc-pan", id); } catch { /* sin almacenamiento */ } };
  const withBread = (r) => (bread && FOODS[bread] && r.items.some(([f]) => BREAD_IDS.has(f)) ? { ...r, items: r.items.map(([f, q]) => [BREAD_IDS.has(f) ? bread : f, q]) } : r);
  const mode = profile.cook;
  const t = useMemo(() => macroTargets(profile, rest), [profile, rest]);
  const plan = { ...MEAL_PLANS[profile.meals] };
  if (profile.trainTime === "early" && !rest) { plan.pre = 0.08; plan.desayuno -= 0.08; }
  const order = ["pre", "desayuno", "mediaManana", "comida", "merienda", "cena"].filter((id) => plan[id]);
  const meals = order.map((id) => {
    const all = RECIPES.filter((r) => r.slot === (SLOT_RECIPES[id] || id) && recipeAllowed(r, profile));
    let opts = mode === "todas" ? all : all.filter((r) => r.mode === mode);
    if (!opts.length) opts = all;
    opts = byTaste(opts, profile);
    if (profile.eatOut) opts = [...opts].sort((a, b) => TUPPER.has(b.name) - TUPPER.has(a.name));
    opts = [...opts].sort((a, b) => !!recImg(media, b.id) - !!recImg(media, a.id)); // primero las que tienen foto
    if (!opts.length) return { id, empty: true };
    const k = `${id}-${mode}`;
    const recipe = opts[Math.min(pick[k] || 0, opts.length - 1)];
    const share = plan[id];
    return { id, k, opts, recipe, ...solveRecipe(withBread(recipe), { p: t.p * share, c: t.c * share, f: t.f * share }, profile.veg) };
  });
  const eatenTot = Object.values(eaten).reduce((a, e) => ({ p: a.p + (e.tot?.p || 0), c: a.c + (e.tot?.c || 0), f: a.f + (e.tot?.f || 0), kcal: a.kcal + (e.tot?.kcal || 0) }), { p: 0, c: 0, f: 0, kcal: 0 });
  const anyEaten = Object.keys(eaten).length > 0;
  const left = { kcal: t.kcal - eatenTot.kcal, p: t.p - eatenTot.p, c: t.c - eatenTot.c, f: t.f - eatenTot.f };
  const totOf = (items) => { const x = items.reduce((a, it) => ({ p: a.p + (FOODS[it.food]?.p || 0) * it.g / 100, c: a.c + (FOODS[it.food]?.c || 0) * it.g / 100, f: a.f + (FOODS[it.food]?.f || 0) * it.g / 100 }), { p: 0, c: 0, f: 0 }); x.kcal = x.p * 4 + x.c * 4 + x.f * 9; return x; };
  const dkey = (m) => `${m.id}:${m.recipe.id || m.recipe.name}`;
  const draftOf = (m) => draft[dkey(m)] || m.items.map((it) => ({ food: it.food, g: Math.round(it.g) }));
  const setDraftG = (m, food, g) => setDraft({ ...draft, [dkey(m)]: draftOf(m).map((it) => (it.food === food ? { ...it, g: Math.max(0, Number(g) || 0) } : it)) });
  const markEaten = (m) => {
    const next = { ...eaten };
    if (next[m.id]) delete next[m.id];
    else { const items = draftOf(m); next[m.id] = { name: m.recipe.name, items, tot: totOf(items) }; }
    setEaten(next); setEditing(null);
  };
  const setGrams = (id, food, g) => {
    const e = eaten[id]; if (!e) return;
    const items = e.items.map((it) => (it.food === food ? { ...it, g: Math.max(0, Number(g) || 0) } : it));
    setEaten({ ...eaten, [id]: { ...e, items, tot: totOf(items) } });
  };
  const r0 = (n) => Math.round(n);
  const day = meals.filter((m) => !m.empty).reduce((a, m) => ({ p: a.p + m.tot.p, c: a.c + m.tot.c, f: a.f + m.tot.f, kcal: a.kcal + m.tot.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  return (
    <>
      <h1>Nutrición</h1>
      <div className="seg" style={{ marginTop: 14 }}>
        <button className={!rest ? "on" : ""} onClick={() => setRest(false)}>Día de entreno</button>
        <button className={rest ? "on" : ""} onClick={() => setRest(true)}>Día de descanso</button>
      </div>
      <div className="ntop">
        {anyEaten
          ? <div className="kcal">{r0(Math.abs(left.kcal))}<span>{left.kcal >= 0 ? `kcal te quedan de ${t.kcal}` : `kcal por encima de ${t.kcal}`}</span></div>
          : <div className="kcal">{t.kcal}<span>kcal al día</span></div>}
        {anyEaten && <div className="eatbar"><i style={{ width: `${Math.min(100, (eatenTot.kcal / t.kcal) * 100)}%` }} /></div>}
        <div className="mbar" aria-hidden="true">
          <i style={{ flex: t.p * 4, background: "var(--ac)" }} /><i style={{ flex: t.c * 4, background: "#EDE7E2" }} /><i style={{ flex: t.f * 9, background: "#F5C76B" }} />
        </div>
        <div className="macros">
          {[["p", "Proteína", "var(--ac)"], ["c", "Hidratos", "#EDE7E2"], ["f", "Grasas", "#F5C76B"]].map(([k, l, col]) => (
            <div key={k}><i style={{ background: col }} /><b>{anyEaten ? r0(Math.max(0, left[k])) : t[k]} g</b><span>{l}{anyEaten && <><br />te quedan de {t[k]} g</>}</span></div>
          ))}
        </div>
      </div>

      <NutriGuide />
      <h2>Tus comidas</h2>
      <div className="seg">{COOK_OPTS.map(([v, l]) => <button key={v} className={mode === v ? "on" : ""} onClick={() => setCook(v)}>{l}</button>)}</div>
      {profile.eatOut && <p className="hint" style={{ marginTop: 0 }}>Primero te salen las que aguantan bien en táper.</p>}

      <div className="mlist">
      {meals.map((m) => m.empty ? (
        <div className="mcard" key={m.id}><div className="mbody"><div className="mslot">{SLOT_NAMES[m.id]}</div><p className="hint">Con lo que has quitado no hay recetas para esta comida todavía.</p></div></div>
      ) : (() => {
        const img = recImg(media, m.recipe.id), idx = m.opts.indexOf(m.recipe), n = m.opts.length;
        const go = (d) => setPick({ ...pick, [m.k]: (idx + d + n) % n });
        return (
          <div className={`mcard${eaten[m.id] ? " done" : ""}`} key={m.id}>
            <div className="mhead">
              <div className={`mthumb ${img ? "ph" : ""}`}>{img ? <img src={img} alt="" loading="lazy" /> : <CookIcon mode={m.recipe.mode === "sanji" ? "sanji" : "sencilla"} size={30} />}</div>
              <div className="mhead-t">
                <div className="mslot">{SLOT_NAMES[m.id]} <span>· {Math.round(m.tot.kcal)} kcal</span></div>
                <div className="mname">{m.recipe.name}</div>
                <div className="mmac"><span><i style={{ background: "var(--ac)" }} />P {Math.round(m.tot.p)}</span><span><i style={{ background: "#EDE7E2" }} />H {Math.round(m.tot.c)}</span><span><i style={{ background: "#F5C76B" }} />G {Math.round(m.tot.f)}</span>{TUPPER.has(m.recipe.name) && <span className="tp">Táper</span>}</div>
              </div>
            </div>
            {n > 1 && <div className="mswap">
              <button aria-label="Receta anterior" onClick={() => go(-1)}>‹</button>
              <span>Opción {idx + 1} de {n}</span>
              <button aria-label="Otra receta" onClick={() => go(1)}>Otra receta ›</button>
            </div>}
            <div className="mbody">
              {!eaten[m.id] && editing === m.id
                ? <div className="mfoods">{draftOf(m).map((it) => <label className="food edit" key={it.food}><span>{FOODS[it.food]?.n || it.food}</span><span className="gin"><input className="in" type="number" inputMode="numeric" value={it.g} onChange={(e) => setDraftG(m, it.food, e.target.value)} aria-label={`Gramos de ${FOODS[it.food]?.n || it.food}`} /> g</span></label>)}</div>
                : eaten[m.id] && editing === m.id
                ? <div className="mfoods">{eaten[m.id].items.map((it) => <label className="food edit" key={it.food}><span>{FOODS[it.food]?.n || it.food}</span><span className="gin"><input className="in" type="number" inputMode="numeric" value={it.g} onChange={(e) => setGrams(m.id, it.food, e.target.value)} aria-label={`Gramos de ${FOODS[it.food]?.n || it.food}`} /> g</span></label>)}</div>
                : <div className="mfoods">{(eaten[m.id]?.items || (draft[dkey(m)] ? draftOf(m) : m.items)).map((it) => <div className="food" key={it.food}><span>{FOODS[it.food]?.n || it.food}</span><em>{Math.round(it.g)} g{breadUnits(it.food, it.g)}</em></div>)}</div>}
              <div className="meat">
                <button className={`eatbtn${eaten[m.id] ? " on" : ""}`} onClick={() => markEaten(m)}>{eaten[m.id] ? "✓ Comida apuntada" : "Me la he comido"}</button>
                <button className="eatedit" onClick={() => setEditing(editing === m.id ? null : m.id)}>{editing === m.id ? "Listo" : eaten[m.id] ? "Cambiar cantidades" : "Ajustar cantidades"}</button>
              </div>
              {!eaten[m.id] && editing === m.id && (() => { const t2 = totOf(draftOf(m)); return <p className="hint" style={{ margin: "6px 0 0" }}>Con estas cantidades: {r0(t2.kcal)} kcal · P {r0(t2.p)} · H {r0(t2.c)} · G {r0(t2.f)}. Cuando lo tengas, toca «Me la he comido».</p>; })()}
              {eaten[m.id] && <p className="hint" style={{ margin: "6px 0 0" }}>Has comido {r0(eaten[m.id].tot.kcal)} kcal · P {r0(eaten[m.id].tot.p)} · H {r0(eaten[m.id].tot.c)} · G {r0(eaten[m.id].tot.f)}</p>}
              {!eaten[m.id] && m.recipe.items.some(([f]) => BREAD_IDS.has(f)) && <BreadPick value={m.items.find((it) => BREAD_IDS.has(it.food))?.food} onPick={setBread} />}
              <ShopPicks items={eaten[m.id]?.items || m.items} pre={m.id === "pre"} />
              <details className="mprep">
                <summary>Cómo se prepara</summary>
                {m.recipe.steps ? <ol className="steps">{m.recipe.steps.map((st) => <li key={st}>{st}</li>)}</ol> : <p className="hint">{m.recipe.how}</p>}
                {m.recipe.plate && <p className="plate">{m.recipe.plate}</p>}
                {m.recipe.mode !== "sanji" && m.items.some((it) => it.food === "verduras") && <p className="plate">Truco: usa una bolsa de verduras congeladas. Hazlas al principio de la semana, guárdalas en tápers y así montas el plato en un momento.</p>}
              </details>
            </div>
          </div>
        );
      })())}
      </div>
      <Extras eaten={eaten} setEaten={setEaten} totOf={totOf} />
      <div className="note">Total del día: {Math.round(day.kcal)} kcal, {Math.round(day.p)} g de proteína, {Math.round(day.c)} g de hidratos y {Math.round(day.f)} g de grasas. Pesos en crudo salvo patata, legumbres y cremas, que van ya cocinadas.</div>

      <h2>Suplementación</h2>
      <p className="sub">Información general, no una recomendación personal. La creatina monohidrato es el suplemento con más evidencia para ganar fuerza; en los estudios se usan 3–5 g al día. Antes de tomar cualquier suplemento, consúltalo con tu médico o farmacéutico, sobre todo si tomas medicación o tienes alguna enfermedad.</p>
      <p className="hint" style={{ marginTop: 18 }}>Tus calorías se calculan con la ecuación de Mifflin-St Jeor, tu nivel de actividad y tu objetivo, y la proteína según la ISSN.</p>
      <div id="fuentes-nutricion-wrap"><SourcesAnchor id="fuentes-nutricion" groups={["nutricion"]} /></div>
      <p className="hint">Plan orientativo calculado con tu cuestionario. No sustituye la consulta con un dietista-nutricionista.</p>
    </>
  );
}

/* ============================ HÁBITOS ============================ */

// Fuentes científicas de los cálculos y recomendaciones (Apple 1.4.1)
const SOURCES = {
  nutricion: [
    ["Calorías de reposo: ecuación de Mifflin-St Jeor", "Mifflin MD, St Jeor ST et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr, 1990.", "https://doi.org/10.1093/ajcn/51.2.241"],
    ["Factor de actividad diaria", "FAO/OMS/UNU. Human energy requirements: report of a joint expert consultation, 2004.", "https://www.fao.org/3/y5686e/y5686e00.htm"],
    ["Proteína: 1,6–2,2 g por kg al día", "Jäger R et al. ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr, 2017.", "https://pubmed.ncbi.nlm.nih.gov/28642676/"],
    ["Déficit moderado, más proteína y grasas mínimas", "Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr, 2014.", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/"],
    ["Reparto de grasas e hidratos", "EFSA. Dietary Reference Values for nutrients: summary report, 2017.", "https://efsa.europa.eu/en/supporting/pub/e15121"],
    ["Creatina monohidrato 3–5 g al día", "Kreider RB et al. ISSN position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr, 2017.", "https://pubmed.ncbi.nlm.nih.gov/28615996/"],
  ],
  habitos: [
    ["Pasos al día", "Paluch AE et al. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health, 2022.", "https://pubmed.ncbi.nlm.nih.gov/35247352/"],
    ["Agua: 2–2,5 L al día", "EFSA. Scientific Opinion on Dietary Reference Values for water. EFSA Journal, 2010.", "https://www.efsa.europa.eu/en/efsajournal/pub/1459"],
    ["Sueño: 7 horas o más", "Watson NF et al. Recommended amount of sleep for a healthy adult: joint consensus statement of the AASM and SRS. Sleep, 2015.", "https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf"],
  ],
  entreno: [
    ["Series por músculo a la semana", "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci, 2017.", "https://doi.org/10.1080/02640414.2016.1210197"],
  ],
};
function SourcesAnchor({ id, groups }) {
  return <details id={id} className="srcs"><summary>Fuentes científicas</summary><p className="hint" style={{ marginTop: 6 }}>Los cálculos de ARC se basan en estas fuentes. Son orientativos y no sustituyen el consejo de un profesional sanitario.</p>{groups.flatMap((g) => SOURCES[g]).map(([what, cite, url]) => <a key={url} className="src" href={url} target="_blank" rel="noopener noreferrer"><b>{what}</b><span>{cite}</span></a>)}</details>;
}
function Sources({ groups, title = "Fuentes científicas", open = false }) {
  return (
    <details className="srcs" open={open}>
      <summary>{title}</summary>
      <p className="hint" style={{ marginTop: 6 }}>Los cálculos de ARC se basan en estas fuentes. Son orientativos y no sustituyen el consejo de un profesional sanitario.</p>
      {groups.flatMap((g) => SOURCES[g]).map(([what, cite, url]) => (
        <a key={url} className="src" href={url} target="_blank" rel="noopener noreferrer"><b>{what}</b><span>{cite}</span></a>
      ))}
    </details>
  );
}

function Habits({ state, setHabit, adh, steps }) {
  const [shareSteps, setShareSteps] = useState(false);
  const [dayStory, setDayStory] = useState(false);
  const today = dkey();
  const h = state.habits[today] || {};
  const water = h.water || 0;
  return (
    <>
      <h1>Hábitos</h1>
      <p className="sub">Hoy cuenta como día cumplido si llegas a dos de los tres: pasos, agua y sueño.</p>
      <div className="stat3">
        <div><b>{adh.provisional ? "—" : `${adh.pct}%`}</b><span>Adherencia</span></div>
        <div><b>{adh.streak}</b><span>Días de racha</span></div>
        <div><b>{dayMet(h) ? "Sí" : "No"}</b><span>Hoy cumplido</span></div>
      </div>

      <div className="hb">
        <div className="hd"><b>Pasos</b><button className="shr-mini" onClick={() => setShareSteps(true)}><ShareIcon /> Compartir</button></div>
        <p className="hint" style={{ margin: "-4px 0 8px" }}>Meta {RULES.STEPS_GOAL.toLocaleString("es-ES")}</p>
        <div className="steps-now"><b>{fmtN(h.steps || 0)}</b><span>pasos hoy</span></div>
        {!(steps?.linked) && <p className="hint" style={{ margin: "4px 0 0" }}>Los pasos se leen solos del móvil{steps ? ` (${steps.source})` : ""}, así nadie puede inflarlos a mano. Conéctalo abajo para que cuenten.</p>}
        <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${Math.min(100, ((h.steps || 0) / RULES.STEPS_GOAL) * 100)}%`, background: "var(--ac)" }} /></div>
        <StepsWeek habits={state.habits} />
        <DayStoryCard onOpen={() => setDayStory(true)} />
        {shareSteps && <StepsShareSheet habits={state.habits} nick={state.nickname} onClose={() => setShareSteps(false)} onDay={() => { setShareSteps(false); setDayStory(true); }} />}
        {dayStory && <DayStorySheet habits={state.habits} sessions={state.sessions} onClose={() => setDayStory(false)} />}
        {steps && steps.source !== "Apple Salud" && steps.available && (steps.linked
          ? <div className="chips" style={{ marginTop: 10 }}>
              <button className="chip" disabled={steps.busy} onClick={steps.sync}>{steps.busy ? "Leyendo pasos…" : "Actualizar pasos del móvil"}</button>
            </div>
          : <button className="btn ghost" style={{ marginTop: 10 }} disabled={steps.busy} onClick={steps.connect}>{steps.busy ? "Un momento…" : steps.label}</button>)}
        {steps && steps.source !== "Apple Salud" && steps.error && <div className="err">{steps.error}</div>}
        {steps?.source === "Apple Salud" && <HealthKitCard steps={steps} />}
      </div>

      <div className="hb">
        <div className="hd"><b>Hidratación</b><span>{((water * RULES.WATER_GLASS_ML) / 1000).toFixed(2).replace(".", ",")} L de 2–3 L</span></div>
        <div className="glasses">
          {Array.from({ length: 12 }).map((_, i) => (
            <button key={i} className={`glass ${i < water ? "on" : ""}`} aria-label={`${i + 1} vasos`} onClick={() => setHabit("water", i + 1 === water ? i : i + 1)} />
          ))}
        </div>
        <ul className="tips">
          <li>Ten la botella siempre a la vista.</li>
          <li>Un vaso al levantarte y otro con cada comida.</li>
          <li>Las bebidas 0% o con algo de edulcorante también cuentan si te ayudan a beber más, con moderación.</li>
        </ul>
      </div>

      <div className="hb">
        <div className="hd"><b>Sueño</b><span>Meta {RULES.SLEEP_GOAL_H} h</span></div>
        <input className="in" type="number" step="0.5" inputMode="decimal" placeholder="Horas dormidas" value={h.sleep ?? ""} onChange={(e) => setHabit("sleep", e.target.value === "" ? "" : Number(e.target.value))} />
      </div>

      <div className="hb" style={{ borderBottom: 0 }}>
        <div className="hd"><b>Peso corporal</b><span>Opcional</span></div>
        <input className="in" type="number" step="0.1" inputMode="decimal" placeholder="kg" value={h.weight ?? ""} onChange={(e) => setHabit("weight", e.target.value === "" ? "" : Number(e.target.value))} />
        <p className="hint">Pésate en ayunas y fíjate en la tendencia, no en un día suelto.</p>
      </div>
      <Sources groups={["habitos"]} title="Fuentes de estas metas" />
    </>
  );
}

// Pasos de los últimos 7 días con la media y una valoración sincera
function StepsWeek({ habits }) {
  const goal = RULES.STEPS_GOAL;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const vals = days.map((d) => Number(habits[dkey(d)]?.steps) || 0);
  const logged = vals.filter((v) => v > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  const max = Math.max(goal, ...vals);
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const pct = avg / goal;
  const verdict = !logged.length ? ["Aún no hay pasos esta semana.", ""]
    : pct >= 1 ? ["Vas genial: estás por encima de tu meta.", "ok"]
    : pct >= 0.85 ? [`Casi: te faltan unos ${fmt(Math.round((goal - avg) / 100) * 100)} pasos al día de media.`, "mid"]
    : pct >= 0.6 ? [`Te estás quedando por debajo: ${fmt(avg)} de media frente a ${fmt(goal)}. Mete un paseo de 20 minutos al día.`, "low"]
    : ["Sinceramente, esta semana te faltan muchos pasos. Prueba a ir andando a clase o al gym y a dar un paseo después de comer.", "low"];
  const L = ["D", "L", "M", "X", "J", "V", "S"];
  return (
    <div className="stw">
      <div className="stw-hd"><span>Últimos 7 días</span><b>{fmt(avg)}<small> de media</small></b></div>
      <div className="stw-bars">
        <i className="stw-goal" style={{ bottom: `calc(18px + (100% - 18px) * ${goal / max})` }} />
        {vals.map((v, i) => (
          <div key={i} className="stw-col">
            <div className={`stw-bar ${v >= goal ? "ok" : ""}`} style={{ height: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` }} />
            <small className={i === 6 ? "today" : ""}>{L[days[i].getDay()]}</small>
          </div>
        ))}
      </div>
      {verdict[0] && <p className={`stw-v ${verdict[1]}`}>{verdict[0]}</p>}
    </div>
  );
}

// Integración con Apple Salud (HealthKit), bien visible para la usuaria
const HealthIcon = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="7" fill="#fff" /><path d="M15 23.5s-7.5-4.6-7.5-10.1A4.1 4.1 0 0 1 15 11a4.1 4.1 0 0 1 7.5 2.4c0 5.5-7.5 10.1-7.5 10.1z" fill="#FF2D55" /></svg>
);
function HealthKitCard({ steps }) {
  const [more, setMore] = useState(false);
  if (steps.linked && steps.available) return (
    <div className="hk mini">
      <div className="hk-hd">
        <HealthIcon size={24} />
        <div><b>Apple Salud</b><small>Pasos leídos con HealthKit · solo lectura</small></div>
        <button className="chip" disabled={steps.busy} onClick={steps.sync}>{steps.busy ? "…" : "Actualizar"}</button>
      </div>
      {steps.error && <div className="err">{steps.error}</div>}
      <button className="link" onClick={() => setMore(!more)}>{more ? "Ocultar" : "Más información"}</button>
      {more && <p className="hint">ARC usa HealthKit solo para leer tus pasos diarios de la app Salud. No escribe nada en Salud, no comparte tus datos ni los usa para publicidad. Puedes quitar el permiso en Ajustes del iPhone → Salud → Acceso a datos y dispositivos → ARC.</p>}
    </div>
  );
  return (
    <div className="hk">
      <div className="hk-hd">
        <HealthIcon />
        <div><b>Apple Salud</b><small>Integración con HealthKit</small></div>
        <span className={`hk-st ${steps.linked ? "on" : ""}`}>{steps.linked ? "Conectado" : "Sin conectar"}</span>
      </div>
      <p>ARC usa <b>HealthKit</b> para leer tus pasos diarios de la app Salud y apuntarlos aquí automáticamente. Solo lee los pasos: no escribe nada en Salud, no comparte tus datos con nadie y no los usa para publicidad.</p>
      {steps.available
        ? (steps.linked
          ? <button className="chip" disabled={steps.busy} onClick={steps.sync}>{steps.busy ? "Leyendo pasos de Apple Salud…" : "Actualizar pasos desde Apple Salud"}</button>
          : <button className="btn ghost" style={{ marginTop: 4 }} disabled={steps.busy} onClick={steps.connect}>{steps.busy ? "Un momento…" : "Conectar con Apple Salud"}</button>)
        : <p className="hint">Apple Salud no está disponible en este dispositivo. Puedes apuntar tus pasos a mano.</p>}
      {steps.error && <div className="err">{steps.error}</div>}
      <p className="hint">Puedes quitar el permiso cuando quieras en Ajustes del iPhone → Salud → Acceso a datos y dispositivos → ARC.</p>
    </div>
  );
}

/* ============================ EDITOR DE CONTENIDO (COACH) ============================ */

const ED_TABS = [["quotes", "Frases"], ["recipes", "Recetas"], ["exercises", "Ejercicios"], ["foods", "Alimentos"]];
const SLOT_OPTS = [["desayuno", "Desayuno"], ["pre", "Pre-entreno"], ["comida", "Comida"], ["merienda", "Merienda y media mañana"], ["cena", "Cena"]];
const ROLE_OPTS = [["p", "Ajusta proteína"], ["c", "Ajusta hidratos"], ["f", "Ajusta grasas"], ["fixed", "Cantidad fija"]];
const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function blankRow(table, content) {
  if (table === "quotes") return { id: `q-${Date.now()}`, text: "", who: "", source: "", why: "", kind: "cita", active: true };
  if (table === "exercises") {
    const n = Math.max(68, ...content.exercises.map((e) => Number((e.id.match(/^ARC-(\d+)$/) || [])[1]) || 0)) + 1;
    return { id: `ARC-${String(n).padStart(3, "0")}`, grp: GROUPS[0] || "Pecho", name: "", muscle: "", equip: "", simple: "", tip: "", note: "", lift: "", unit: "", sort: 500 + n };
  }
  if (table === "foods") return { id: "", name: "", p: 0, c: 0, f: 0, tags: [] };
  return { id: `r-${Date.now()}`, slot: "comida", mode: "sencilla", name: "", items: [["", "p"], ["", "c"], ["", "f"]], how: "", steps: [], plate: "", tupper: false, active: true, sort: 999 };
}

function ContentEditor({ content, onSave, onDelete, onClose, media, setMedia, uploadMedia }) {
  const [table, setTable] = useState("quotes");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const rows = content[table];
  const label = (r) => table === "quotes" ? r.text : r.name;
  const sub = (r) => table === "quotes" ? [r.who, r.source].filter(Boolean).join(" · ") : table === "recipes" ? `${SLOT_NAMES[r.slot] || r.slot} · ${r.mode === "sanji" ? "Sanji" : "Fácil"}` : table === "exercises" ? `${r.id} · ${r.grp}` : `P ${r.p} · H ${r.c} · G ${r.f}`;
  const list = rows.filter((r) => !q || norm(`${label(r)} ${sub(r)}`).includes(norm(q)));

  if (edit) return <EditForm table={table} row={edit.row} isNew={edit.isNew} content={content} onCancel={() => setEdit(null)}
    onSave={async (r) => { await onSave(table, r); setEdit(null); }} onDelete={async (id) => { await onDelete(table, id); setEdit(null); }}
    media={media} setMedia={setMedia} uploadMedia={uploadMedia} />;

  return (
    <>
      <h1>Contenido</h1>
      <p className="sub">Lo que cambies aquí les llega a todas las usuarias al momento.</p>
      <div className="seg">{ED_TABS.map(([t, l]) => <button key={t} className={table === t ? "on" : ""} onClick={() => { setTable(t); setQ(""); }}>{l}</button>)}</div>
      <div className="row" style={{ marginBottom: 6 }}>
        <input className="in" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="sbtn" style={{ background: "var(--ac)" }} onClick={() => setEdit({ row: blankRow(table, content), isNew: true })}>Añadir</button>
      </div>
      <p className="hint">{list.length} {list.length === 1 ? "elemento" : "elementos"}</p>
      {list.map((r) => (
        <button key={r.id} className="edrow" onClick={() => setEdit({ row: JSON.parse(JSON.stringify(r)), isNew: false })} style={{ opacity: r.active === false ? 0.45 : 1 }}>
          <span>{label(r) || "Sin título"}</span><small>{sub(r)}{r.active === false ? " · oculta" : ""}</small>
        </button>
      ))}
      <button className="btn ghost" style={{ marginTop: 20 }} onClick={onClose}>Volver</button>
    </>
  );
}

function Field({ label, children, hint }) {
  return <div className="field"><label>{label}</label>{children}{hint && <div className="hint">{hint}</div>}</div>;
}

function EditForm({ table, row, isNew, content, onSave, onDelete, onCancel, media, setMedia, uploadMedia }) {
  const [r, setR] = useState(row);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (k, v) => setR({ ...r, [k]: v });
  const txt = (k, ph) => <input className="in" placeholder={ph} value={r[k] ?? ""} onChange={(e) => set(k, e.target.value)} />;
  const area = (k, ph, rows = 3) => <textarea className="in" rows={rows} placeholder={ph} value={r[k] ?? ""} onChange={(e) => set(k, e.target.value)} />;
  const chips = (k, opts) => <div className="chips">{opts.map(([v, l]) => <button key={v} className={`chip ${r[k] === v ? "on" : ""}`} onClick={() => set(k, v)}>{l}</button>)}</div>;

  const usedBy = table === "foods" ? content.recipes.filter((x) => x.items.some(([f]) => f === r.id)).length : 0;
  const locked = table === "exercises" && EX_IN_USE.has(r.id);
  const canDelete = !isNew && !locked && usedBy === 0;

  const validate = () => {
    if (table === "quotes" && !r.text.trim()) return "Pon la frase.";
    if (table === "exercises" && !r.name.trim()) return "Ponle nombre al ejercicio.";
    if (table === "foods") {
      if (!r.name.trim()) return "Ponle nombre al alimento.";
      if (isNew && content.foods.some((f) => f.id === r.id)) return "Ya hay un alimento con ese nombre.";
    }
    if (table === "recipes") {
      if (!r.name.trim()) return "Ponle nombre a la receta.";
      const items = r.items.filter(([f]) => f);
      if (!items.length) return "Añade al menos un ingrediente.";
      const roles = items.map(([, x]) => x).filter((x) => typeof x === "string");
      if (!roles.length) return "Al menos un ingrediente tiene que ajustarse a los macros.";
      if (new Set(roles).size !== roles.length) return "Solo puede haber un ingrediente que ajuste cada macro.";
    }
    return "";
  };
  const save = async () => {
    const e = validate(); if (e) return setErr(e);
    let out = { ...r };
    if (table === "foods") out = { ...out, id: out.id || slug(out.name), p: Number(out.p) || 0, c: Number(out.c) || 0, f: Number(out.f) || 0 };
    if (table === "recipes") out = { ...out, items: out.items.filter(([f]) => f).map(([f, x]) => [f, typeof x === "number" ? x : x]), steps: (out.steps || []).filter((s) => s.trim()) };
    setBusy(true); setErr("");
    try { await onSave(out); } catch (e) { setErr("No se ha podido guardar. Revisa tu conexión."); setBusy(false); }
  };

  return (
    <>
      <h1>{isNew ? "Añadir" : "Editar"} {table === "quotes" ? "frase" : table === "recipes" ? "receta" : table === "exercises" ? "ejercicio" : "alimento"}</h1>

      {table === "quotes" && <>
        <Field label="Frase">{area("text", "La frase tal cual", 3)}</Field>
        <div className="row">
          <div style={{ flex: 1 }}><Field label="Quién la dice">{txt("who", "Muhammad Ali")}</Field></div>
          <div style={{ flex: 1 }}><Field label="De dónde">{txt("source", "Naruto")}</Field></div>
        </div>
        <Field label="Explicación" hint="Una o dos frases, cortas y en tu tono.">{area("why", "Qué tiene que ver con entrenar", 3)}</Field>
        <Field label="Tipo">{chips("kind", [["cita", "Cita real (con comillas)"], ["leccion", "Lección tuya"]])}</Field>
        <Field label="Visible">{chips("active", [[true, "Sí"], [false, "Oculta"]])}</Field>
      </>}

      {table === "exercises" && <>
        <p className="hint" style={{ marginTop: -4 }}>{r.id}</p>
        <Field label="Nombre">{txt("name", "Hip thrust en máquina")}</Field>
        <Field label="Grupo">
          <div className="chips">{[...new Set([...GROUPS, r.grp])].map((g) => <button key={g} className={`chip ${r.grp === g ? "on" : ""}`} onClick={() => set("grp", g)}>{g}</button>)}</div>
          <input className="in" style={{ marginTop: 8 }} placeholder="O escribe un grupo nuevo" onBlur={(e) => e.target.value.trim() && set("grp", e.target.value.trim())} />
        </Field>
        <div className="row">
          <div style={{ flex: 1 }}><Field label="Músculo principal">{txt("muscle", "Glúteo mayor")}</Field></div>
          <div style={{ flex: 1 }}><Field label="Equipo">{txt("equip", "Máquina")}</Field></div>
        </div>
        <Field label="Explicación simple">{area("simple", "Lo que ve la clienta: cómo se hace", 3)}</Field>
        <Field label="Truquito">{area("tip", "El detalle técnico que lo cambia todo", 3)}</Field>
        <Field label="Nota (opcional)" hint="Sale debajo del nombre durante el entreno.">{txt("note", "No te preocupes si aún no te sale…")}</Field>
        <Field label="Se registra en">{chips("unit", [["", "Kilos y repeticiones"], ["s", "Segundos"], ["min", "Minutos"]])}</Field>
        <Field label="¿Cuenta para subir de nivel?">{chips("lift", LIFT_OPTS)}</Field>
        {!isNew && <Field label="Vídeo o GIF de técnica">
          {media[`ex:${r.id}`] ? <MediaView src={media[`ex:${r.id}`]} /> : <div className="hint">Aún no tiene vídeo.</div>}
          <div className="chips" style={{ marginTop: 8 }}>
            <MediaPicker label={media[`ex:${r.id}`] ? "Cambiar vídeo" : "Subir vídeo o GIF"} accept="video/*,image/*" onPick={(f) => uploadMedia(`ex:${r.id}`, f)} onError={setErr} />
            {media[`ex:${r.id}`] && <button className="chip" onClick={() => setMedia(`ex:${r.id}`, null)}>Quitar</button>}
          </div>
        </Field>}
      </>}

      {table === "recipes" && !isNew && <Field label="Foto del plato" hint="Sale arriba de la receta en Nutrición, en cuadrado. Mejor desde arriba y con el plato centrado.">
        {recImg(media, r.id) ? <img className="rphoto" src={recImg(media, r.id)} alt="" /> : <div className="hint">Aún no tiene foto.</div>}
        <div className="chips" style={{ marginTop: 8 }}>
          <MediaPicker label={media[`rec:${r.id}`] ? "Cambiar foto" : "Subir foto"} accept="image/*" onPick={(f) => uploadMedia(`rec:${r.id}`, f)} onError={setErr} />
          {media[`rec:${r.id}`] && <button className="chip" onClick={() => setMedia(`rec:${r.id}`, null)}>Quitar</button>}
        </div>
      </Field>}
      {table === "recipes" && isNew && <p className="hint">Guarda la receta y vuelve a abrirla para subir la foto.</p>}
      {table === "foods" && <>
        <Field label="Nombre">{txt("name", "Yogur griego natural")}</Field>
        <p className="hint" style={{ marginTop: -6 }}>Valores por 100 g</p>
        <div className="row">
          {[["p", "Proteína"], ["c", "Hidratos"], ["f", "Grasas"]].map(([k, l]) => (
            <div key={k} style={{ flex: 1 }}><Field label={l}><input className="in" type="number" step="0.1" inputMode="decimal" value={r[k]} onChange={(e) => set(k, e.target.value)} /></Field></div>
          ))}
        </div>
        <p className="hint">{Math.round((Number(r.p) || 0) * 4 + (Number(r.c) || 0) * 4 + (Number(r.f) || 0) * 9)} kcal por 100 g</p>
        <Field label="Contiene" hint="Sirve para quitarlo a quien lo excluya en el cuestionario.">
          <div className="chips">{TAG_OPTS.map(([t, l]) => { const on = (r.tags || []).includes(t); return <button key={t} className={`chip ${on ? "on" : ""}`} onClick={() => set("tags", on ? r.tags.filter((x) => x !== t) : [...(r.tags || []), t])}>{l}</button>; })}</div>
        </Field>
        {usedBy > 0 && <p className="hint">Se usa en {usedBy} {usedBy === 1 ? "receta" : "recetas"}, por eso no se puede borrar.</p>}
      </>}

      {table === "recipes" && <>
        <Field label="Nombre">{txt("name", "Tostadas sushi")}</Field>
        <Field label="Comida">{chips("slot", SLOT_OPTS)}</Field>
        <Field label="Modo">{chips("mode", [["sencilla", "Fácil"], ["sanji", "Modo Sanji (cocinitas)"]])}</Field>
        <Field label="¿Aguanta en táper?">{chips("tupper", [[true, "Sí"], [false, "No"]])}</Field>
        <Field label="Ingredientes" hint="Los que ajustan un macro cambian de cantidad según cada persona. Los fijos van siempre igual.">
          {r.items.map(([food, role], i) => {
            const fixed = typeof role === "number";
            const upd = (nf, nr) => set("items", r.items.map((it, j) => (j === i ? [nf, nr] : it)));
            return (
              <div key={i} className="ingr">
                <select className="in" value={food} onChange={(e) => upd(e.target.value, role)}>
                  <option value="">Elige alimento…</option>
                  {[...content.foods].sort((a, b) => a.name.localeCompare(b.name)).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <div className="row" style={{ marginTop: 6 }}>
                  <select className="in" value={fixed ? "fixed" : role} onChange={(e) => upd(food, e.target.value === "fixed" ? 50 : e.target.value)}>
                    {ROLE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {fixed && <input className="in" style={{ width: 90 }} type="number" value={role} onChange={(e) => upd(food, Number(e.target.value) || 0)} aria-label="Gramos" />}
                  <button className="chip" onClick={() => set("items", r.items.filter((_, j) => j !== i))}>×</button>
                </div>
              </div>
            );
          })}
          <button className="add" onClick={() => set("items", [...r.items, ["", 50]])}>+ Añadir ingrediente</button>
        </Field>
        {r.mode === "sanji"
          ? <Field label="Pasos" hint="Un paso por línea.">
              <textarea className="in" rows={5} value={(r.steps || []).join("\n")} onChange={(e) => set("steps", e.target.value.split("\n"))} />
            </Field>
          : <Field label="Cómo se hace">{area("how", "Una o dos frases", 3)}</Field>}
        <Field label="Emplatado (opcional)">{area("plate", "Cómo dejarla bonita", 2)}</Field>
        <Field label="Visible">{chips("active", [[true, "Sí"], [false, "Oculta"]])}</Field>
      </>}

      {err && <div className="err">{err}</div>}
      <button className="btn ac" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
      <button className="btn ghost" onClick={onCancel}>Cancelar</button>
      {canDelete && !confirm && <button className="btn ghost" style={{ color: "#FCA5A5" }} onClick={() => setConfirm(true)}>Borrar</button>}
      {confirm && <button className="btn" style={{ background: "#FCA5A5" }} onClick={() => onDelete(r.id).catch(() => setErr("No se ha podido borrar."))}>Sí, borrar para siempre</button>}
      {locked && <p className="hint">Este ejercicio lo usan las rutinas, así que no se puede borrar. Puedes editarlo.</p>}
    </>
  );
}

/* ============================ RANKING SEMANAL ============================ */

const RANK_POINTS = { session: 40, habitDay: 15 }; // +40 por día entrenado, +15 por día de hábitos cumplido
const BAD_WORDS = ["puta", "puto", "zorra", "maricon", "mariquita", "polla", "coño", "cabron", "gilipollas", "subnormal", "retrasad", "nazi", "hitler", "follar", "sexo", "porno", "fuck", "shit", "bitch", "whore", "slut", "nigga", "nigger", "admin", "coach", "lunarovx", "soporte"];
const REPORT_REASONS = ["Nombre ofensivo", "Foto de perfil inapropiada", "Suplanta a alguien", "Otro motivo"];

function weekStart(d = new Date(), weeksAgo = 0) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7) - 7 * weeksAgo);
  return x;
}
function myWeekPoints(state, weeksAgo = 0) {
  const start = weekStart(new Date(), weeksAgo), end = new Date(start); end.setDate(end.getDate() + 7);
  const days = new Set(state.sessions.map((s) => new Date(s.date)).filter((d) => d >= start && d < end).map((d) => dkey(d)));
  const habitDays = Object.entries(state.habits).filter(([k, h]) => { const d = new Date(k + "T12:00:00"); return d >= start && d < end && dayMet(h); }).length;
  return { sessions: days.size, habitDays, points: days.size * RANK_POINTS.session + habitDays * RANK_POINTS.habitDay };
}
function checkNickname(n) {
  const v = n.trim();
  if (v.length < 3 || v.length > 20) return "Entre 3 y 20 caracteres.";
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(v)) return "Solo letras, números, espacios, guiones y puntos.";
  const plain = norm(v).replace(/[^a-z0-9]/g, "");
  if (BAD_WORDS.some((w) => plain.includes(norm(w)))) return "Ese nombre no está permitido. Prueba con otro.";
  return "";
}
const levelLabel = (branch, level, mode) => (branch && mode !== "simple" ? levelsOf(branch, mode)[level]?.name || "" : "");
const fmtDay = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const RANK_MAX = 7 * RANK_POINTS.session + 7 * RANK_POINTS.habitDay;
const WEEK_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const fmtKg = (kg) => (kg >= 1000 ? `${(kg / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`);
const relDay = (d) => {
  const n = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  return n === 0 ? "Hoy" : n === 1 ? "Ayer" : n < 7 ? `Hace ${n} días` : new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

const Crown = ({ size = 26 }) => (
  <svg width={size} height={size * 0.75} viewBox="0 0 32 24" aria-hidden="true"><path d="M2 20L0 4l9 7 7-11 7 11 9-7-2 16z" fill="#F5C76B" /><rect x="2" y="21" width="28" height="3" rx="1.5" fill="#F5C76B" /><circle cx="16" cy="13" r="2.4" fill="#D48B92" /></svg>
);

function Avatar({ r, media, size = 40, ring = false }) {
  const lvl = r.branch && r.mode !== "simple" ? mediaOr(media || {}, levelKey(r.branch, r.mode, r.level || 0)) : null;
  const src = r.avatar_url || lvl;
  return (
    <span className={`av${ring ? " ring" : ""}${r.avatar_url ? " photo" : ""}${!src ? " none" : ""}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {src ? <img src={src} alt="" loading="lazy" /> : (r.nickname || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 7) * 0.08, r: (i * 53) % 360, c: ["#D48B92", "#F5C76B", "#fff", "#6EE7B7"][i % 4], w: 6 + (i % 3) * 3 })), []);
  return <div className="confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c, width: b.w, transform: `rotate(${b.r}deg)` }} />)}</div>;
}

function Podium({ rows, media, onOpen }) {
  const slots = [[rows[1], 2], [rows[0], 1], [rows[2], 3]];
  return (
    <div className="podium">
      {slots.map(([r, p]) => r ? (
        <button key={r.nickname} className={`pd p${p}${r.is_me ? " me" : ""}`} onClick={() => onOpen(r.nickname)}>
          {p === 1 && <span className="crown"><Crown /></span>}
          <Avatar r={r} media={media} size={p === 1 ? 78 : 60} ring />
          <b className="pn">{r.nickname}</b>
          <small>{r.points} pts</small>
          <div className="step"><span>{p}</span></div>
        </button>
      ) : <div key={p} className={`pd p${p} vacio`}><span className="av none" style={{ width: 52, height: 52 }}>?</span><div className="step"><span>{p}</span></div></div>)}
    </div>
  );
}

function WeekCard({ state, rank }) {
  const mine = myWeekPoints(state);
  const start = weekStart();
  const trained = new Set(state.sessions.map((s) => new Date(s.date)).filter((d) => d >= start).map((d) => (d.getDay() + 6) % 7));
  const today = (new Date().getDay() + 6) % 7;
  const pct = Math.min(1, mine.points / RANK_MAX), R = 34, L = 2 * Math.PI * R;
  return (
    <div className="wkcard">
      <div className="wkring">
        <svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r={R} fill="none" stroke="var(--ln)" strokeWidth="7" />
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--ac)" strokeWidth="7" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - pct)} transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset 1s ease" }} /></svg>
        <div><b>{mine.points}</b><small>pts</small></div>
      </div>
      <div className="wkinfo">
        <span className="wkpos">{rank ? <>Vas <b>{rank}º</b> esta semana</> : "Esta semana"}</span>
        <div className="wkdays">{WEEK_LETTERS.map((l, i) => <span key={l} className={`${trained.has(i) ? "on" : ""}${i === today ? " today" : ""}`}>{l}</span>)}</div>
        <small>{mine.sessions} {mine.sessions === 1 ? "día entrenado" : "días entrenados"} · {mine.habitDays} de hábitos</small>
      </div>
    </div>
  );
}

function ProfileSheet({ nick, api, media, onClose, onReport, blocked }) {
  const [p, setP] = useState(undefined);
  useEffect(() => { let on = true; api.profile?.(nick).then((x) => on && setP(x || null)).catch(() => on && setP(null)); return () => { on = false; }; }, [nick]);
  const groups = useMemo(() => {
    if (!p?.week_ex) return [];
    const g = {};
    Object.entries(p.week_ex).forEach(([id, n]) => { const e = EXERCISES[EX_REMAP[id] || id]; if (e && e.group !== "Movilidad") g[e.group] = (g[e.group] || 0) + n; });
    return Object.entries(g).sort((a, b) => b[1] - a[1]);
  }, [p]);
  const maxG = groups[0]?.[1] || 1;
  const days = new Set(p?.week_days || []);
  return (
    <div className="modal" onClick={onClose}>
      <div className="box prof" onClick={(e) => e.stopPropagation()}>
        {p === undefined && <p className="sub" style={{ textAlign: "center", padding: 30 }}>Cargando perfil…</p>}
        {p === null && <p className="sub" style={{ textAlign: "center", padding: 30 }}>Este perfil ya no está disponible.</p>}
        {p && (
          <>
            <div className="prof-hd">
              <Avatar r={p} media={media} size={92} ring />
              <h1>{p.nickname}{p.is_me && <small> (tú)</small>}</h1>
              {levelLabel(p.branch, p.level, p.mode) && <span className="lvtag">{levelLabel(p.branch, p.level, p.mode)}</span>}
            </div>
            {p.private ? <div className="empty" style={{ marginTop: 16 }}>Este perfil es privado. Solo se ve su nivel y su puesto en el ranking.</div> : (
              <>
                <div className="mycard" style={{ marginTop: 16 }}>
                  <div><span>Días</span><b>{days.size}</b></div>
                  <div><span>Series</span><b>{p.week_sets}</b></div>
                  <div><span>Carga</span><b>{fmtKg(Number(p.week_volume) || 0)}</b></div>
                </div>
                <div className="wkdays big">{WEEK_LETTERS.map((l, i) => <span key={l} className={days.has(i + 1) ? "on" : ""}>{l}</span>)}</div>
                <h2>Músculos esta semana</h2>
                {groups.length ? groups.map(([g, n], i) => (
                  <div key={g} className="mbar"><span>{g}</span><div><i style={{ width: `${(n / maxG) * 100}%`, animationDelay: `${i * 0.06}s` }} /></div><b>{n}</b></div>
                )) : <p className="sub">Aún no ha entrenado esta semana.</p>}
                <h2>Últimas 8 semanas</h2>
                <div className="wk8">{(p.weeks || []).map((n, i, a) => <div key={i} title={`${n} días`}><i style={{ height: `${Math.max(6, (n / 7) * 100)}%`, opacity: i === a.length - 1 ? 1 : 0.55 }} /><small>{n}</small></div>)}</div>
                {p.last?.length > 0 && <>
                  <h2>Últimos entrenos</h2>
                  {p.last.map((s, i) => <div key={i} className="hist"><span>{s.name || "Entreno"}<small style={{ display: "block", color: "var(--dm)" }}>{relDay(s.at)} · {Math.round((s.dur || 0) / 60)} min</small></span><span>{s.sets} series · {fmtKg(Number(s.kg) || 0)}</span></div>)}
                </>}
                <p className="hint" style={{ marginTop: 12 }}>{p.total_sessions} entrenos en total</p>
              </>
            )}
            {!p.is_me && !blocked && <button className="link" style={{ marginTop: 14 }} onClick={() => onReport(p.nickname)}>Bloquear o denunciar</button>}
          </>
        )}
        <button className="btn" style={{ marginTop: 16 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function MyRankProfile({ me, api, media, state, onOpen }) {
  const [err, setErr] = useState("");
  const r = { nickname: me.nickname, avatar_url: me.pending || me.avatar, branch: state.profile?.branch, mode: state.profile?.mode, level: state.savedLevel || 0 };
  return (
    <div className="myprof">
      <button className="myprof-av" onClick={() => onOpen(me.nickname)} aria-label="Ver mi perfil"><Avatar r={r} media={media} size={54} ring /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{me.nickname}</b>
        {me.pending && <small className="pend">Foto en revisión: la verá el resto cuando la apruebe la coach</small>}
        <div className="chips" style={{ marginTop: 6 }}>
          <MediaPicker label={me.avatar || me.pending ? "Cambiar foto" : "Poner foto"} accept="image/*" onPick={(f) => api.setAvatar(f)} onError={setErr} />
          {(me.avatar || me.pending) && <button className="chip" onClick={() => api.setAvatar(null).catch(() => setErr("No se ha podido quitar."))}>Quitar</button>}
          <button className={`chip ${me.isPublic ? "on" : ""}`} onClick={() => api.setPublic(!me.isPublic).catch(() => setErr("No se ha podido guardar."))}>{me.isPublic ? "Perfil visible" : "Perfil privado"}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}

// Premios y sorteos del ranking (los anuncia Luna en Instagram). Texto editable por la coach.
const PRIZE_DEFAULT = "Las primeras del ranking entran en los premios y sorteos que anunciamos en Instagram. ¡Atenta a las historias!";
function PrizeCard({ media, coach, setMedia, onRules }) {
  const text = media["rank:prize"] || PRIZE_DEFAULT;
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(text);
  return (
    <div className="prize">
      <div className="prize-hd"><span className="prize-ic">★</span><b>Premios y sorteos</b></div>
      {edit ? (
        <>
          <textarea className="in" rows={3} value={val} onChange={(e) => setVal(e.target.value)} />
          <div className="chips" style={{ marginTop: 8 }}>
            <button className="chip on" onClick={() => { setMedia?.("rank:prize", val.trim() || null); setEdit(false); }}>Guardar</button>
            <button className="chip" onClick={() => { setVal(text); setEdit(false); }}>Cancelar</button>
          </div>
        </>
      ) : <p>{text}</p>}
      <div className="prize-links">
        <a href={`https://instagram.com/${APP_IG}`} target="_blank" rel="noopener noreferrer">Ver en @{APP_IG}</a>
        <button className="inlink" onClick={onRules}>Bases</button>
        {coach && !edit && <button className="inlink" onClick={() => setEdit(true)}>Editar texto</button>}
      </div>
      <small>Apple no patrocina ni participa de ninguna forma en estos premios ni sorteos. Participar es gratis y no hace falta comprar nada.</small>
    </div>
  );
}

function Ranking({ me, state, api, media = {}, blocked = [], onBlock, onUnblockAll, coach = false, setMedia }) {
  const [board, setBoard] = useState(null);
  const [last, setLast] = useState(null);
  const [err, setErr] = useState("");
  const [nick, setNick] = useState(me.nickname || "");
  const [nickErr, setNickErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [report, setReport] = useState(null);
  const [sent, setSent] = useState("");
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null);
  const [party, setParty] = useState("");
  const [legalDoc, setLegalDoc] = useState(null);
  const legalView = legalDoc && (
    <div className="rk-legal" role="dialog" aria-label="Normas de la comunidad">
      <div className="rk-legal-top"><button className="link" onClick={() => setLegalDoc(null)}>Cerrar</button></div>
      <iframe title="Normas y bases" src={legalDoc === "terminos-premios" ? "/terminos.html#premios" : `/${legalDoc}.html#normas`} />
    </div>
  );

  const load = async () => {
    setErr("");
    try { const [b, l] = await Promise.all([api.load(0), api.load(1)]); setBoard(b); setLast(l.filter((r) => r.rank <= 3)); }
    catch (e) { setErr("No se ha podido cargar el ranking. Revisa tu conexión."); }
  };
  useEffect(() => { if (me.optIn) load(); }, [me.optIn, state.sessions.length, me.avatar]);

  // Confeti si has subido puestos desde la última vez que miraste
  const myRank = board?.find((r) => r.is_me)?.rank;
  useEffect(() => {
    if (!myRank) return;
    const k = `arc-rank-${dkey(weekStart())}`, prev = Number(store.get(k)) || 0;
    if (prev && myRank < prev) { setParty(myRank === 1 ? "¡Estás la primera de la semana!" : `¡Has subido al ${myRank}º puesto!`); setTimeout(() => setParty(""), 2800); }
    store.set(k, String(myRank));
  }, [myRank]);

  useEffect(() => {
    if (q.trim().length < 2 || !api.search) { setFound(null); return; }
    const t = setTimeout(() => api.search(q.trim()).then((r) => setFound(r.filter((x) => x.is_me || !blocked.includes(x.nickname)))).catch(() => setFound([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const start = weekStart(), end = new Date(start); end.setDate(end.getDate() + 6);
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);

  const join = async () => {
    const e = checkNickname(nick); if (e) return setNickErr(e);
    setBusy(true); setNickErr("");
    try { await api.join(nick.trim()); setEditing(false); }
    catch (e) { setNickErr(/duplicate|unique|23505/i.test(e.message || e.code || "") ? "Ese nombre ya lo tiene otra persona." : "No se ha podido guardar. Vuelve a intentarlo."); }
    finally { setBusy(false); }
  };

  if (!me.optIn || editing) return (
    <>
      <h1>Ranking semanal</h1>
      <div className="rk-hero">
        <div className="rk-hero-pod"><span className="b2" /><span className="b1"><Crown size={30} /></span><span className="b3" /></div>
        <p>Cada lunes empieza de cero. Gana la constancia, no los kilos.</p>
      </div>
      <p className="sub">Sumas {RANK_POINTS.session} puntos por cada día que entrenas y {RANK_POINTS.habitDay} por cada día que cumples tus hábitos. Puedes poner foto, ver el perfil del resto y buscar a tu gente.</p>
      <div className="note" style={{ marginTop: 0, marginBottom: 18 }}>Se verá tu apodo, tu nivel, tus días entrenados y tus series de la semana. Nunca tu peso, tus medidas ni tus fotos de progreso. Puedes poner tu perfil privado cuando quieras.</div>
      <div className="field"><label>Tu apodo en el ranking</label>
        <input className="in" maxLength={20} placeholder="Por ejemplo: luna_lifts" value={nick} onChange={(e) => { setNick(e.target.value); setNickErr(""); }} />
        {nickErr && <div className="err">{nickErr}</div>}
      </div>
      <button className="btn ac" disabled={busy || !nick.trim()} onClick={join}>{busy ? "Un momento…" : me.optIn ? "Guardar apodo" : "Unirme al ranking"}</button>
      <p className="hint" style={{ textAlign: "center" }}>Al unirte aceptas las <button className="inlink" onClick={() => setLegalDoc("terminos")}>normas de la comunidad</button>: nada de contenido ofensivo. Se puede denunciar y bloquear a cualquiera.</p>
      {editing && <button className="btn ghost" onClick={() => setEditing(false)}>Cancelar</button>}
      {legalView}
    </>
  );

  const rows = board?.filter((r) => r.is_me || !blocked.includes(r.nickname)) || [];
  const rest = rows.slice(3);

  return (
    <>
      {party && <><Confetti /><div className="toast">{party}</div></>}
      <h1>Ranking semanal</h1>
      <p className="sub">Del {fmtDay(start)} al {fmtDay(end)} · se reinicia en {daysLeft} {daysLeft === 1 ? "día" : "días"}</p>

      <WeekCard state={state} rank={myRank} />
      <PrizeCard media={media} coach={coach} setMedia={setMedia} onRules={() => setLegalDoc("terminos-premios")} />

      <div className="rk-search">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        <input placeholder="Buscar perfiles por apodo" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button aria-label="Borrar" onClick={() => setQ("")}>✕</button>}
      </div>
      {found && (
        <div className="rk-found">
          {found.length === 0 ? <p className="sub" style={{ margin: "8px 4px" }}>No hay nadie con ese apodo.</p> : found.map((r) => (
            <button key={r.nickname} className="rkrow" onClick={() => setOpen(r.nickname)}>
              <Avatar r={r} media={media} size={36} />
              <span className="who">{r.nickname}{r.is_me && " (tú)"}<small>{levelLabel(r.branch, r.level, r.mode)}</small></span>
              <span className="go">›</span>
            </button>
          ))}
        </div>
      )}

      {err && <><div className="err">{err}</div><button className="btn ghost" onClick={load}>Reintentar</button></>}
      {!board && !err && <div className="podium sk"><div /><div /><div /></div>}
      {board && !found && (
        <>
          <Podium rows={rows} media={media} onOpen={setOpen} />
          {rows.length <= 1 && <div className="empty">Esta semana aún no hay nadie más. ¡Tienes la corona a tiro!</div>}
          <div className="rk-list">
            {rest.map((r, i) => (
              <div key={r.nickname} className={`rkrow ${r.is_me ? "me" : ""}`} style={{ animationDelay: `${0.35 + i * 0.04}s` }}>
                <span className="pos">{r.rank}</span>
                <button className="rk-open" onClick={() => setOpen(r.nickname)}>
                  <Avatar r={r} media={media} size={38} />
                  <span className="who">{r.nickname}{r.is_me && " (tú)"}<small>{levelLabel(r.branch, r.level, r.mode)}{r.days ? ` · ${r.days} ${r.days === 1 ? "día" : "días"}` : ""}</small></span>
                </button>
                <b>{r.points}</b>
                {!r.is_me && <button className="dots" aria-label="Opciones" onClick={() => { setReport(r.nickname); setSent(""); }}>⋮</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {last?.length > 0 && !found && (
        <>
          <h2>Ganadoras de la semana pasada</h2>
          <div className="lastwin">{last.map((r) => <button key={r.nickname} onClick={() => setOpen(r.nickname)}><Avatar r={r} media={media} size={44} /><b>{r.rank}º</b><small>{r.nickname}</small></button>)}</div>
        </>
      )}

      <h2>Tu perfil</h2>
      <MyRankProfile me={me} api={api} media={media} state={state} onOpen={setOpen} />
      <p className="hint">Foto tuya o algo que te represente. Antes de que la vea el resto la revisa la coach. Nada de desnudos, violencia ni fotos de otras personas. Consulta las <button className="inlink" onClick={() => setLegalDoc("terminos")}>normas de la comunidad</button>.</p>

      <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
        <button className="link" onClick={() => { setNick(me.nickname || ""); setEditing(true); }}>Cambiar mi apodo</button>
        <button className="link" onClick={async () => { await api.leave(); }}>Dejar de salir en el ranking</button>
        {blocked.length > 0 && <button className="link" onClick={() => onUnblockAll?.()}>Desbloquear a todos ({blocked.length})</button>}
      </div>

      {legalView}
      {open && <ProfileSheet nick={open} api={api} media={media} blocked={blocked.includes(open)} onClose={() => setOpen(null)} onReport={(n) => { setOpen(null); setReport(n); setSent(""); }} />}

      {report && (
        <div className="modal" onClick={() => setReport(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <h1 style={{ fontSize: 20 }}>{report}</h1>
            {sent ? <p className="sub">{sent}</p> : <>
              <button className="btn ghost" onClick={() => { onBlock?.(report); setSent(`Has bloqueado a ${report}. Ya no lo verás en tu ranking.`); }}>Bloquear a {report}</button>
              <h2 style={{ marginTop: 14 }}>Denunciar</h2>
              <p className="sub">Lo revisará la coach y, si no cumple las normas, lo quitará del ranking.</p>
              {REPORT_REASONS.map((reason) => (
                <button key={reason} className="btn ghost" onClick={async () => {
                  try { await api.report(report, reason); setSent("Gracias. Lo revisaremos pronto."); } catch (e) { setSent("No se ha podido enviar. Inténtalo más tarde."); }
                }}>{reason}</button>
              ))}
            </>}
            <button className="btn" onClick={() => setReport(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ ANIMACIONES ============================ */

const Star = ({ size = 12, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill={color} /></svg>
);

// Al abrir la app: el logo aparece con un destello y se desvanece
function Splash({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1500); return () => clearTimeout(t); }, []);
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-glow" />
      <div className="splash-mark"><Logo height={88} /></div>
      <div className="splash-word">ARC</div>
    </div>
  );
}

// Al subir de nivel: pantalla completa con el personaje nuevo
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = 120 + (i % 3) * 30;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, d: 0.55 + (i % 4) * 0.08, s: 8 + (i % 3) * 5 };
});

// Al terminar un entreno: grito de ánimo con la foto que suba la coach (si sube varias, sale una al azar)
const FINISH_KEYS = ["finish:1", "finish:2", "finish:3", "finish:4", "finish:5"];
const FINISH_SHOUTS = [
  ["¡PLUS ULTRA!", "Hoy has ido más allá."],
  ["¡ENTRENO HECHO!", "Esto es lo que te separa de quien solo lo piensa."],
  ["¡ASÍ SE HACE!", "Un día más sumando en tu arco."],
  ["¡IMPARABLE!", "Mañana tu cuerpo te lo agradece. Hoy, descansa y come bien."],
];

function useCount(target, ms = 1000, delay = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(target); return; }
    const t = setTimeout(() => {
      const step = (now) => { if (!t0) t0 = now; const k = Math.min(1, (now - t0) / ms); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target]);
  return v;
}

function FinishScreen({ data, media, coach, uploadMedia, setMedia, onClose }) {
  const [seed] = useState(() => ({ r: Math.random(), shout: FINISH_SHOUTS[Math.floor(Math.random() * FINISH_SHOUTS.length)] }));
  const imgs = FINISH_KEYS.map((k) => media[k]).filter(Boolean);
  const [last, setLast] = useState(null); // la que acaba de subir la coach, para verla al momento
  const pick = { img: (last && media[last]) || imgs[Math.floor(seed.r * imgs.length)] || null, shout: seed.shout };
  const [err, setErr] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const vol = useCount(data.volume || 0), sets = useCount(data.sets || 0, 700), xp = useCount(data.xp || 0, 700);
  return (
    <div className="fin" role="dialog" aria-label="Entreno terminado">
      <div className="fin-rays" />
      <div className="fin-stage">
        {SPARKS.map((s, i) => <span key={i} className="lvup-spark" style={{ "--x": `${s.x}px`, "--y": `${s.y}px`, animationDelay: `${0.25 + s.d}s` }}><Star size={s.s} color={i % 2 ? "#fff" : "#D48B92"} /></span>)}
        {pick.img ? <div className="fin-img"><img src={pick.img} alt="" /></div> : <div className="fin-mark"><Logo height={70} /></div>}
      </div>
      <h1 className="fin-shout">{pick.shout[0]}</h1>
      <p className="fin-sub">{pick.shout[1]}</p>
      <div className="fin-stats">
        <div><b>{mmss(data.dur || 0)}</b><span>Tiempo</span></div>
        <div><b>{Math.round(sets)}</b><span>Series</span></div>
        <div><b>{Math.round(vol).toLocaleString("es-ES")}</b><span>Kg movidos</span></div>
        <div><b>+{Math.round(xp)}</b><span>XP</span></div>
      </div>
      {data.prs > 0 && <div className="fin-pr">{data.prs === 1 ? "¡Nuevo récord en 1 ejercicio!" : `¡Nuevos récords en ${data.prs} ejercicios!`}</div>}
      {coach && (
        <div className="fin-coach">
          <small>Modo coach: fotos de esta pantalla (sale una al azar)</small>
          <div className="slots">{FINISH_KEYS.map((k, i) => (
            <div key={k} className="slot">
              <button className="slot-img" onClick={() => media[k] && setLast(k)} aria-label={`Ver foto ${i + 1}`}>{media[k] ? <img src={media[k]} alt="" /> : <span>{i + 1}</span>}</button>
              <MediaPicker label={media[k] ? "Cambiar" : "Subir"} accept="image/*" onPick={async (f) => { await uploadMedia(k, f); setLast(k); }} onError={setErr} />
              {media[k] && <button className="chip" onClick={() => { setMedia(k, null); if (last === k) setLast(null); }}>Quitar</button>}
            </div>
          ))}</div>
          {err && <div className="err">{err}</div>}
        </div>
      )}
      {data.share && <button className="btn fin-share" onClick={() => setShareOpen(true)}>Compartir en historias</button>}
      <button className="btn ac fin-btn" onClick={onClose}>Seguir</button>
      {shareOpen && <ShareSheet session={data.share.session} prs={data.share.prs} levelImg={data.levelImg} nick={data.nick} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

/* ============================ COMPARTIR EN HISTORIAS ============================ */

// Se sustituye por el compartir nativo en la app; en el navegador comparte o descarga
let SHARE_IMPL = async (dataUrl, name) => {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] });
  const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click();
};

// Récords de una sesión frente a todo lo anterior: mejor serie (1RM estimado) de cada ejercicio
function prList(prevSessions, exercises) {
  const bestSet = (sets) => sets.filter((x) => x.done && x.type !== "W" && Number(x.kg) > 0 && Number(x.reps) > 0)
    .reduce((b, x) => (!b || epley(x.kg, x.reps) > epley(b.kg, b.reps) ? x : b), null);
  return exercises.map((e) => {
    if (EXERCISES[e.exId].unit) return null;
    const now = bestSet(e.sets || []);
    if (!now) return null;
    let prev = null, prevDate = null;
    prevSessions.forEach((s) => {
      const x = s.exercises.find((y) => y.exId === e.exId);
      const b = x && bestSet(x.sets || []);
      if (b && (!prev || epley(b.kg, b.reps) > epley(prev.kg, prev.reps))) { prev = b; prevDate = s.date; }
    });
    if (!prev || epley(now.kg, now.reps) <= epley(prev.kg, prev.reps)) return null;
    return { exId: e.exId, kg: Number(now.kg), reps: Number(now.reps), prevKg: Number(prev.kg), prevDate };
  }).filter(Boolean);
}

const SHARE_FONT = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const shareDate = (d) => new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "").toUpperCase();
function spaced(ctx, text, x, y, sp, align = "left") {
  const chars = [...text]; const w = chars.reduce((a, c) => a + ctx.measureText(c).width + sp, -sp);
  let cx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + sp; });
  return w;
}
function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = []; let cur = "";
  words.forEach((w) => { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
function cover(ctx, img, W, H) {
  const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2.6, w, h);
}

// Dibuja la tarjeta 1080x1920 (formato historia) y devuelve un PNG en base64
async function drawShareCard({ kind, session, pr, bg, photo, levelImg, nick }) {
  const W = 1080, H = 1920, PINK = "#D48B92", DIM = "rgba(255,255,255,.62)", GREEN = "#6EE7B7";
  try { await Promise.all([document.fonts?.load(`800 90px ${SHARE_FONT}`), document.fonts?.load(`600 30px ${SHARE_FONT}`)]); } catch (e) { /* fuente del sistema */ }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#050506"; x.fillRect(0, 0, W, H);
  const bgImg = await loadImg(bg === "foto" ? photo : bg === "personaje" ? levelImg : null);
  const logo = await loadImg("/logo-mark.png");
  if (bgImg) {
    cover(x, bgImg, W, H);
    let g = x.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, "rgba(0,0,0,.65)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, 520);
    g = x.createLinearGradient(0, 860, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.45, "rgba(0,0,0,.78)"); g.addColorStop(1, "rgba(0,0,0,.95)"); x.fillStyle = g; x.fillRect(0, 860, W, H - 860);
  } else {
    const g = x.createRadialGradient(W / 2, 640, 40, W / 2, 640, 760); g.addColorStop(0, "rgba(212,139,146,.38)"); g.addColorStop(1, "rgba(212,139,146,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (logo) { x.globalAlpha = .09; const lw = 760, lh = logo.height * lw / logo.width; x.drawImage(logo, (W - lw) / 2, 620 - lh / 2, lw, lh); x.globalAlpha = 1; }
  }
  // cabecera
  if (logo) { const lw = 74, lh = logo.height * lw / logo.width; x.drawImage(logo, 72, 118 - lh / 2, lw, lh); }
  x.fillStyle = "#fff"; x.textBaseline = "middle"; x.font = `800 46px ${SHARE_FONT}`; x.fillText("ARC", 162, 120);
  const aw = x.measureText("ARC").width;
  x.fillStyle = DIM; x.font = `500 30px ${SHARE_FONT}`; x.fillText("by Lunarovx", 162 + aw + 16, 122);
  x.font = `600 28px ${SHARE_FONT}`; spaced(x, shareDate(kind === "pr" ? session.date || new Date() : session.date), W - 72, 122, 4, "right");
  x.textBaseline = "alphabetic";

  const L = 72, R = W - 72;
  const stat = (label, value, unit, cx, y, color = "#fff") => {
    x.fillStyle = DIM; x.font = `600 26px ${SHARE_FONT}`; spaced(x, label, cx, y, 4);
    x.fillStyle = color; x.font = `800 88px ${SHARE_FONT}`; x.fillText(value, cx, y + 98);
    const vw = x.measureText(value).width; x.font = `700 34px ${SHARE_FONT}`; x.fillText(unit, cx + vw + 8, y + 98);
  };
  const cols = [L, L + 400, L + 640];
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (kind === "pr") {
    // sello "NUEVO PR"
    x.save(); x.translate(L + 14, 1040); x.rotate(-0.07);
    x.font = `800 58px ${SHARE_FONT}`; const sw = x.measureText("NUEVO PR").width + 72;
    x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, 0, sw, 104);
    x.strokeStyle = PINK; x.lineWidth = 6; x.strokeRect(0, 0, sw, 104); x.lineWidth = 2; x.strokeRect(11, 11, sw - 22, 82);
    x.fillStyle = PINK; x.textBaseline = "middle"; x.fillText("NUEVO PR", 36, 54); x.textBaseline = "alphabetic"; x.restore();
    let y = 1250;
    x.fillStyle = PINK; x.beginPath(); x.arc(L + 9, y - 10, 9, 0, 7); x.fill(); x.font = `700 30px ${SHARE_FONT}`; spaced(x, "NUEVO RÉCORD", L + 34, y, 5);
    x.fillStyle = "#fff"; x.font = `800 84px ${SHARE_FONT}`;
    const lines = wrap(x, EXERCISES[pr.exId].n, R - L); y += 96; lines.forEach((l) => { x.fillText(l, L, y); y += 92; });
    y += 4; x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(L, y, R - L, 2); y += 56;
    stat("PESO", String(pr.kg).replace(".", ","), "kg", L, y);
    stat("REPS", String(pr.reps), "", cols[1], y);
    const gain = Math.round((pr.kg - pr.prevKg) * 10) / 10;
    stat(pr.prevDate ? `VS ${new Date(pr.prevDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "").toUpperCase()}` : "ANTES", gain > 0 ? `+${String(gain).replace(".", ",")}` : `${pr.reps}r`, gain > 0 ? "kg" : "", cols[2], y, GREEN);
  } else {
    const prs = session.prs || 0;
    let y = 1190 - (session.top?.length && !bgImg ? 0 : 0);
    if (!bgImg && session.top?.length) {
      x.font = `600 34px ${SHARE_FONT}`; let ty = 800;
      session.top.slice(0, 4).forEach((t) => { x.fillStyle = "#fff"; x.fillText(t.name, L, ty); x.fillStyle = DIM; x.textAlign = "right"; x.fillText(t.detail, R, ty); x.textAlign = "left"; ty += 62; });
    }
    if (prs > 0) {
      const t = prs === 1 ? "1 NUEVO RÉCORD" : `${prs} NUEVOS RÉCORDS`; x.font = `800 30px ${SHARE_FONT}`;
      const tw = x.measureText(t).width + 90; x.fillStyle = PINK; x.beginPath(); x.roundRect(L, y - 120, tw, 64, 32); x.fill();
      x.fillStyle = "#000"; x.fillText("★ " + t, L + 26, y - 77);
    }
    x.fillStyle = PINK; x.beginPath(); x.arc(L + 9, y - 10, 9, 0, 7); x.fill(); x.font = `700 30px ${SHARE_FONT}`; spaced(x, "ENTRENO COMPLETADO", L + 34, y, 5);
    x.fillStyle = "#fff"; x.font = `800 92px ${SHARE_FONT}`;
    const lines = wrap(x, session.dayName || "Entreno", R - L); y += 104; lines.forEach((l) => { x.fillText(l, L, y); y += 98; });
    y += 4; x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(L, y, R - L, 2); y += 56;
    const vol = Math.round(session.volume || 0);
    stat("VOLUMEN", vol >= 100000 ? (vol / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) : num(vol), vol >= 100000 ? "t" : "kg", L, y);
    stat("SERIES", String(session.sets || 0), "", cols[1], y);
    stat("TIEMPO", String(Math.max(1, Math.round((session.dur || 0) / 60))), "min", cols[2], y);
  }
  // pie
  x.fillStyle = "#fff"; x.font = `800 32px ${SHARE_FONT}`; if (nick) spaced(x, nick.toUpperCase(), L, H - 120, 2);
  x.fillStyle = DIM; x.font = `600 28px ${SHARE_FONT}`; x.textAlign = "right"; x.fillText("@arcworkoutapp", R, H - 120); x.textAlign = "left";
  return c.toDataURL("image/png");
}

// Hoja para elegir tarjeta y fondo y compartirla (Instagram, WhatsApp, guardar en fotos…)
function ShareSheet({ session, prs = [], levelImg, nick, onClose }) {
  const [kind, setKind] = useState(prs.length ? "pr:0" : "resumen");
  const [photo, setPhoto] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tip, setTip] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!photo) return;
    let on = true; setUrl(null);
    const pr = kind.startsWith("pr:") ? prs[Number(kind.slice(3))] : null;
    drawShareCard({ kind: pr ? "pr" : "resumen", session, pr, bg: "foto", photo, levelImg, nick }).then((u) => on && setUrl(u)).catch(() => on && setErr("No se ha podido crear la imagen."));
    return () => { on = false; };
  }, [kind, photo]);
  const share = async () => {
    setBusy(true); setErr("");
    try { await SHARE_IMPL(url, `arc-${kind.replace(":", "-")}.png`); } catch (e) { if (!/cancel/i.test(e?.message || "")) setErr("No se ha podido compartir. Inténtalo otra vez."); }
    finally { setBusy(false); setTip(false); }
  };
  return (
    <div className="modal shr" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>Compartir en historias</h1>
        <div className="chips">
          <button className={`chip ${kind === "resumen" ? "on" : ""}`} onClick={() => setKind("resumen")}>Resumen del entreno</button>
          {prs.map((p, i) => <button key={p.exId} className={`chip ${kind === `pr:${i}` ? "on" : ""}`} onClick={() => setKind(`pr:${i}`)}>PR · {EXERCISES[p.exId].n}</button>)}
        </div>
        <button className="shr-prev" onClick={() => fileRef.current?.click()} aria-label={photo ? "Cambiar foto" : "Elegir tu foto"}>
          {photo ? (url ? <img src={url} alt="Vista previa de la tarjeta" /> : <span>Creando…</span>) : (
            <span className="shr-empty"><b>+</b>Elige tu foto<small>Una foto tuya entrenando o en el gym</small></span>
          )}
        </button>
        {photo && <button className="chip" style={{ display: "block", margin: "0 auto" }} onClick={() => fileRef.current?.click()}>Cambiar foto</button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          try { setPhoto(await readFile(f, 1400)); } catch (er) { setErr("No se ha podido abrir la foto."); }
        }} />
        <p className="hint">La imagen se crea en tu móvil y solo se comparte si tú lo eliges. No se sube a ningún sitio.</p>
        {err && <div className="err">{err}</div>}
        <button className="btn ac" disabled={(photo && !url) || busy} onClick={() => (photo ? setTip(true) : fileRef.current?.click())}>{busy ? "Un momento…" : photo ? "Compartir" : "Elige tu foto para compartir"}</button>
        <button className="btn" onClick={onClose}>Cerrar</button>
        {tip && (
          <div className="shr-tip" onClick={() => setTip(false)}>
            <div className="shr-tip-box" onClick={(e) => e.stopPropagation()}>
              <b>¡No te olvides de mencionar a @arcworkoutapp!</b>
              <p>Así podemos ver tu historia y repostearla.</p>
              <button className="btn ac" disabled={busy} onClick={share}>{busy ? "Un momento…" : "Vale, compartir"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Compartir pasos y "Mi día" (historia de 4 fotos) ---------- */
const fmtN = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function stepsWeekData(habits) {
  const L = ["D", "L", "M", "X", "J", "V", "S"];
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { l: L[d.getDay()], v: Number(habits[dkey(d)]?.steps) || 0 }; });
}
function drawBrand(x, W, y, size = 1) {
  return loadImg("/logo-mark.png").then((logo) => {
    x.save(); x.textBaseline = "middle";
    const lw = 54 * size, lh = logo ? logo.height * lw / logo.width : 0;
    x.font = `700 ${Math.round(28 * size)}px ${SHARE_FONT}`;
    const tw = x.measureText("@arcworkoutapp").width, total = (logo ? lw + 14 * size : 0) + tw;
    const pad = 18 * size, bx = W - total - pad * 2 - 40, bh = Math.max(lh, 34 * size) + pad * 1.2;
    x.fillStyle = "rgba(0,0,0,.55)"; x.beginPath(); x.roundRect(bx, y - bh / 2, total + pad * 2, bh, bh / 2); x.fill();
    let cx = bx + pad;
    if (logo) { x.drawImage(logo, cx, y - lh / 2, lw, lh); cx += lw + 14 * size; }
    x.fillStyle = "#fff"; x.fillText("@arcworkoutapp", cx, y + 1);
    x.restore();
  });
}
function drawStepsPanel(x, X, Y, W, H, { steps, week, goal, kind, compact }) {
  const PINK = "#D48B92", DIM = "rgba(255,255,255,.62)";
  const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, "#1b1216"); g.addColorStop(1, "#070708"); x.fillStyle = g; x.fillRect(X, Y, W, H);
  const rg = x.createRadialGradient(X + W, Y, 10, X + W, Y, W * 1.1); rg.addColorStop(0, "rgba(212,139,146,.45)"); rg.addColorStop(1, "rgba(212,139,146,0)"); x.fillStyle = rg; x.fillRect(X, Y, W, H);
  const s = compact ? 0.62 : 1, L = X + 60 * s, R = X + W - 60 * s;
  const avg = (() => { const v = week.filter((d) => d.v > 0); return v.length ? v.reduce((a, d) => a + d.v, 0) / v.length : 0; })();
  const big = kind === "semana" ? avg : steps;
  let y = Y + H * (compact ? 0.2 : 0.36);
  x.fillStyle = PINK; x.font = `700 ${Math.round(30 * s)}px ${SHARE_FONT}`; spaced(x, kind === "semana" ? "PASOS · MEDIA SEMANAL" : "PASOS DE HOY", L, y, 5 * s);
  y += 150 * s; x.fillStyle = "#fff"; x.font = `800 ${Math.round(170 * s)}px ${SHARE_FONT}`; x.fillText(fmtN(big), L, y);
  y += 60 * s; x.fillStyle = DIM; x.font = `600 ${Math.round(32 * s)}px ${SHARE_FONT}`;
  x.fillText(big >= goal ? "Meta cumplida" : `${Math.min(99, Math.round((big / goal) * 100))}% de la meta de ${fmtN(goal)}`, L, y);
  // barra de progreso
  y += 40 * s; x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.roundRect(L, y, R - L, 16 * s, 8 * s); x.fill();
  x.fillStyle = PINK; x.beginPath(); x.roundRect(L, y, Math.max(16 * s, (R - L) * Math.min(1, big / goal)), 16 * s, 8 * s); x.fill();
  // barras de la semana
  const bh = (compact ? 230 : 420) * s / (compact ? 0.62 : 1) * (compact ? 0.62 : 1), by = Math.min(Y + H - 110 * s, y + 120 * s + bh);
  const max = Math.max(goal, ...week.map((d) => d.v)), bw = (R - L) / 7;
  x.strokeStyle = "rgba(255,255,255,.35)"; x.setLineDash([10 * s, 10 * s]); x.lineWidth = 2; x.beginPath(); const gy = by - bh * goal / max; x.moveTo(L, gy); x.lineTo(R, gy); x.stroke(); x.setLineDash([]);
  week.forEach((d, i) => {
    const h = Math.max(d.v ? 8 * s : 0, bh * d.v / max), bx = L + i * bw + bw * 0.18;
    x.fillStyle = d.v >= goal ? PINK : i === 6 ? "#fff" : "rgba(255,255,255,.35)"; x.beginPath(); x.roundRect(bx, by - h, bw * 0.64, h, 10 * s); x.fill();
    x.fillStyle = i === 6 ? "#fff" : DIM; x.font = `${i === 6 ? 800 : 600} ${Math.round(26 * s)}px ${SHARE_FONT}`; x.textAlign = "center"; x.fillText(d.l, bx + bw * 0.32, by + 44 * s); x.textAlign = "left";
  });
}
async function drawStepsCard({ kind, steps, week, goal, photo, nick }) {
  const W = 1080, H = 1920;
  try { await document.fonts?.load(`800 90px ${SHARE_FONT}`); } catch (e) { /* fuente del sistema */ }
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  if (photo) {
    const img = await loadImg(photo); x.fillStyle = "#000"; x.fillRect(0, 0, W, H); if (img) cover(x, img, W, H * 0.55);
    const g = x.createLinearGradient(0, H * 0.4, 0, H * 0.58); g.addColorStop(0, "rgba(5,5,6,0)"); g.addColorStop(1, "#070708"); x.fillStyle = g; x.fillRect(0, H * 0.4, W, H * 0.18);
    drawStepsPanel(x, 0, H * 0.55, W, H * 0.45, { steps, week, goal, kind, compact: true });
  } else drawStepsPanel(x, 0, 0, W, H, { steps, week, goal, kind });
  await drawBrand(x, W, 120, 1);
  if (nick) { x.font = `800 30px ${SHARE_FONT}`; x.textBaseline = "middle"; const t = nick.toUpperCase(), w = [...t].reduce((a, ch) => a + x.measureText(ch).width + 2, 0); x.fillStyle = "rgba(0,0,0,.55)"; x.beginPath(); x.roundRect(52, 92, w + 40, 60, 30); x.fill(); x.fillStyle = "#fff"; spaced(x, t, 72, 122, 2); x.textBaseline = "alphabetic"; }
  return c.toDataURL("image/png");
}
// Historia "Mi día": cuatro fotos en cuadrícula y los pasos del día en el centro
const DAY_SLOTS = [["food", "Comida", "Tu desayuno, tu táper o esa receta nueva"], ["free", "Lo que quieras", "La serie que estás viendo, tu escritorio o tu outfit"], ["gym", "Gym / pump", "Foto del pump, tu máquina favorita o el espejo"], ["more", "Otra foto", "Otra comida, un paseo o tu rest day"]];
// Entreno de hoy (el último que terminaste hoy) en versión mini para la historia
function todayWorkout(sessions = []) {
  const t = new Date().toDateString();
  const s = [...sessions].reverse().find((x) => new Date(x.date).toDateString() === t);
  if (!s) return null;
  const groups = [...new Set((s.exercises || []).map((e) => EXERCISES[e.exId]?.group).filter(Boolean))].slice(0, 3);
  const done = (s.exercises || []).reduce((a, e) => a + (e.sets || []).filter((x) => x.done !== false).length, 0);
  return { name: s.dayName || "Entreno", groups, volume: Math.round(s.volume || 0), sets: s.sets || done, min: Math.round((s.dur || 0) / 60) };
}
function drawWorkoutTile(x, wk, px, py, cw, ch) {
  // el bloque acaba por encima de la etiqueta de pasos del centro
  const L = px + 40, maxW = cw - 80, end = py + ch - 140;
  x.font = `800 48px ${SHARE_FONT}`;
  const words = wk.name.split(" "), lines = [""];
  for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (x.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); }
  const nl = lines.slice(0, 2); if (lines.length > 2) nl[1] = nl[1] + "…";
  const top = end - 66 - (wk.groups.length ? 44 : 0) - nl.length * 56 - 44;
  const g = x.createLinearGradient(0, top - 120, 0, end + 40);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.35, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,.9)");
  x.fillStyle = g; x.fillRect(px, top - 120, cw, py + ch - (top - 120));
  let y = top;
  x.fillStyle = "#D48B92"; x.font = `800 24px ${SHARE_FONT}`; spaced(x, "ENTRENO DE HOY", L, y, 3);
  x.fillStyle = "#fff"; x.font = `800 48px ${SHARE_FONT}`;
  for (const ln of nl) { y += 56; x.fillText(ln, L, y); }
  if (wk.groups.length) { y += 44; x.fillStyle = "rgba(255,255,255,.75)"; x.font = `600 26px ${SHARE_FONT}`; let gt = wk.groups.join(" · "); while (x.measureText(gt).width > maxW && gt.length > 4) gt = gt.slice(0, -2) + "…"; x.fillText(gt, L, y); }
  y += 66; const stats = [[fmtN(wk.volume), "kg"], [String(wk.sets), "series"], ...(wk.min ? [[String(wk.min), "min"]] : [])];
  let sx = L;
  for (const [v, u] of stats) {
    x.fillStyle = "#fff"; x.font = `800 42px ${SHARE_FONT}`; x.fillText(v, sx, y); const vw = x.measureText(v).width;
    x.fillStyle = "rgba(255,255,255,.7)"; x.font = `600 22px ${SHARE_FONT}`; x.fillText(" " + u, sx + vw, y);
    sx += vw + x.measureText(" " + u).width + 26;
  }
}
async function drawDayStory({ photos, steps, workout }) {
  const W = 1080, H = 1920, gap = 6, cw = (W - gap) / 2, ch = (H - gap) / 2;
  try { await document.fonts?.load(`800 90px ${SHARE_FONT}`); } catch (e) { /* fuente del sistema */ }
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const pos = [[0, 0], [cw + gap, 0], [0, ch + gap], [cw + gap, ch + gap]];
  for (let i = 0; i < 4; i++) {
    const [k] = DAY_SLOTS[i], [px, py] = pos[i];
    x.save(); x.beginPath(); x.rect(px, py, cw, ch); x.clip();
    x.fillStyle = "#111"; x.fillRect(px, py, cw, ch);
    const img = await loadImg(photos[k]);
    if (img) { const r = Math.max(cw / img.width, ch / img.height), w = img.width * r, h = img.height * r; x.drawImage(img, px + (cw - w) / 2, py + (ch - h) / 2, w, h); }
    if (workout && k === "free") drawWorkoutTile(x, workout, px, py, cw, ch);
    x.restore();
  }
  // pasos en el centro, como la etiqueta de Salud
  const date = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  x.font = `800 92px ${SHARE_FONT}`; const nw = x.measureText(fmtN(steps)).width;
  x.font = `600 38px ${SHARE_FONT}`; const uw = x.measureText(" pasos").width;
  const bw = nw + uw + 64, bh = 196, bx = (W - bw) / 2, by = (H - bh) / 2;
  x.fillStyle = "rgba(10,10,12,.82)"; x.beginPath(); x.roundRect(bx, by, bw, bh, 18); x.fill();
  x.fillStyle = "#D48B92"; x.fillRect(bx, by + 18, 5, bh - 36);
  x.fillStyle = "rgba(255,255,255,.7)"; x.font = `700 26px ${SHARE_FONT}`; spaced(x, "PASOS DE HOY", bx + 32, by + 46, 3);
  x.fillStyle = "#fff"; x.font = `800 92px ${SHARE_FONT}`; x.fillText(fmtN(steps), bx + 32, by + 136);
  x.fillStyle = "rgba(255,255,255,.75)"; x.font = `600 38px ${SHARE_FONT}`; x.fillText(" pasos", bx + 32 + nw, by + 136);
  x.fillStyle = "rgba(255,255,255,.6)"; x.font = `600 26px ${SHARE_FONT}`; x.fillText(date, bx + 32, by + 176);
  await drawBrand(x, W, H - 70, 0.85);
  return c.toDataURL("image/png");
}

function ShareTip({ busy, onShare, onClose }) {
  return (
    <div className="shr-tip" onClick={onClose}>
      <div className="shr-tip-box" onClick={(e) => e.stopPropagation()}>
        <b>¡No te olvides de mencionar a @arcworkoutapp!</b>
        <p>Así podemos ver tu historia y repostearla.</p>
        <button className="btn ac" disabled={busy} onClick={onShare}>{busy ? "Un momento…" : "Vale, compartir"}</button>
      </div>
    </div>
  );
}
function useShareImg(url, name) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [tip, setTip] = useState(false);
  const share = async () => {
    setBusy(true); setErr("");
    try { await SHARE_IMPL(url, name); } catch (e) { if (!/cancel/i.test(e?.message || "")) setErr("No se ha podido compartir. Inténtalo otra vez."); }
    finally { setBusy(false); setTip(false); }
  };
  return { busy, err, setErr, tip, setTip, share };
}
function PhotoInput({ inputRef, onPhoto, onErr }) {
  return <input ref={inputRef} type="file" accept="image/*" hidden onChange={async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { onPhoto(await readFile(f, 1400)); } catch (er) { onErr("No se ha podido abrir la foto."); }
  }} />;
}

function StepsShareSheet({ habits, nick, onClose, onDay }) {
  const [kind, setKind] = useState("dia");
  const [photo, setPhoto] = useState(null);
  const [url, setUrl] = useState(null);
  const ref = useRef(null);
  const week = stepsWeekData(habits), steps = week[6].v;
  const sh = useShareImg(url, `arc-pasos-${kind}.png`);
  useEffect(() => { let on = true; setUrl(null); drawStepsCard({ kind, steps, week, goal: RULES.STEPS_GOAL, photo, nick }).then((u) => on && setUrl(u)); return () => { on = false; }; }, [kind, photo]);
  return (
    <div className="modal shr" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>Compartir tus pasos</h1>
        <div className="chips"><button className={`chip ${kind === "dia" ? "on" : ""}`} onClick={() => setKind("dia")}>Hoy</button><button className={`chip ${kind === "semana" ? "on" : ""}`} onClick={() => setKind("semana")}>Esta semana</button></div>
        <div className="shr-prev">{url ? <img src={url} alt="Vista previa" /> : <span>Creando…</span>}</div>
        <div className="chips" style={{ justifyContent: "center" }}>
          <button className="chip" onClick={() => ref.current?.click()}>{photo ? "Cambiar foto" : "Añadir una foto arriba"}</button>
          {photo && <button className="chip" onClick={() => setPhoto(null)}>Sin foto</button>}
        </div>
        <PhotoInput inputRef={ref} onPhoto={setPhoto} onErr={sh.setErr} />
        {sh.err && <div className="err">{sh.err}</div>}
        <button className="btn ac" disabled={!url || sh.busy} onClick={() => sh.setTip(true)}>Compartir</button>
        {onDay && <button className="btn" onClick={onDay}>Mejor, mi día completo (4 fotos)</button>}
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
        {sh.tip && <ShareTip busy={sh.busy} onShare={sh.share} onClose={() => sh.setTip(false)} />}
      </div>
    </div>
  );
}

function DayStorySheet({ habits, sessions = [], onClose }) {
  const [photos, setPhotos] = useState({});
  const wk = useMemo(() => todayWorkout(sessions), [sessions]);
  const [withWk, setWithWk] = useState(!!wk);
  const workout = withWk && wk ? wk : null;
  const [slot, setSlot] = useState(null);
  const [url, setUrl] = useState(null);
  const ref = useRef(null);
  const week = stepsWeekData(habits), steps = week[6].v;
  const ready = DAY_SLOTS.every(([k]) => photos[k]);
  const sh = useShareImg(url, "arc-mi-dia.png");
  useEffect(() => { let on = true; setUrl(null); drawDayStory({ photos, steps, workout }).then((u) => on && setUrl(u)); return () => { on = false; }; }, [photos, withWk]);
  const pick = (k) => { setSlot(k); setTimeout(() => ref.current?.click(), 0); };
  return (
    <div className="modal shr" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>Tu día en una historia</h1>
        <p className="sub" style={{ margin: "-4px 0 10px" }}>Toca cada hueco para poner tu foto. Tus pasos de hoy van en el centro.</p>
        <div className="field" style={{ marginBottom: 10 }}><label>Arriba a la derecha</label>
          <div className="chips">
            <button className={`chip ${!workout ? "on" : ""}`} onClick={() => setWithWk(false)}>Foto libre</button>
            <button className={`chip ${workout ? "on" : ""}`} disabled={!wk} onClick={() => setWithWk(true)}>Mi entreno de hoy</button>
          </div>
          {!wk && <div className="hint">Cuando termines un entreno hoy, podrás ponerlo aquí con su volumen y una foto.</div>}
        </div>
        <div className="dgrid">
          {DAY_SLOTS.map(([k, label, ex]) => {
            const isWk = workout && k === "free";
            const lb = isWk ? "Foto de tu entreno" : label, exT = ex;
            return (
              <button key={k} className={`dslot ${photos[k] ? "has" : ""}`} onClick={() => pick(k)} aria-label={`Foto: ${lb}`}>
                {photos[k] ? <img src={photos[k]} alt="" /> : <span style={isWk ? { marginTop: "-40%" } : undefined}><b>+</b>{lb}{!isWk && <em className="dex">{exT}</em>}</span>}
                {isWk && <span className="dwk"><small>Entreno de hoy</small><b>{workout.name}</b><em>{fmtN(workout.volume)} kg · {workout.sets} series{workout.min ? ` · ${workout.min} min` : ""}</em></span>}
              </button>
            );
          })}
          <div className="dbadge" aria-hidden="true"><small>Pasos de hoy</small><b>{fmtN(steps)}<em> pasos</em></b></div>
        </div>
        <PhotoInput inputRef={ref} onPhoto={(u) => setPhotos((p) => ({ ...p, [slot]: u }))} onErr={sh.setErr} />
        {ready && url && <div className="shr-prev" style={{ marginTop: 12 }}><img src={url} alt="Vista previa de tu historia" /></div>}
        <p className="hint">La imagen se crea en tu móvil y solo se comparte si tú lo eliges.</p>
        {sh.err && <div className="err">{sh.err}</div>}
        <button className="btn ac" disabled={!ready || !url || sh.busy} onClick={() => sh.setTip(true)}>{ready ? "Compartir" : "Pon las 4 fotos para compartir"}</button>
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
        {sh.tip && <ShareTip busy={sh.busy} onShare={sh.share} onClose={() => sh.setTip(false)} />}
      </div>
    </div>
  );
}
// Botón de "Mi día" para la pantalla principal y Hábitos
function DayStoryCard({ onOpen }) {
  return (
    <button className="dcard" onClick={onOpen}>
      <span className="dcard-ic" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="dcard-t"><b>Crea tu historia del día</b><small>4 fotos de tu día con tus pasos en el centro. Lista para Instagram.</small></span>
      <span className="dcard-go" aria-hidden="true">›</span>
    </button>
  );
}

const ShareIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
);
// Datos para la tarjeta a partir de una sesión guardada
function shareDataFor(session, allSessions) {
  const prev = allSessions.filter((s) => s.date < session.date);
  const prs = prList(prev, session.exercises || []);
  const top = (session.exercises || []).map((e) => {
    const done = (e.sets || []).filter((x) => x.done && x.type !== "W");
    if (!done.length) return null;
    const best = done.reduce((b, x) => ((Number(x.kg) || 0) > (Number(b.kg) || 0) ? x : b), done[0]);
    const vol = done.reduce((a, x) => a + (Number(x.kg) || 0) * (Number(x.reps) || 0), 0);
    const unit = EXERCISES[e.exId].unit;
    return { name: EXERCISES[e.exId].n, vol, detail: unit ? `${done.length} × ${best.reps} ${unit}` : `${done.length} × ${best.kg || 0} kg` };
  }).filter(Boolean).sort((a, b) => b.vol - a.vol);
  return { session: { ...session, prs: prs.length, top }, prs };
}

// Cuántos ejercicios superan su mejor 1RM estimado anterior
function countPRs(prevSessions, exercises) {
  const best = (sets) => Math.max(0, ...sets.filter((x) => x.done && x.type !== "W").map((x) => epley(x.kg, x.reps) || 0));
  return exercises.filter((e) => {
    if (EXERCISES[e.exId].unit) return false;
    const now = best(e.sets);
    if (!now) return false;
    const before = Math.max(0, ...prevSessions.map((s) => s.exercises.find((x) => x.exId === e.exId)).filter(Boolean).map((x) => best(x.sets)));
    return before > 0 && now > before;
  }).length;
}

function LevelUp({ data, onClose }) {
  const { from, to, line, img, idx, total, gymrat } = data;
  return (
    <div className="lvup" role="dialog" aria-label={`Has subido a ${to}`}>
      <div className="lvup-glow" />
      <div className="lvup-tag">Nivel {idx + 1} de {total}</div>
      <div className="lvup-from">{from}</div>
      <div className="lvup-stage">
        {SPARKS.map((s, i) => (
          <span key={i} className="lvup-spark" style={{ "--x": `${s.x}px`, "--y": `${s.y}px`, animationDelay: `${s.d}s` }}><Star size={s.s} color={i % 2 ? "#fff" : "#D48B92"} /></span>
        ))}
        <div className="lvup-img"><img src={img} alt="" /></div>
      </div>
      <h1 className="lvup-title">{gymrat ? "Tu rata ha evolucionado" : data.clasico ? "Has subido de nivel" : "Personaje desbloqueado"}</h1>
      <div className="lvup-name">{to}</div>
      <p className="lvup-line">{line}</p>
      <button className="btn ac lvup-btn" onClick={onClose}>Seguir entrenando</button>
    </div>
  );
}

// Detecta cuándo sube el nivel (por un entreno, por hábitos o por lo que sea) y lo enseña una sola vez
function useLevelUp(profile, ev, media, setProfile) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!profile || !ev || profile.mode === "simple") return;
    const seen = profile.seenLevel;
    const key = `${profile.mode || "otaku"}:${profile.branch}`;
    if (seen === undefined || profile.seenKey !== key) { setProfile({ seenLevel: ev.current, seenKey: key }); return; }
    if (ev.current > seen) {
      const L = levelsOf(profile.branch, profile.mode);
      setData({
        from: L[seen]?.name, to: L[ev.current].name, line: L[ev.current].line, idx: ev.current, total: L.length,
        gymrat: profile.mode === "gymrat", clasico: profile.mode === "clasico",
        img: mediaOr(media, levelKey(profile.branch, profile.mode, ev.current)) || AVATAR[profile.branch],
      });
      setProfile({ seenLevel: ev.current });
    } else if (ev.current < seen) setProfile({ seenLevel: ev.current });
  }, [ev?.current, profile?.mode, profile?.branch]);
  return [data, () => setData(null)];
}

/* ============================ BIENVENIDA (solo la primera vez) ============================ */

// Muro de fotos de recetas que se mueve solo (tutorial)
function FoodWall({ profile, media }) {
  const pics = byTaste(RECIPES, profile).map((r) => ({ src: recImg(media, r.id), name: r.name })).filter((x) => x.src);
  const n = RECIPES.length;
  if (!pics.length) return <p className="tour-p">Tienes {n} recetas que se ajustan solas a tus macros.</p>;
  const rows = [0, 1, 2].map((k) => { const r = pics.filter((_, i) => i % 3 === k); return r.length ? r : pics; });
  return (
    <>
      <div className="fwall" aria-hidden="true">
        {rows.map((r, k) => (
          <div key={k} className={`fwall-row ${k % 2 ? "rev" : ""}`} style={{ animationDuration: `${28 + k * 6}s` }}>
            {[...r, ...r].map((x, i) => <img key={i} src={x.src} alt="" loading="lazy" />)}
          </div>
        ))}
      </div>
      <p className="tour-p">{n} recetas reales que se ajustan solas a tus macros: tú eliges si quieres algo de 5 minutos o cocinar con calma.</p>
      <p className="tour-p dim">{profile.likes?.length ? "Te saldrán primero las que llevan lo que más te gusta." : "Puedes cambiar de plato en cada comida con un toque."}</p>
    </>
  );
}

function Tour({ profile, ev, heroImg, perms, onFinish, media = {} }) {
  const [i, setI] = useState(0);
  const male = profile.branch === "male";
  const gymrat = profile.mode === "gymrat";
  const L = levelsOf(profile.branch, profile.mode);
  const lv = L[ev.current];
  const next = L[ev.current + 1];
  const slides = [
    {
      title: `${male ? "Bienvenido" : "Bienvenida"} a tu arco`,
      body: <>
        <p className="tour-p">Aquí no subes de nivel por abrir la app.</p>
        <p className="tour-p">Subes por lo que levantas, por los meses que llevas sin parar y por no fallarte día tras día.</p>
      </>,
    },
    {
      title: `Empiezas como ${lv.name}`,
      img: heroImg,
      body: <>
        <p className="tour-p">{lv.line}</p>
        {next && <p className="tour-p dim">{gymrat ? "Tu siguiente fase" : profile.mode === "clasico" ? "Tu siguiente nivel" : "Tu siguiente personaje"}: <b>{next.name}</b>. En Inicio verás exactamente qué te falta.</p>}
      </>,
    },
    {
      title: "Cómo se sube",
      body: (
        <div className="tour-list">
          <div><b>Fuerza</b><span>Apunta tus series de sentadilla y peso muerto{male ? " y press banca" : ""}. La app calcula tu fuerza con tu peso.</span></div>
          <div><b>Meses sin parar</b><span>Si paras más de 3 semanas, la cuenta vuelve a empezar.</span></div>
          <div><b>Hábitos</b><span>Pasos, agua y sueño. Con 2 de 3 el día cuenta como cumplido.</span></div>
          <div><b>Dominadas (extra)</b><span>No hacen falta para subir, pero suman en tus skills.</span></div>
        </div>
      ),
    },
    {
      title: "Comer bien, sin dieta triste",
      wide: true,
      body: <FoodWall profile={profile} media={media} />,
    },
    {
      title: "Tus entrenos",
      body: (
        <div className="tour-list">
          <div><b>Tu rutina, hecha para ti</b><span>En Entrenos ves qué te toca hoy y tu semana. Puedes cambiar los días o apuntar tu propia rutina.</span></div>
          <div><b>Apunta cada serie</b><span>Kilos, repeticiones y RIR (las que te quedaban en la recámara), con temporizador de descanso.</span></div>
          <div><b>Te avisa cuando toca subir</b><span>Si te sobran repeticiones, ARC te dice que subas peso y te marca tus récords.</span></div>
          <div><b>Técnica en vídeo</b><span>Toca un ejercicio para verlo grabado en el gym, con una explicación sencilla y un truquito.</span></div>
        </div>
      ),
    },
    {
      title: "Tus comidas",
      body: (
        <div className="tour-list">
          <div><b>Calorías y macros para ti</b><span>Arriba ves lo que te queda del día. Cambia entre día de entreno y de descanso.</span></div>
          <div><b>Recetas a tu medida</b><span>Las cantidades ya están ajustadas. ¿No te apetece? Toca «Otra receta».</span></div>
          <div><b>Apunta lo que comes</b><span>«Me la he comido» y, si comiste otra cantidad, «Cambiar cantidades». Los picoteos también cuentan: apúntalos en «Picoteos y extras».</span></div>
          <div><b>Elige tu pan y tus productos</b><span>En las recetas con pan eliges cuál usas y se recalcula todo. Y tienes productos del Mercadona y consejos para hacer la compra.</span></div>
        </div>
      ),
    },
    {
      title: "Hábitos y compartir",
      body: (
        <div className="tour-list">
          <div><b>Pasos solos</b><span>Se leen del móvil (Salud en iPhone, Health Connect en Android). No se pueden escribir a mano.</span></div>
          <div><b>Agua y sueño</b><span>Con 2 de los 3 hábitos cumplidos, el día cuenta para tu racha.</span></div>
          <div><b>Presume tu progreso</b><span>Crea historias para Instagram con tus récords, tu entreno, tus pasos o tu día en cuatro fotos.</span></div>
          <div><b>Recordatorios y ranking</b><span>Te avisamos para entrenar o presumir tu día, y cada semana hay ranking: gana la constancia, no los kilos.</span></div>
        </div>
      ),
    },
    {
      title: profile.mode === "simple" ? "Hoy empiezas" : "Hoy empieza tu arco",
      body: <>
        <p className="tour-p">Tienes tu rutina en Entrenos, tus comidas ajustadas en Nutrición y un ranking semanal donde gana la constancia, no los kilos.</p>
        <p className="tour-p dim">El primer paso es el que más cuesta. Los demás ya vienen solos.</p>
      </>,
    },
  ];
  if (perms?.length) slides.push({
    title: "Dos permisos y listo",
    body: (
      <div className="tour-list">
        {perms.map((p) => (
          <div key={p.key}>
            <b>{p.title}</b>
            <span>{p.text}</span>
            {p.done
              ? <em className="tour-ok">{p.doneText}</em>
              : <button className="btn ghost" style={{ marginTop: 10 }} disabled={p.busy} onClick={p.onAsk}>{p.busy ? "Un momento…" : p.button}</button>}
            {p.error && <span className="err">{p.error}</span>}
          </div>
        ))}
        <p className="hint">Puedes cambiarlo cuando quieras en Ajustes.</p>
      </div>
    ),
  });
  if (profile.mode === "simple") {
    slides.splice(0, 3, { title: `${male ? "Bienvenido" : "Bienvenida"} a ARC`, body: <>
      <p className="tour-p">Aquí tienes tu rutina, tu registro de series y tus comidas ajustadas.</p>
      <p className="tour-p dim">Sin niveles ni personajes: solo tú, tus entrenos y tu progreso.</p>
    </> });
  }
  const s = slides[i];
  const last = i === slides.length - 1;
  return (
    <div className="tour">
      <div className="tour-dots" aria-hidden="true">{slides.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
      {s.img && <div className="hero" style={{ marginTop: 18, aspectRatio: "1/1" }}><img src={s.img} alt={lv.name} /></div>}
      <h1 className="tour-h">{s.title}</h1>
      {s.body}
      <div className="tour-actions">
        <button className="btn ac" onClick={() => (last ? onFinish() : setI(i + 1))}>{last ? "Empezar" : "Siguiente"}</button>
        {!last && <button className="link" onClick={() => setI(slides.length - 1)}>Saltar</button>}
      </div>
    </div>
  );
}

/* ============================ AJUSTES ============================ */

SHARE_IMPL = nativeShare; // compartir con la hoja nativa del móvil


const WEEK = [[2, "L"], [3, "M"], [4, "X"], [5, "J"], [6, "V"], [7, "S"], [1, "D"]];

function Reminders({ value, onChange }) {
  const r = { ...native.DEFAULT_REMINDERS, ...(value || {}) };
  const [err, setErr] = useState("");
  const save = async (next) => {
    setErr("");
    const anyOn = next.train.on || next.water.on || next.sunday.on || next.story?.on;
    if (anyOn && native.isNative && !(await native.notificationsAllowed(true))) {
      setErr("ARC no tiene permiso para avisarte. Actívalo en los ajustes del móvil, en Notificaciones.");
      return;
    }
    onChange(next);
    try { await native.applyReminders(next); } catch { setErr("No se han podido programar los avisos."); }
  };
  const toggle = (k) => save({ ...r, [k]: { ...r[k], on: !r[k].on } });
  const row = (k, title, sub) => (
    <div className="remrow">
      <span>{title}<small>{sub}</small></span>
      <button className={`switch ${r[k].on ? "on" : ""}`} role="switch" aria-checked={r[k].on} aria-label={title} onClick={() => toggle(k)}><i /></button>
    </div>
  );
  return (
    <>
      <h2>Recordatorios</h2>
      {!native.isNative && <p className="hint" style={{ marginTop: -4 }}>Puedes dejarlos elegidos aquí; los avisos llegan en la app instalada en el móvil.</p>}
      {row("train", "Días de entreno", "Un aviso a la hora que elijas")}
      {r.train.on && (
        <div style={{ padding: "4px 0 12px" }}>
          <div className="chips">{WEEK.map(([d, l]) => {
            const on = r.train.days.includes(d);
            return <button key={d} className={`chip ${on ? "on" : ""}`} style={{ minWidth: 40 }} onClick={() => save({ ...r, train: { ...r.train, days: on ? r.train.days.filter((x) => x !== d) : [...r.train.days, d] } })}>{l}</button>;
          })}</div>
          <input className="in" type="time" style={{ marginTop: 10, maxWidth: 140 }} value={r.train.time} onChange={(e) => save({ ...r, train: { ...r.train, time: e.target.value } })} />
        </div>
      )}
      {row("water", "Beber agua", "A las " + r.water.times.join(", ").replace(/, ([^,]*)$/, " y $1"))}
      {row("sunday", "Cierre del domingo", "Pesarte, ver tu ranking y planear la semana")}
      {r.sunday.on && <input className="in" type="time" style={{ margin: "4px 0 12px", maxWidth: 140 }} value={r.sunday.time} onChange={(e) => save({ ...r, sunday: { ...r.sunday, time: e.target.value } })} />}
      {row("story", "Presume tu día", "Te recuerda crear tu historia del día")}
      {r.story.on && (
        <div style={{ padding: "4px 0 12px" }}>
          <div className="chips">{WEEK.map(([d, l]) => {
            const on = r.story.days.includes(d);
            return <button key={d} className={`chip ${on ? "on" : ""}`} style={{ minWidth: 40 }} onClick={() => save({ ...r, story: { ...r.story, days: on ? r.story.days.filter((x) => x !== d) : [...r.story.days, d] } })}>{l}</button>;
          })}</div>
          <input className="in" type="time" style={{ marginTop: 10, maxWidth: 140 }} value={r.story.time} onChange={(e) => save({ ...r, story: { ...r.story, time: e.target.value } })} />
        </div>
      )}
      {err && <div className="err">{err}</div>}
    </>
  );
}

function Settings({ onTour, onClients, onPaywallPreview, videos, onFinishPreview, sub, email, isCoach, coachView, setCoachView, onEdit, onContent, onReports, reminders, setReminders, onSignOut, onResetData, onDeleteAccount, onClose }) {
  const [confirm, setConfirm] = useState(null); // "data" | "account"
  const [legal, setLegal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(`No se ha podido completar. Vuelve a intentarlo. (${e?.message || e?.code || e})`); } finally { setBusy(false); } };
  return (
    <>
      <h1>Ajustes</h1>
      <p className="sub">{email}</p>
      <button className="btn" onClick={onEdit}>Editar mis datos y preferencias</button>
      {onTour && <button className="btn ghost" onClick={onTour}>Ver cómo funciona ARC</button>}
      {isCoach && (
        <>
          <h2>Modo coach</h2>
          <p className="sub">Sube imágenes de cada personaje y vídeos de cada ejercicio. Solo lo ve tu cuenta.</p>
          <div className="seg">
            <button className={!coachView ? "on" : ""} onClick={() => setCoachView(false)}>Ver como clienta</button>
            <button className={coachView ? "on" : ""} onClick={() => setCoachView(true)}>Modo coach</button>
          </div>
          <button className="btn ac" onClick={onClients}>Mis asesorad@s</button>
          <button className="btn" onClick={onContent}>Editar frases, recetas, ejercicios y alimentos</button>
          <button className="btn ghost" onClick={onReports}>Denuncias del ranking</button>
          <h2>Fotos de la app</h2>
          <p className="sub">Las imágenes de los personajes se cambian en Inicio, en "El arco completo". Las fotos de las recetas y los vídeos de los ejercicios, en "Editar frases, recetas, ejercicios y alimentos".</p>
          <button className="btn ghost" onClick={onFinishPreview}>Pantalla de fin de entreno (fotos)</button>
          <button className="btn ghost" onClick={onPaywallPreview}>Pantalla de planes (memes)</button>
        </>
      )}
      <Reminders value={reminders} onChange={setReminders} />
      {videos && (
        <>
          <h2>Entreno</h2>
          <div className="remrow">
            <span>Vídeos de técnica<small>Se ven solos en cada ejercicio mientras entrenas</small></span>
            <button className={`switch ${videos.on ? "on" : ""}`} role="switch" aria-checked={videos.on} aria-label="Vídeos de técnica" onClick={() => videos.set(!videos.on)}><i /></button>
          </div>
        </>
      )}
      {sub && (
        <>
          <h2>Suscripción</h2>
          <p className="sub">{sub.premium ? "Tienes ARC completo." : "Estás en la versión gratis."}</p>
          {!sub.premium && <button className="btn ac" onClick={sub.open}>Ver planes</button>}
          {sub.premium && <a className="btn ghost" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={purchases.MANAGE_URL} target="_blank" rel="noreferrer">Gestionar suscripción</a>}
          <button className="btn ghost" disabled={sub.busy} onClick={sub.restore}>{sub.busy ? "Un momento…" : "Restaurar compras"}</button>
          {sub.msg && <div className="note">{sub.msg}</div>}
        </>
      )}
      <h2>Salud y privacidad</h2>
      <p className="hint">ARC da orientación general de entreno y alimentación. No es consejo médico ni sustituye a un profesional sanitario. Si tienes una lesión, una enfermedad o estás embarazada, consulta antes de empezar.</p>
      <p className="hint"><b>Apple Salud (HealthKit):</b> si lo conectas en Hábitos, ARC lee tus pasos diarios de la app Salud. Solo lectura: no escribe nada ni comparte tus datos. Puedes quitar el permiso en Ajustes del iPhone → Salud → Acceso a datos y dispositivos → ARC.</p>
      <Sources groups={["nutricion", "habitos", "entreno"]} />
      <div className="legal-links">
        <button className="inlink" onClick={() => setLegal("privacidad")}>Política de privacidad</button>
        <button className="inlink" onClick={() => setLegal("terminos")}>Términos de uso</button>
      </div>
      <style>{LEGAL_CSS}</style>
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
      <h2>Cuenta</h2>
      <button className="btn ghost" onClick={onSignOut}>Cerrar sesión</button>
      {confirm === null && <button className="btn ghost" onClick={() => setConfirm("data")}>Borrar mis datos</button>}
      {confirm === null && <button className="btn ghost" style={{ color: "#FCA5A5" }} onClick={() => setConfirm("account")}>Eliminar mi cuenta</button>}
      {confirm && (
        <div className="note">
          {confirm === "data" ? "Se borran tus entrenos, hábitos y respuestas del cuestionario. Tu cuenta sigue activa." : "Se elimina tu cuenta y todos tus datos para siempre. No se puede deshacer."}
          <button className="btn" style={{ background: "#FCA5A5" }} disabled={busy} onClick={() => go(confirm === "data" ? onResetData : onDeleteAccount)}>{busy ? "Un momento…" : confirm === "data" ? "Sí, borrar mis datos" : "Sí, eliminar mi cuenta"}</button>
          <button className="btn ghost" onClick={() => setConfirm(null)}>Cancelar</button>
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn ghost" style={{ marginTop: 24 }} onClick={onClose}>Volver</button>
      <SocialLinks />
      <p className="hint" style={{ textAlign: "center", fontSize: 11, opacity: 0.5 }}>ARC · versión del {typeof __BUILD__ !== "undefined" ? __BUILD__ : "—"}</p>
    </>
  );
}

function ReportAvatar({ nick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { db.avatarOf(nick).then(setUrl).catch(() => {}); }, [nick]);
  return url ? <img src={url} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", display: "block", marginTop: 8 }} /> : null;
}

function PendingAvatars() {
  const [list, setList] = useState(null);
  const load = () => db.pendingAvatars().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  if (!list?.length) return null;
  return (
    <>
      <h2>Fotos de perfil por revisar</h2>
      <p className="sub">No se ven en el ranking hasta que las apruebes.</p>
      {list.map((r) => (
        <div key={r.nickname} className="day" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <img src={r.avatar_pending} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }} />
          <div style={{ flex: 1 }}>
            <b>{r.nickname}</b>
            <div className="chips" style={{ marginTop: 8 }}>
              <button className="chip on" onClick={() => db.reviewAvatar(r.nickname, true).then(load)}>Aprobar</button>
              <button className="chip" onClick={() => db.reviewAvatar(r.nickname, false).then(load)}>Rechazar</button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function Reports({ onClose }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const load = () => db.listReports().then(setList).catch(() => setErr("No se han podido cargar."));
  useEffect(() => { load(); }, []);
  const act = async (fn) => { try { await fn(); load(); } catch (e) { setErr("No se ha podido completar."); } };
  return (
    <>
      <h1>Moderación del ranking</h1>
      <p className="sub">Si quitas a alguien, desaparece del ranking y pierde su apodo. Si solo es la foto, quítale la foto y sigue en el ranking.</p>
      {err && <div className="err">{err}</div>}
      <PendingAvatars />
      {list && list.length === 0 && <div className="empty">No hay denuncias pendientes.</div>}
      {list?.map((r) => (
        <div key={r.id} className="day">
          <div className="hd"><b>{r.nickname}</b><small>{new Date(r.created_at).toLocaleDateString("es-ES")}</small></div>
          <small>{r.reason}</small>
          <ReportAvatar nick={r.nickname} />
          <div className="chips" style={{ marginTop: 10 }}>
            <button className="chip" onClick={() => act(() => db.clearAvatar(r.nickname))}>Quitar su foto</button>
            <button className="chip" onClick={() => act(() => db.hideFromRanking(r.nickname))}>Quitar del ranking</button>
            <button className="chip" onClick={() => act(() => db.dismissReport(r.id))}>Está bien, ignorar</button>
          </div>
        </div>
      ))}
      <button className="btn ghost" style={{ marginTop: 20 }} onClick={onClose}>Volver</button>
    </>
  );
}

/* ============================ APP ============================ */

function Shell({ children }) {
  return (
    <div className="arc">
      <style>{CSS + EXTRA_CSS}</style>
      <div className="phone">
        <div className="top"><Logo /><b>ARC</b><span className="by">by Lunarovx</span></div>
        {children}
      </div>
    </div>
  );
}

const EXTRA_CSS = `
.remrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--ln);font-size:15px}
.remrow small{display:block;color:var(--dm);font-size:12px;margin-top:2px}
.switch{width:46px;height:28px;border-radius:999px;border:1px solid var(--ln);background:var(--sf2);position:relative;cursor:pointer;flex-shrink:0;padding:0}
.switch i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--dm);transition:left .2s}
.switch.on{background:var(--ac);border-color:var(--ac)}
.switch.on i{left:21px;background:#000}
.btn:disabled{opacity:.4;cursor:default}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--dm);margin-top:6px}
.consent input{margin-top:3px;accent-color:#D48B92}
.consent a{color:var(--tx)}
`;

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Shell><p className="sub">Cargando…</p></Shell>;
  if (recovery) return <Shell><NewPassword onDone={() => setRecovery(false)} /></Shell>;
  if (!session) return <Shell><Auth /></Shell>;
  return <ArcApp key={session.user.id} user={session.user} />;
}

const EMPTY = { onboarded: false, profile: null, sessions: [], habits: {}, xp: 0, gems: 0, active: null, role: "client" };

function fromDb({ profile, sessions, habits, coach }) {
  const fix = (m) => (m === "gymrat" ? "otaku" : m); // el modo gymrat ya no existe
  const forced = fix(coach?.mode || "");
  const base = profile.data ? { ...DEFAULT_PROFILE, ...profile.data, mode: fix(profile.data.mode || DEFAULT_PROFILE.mode), startDate: profile.start_date } : null;
  return {
    onboarded: profile.onboarded,
    profile: base && forced ? { ...base, ownMode: base.mode, mode: forced } : base,
    hasCoach: !!coach, coachMode: forced,
    sessions: sessions.map((s) => ({ id: s.id, date: s.performed_at, dayId: s.day_id, dayName: s.day_name, dur: s.duration_s, volume: Number(s.volume_kg), sets: s.sets_done, exercises: s.exercises })),
    habits: Object.fromEntries(habits.map((h) => [h.day, { water: h.water ?? undefined, steps: h.steps ?? undefined, sleep: h.sleep != null ? Number(h.sleep) : undefined, weight: h.weight != null ? Number(h.weight) : undefined, food: h.food || undefined }])),
    xp: profile.xp, gems: profile.gems, active: profile.active_session, role: profile.role,
    nickname: profile.nickname, rankOptIn: profile.rank_opt_in && !!profile.nickname, savedLevel: profile.level,
    avatar: profile.avatar_url || null, avatarPending: profile.avatar_pending || null, profilePublic: profile.profile_public !== false,
    coachRoutine: coach?.routine || null,
  };
}

/* ============================ SUSCRIPCIÓN ============================ */

const PAYWALL_KEYS = ["paywall:1", "paywall:2", "paywall:3"];
const PERKS = [
  "Tu rutina completa con registro de series y avisos de cuándo subir peso",
  "Comidas ajustadas a tus macros, en modo fácil o modo Sanji",
  "Tus músculos de la semana y el mapa del cuerpo",
  "El ranking semanal con tu apodo",
];

function Paywall({ media, coach, uploadMedia, setMedia, onClose, onPremium }) {
  const [plans, setPlans] = useState(null);
  const [sel, setSel] = useState("annual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [slide, setSlide] = useState(0);
  const [legal, setLegal] = useState(null);
  const memes = PAYWALL_KEYS.map((k) => media[k]).filter(Boolean);
  const [planErr, setPlanErr] = useState("");
  const loadPlans = () => {
    setPlans(null); setPlanErr("");
    purchases.getPlans().then((p) => {
      if (!p || (!p.annual && !p.monthly && !p.lifetime)) { setPlanErr("empty"); setPlans(false); return; }
      setPlans(p); if (!p.annual) setSel(p.monthly ? "monthly" : "lifetime");
    }).catch((e) => { setPlanErr(String(e?.message || e)); setPlans(false); });
  };

  useEffect(() => {
    loadPlans();
  }, []);
  useEffect(() => { if (memes.length < 2) return; const t = setInterval(() => setSlide((s) => (s + 1) % memes.length), 3500); return () => clearInterval(t); }, [memes.length]);

  const pkg = plans ? plans[sel] : null;
  const trial = purchases.freeTrialDays(pkg);
  const founder = plans?.id === "fundadora" || /fundadora/.test(plans?.annual?.product?.identifier || "");
  const perMonth = (p) => p?.product?.price ? (p.product.price / 12).toLocaleString("es-ES", { style: "currency", currency: p.product.currencyCode || "EUR" }) : "";
  const go = async (fn) => {
    setBusy(true); setErr("");
    try { const ok = await fn(); if (ok) onPremium(); else if (ok === false) setErr("La compra no se ha activado todavía. Espera unos segundos y dale a Restaurar compras."); }
    catch (e) { setErr("No se ha podido completar la compra. Inténtalo otra vez en un momento."); }
    finally { setBusy(false); }
  };
  const Plan = ({ k, title, p, sub, tag }) => p ? (
    <button className={`pw-plan ${sel === k ? "on" : ""}`} onClick={() => setSel(k)}>
      {tag && <em>{tag}</em>}
      <span><b>{title}</b><small>{sub}</small></span>
      <strong>{p.product.priceString}</strong>
    </button>
  ) : null;

  return (
    <div className="pw" role="dialog" aria-label="Planes de ARC">
      <div className="pw-hero">
        {memes.length ? memes.map((src, i) => <img key={src} src={src} alt="" className={i === slide ? "on" : ""} />) : <div className="pw-mark"><Logo height={64} /></div>}
      </div>
      {coach && (
        <div className="pw-coach">
          <small>Modo coach: memes de la cabecera (hasta 3)</small>
          <div className="slots" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{PAYWALL_KEYS.map((k, i) => (
            <div key={k} className="slot">
              <div className="slot-img" style={{ aspectRatio: "4/3" }}>{media[k] ? <img src={media[k]} alt="" /> : <span>{i + 1}</span>}</div>
              <MediaPicker label={media[k] ? "Cambiar" : "Subir"} accept="image/*" onPick={(f) => uploadMedia(k, f)} onError={setErr} />
              {media[k] && <button className="chip" onClick={() => setMedia(k, null)}>Quitar</button>}
            </div>
          ))}</div>
        </div>
      )}
      <h1 className="pw-title">Desbloquea todo tu arco</h1>
      <ul className="pw-perks">{PERKS.map((t) => <li key={t}>{t}</li>)}</ul>

      {plans === null && <p className="hint">Cargando planes…</p>}
      {plans === false && <>
        <div className="err">No se han podido cargar los planes. Revisa tu conexión e inténtalo otra vez.</div>
        <button className="btn ghost" onClick={loadPlans}>Reintentar</button>
        {planErr && <p className="hint" style={{ fontSize: 11, opacity: 0.6 }}>Detalle: {planErr === "empty" ? "no hay oferta activa en RevenueCat" : planErr}</p>}
      </>}
      {plans && (
        <div className="pw-plans">
          <Plan k="annual" title="Anual" p={plans.annual} sub={`${perMonth(plans.annual)} al mes${purchases.freeTrialDays(plans.annual) ? ` · ${purchases.freeTrialDays(plans.annual)} días gratis` : ""}`} tag={founder ? "Precio fundadora" : "El más elegido"} />
          <Plan k="monthly" title="Mensual" p={plans.monthly} sub={purchases.freeTrialDays(plans.monthly) ? `${purchases.freeTrialDays(plans.monthly)} días gratis` : "Cancela cuando quieras"} />
          <Plan k="lifetime" title="De por vida" p={plans.lifetime} sub="Un solo pago, para siempre" />
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn ac pw-cta" disabled={!pkg || busy} onClick={() => go(() => purchases.buy(pkg))}>
        {busy ? "Un momento…" : !pkg ? "Suscribirme" : sel === "lifetime" ? `Comprar de por vida · ${pkg.product.priceString}` : `${trial ? `${trial} días gratis, luego ` : ""}${pkg.product.priceString}/${sel === "annual" ? "año" : "mes"}`}
      </button>
      {pkg && (
        <p className="pw-fine">
          {sel === "lifetime"
            ? `Pago único de ${pkg.product.priceString}. Sin renovaciones.`
            : `${trial ? `Gratis ${trial} días y después ` : ""}${pkg.product.priceString} ${sel === "annual" ? "al año" : "al mes"}. Se renueva solo hasta que lo canceles en Ajustes del iPhone, al menos 24 horas antes de que acabe el periodo.`}
        </p>
      )}
      <div className="pw-links">
        <button className="inlink" disabled={busy} onClick={() => go(purchases.restore)}>Restaurar compras</button>
        <button className="inlink" onClick={() => setLegal("terminos")}>Términos</button>
        <button className="inlink" onClick={() => setLegal("privacidad")}>Privacidad</button>
      </div>
      <button className="link pw-free" onClick={onClose}>Seguir con la versión gratis</button>
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
    </div>
  );
}

const LOCKED = {
  entrenos: ["Tu rutina te está esperando", "Rutina por días, registro de series, avisos de cuándo subir peso y el mapa de tus músculos."],
  nutricion: ["Tus comidas, a tu medida", "Recetas fáciles o modo Sanji ajustadas a tus macros, con la lista de cantidades."],
  ranking: ["Compite cada semana", "Entra en el ranking semanal con tu apodo y suma puntos entrenando y cumpliendo hábitos."],
};
function Locked({ tab, onOpen }) {
  const [t, d] = LOCKED[tab];
  return (
    <div className="locked">
      <div className="locked-ic" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#D48B92" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </div>
      <h1>{t}</h1>
      <p className="sub">{d}</p>
      <button className="btn ac" onClick={onOpen}>Ver planes</button>
      <p className="hint" style={{ textAlign: "center" }}>En la versión gratis tienes tu nivel, tu personaje, la frase del día y tus hábitos.</p>
    </div>
  );
}

const PAYWALL_CSS = `
.pw{position:fixed;inset:0;z-index:35;background:#000;overflow-y:auto;padding:calc(env(safe-area-inset-top) + 14px) 20px calc(env(safe-area-inset-bottom) + 24px);display:flex;flex-direction:column;max-width:430px;margin:0 auto}
.pw-x{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:16px;z-index:2;background:rgba(0,0,0,.55);border:1px solid var(--ln);color:#fff;width:34px;height:34px;border-radius:50%;font-size:14px;cursor:pointer}
.pw-hero{position:relative;width:100%;aspect-ratio:4/3;border-radius:22px;overflow:hidden;background:var(--sf);border:1px solid var(--ln);flex-shrink:0}
.pw-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
.pw-hero img.on{opacity:1}
.pw-mark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 55%,rgba(212,139,146,.28),transparent 65%)}
.pw-coach{margin-top:10px}.pw-coach small{display:block;color:var(--dm);font-size:12px;margin-bottom:6px}
.pw-title{font-size:26px;margin:18px 0 8px}
.pw-perks{list-style:none;padding:0;margin:0 0 16px}
.pw-perks li{position:relative;padding:6px 0 6px 24px;font-size:14px;color:var(--dm);line-height:1.4}
.pw-perks li::before{content:"";position:absolute;left:2px;top:10px;width:12px;height:12px;border-radius:50%;background:var(--ac);box-shadow:0 0 0 3px rgba(212,139,146,.18)}
.pw-plans{display:flex;flex-direction:column;gap:8px}
.pw-plan{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--sf);border:1.5px solid var(--ln);border-radius:16px;padding:14px 16px;color:var(--tx);font:inherit;text-align:left;cursor:pointer;transition:border-color .2s,transform .12s}
.pw-plan.on{border-color:var(--ac);background:rgba(212,139,146,.07)}
.pw-plan:active{transform:scale(.98)}
.pw-plan span{display:flex;flex-direction:column}
.pw-plan b{font-size:15px}.pw-plan small{font-size:12px;color:var(--dm);margin-top:2px}
.pw-plan strong{font-size:16px;white-space:nowrap}
.pw-plan em{position:absolute;top:-9px;left:14px;font-style:normal;font-size:11px;font-weight:800;background:var(--ac);color:#000;border-radius:999px;padding:2px 9px}
.pw-cta{margin-top:16px}
.pw-fine{font-size:13px;line-height:1.5;color:rgba(255,255,255,.75);text-align:center;margin:10px 4px 0}
.pw-links{display:flex;justify-content:center;gap:18px;margin-top:12px;font-size:13px}
.pw-free{margin-top:14px;align-self:center}
.locked{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:40px}
.locked-ic{width:64px;height:64px;border-radius:20px;background:var(--sf);border:1px solid var(--ln);display:flex;align-items:center;justify-content:center;margin-bottom:8px}
.locked .btn{max-width:320px}
@media (prefers-reduced-motion:no-preference){.pw{animation:pwIn .35s cubic-bezier(.2,.8,.2,1) both}.pw-plan{animation:rise .4s ease-out both}.pw-plan:nth-child(2){animation-delay:.06s}.pw-plan:nth-child(3){animation-delay:.12s}}
@keyframes pwIn{from{transform:translateY(24px);opacity:0}}
`;

/* ============================ REVISIONES ============================ */

function CheckinList({ items }) {
  const [urls, setUrls] = useState({});
  const [big, setBig] = useState(null);
  useEffect(() => {
    const paths = items.flatMap((c) => c.photos || []).filter((p) => !urls[p]);
    if (paths.length) db.checkinUrls(paths).then((u) => setUrls((x) => ({ ...x, ...u }))).catch(() => {});
  }, [items]);
  if (!items.length) return <div className="empty">Todavía no hay revisiones.</div>;
  return (
    <>
      {items.map((c) => (
        <div className="ck" key={c.id}>
          <div className="ck-hd"><b>{new Date(c.created_at).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</b>
            <span>{[c.weight && `${c.weight} kg`, c.waist && `cintura ${c.waist}`, c.hip && `cadera ${c.hip}`].filter(Boolean).join(" · ")}</span></div>
          {c.photos?.length > 0 && <div className="ck-photos">{c.photos.map((p) => <button key={p} onClick={() => urls[p] && setBig(urls[p])}>{urls[p] ? <img src={urls[p]} alt="" /> : <span>…</span>}</button>)}</div>}
          {c.feeling && <p className="ck-txt">{c.feeling}</p>}
        </div>
      ))}
      {big && <div className="ck-big" onClick={() => setBig(null)}><img src={big} alt="" /></div>}
    </>
  );
}

// Lo que ve la asesorada: mandar su revisión a la coach
function CheckinCard({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [f, setF] = useState({ weight: "", waist: "", hip: "", feeling: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (open && items === null) db.listCheckins(userId).then(setItems).catch(() => setItems([])); }, [open]);
  const pick = async (list) => {
    const out = [];
    for (const file of [...list].slice(0, 3 - files.length)) {
      const data = await readFile(file, 1400);
      out.push({ preview: data, blob: await (await fetch(data)).blob() });
    }
    setFiles((x) => [...x, ...out].slice(0, 3));
  };
  const send = async () => {
    setBusy(true); setMsg("");
    try {
      const row = await db.addCheckin(userId, { ...f, files: files.map((x) => x.blob) });
      setItems((x) => [row, ...(x || [])]); setF({ weight: "", waist: "", hip: "", feeling: "" }); setFiles([]);
      setMsg("Revisión enviada. Tu entrenadora ya la puede ver.");
    } catch { setMsg("No se ha podido enviar. Revisa tu conexión e inténtalo otra vez."); }
    finally { setBusy(false); }
  };
  return (
    <div className="ckcard">
      <div className="ck-hd"><b>Revisión con tu entrenadora</b><button className="link" onClick={() => setOpen(!open)}>{open ? "Cerrar" : "Abrir"}</button></div>
      {!open && <p className="hint" style={{ margin: "6px 0 0" }}>Fotos de progreso, peso, medidas y cómo te ha ido. Solo las ve ella.</p>}
      {open && (
        <>
          <div className="ck-photos ck-new">
            {files.map((x, i) => <button key={i} onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Quitar foto"><img src={x.preview} alt="" /><i>✕</i></button>)}
            {files.length < 3 && <button className="ck-add" onClick={() => ref.current?.click()}>+<small>{["Frente", "Perfil", "Espalda"][files.length]}</small></button>}
            <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          </div>
          <div className="row">
            {[["weight", "Peso (kg)"], ["waist", "Cintura (cm)"], ["hip", "Cadera (cm)"]].map(([k, l]) => (
              <div key={k} className="field" style={{ flex: 1 }}><label>{l}</label><input className="in" inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
            ))}
          </div>
          <div className="field"><label>¿Cómo ha ido la semana?</label><textarea className="in" rows={3} value={f.feeling} placeholder="Energía, hambre, sueño, entrenos, molestias…" onChange={(e) => setF({ ...f, feeling: e.target.value })} /></div>
          <button className="btn ac" disabled={busy || (!files.length && !f.weight && !f.feeling)} onClick={send}>{busy ? "Enviando…" : "Enviar revisión"}</button>
          {msg && <div className="note">{msg}</div>}
          <h2>Tus revisiones</h2>
          {items === null ? <p className="hint">Cargando…</p> : <CheckinList items={items} />}
        </>
      )}
    </div>
  );
}

const CHECKIN_CSS = `
.ckcard{background:var(--sf);border:1px solid var(--ln);border-radius:18px;padding:14px 16px;margin-top:18px}
.ck-hd{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.ck-hd span{font-size:12px;color:var(--dm);text-align:right}
.ck{border-bottom:1px solid var(--ln);padding:12px 0}
.ck-photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.ck-photos button{position:relative;aspect-ratio:3/4;border-radius:12px;overflow:hidden;border:1px solid var(--ln);background:#000;padding:0;cursor:pointer;color:var(--dm)}
.ck-photos img{width:100%;height:100%;object-fit:cover}
.ck-photos i{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;font-style:normal;font-size:11px;display:flex;align-items:center;justify-content:center}
.ck-add{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:26px;color:var(--ac)!important;border-style:dashed!important}
.ck-add small{font-size:11px;color:var(--dm);margin-top:4px}
.ck-txt{font-size:14px;color:var(--dm);margin:8px 0 0;white-space:pre-wrap}
.ck-big{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:20px}
.ck-big img{max-width:100%;max-height:100%;border-radius:14px}
`;

/* ============================ ASESORADAS (COACH) ============================ */

const dayMs = 864e5;
const fmtDate = (d) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

// Resumen de cumplimiento de una asesorada a partir de sus datos
function clientSummary(raw, routineDays) {
  const p = fromDb(raw);
  const plan = routineDays || (p.profile ? activeRoutine(p.profile).length : 0) || 3;
  const now = Date.now();
  const weeks = [3, 2, 1, 0].map((w) => {
    const to = now - w * 7 * dayMs, from = to - 7 * dayMs;
    return p.sessions.filter((s) => { const t = new Date(s.date).getTime(); return t > from && t <= to; }).length;
  });
  const adh = p.profile ? adherenceInfo(p.habits, p.profile.startDate) : null;
  const weights = Object.entries(p.habits).filter(([, h]) => h.weight).sort(([a], [b]) => a.localeCompare(b));
  const last = p.sessions[p.sessions.length - 1];
  const trainPct = Math.round(Math.min(1, weeks.reduce((a, b) => a + b, 0) / (plan * 4)) * 100);
  return { p, plan, weeks, adh, trainPct, last, w0: weights[0]?.[1].weight, w1: weights[weights.length - 1]?.[1].weight };
}

function ClientDetail({ client, onBack, onSaved, onRemoved }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("cumple");
  const [days, setDays] = useState(client.routine || null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(client.notes || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [checkins, setCheckins] = useState(null);
  const [mode, setMode] = useState(client.mode || "");
  useEffect(() => { if (tab === "revis" && client.client_id && checkins === null) db.listCheckins(client.client_id).then(setCheckins).catch(() => setCheckins([])); }, [tab]);

  useEffect(() => {
    if (!client.client_id) return;
    db.clientData(client.client_id).then(setData).catch(() => setErr("No se han podido cargar sus datos."));
  }, [client.client_id]);

  const sum = data ? clientSummary(data, days?.length) : null;
  const save = async (patch, ok) => {
    setBusy(true); setMsg("");
    try { const row = await db.updateClient(client.id, patch); onSaved(row); setMsg(ok); } catch { setMsg("No se ha podido guardar."); } finally { setBusy(false); }
  };
  const fromCurrent = () => {
    const base = sum?.p.profile ? activeRoutine(sum.p.profile) : buildRoutine(3, "female");
    setDays(base.map((d) => ({ name: d.name, ex: d.ex.map(({ id, sets, reps, rir, rest }) => ({ id, sets, reps, rir, rest })) })));
    setEditing(true);
  };

  return (
    <>
      <button className="link" onClick={onBack}>← Asesorad@s</button>
      <h1 style={{ marginTop: 10 }}>{client.name || client.email}</h1>
      <p className="sub">{client.email}{!client.client_id && " · aún no se ha registrado"}</p>
      <div className="seg">
        <button className={tab === "cumple" ? "on" : ""} onClick={() => setTab("cumple")}>Cumplimiento</button>
        <button className={tab === "rutina" ? "on" : ""} onClick={() => setTab("rutina")}>Rutina</button>
        <button className={tab === "revis" ? "on" : ""} onClick={() => setTab("revis")}>Revisiones</button>
        <button className={tab === "notas" ? "on" : ""} onClick={() => setTab("notas")}>Notas</button>
      </div>

      {tab === "cumple" && (
        !client.client_id ? <div className="note">Cuando se registre en ARC con <b>{client.email}</b>, aparecerá aquí todo lo que haga. Puedes ir preparándole la rutina.</div>
        : err ? <div className="err">{err}</div>
        : !sum ? <p className="hint">Cargando…</p>
        : (
          <>
            <div className="cl-kpis">
              <div><b>{sum.trainPct}%</b><span>Entrenos (4 sem.)</span></div>
              <div><b>{sum.adh ? `${sum.adh.pct}%` : "—"}</b><span>Hábitos (30 días)</span></div>
              <div><b>{sum.adh?.streak ?? 0}</b><span>Días de racha</span></div>
            </div>
            <h2>Entrenos por semana</h2>
            <div className="cl-weeks">
              {sum.weeks.map((n, i) => (
                <div key={i}>
                  <div className="cl-col"><i style={{ height: `${Math.min(100, (n / sum.plan) * 100)}%`, background: n >= sum.plan ? "var(--okl)" : "var(--ac)" }} /></div>
                  <b>{n}/{sum.plan}</b><span>{i === 3 ? "Esta" : `Hace ${3 - i}`}</span>
                </div>
              ))}
            </div>
            <div className="hist"><span>Último entreno</span><span>{sum.last ? `${fmtDate(sum.last.date)} · ${sum.last.dayName || "Entreno"}` : "Ninguno todavía"}</span></div>
            <div className="hist"><span>Peso</span><span>{sum.w1 ? `${sum.w1} kg${sum.w0 && sum.w0 !== sum.w1 ? ` (${sum.w1 - sum.w0 > 0 ? "+" : ""}${(sum.w1 - sum.w0).toFixed(1)} kg)` : ""}` : "Sin registrar"}</span></div>
            <div className="hist"><span>Entrenos en total</span><span>{sum.p.sessions.length}</span></div>
            <h2>Sus músculos</h2>
            <MuscleWeek sessions={sum.p.sessions} routine={days?.length ? normDays(days) : sum.p.profile ? activeRoutine(sum.p.profile) : []} />
            <h2>Últimos entrenos</h2>
            {sum.p.sessions.length === 0 && <div className="empty">Todavía no ha registrado ningún entreno.</div>}
            {sum.p.sessions.slice().reverse().slice(0, 8).map((s) => (
              <div className="hist" key={s.id}><span>{s.dayName || "Entreno"}</span><span>{fmtDate(s.date)} · {s.sets} series · {s.volume.toLocaleString("es-ES")} kg</span></div>
            ))}
          </>
        )
      )}

      {tab === "rutina" && (
        <>
          <div className="field"><label>Modo de niveles</label>
            <div className="chips">{[["", "Lo elige su usuari@"], ["otaku", "Personajes anime"], ["clasico", "Sin personajes"], ["simple", "Sin niveles"]].map(([v, l]) => (
              <button key={v} className={`chip ${mode === v ? "on" : ""}`} disabled={busy} onClick={() => { setMode(v); save({ mode: v }, v === "clasico" ? "Le saldrán solo niveles con número, sin personajes." : v ? "Modo cambiado. Lo verá al abrir la app." : "Vuelve a elegirlo su usuari@."); }}>{l}</button>
            ))}</div>
          </div>
          {!days?.length && !editing && (
            <div className="note">
              Aún no le has puesto rutina: ahora mismo usa la suya o la automática.
              <button className="btn" onClick={fromCurrent}>Empezar desde su rutina actual</button>
              <button className="btn ghost" onClick={() => { setDays([{ name: "Día A", ex: [] }]); setEditing(true); }}>Empezar de cero</button>
            </div>
          )}
          {days?.length > 0 && editing && (
            <RoutineEditor days={days} onChange={setDays} onDone={() => { setEditing(false); save({ routine: days }, "Rutina guardada. La verá la próxima vez que abra la app."); }} />
          )}
          {days?.length > 0 && !editing && (
            <>
              {normDays(days).map((d) => (
                <div className="day" key={d.id}>
                  <div className="hd"><b>Día {d.id}: {d.name}</b></div>
                  {d.ex.map((e, k) => <div key={k} className="exrow"><span>{EXERCISES[e.id].n}</span><span>{e.sets} × {e.reps}</span></div>)}
                </div>
              ))}
              <button className="btn" onClick={() => setEditing(true)}>Editar rutina</button>
              <button className="btn ghost" disabled={busy} onClick={() => { setDays(null); save({ routine: null }, "Rutina quitada. Vuelve a usar la suya."); }}>Quitarle la rutina</button>
            </>
          )}
          {editing && <h2>Así le queda la semana</h2>}
          {editing && <MuscleWeek sessions={[]} routine={normDays(days || [])} initial="plan" />}
        </>
      )}

      {tab === "revis" && (
        !client.client_id ? <div className="note">Cuando se registre, aquí verás sus fotos de progreso, peso, medidas y cómo le ha ido cada semana. Las manda desde su pestaña de Hábitos.</div>
        : checkins === null ? <p className="hint">Cargando…</p> : <CheckinList items={checkins} />
      )}

      {tab === "notas" && (
        <>
          <textarea className="in" rows={8} placeholder="Lesiones, objetivos, cómo va, lo que hablasteis…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn" disabled={busy} onClick={() => save({ notes }, "Notas guardadas.")}>Guardar notas</button>
          <p className="hint">Solo las ves tú.</p>
        </>
      )}

      {msg && <div className="note">{msg}</div>}
      <h2>Asesorad@</h2>
      {!confirmDel
        ? <button className="btn ghost" style={{ color: "#FCA5A5" }} onClick={() => setConfirmDel(true)}>Quitar de mis asesorad@s</button>
        : <div className="note">Deja de estar en tu lista y pierde la rutina que le pusiste. Su cuenta y sus datos no se tocan.
            <button className="btn" style={{ background: "#FCA5A5" }} onClick={async () => { await db.removeClient(client.id); onRemoved(client.id); }}>Sí, quitar</button>
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>Cancelar</button>
          </div>}
    </>
  );
}

function Clients({ onClose }) {
  const [list, setList] = useState(null);
  const [sums, setSums] = useState({});
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => db.listClients().then(setList).catch(() => setErr("No se ha podido cargar la lista. ¿Has pegado el SQL de asesorad@s en Supabase?"));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    (list || []).filter((c) => c.client_id && !sums[c.id]).forEach((c) => db.clientData(c.client_id).then((d) => setSums((s) => ({ ...s, [c.id]: clientSummary(d, c.routine?.length) }))).catch(() => {}));
  }, [list]);

  const add = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Escribe un correo válido."); return; }
    setBusy(true); setErr("");
    try { const row = await db.addClient(name.trim() || null, email.trim()); setList((l) => [...(l || []), row]); setName(""); setEmail(""); }
    catch (e) { setErr(/duplicate|unique/i.test(e.message || "") ? "Ya tienes a esa persona en tu lista." : "No se ha podido añadir. Inténtalo otra vez."); }
    finally { setBusy(false); }
  };

  const cur = open && list?.find((c) => c.id === open);
  if (cur) return <ClientDetail client={cur} onBack={() => setOpen(null)} onSaved={(row) => setList((l) => l.map((c) => (c.id === row.id ? row : c)))} onRemoved={(id) => { setList((l) => l.filter((c) => c.id !== id)); setOpen(null); }} />;

  return (
    <>
      <button className="link" onClick={onClose}>← Ajustes</button>
      <h1 style={{ marginTop: 10 }}>Mis asesorad@s</h1>
      <p className="sub">Añádelas con el correo con el que usan ARC. Si aún no tienen cuenta, se unirán solas cuando se registren con ese correo.</p>
      <div className="field"><label>Nombre</label><input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Marta" /></div>
      <div className="field"><label>Correo</label><input className="in" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marta@gmail.com" /></div>
      <button className="btn ac" disabled={busy || !email} onClick={add}>{busy ? "Añadiendo…" : "Añadir asesorad@"}</button>
      {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}

      <h2>Tu lista</h2>
      {list === null && !err && <p className="hint">Cargando…</p>}
      {list?.length === 0 && <div className="empty">Aún no has añadido a nadie.</div>}
      {list?.map((c) => {
        const s = sums[c.id];
        return (
          <button key={c.id} className="cl-row" onClick={() => setOpen(c.id)}>
            <div className="cl-av">{(c.name || c.email)[0].toUpperCase()}</div>
            <div className="cl-main">
              <b>{c.name || c.email}</b>
              <small>{!c.client_id ? "Esperando a que se registre" : s ? (s.last ? `Último entreno: ${fmtDate(s.last.date)}` : "Sin entrenos todavía") : "Cargando…"}{c.routine?.length ? " · con tu rutina" : ""}</small>
            </div>
            {s && <div className="cl-pct"><b style={{ color: s.trainPct >= 75 ? "var(--okl)" : s.trainPct >= 40 ? "var(--wu)" : "#FCA5A5" }}>{s.trainPct}%</b><small>cumple</small></div>}
          </button>
        );
      })}
    </>
  );
}

const CLIENTS_CSS = `
.cl-row{display:flex;align-items:center;gap:12px;width:100%;background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:12px 14px;margin-bottom:8px;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.cl-av{width:40px;height:40px;border-radius:50%;background:rgba(212,139,146,.15);color:var(--ac);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}
.cl-main{flex:1;min-width:0}.cl-main b{display:block;font-size:15px}.cl-main small{display:block;font-size:12px;color:var(--dm);margin-top:2px}
.cl-pct{text-align:right}.cl-pct b{display:block;font-size:18px}.cl-pct small{font-size:11px;color:var(--dm)}
.cl-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.cl-kpis div{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px 8px;text-align:center}
.cl-kpis b{display:block;font-size:22px}.cl-kpis span{font-size:11px;color:var(--dm)}
.cl-weeks{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}
.cl-weeks>div{display:flex;flex-direction:column;align-items:center;gap:4px}
.cl-col{width:28px;height:90px;border-radius:8px;background:var(--ln);display:flex;align-items:flex-end;overflow:hidden}
.cl-col i{display:block;width:100%;border-radius:8px}
.cl-weeks b{font-size:13px}.cl-weeks span{font-size:11px;color:var(--dm)}
`;

function ArcApp({ user }) {
  const [state, setState] = useState(EMPTY);
  const [media, setMediaState] = useState(BUNDLED_MEDIA);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("inicio");
  useEffect(() => native.onReminderOpen((o) => { if (o === "story") { setTab("inicio"); setTimeout(() => window.dispatchEvent(new Event("arc-story")), 400); } }), []);
  const [screen, setScreen] = useState(null);
  const [toast, setToast] = useState("");
  const [coachView, setCoachView] = useState(true);
  const [stepsAvail, setStepsAvail] = useState(false);
  const [stepsBusy, setStepsBusy] = useState(false);
  const [stepsErr, setStepsErr] = useState("");
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifErr, setNotifErr] = useState("");
  const [quote, setQuote] = useState(null);
  const [splash, setSplash] = useState(true);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [premium, setPremium] = useState(null); // null = aún no se sabe
  const [paywall, setPaywall] = useState(false);
  const [done, setDone] = useState(null); // pantalla de fin de entreno
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState("");
  const timers = useRef({});

  const load = async () => {
    setLoadErr("");
    try {
      const [all, remote] = await Promise.all([db.loadAll(user.id), db.loadContent().catch(() => null)]);
      if (remote) { applyContent(remote); setContent({ quotes: remote.quotes.length ? remote.quotes : DEFAULT_CONTENT.quotes, exercises: remote.exercises.length ? remote.exercises : DEFAULT_CONTENT.exercises, foods: remote.foods.length ? remote.foods : DEFAULT_CONTENT.foods, recipes: remote.recipes.length ? remote.recipes : DEFAULT_CONTENT.recipes }); }
      const st = fromDb(all);
      setQuote(pickQuote(st.profile?.mode));
      setState(st);
      setMediaState({ ...BUNDLED_MEDIA, ...Object.fromEntries(all.media.map((m) => [m.key, m.url])) });
      setLoaded(true);
    } catch (e) { setLoadErr("No hemos podido cargar tus datos. Revisa tu conexión."); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  const fail = () => setToast("No se ha podido guardar. Revisa tu conexión.");
  const later = (key, fn, ms = 800) => { clearTimeout(timers.current[key]); timers.current[key] = setTimeout(() => fn().catch(fail), ms); };

  const isCoach = state.role === "coach" || state.role === "admin";
  // Sin clave de RevenueCat o fuera del iPhone no se bloquea nada
  const hasPremium = isCoach || !purchases.enabled || premium === true;
  useEffect(() => {
    if (!loaded || !purchases.enabled) return;
    purchases.init(user.id).then(setPremium).catch(() => setPremium(false));
    purchases.onChange(setPremium).catch(() => {});
  }, [loaded]);
  const coach = isCoach && coachView;

  const setMedia = async (key, value) => {
    setMediaState((m) => { const n = { ...m }; if (value) n[key] = value; else delete n[key]; return n; });
    try { if (value) await db.setMedia(key, value, isImage(value) ? "image" : "video"); else await db.deleteMedia(key); } catch (e) { fail(); }
  };
  const onSaveItem = async (table, row) => {
    await db.saveContentRow(table, row);
    const next = { ...content, [table]: content[table].some((x) => x.id === row.id) ? content[table].map((x) => (x.id === row.id ? row : x)) : [...content[table], row] };
    applyContent(next); setContent(next);
  };
  const onDeleteItem = async (table, id) => {
    await db.deleteContentRow(table, id);
    const next = { ...content, [table]: content[table].filter((x) => x.id !== id) };
    applyContent(next); setContent(next);
  };

  const uploadMedia = async (key, file) => {
    let blob = file, type = file.type, ext = (file.name.split(".").pop() || "bin").toLowerCase();
    if (file.type.startsWith("image/") && file.type !== "image/gif") {
      const data = await readFile(file, 1600, 0.93);
      blob = await (await fetch(data)).blob(); type = blob.type; ext = type === "image/png" ? "png" : "jpg";
    }
    const url = await db.uploadFile(`${key.replace(/:/g, "/")}/${Date.now()}.${ext}`, blob, type);
    await setMedia(key, url);
  };

  const routine = useMemo(() => activeRoutine({ ...state.profile, coachRoutine: state.coachRoutine }), [state.profile?.days, state.profile?.branch, state.profile?.routineMode, state.profile?.customRoutine, state.coachRoutine]);
  const adh = useMemo(() => (state.profile ? adherenceInfo(state.habits, state.profile.startDate) : null), [state.habits, state.profile]);
  const stats = useMemo(() => {
    if (!state.profile) return null;
    const { best, pullups } = bestLifts(state);
    return {
      ratio: ratioOf(state.profile.branch, best, currentWeight(state)),
      pullups,
      months: (Number(state.profile.months) || 0) + activeMonths(state.sessions.map((s) => s.date)),
      adherence: adh.pct, provisional: adh.provisional, streak: adh.streak,
    };
  }, [state, adh]);
  const ev = useMemo(() => (stats ? evaluate(state.profile.branch, stats, state.profile.mode) : null), [stats, state.profile]);

  useEffect(() => {
    if (ev && state.rankOptIn && ev.current !== state.savedLevel) {
      db.setLevel(user.id, ev.current).then(() => setState((s) => ({ ...s, savedLevel: ev.current }))).catch(() => {});
    }
  }, [ev?.current, state.rankOptIn]);

  const rankApi = {
    load: (w) => db.loadRanking(w),
    join: async (nickname) => { await db.joinRanking(user.id, nickname, ev?.current || 0); setState((s) => ({ ...s, nickname, rankOptIn: true, savedLevel: ev?.current || 0 })); },
    leave: async () => { await db.leaveRanking(user.id); setState((s) => ({ ...s, rankOptIn: false })); },
    report: (nick, reason) => db.reportNickname(nick, reason),
    search: (q) => db.searchProfiles(q),
    profile: (nick) => db.publicProfile(nick),
    setAvatar: async (file) => {
      if (!file) { await db.clearMyAvatar(); setState((s) => ({ ...s, avatar: null, avatarPending: null })); return; }
      const data = await squareImage(file, 400);
      const url = await db.uploadAvatar(user.id, await (await fetch(data)).blob());
      await db.setAvatarPending(user.id, url);
      setState((s) => ({ ...s, avatarPending: url }));
    },
    setPublic: async (v) => { await db.setProfilePublic(user.id, v); setState((s) => ({ ...s, profilePublic: v })); },
  };

  // Pasos y recordatorios (solo en el móvil)
  useEffect(() => { native.stepsAvailable().then(setStepsAvail); }, []);
  useEffect(() => {
    if (loaded && state.profile?.reminders) native.applyReminders(state.profile.reminders).catch(() => {});
  }, [loaded]);
  const syncSteps = async () => {
    setStepsBusy(true); setStepsErr("");
    try {
      const n = await native.stepsToday();
      const current = Number(state.habits[dkey()]?.steps) || 0;
      if (n > current) setHabit("steps", n);
    } catch { setStepsErr("No se han podido leer los pasos. Revisa el permiso en " + (native.platform === "ios" ? "Apple Salud." : "Health Connect.")); }
    finally { setStepsBusy(false); }
  };
  const connectSteps = async () => {
    if (native.platform === "android" && !stepsAvail) return native.installHealthConnect();
    setStepsBusy(true); setStepsErr("");
    try { await native.connectSteps(); setProfile({ stepsLinked: true }); setStepsBusy(false); await syncSteps(); }
    catch { setStepsBusy(false); setStepsErr("No has dado permiso para leer los pasos. Puedes activarlo en " + (native.platform === "ios" ? "Ajustes > Salud > Acceso a datos > ARC." : "Health Connect > Permisos de apps > ARC.")); }
  };
  useEffect(() => { if ((tab === "habitos" || tab === "inicio") && state.profile?.stepsLinked && stepsAvail) syncSteps(); }, [tab, stepsAvail]);

  const [levelUp, closeLevelUp] = useLevelUp(loaded && state.onboarded ? state.profile : null, ev, media, (patch) => setState((s) => {
    const profile = { ...s.profile, ...patch };
    const { startDate, ...data } = profile;
    later("profile", () => db.updateProfile(user.id, { data }), 300);
    return { ...s, profile };
  }));

  if (!loaded) return <Shell>{loadErr ? <><div className="err">{loadErr}</div><button className="btn" onClick={load}>Reintentar</button></> : <p className="sub">Cargando tu arco…</p>}{splash && <Splash onDone={() => setSplash(false)} />}</Shell>;

  const profileData = (p) => { const { startDate, ownMode, ...rest } = p; return ownMode !== undefined ? { ...rest, mode: ownMode } : rest; };
  const setProfile = (patch) => setState((s) => {
    const profile = { ...s.profile, ...patch };
    later("profile", () => db.updateProfile(user.id, { data: profileData(profile) }), 300);
    return { ...s, profile };
  });
  const saveProfile = async (q) => {
    const startDate = state.profile?.startDate || dkey();
    const profile = { ...state.profile, ...q, startDate };
    setState((s) => ({ ...s, onboarded: true, profile }));
    setScreen(null); setTab("inicio");
    try { await db.updateProfile(user.id, { onboarded: true, data: profileData(profile), start_date: startDate }); } catch (e) { fail(); }
  };
  const setHabit = (k, v) => setState((s) => {
    const day = dkey();
    const h = { ...(s.habits[day] || {}), [k]: v };
    later(`habit-${day}`, () => db.upsertHabit(user.id, day, h));
    return { ...s, habits: { ...s.habits, [day]: h } };
  });
  const setActive = (a) => {
    setState((s) => ({ ...s, active: a }));
    later("active", () => db.updateProfile(user.id, { active_session: a }), a ? 1500 : 0);
  };
  const finish = async (volume, sets) => {
    const a = state.active;
    const prevLevel = ev.current;
    const row = {
      user_id: user.id, performed_at: new Date().toISOString(), day_id: a.dayId, day_name: a.dayName,
      duration_s: Math.round((Date.now() - a.start) / 1000), volume_kg: volume, sets_done: sets,
      exercises: a.exercises.map(({ exId, sets, note }) => ({ exId, sets, note })),
    };
    clearTimeout(timers.current.active);
    try {
      const prs = countPRs(state.sessions, row.exercises);
      const saved = await db.addSession(row);
      const session = { id: saved.id, date: saved.performed_at, dayId: a.dayId, dayName: a.dayName, dur: row.duration_s, volume, sets, exercises: row.exercises };
      const next = { ...state, active: null, sessions: [...state.sessions, session], xp: state.xp + RULES.XP_PER_SESSION, gems: state.gems + RULES.GEMS_PER_SESSION };
      setState(next);
      const { best, pullups } = bestLifts(next);
      const lv = evaluate(next.profile.branch, { ...stats, ratio: ratioOf(next.profile.branch, best, currentWeight(next)), pullups }, next.profile.mode).current;
      setDone({ dur: row.duration_s, sets, volume, xp: RULES.XP_PER_SESSION, prs, share: shareDataFor(session, next.sessions), nick: state.nickname, levelImg: next.profile.mode === "simple" ? null : mediaOr(media, levelKey(next.profile.branch, next.profile.mode || "otaku", lv)) });
      setTab("inicio");
    } catch (e) { setToast("No se ha podido guardar el entreno. Tu sesión sigue abierta: vuelve a darle a Terminar."); }
  };

  const showQuestionnaire = !state.onboarded || screen === "editar";
  const showTour = state.onboarded && !state.profile?.toured && !showQuestionnaire;
  const inTracker = tab === "entrenos" && state.active && !showQuestionnaire && !screen && !showTour;

  // Permisos que se piden en la bienvenida (solo en el móvil)
  const askReminders = async () => {
    setNotifBusy(true); setNotifErr("");
    try {
      if (!(await native.notificationsAllowed(true))) { setNotifErr("Sin permiso. Puedes activarlo en Ajustes del iPhone > ARC > Notificaciones."); return; }
      const r = { ...native.DEFAULT_REMINDERS, train: { ...native.DEFAULT_REMINDERS.train, on: true }, sunday: { ...native.DEFAULT_REMINDERS.sunday, on: true } };
      setProfile({ reminders: r });
      await native.applyReminders(r);
    } catch { setNotifErr("No se han podido activar los avisos."); }
    finally { setNotifBusy(false); }
  };
  const tourPerms = native.isNative ? [
    { key: "steps", title: native.platform === "ios" ? "Pasos de Apple Salud" : "Pasos de Health Connect",
      text: native.platform === "ios" ? "ARC usa HealthKit para leer tus pasos de la app Salud y apuntarlos solos en Hábitos. Solo lectura, nunca se comparten." : "Así tus pasos se apuntan solos en Hábitos, sin escribir nada.",
      button: native.platform === "android" && !stepsAvail ? "Instalar Health Connect" : native.platform === "ios" ? "Conectar con Apple Salud" : "Conectar pasos",
      done: !!state.profile?.stepsLinked, doneText: "Conectado", busy: stepsBusy, error: stepsErr, onAsk: connectSteps },
    { key: "notif", title: "Recordatorios",
      text: "Un aviso los días de entreno y el cierre del domingo. Nada de spam.",
      button: "Activar avisos",
      done: !!state.profile?.reminders?.train?.on, doneText: "Activados", busy: notifBusy, error: notifErr, onAsk: askReminders },
  ] : null;

  let body;
  if (showTour) {
    body = <Tour media={media} profile={state.profile} ev={ev} heroImg={mediaOr(media, levelKey(state.profile.branch, state.profile.mode, ev.current)) || AVATAR[state.profile.branch]} perms={tourPerms} onFinish={() => { const again = state.profile?.retour; setProfile({ toured: true, retour: false }); setTab("inicio"); if (!hasPremium && !again) setPaywall(true); }} />;
  } else if (showQuestionnaire) {
    body = <Questionnaire initial={state.profile || DEFAULT_PROFILE} editing={state.onboarded} onSave={saveProfile} onCancel={() => setScreen("ajustes")} />;
  } else if (screen === "contenido" && isCoach) {
    body = <ContentEditor content={content} onSave={onSaveItem} onDelete={onDeleteItem} onClose={() => setScreen("ajustes")} media={media} setMedia={setMedia} uploadMedia={uploadMedia} />;
  } else if (screen === "asesoradas" && isCoach) {
    body = <Clients onClose={() => setScreen("ajustes")} />;
  } else if (screen === "denuncias" && isCoach) {
    body = <Reports onClose={() => setScreen("ajustes")} />;
  } else if (screen === "ajustes") {
    body = <Settings onTour={() => { setProfile({ toured: false, retour: true }); setScreen(null); }} onClients={() => setScreen("asesoradas")} onPaywallPreview={() => setPaywall(true)} videos={{ on: !state.profile?.hideVideos, set: (on) => setProfile({ hideVideos: !on }) }} onFinishPreview={() => setDone({ dur: 3120, sets: 18, volume: 8450, xp: RULES.XP_PER_SESSION, prs: 2 })} sub={purchases.enabled && !isCoach ? { premium: premium === true, open: () => setPaywall(true), busy: restoring, msg: restoreMsg, restore: async () => { setRestoring(true); setRestoreMsg(""); try { const ok = await purchases.restore(); setPremium(ok); setRestoreMsg(ok ? "Compra restaurada. Ya tienes ARC completo." : "No hay ninguna compra activa en tu cuenta de Apple."); } catch { setRestoreMsg("No se ha podido restaurar. Inténtalo más tarde."); } finally { setRestoring(false); } } } : null} email={user.email} isCoach={isCoach} coachView={coachView} setCoachView={setCoachView}
      reminders={state.profile?.reminders} setReminders={(r) => setProfile({ reminders: r })}
      onEdit={() => setScreen("editar")}
      onContent={() => setScreen("contenido")}
      onReports={() => setScreen("denuncias")}
      onSignOut={() => supabase.auth.signOut()}
      onResetData={async () => { await db.deleteMyData(user.id); setState((s) => ({ ...EMPTY, xp: s.xp, gems: s.gems, role: s.role })); setScreen(null); }}
      onDeleteAccount={() => db.deleteAccount()}
      onClose={() => setScreen(null)} />;
  } else if (inTracker) {
    body = <Tracker active={state.active} sessions={state.sessions} setActive={setActive} onFinish={finish} onCancel={() => setActive(null)} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} onRest={native.scheduleRest} onRestCancel={native.cancelRest} hideVideos={!!state.profile?.hideVideos} />;
  } else if (["entrenos", "nutricion", "ranking"].includes(tab) && !hasPremium) {
    body = <Locked tab={tab} onOpen={() => setPaywall(true)} />;
  } else if (tab === "inicio") {
    body = <Home state={state} stats={stats} ev={ev} quote={quote} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} />;
  } else if (tab === "entrenos") {
    body = <Workouts state={state} routine={routine} onStart={(d) => setActive(newSession(d, state.sessions))} setDays={(d) => setProfile({ days: d })} setProfile={setProfile} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} />;
  } else if (tab === "ranking") {
    body = <Ranking me={{ optIn: !!state.rankOptIn, nickname: state.nickname, avatar: state.avatar, pending: state.avatarPending, isPublic: state.profilePublic !== false }} state={{ ...state, savedLevel: ev?.current ?? state.savedLevel }} api={rankApi} media={media} coach={coach} setMedia={setMedia} blocked={state.profile?.blocked || []} onBlock={(n) => setProfile({ blocked: [...new Set([...(state.profile?.blocked || []), n])] })} onUnblockAll={() => setProfile({ blocked: [] })} />;
  } else if (tab === "nutricion") {
    body = <Nutrition profile={state.profile} setCook={(c) => setProfile({ cook: c })} media={media} eaten={(state.habits[dkey()] || {}).food || {}} setEaten={(v) => setHabit("food", v)} />;
  } else {
    body = <>{<Habits state={state} setHabit={setHabit} adh={adh} steps={native.isNative ? {
      available: native.platform === "android" || stepsAvail,
      linked: !!state.profile?.stepsLinked && stepsAvail,
      label: native.platform === "android" && !stepsAvail ? "Instalar Health Connect para leer tus pasos" : `Conectar con ${native.platform === "ios" ? "Apple Salud" : "Health Connect"}`,
      source: native.platform === "ios" ? "Apple Salud" : "Health Connect",
      busy: stepsBusy, error: stepsErr, connect: connectSteps, sync: syncSteps,
    } : null} />}{state.hasCoach && <CheckinCard userId={user.id} />}</>;
  }

  return (
    <div className="arc">
      <style>{CSS + EXTRA_CSS + LEGAL_CSS + PAYWALL_CSS + CLIENTS_CSS + CHECKIN_CSS}</style>
      {paywall && <Paywall media={media} coach={coach} uploadMedia={uploadMedia} setMedia={setMedia} onClose={() => setPaywall(false)} onPremium={() => { setPremium(true); setPaywall(false); setToast("¡Ya tienes ARC completo!"); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {done && <FinishScreen data={done} media={media} coach={coach} uploadMedia={uploadMedia} setMedia={setMedia} onClose={() => setDone(null)} />}
      {levelUp && <LevelUp data={levelUp} onClose={closeLevelUp} />}
      {splash && <Splash onDone={() => setSplash(false)} />}
      <div className="phone">
        {!inTracker && (
          <div className="top">
            <Logo /><b>ARC</b><span className="by">by Lunarovx</span>
            {state.onboarded && !screen && !showTour && <><span className="xp" key={state.xp}>{state.xp} XP</span><button className="link" style={{ marginLeft: 12 }} onClick={() => setScreen("ajustes")}>Ajustes</button></>}
          </div>
        )}
        <div className="page" key={`${tab}-${screen || ""}`}>{body}</div>
      </div>
      {!showQuestionnaire && !showTour && !inTracker && !screen && (
        <nav className="nav"><div>
          {[["inicio", "Inicio"], ["entrenos", "Entrenos"], ["nutricion", "Nutrición"], ["habitos", "Hábitos"], ["ranking", "Ranking"]].map(([id, l]) => (
            <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{l}{id === "entrenos" && state.active ? " ·" : ""}</button>
          ))}
        </div></nav>
      )}
    </div>
  );
}

const AVATAR = { male: "/avatar-male.jpg", female: "/avatar-female.jpg" };
