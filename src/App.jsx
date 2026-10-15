import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";
import * as native from "./lib/native";
import { Auth, NewPassword } from "./Auth.jsx";

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
    ["Kobeni Higashiyama", "Chainsaw Man", "Muerta de miedo y aun así sigue aquí. Empezar con miedo también cuenta."],
    ["Ochaco Uraraka", "My Hero Academia", "Aprendiendo a controlar su propio peso. Postura, respiración y técnica."],
    ["Nami", "One Piece", "Lista y organizada: dos meses cuadrando comidas y entrenos."],
    ["Asuka Langley", "Neon Genesis Evangelion", "Orgullo de piloto: entrena para no depender de nadie."],
    ["Nobara Kugisaki", "Jujutsu Kaisen", "Fuerte y sin pedir perdón por ello. Kilos a la barra con técnica limpia."],
    ["Lucy", "Cyberpunk: Edgerunners", "Medio año de foco, sin distraerse con el ruido. Primera dominada."],
    ["Annie Leonhart", "Attack on Titan", "Técnica de combate pulida a base de repetir. Fuerza seca y precisa."],
    ["Cha Hae-in", "Solo Leveling", "Cazadora de rango S. Un año entero sin parar."],
    ["Mirko", "My Hero Academia", "Piernas y potencia forjadas entrenando, sin trucos."],
    ["Mikasa Ackerman", "Attack on Titan", "Control total del cuerpo y una espalda de soldado de élite."],
    ["Yuki Tsukumo", "Jujutsu Kaisen", "Hechicera de grado especial. Dos años de fuerza atlética de élite."],
    ["Maki Zenin", "Jujutsu Kaisen", "Boss final. Sin don, sin energía maldita: construida a mano."],
  ],
  male: [
    ["Reigen Arataka", "Mob Psycho 100", "Sin poderes. Solo decidirse y empezar."],
    ["Denji", "Chainsaw Man", "Comer bien, dormir en una cama y primeros entrenos regulares."],
    ["Eijiro Kirishima", "My Hero Academia", "Dureza construida resistiendo cada día. Primera dominada."],
    ["David Martinez", "Cyberpunk: Edgerunners", "Mucha intensidad. Toca aprender a regularla para no quemarse."],
    ["Ippo Makunouchi", "Hajime no Ippo", "De recibir golpes a darlos. Básicos repetidos hasta dominarlos."],
    ["Thorfinn", "Vinland Saga", "Años de esfuerzo físico. Ahora sabe para qué entrena."],
    ["Mamoru Takamura", "Hajime no Ippo", "Un cuerpo de campeón mundial hecho a base de disciplina."],
    ["Yuji Itadori", "Jujutsu Kaisen", "Un año sin parar. Fuerza explosiva y corazón honesto."],
    ["Levi Ackerman", "Attack on Titan", "Control milimétrico de la fuerza relativa. Dominadas perfectas."],
    ["Roronoa Zoro", "One Piece", "Entrena con cargas colosales entre combate y combate. Cero excusas."],
    ["Sung Jinwoo", "Solo Leveling", "El cazador más débil que subió de nivel con su misión diaria."],
    ["Toji Fushiguro", "Jujutsu Kaisen", "Boss final. Físico puro sin energía maldita: el techo del cuerpo humano."],
  ],
};
for (const b of ["female", "male"]) LEVELS[b] = LEVELS[b].map(([name, series, line], i) => lv(b, i, name, series, line));

// Modo gymrat: la misma rata para todas, con 9 fases. Requisitos según la rama.
const RAT_STAGES = [
  ["Chuminá", "La rata con ojeras que acaba de descubrir el gimnasio."],
  ["Pardillo", "Mancuernas de juguete y sudor de verdad."],
  ["Enclenque", "Ya enseña bíceps, hay que creérselo."],
  ["Papafrita", "Blandita por fuera, pero se agarra al banco."],
  ["Mantecado", "Se deshace en las series, pero ya se nota la masa."],
  ["Mazao", "La camiseta le pide perdón."],
  ["Tanque", "No se mueve del banco y nadie se atreve a pedírselo."],
  ["Bestia", "El banco está preocupado."],
  ["Leyenda", "El gimnasio se mide en antes y después de ella."],
];
const RAT_STEPS = [0, 1, 2, 3, 5, 6, 8, 10, 11]; // equivalencia con los 12 niveles de anime
const RAT_LEVELS = Object.fromEntries(["female", "male"].map((b) => [b,
  RAT_STAGES.map(([name, line], i) => ({ ...LEVELS[b][RAT_STEPS[i]], name, series: "Modo gymrat", line })),
]));
const levelsOf = (branch, mode) => (mode === "gymrat" ? RAT_LEVELS : LEVELS)[branch] || LEVELS.female;
const levelKey = (branch, mode, i) => (mode === "gymrat" ? `rat:${i}` : `lvl:${branch}:${i}`);

// [frase, quién, de dónde, explicación, tipo]
let QUOTES = [
  // ---- Anime ----
  ["Un perdedor puede superar a un genio a base de esfuerzo.", "Rock Lee", "Naruto", "Lee no podía usar ninjutsu y aun así se ganó un sitio entre los mejores. Aquí nadie necesita talento para subir de nivel.", "cita"],
  ["No voy a huir ni a retirar mi palabra. Ese es mi camino ninja.", "Naruto Uzumaki", "Naruto", "Si te has dicho que hoy entrenas, hoy entrenas. Cúmplete a ti misma.", "cita"],
  ["Ve más allá. ¡Plus Ultra!", "All Might", "My Hero Academia", "Esa última repetición con buena técnica es tu Plus Ultra de hoy.", "cita"],
  ["Tú también puedes ser un héroe.", "All Might", "My Hero Academia", "Se lo dijo a un chaval sin poderes. Ese chaval acabó siendo el número uno.", "cita"],
  ["Si ganas, vives. Si pierdes, mueres. Si no luchas, no puedes ganar.", "Eren Yeager", "Attack on Titan", "Para los días en que el sofá te llama: presentarte ya es luchar.", "cita"],
  ["¡Entregad vuestros corazones!", "Erwin Smith", "Attack on Titan", "Hoy dalo todo en el entreno. Mañana descansas.", "cita"],
  ["Este mundo es cruel, y aun así es tan hermoso.", "Mikasa Ackerman", "Attack on Titan", "Entrenar cuesta, y verte más fuerte merece cada gota de sudor.", "cita"],
  ["Elige aquello de lo que menos te vayas a arrepentir.", "Levi Ackerman", "Attack on Titan", "¿Te arrepentirás más de ir al gym cansada o de no haber ido? Ya lo sabes.", "cita"],
  ["Tranquilo, soy el más fuerte.", "Satoru Gojo", "Jujutsu Kaisen", "Dilo antes de ponerte bajo la barra. La confianza también se entrena.", "cita"],
  ["Eres fuerte, así que ayuda a los demás.", "El abuelo de Itadori", "Jujutsu Kaisen", "Tu fuerza también sirve para animar a la amiga que no se atreve a empezar.", "cita"],
  ["Huir de lo que te hace daño no tiene nada de malo.", "Reigen Arataka", "Mob Psycho 100", "Si un gym o una rutina te hacen sentir mal, cámbialos. Seguir entrenando es lo que importa.", "cita"],
  ["¿Cuándo muere una persona? Cuando es olvidada.", "Hiriluk", "One Piece", "Lo que no apuntas ni repites, se olvida. Registra tu serie.", "cita"],
  ["¡Los sueños de las personas nunca terminan!", "Barbanegra", "One Piece", "Di en voz alta qué quieres conseguir, aunque alguien se ría.", "cita"],
  ["¡Voy a ser el Rey de los Piratas!", "Monkey D. Luffy", "One Piece", "Luffy lo grita desde el capítulo uno sin vergüenza. Ponle nombre a tu meta.", "cita"],
  ["Cuando decidí perseguir mi sueño, ya había dejado atrás mi vida.", "Roronoa Zoro", "One Piece", "Comprometerte de verdad quita muchas dudas de golpe.", "cita"],
  ["Nada… No ha pasado nada.", "Roronoa Zoro", "One Piece", "Cuando acabas destrozada la pierna y aun así sonríes al salir del gym.", "cita"],
  ["No todo el que se esfuerza triunfa, pero todo el que ha triunfado se ha esforzado.", "Kamogawa", "Hajime no Ippo", "El esfuerzo no te asegura el resultado. Es lo único que te da opciones.", "cita"],
  ["Quiero saber qué significa ser fuerte.", "Ippo Makunouchi", "Hajime no Ippo", "Ippo empezó por esa pregunta y lleva más de mil capítulos respondiéndola.", "cita"],
  ["No tienes enemigos. Nadie tiene enemigos.", "Thors", "Vinland Saga", "Ni la chica de al lado ni tu cuerpo son tus enemigos. Entrena desde ahí.", "cita"],
  ["Un verdadero guerrero no necesita espada.", "Thors", "Vinland Saga", "La fuerza de verdad se nota en cómo tratas a los demás.", "cita"],
  ["No debo huir. No debo huir. No debo huir.", "Shinji Ikari", "Neon Genesis Evangelion", "Shinji lo repite temblando y se sube igual. Puedes ir al gym con miedo.", "cita"],
  ["Soy infantil y odio perder.", "L", "Death Note", "Tu mejor rival es tu marca de la semana pasada. Gánale.", "cita"],
  ["Si vas a golpear algo, golpéalo hasta romperlo.", "Tooru Oikawa", "Haikyuu!!", "Cuando algo te cueste, insiste hasta que deje de costarte.", "cita"],
  ["¡Arde, corazón!", "Kyojuro Rengoku", "Demon Slayer", "Para cuando la motivación se apaga a mitad de entreno.", "cita"],
  ["Levántate y camina. Sigue adelante. Tienes un buen par de piernas.", "Edward Elric", "Fullmetal Alchemist", "Tienes piernas. Hoy toca usarlas.", "cita"],
  ["Levántate.", "Sung Jinwoo", "Solo Leveling", "El cazador más débil del mundo subió de nivel con su misión diaria. Tu misión hoy: levantarte e ir.", "cita"],
  ["El esfuerzo no vale nada si no crees en ti misma.", "Naruto Uzumaki", "Naruto", "Entrena a tu cabeza para creer en lo que estás construyendo.", "cita"],

  // ---- Películas ----
  ["No importa lo fuerte que golpees. Importa lo fuerte que te pueden golpear y seguir avanzando.", "Rocky Balboa", "Rocky Balboa", "Una mala semana, un catarro, exámenes. Lo importante es volver el lunes.", "cita"],
  ["Vas a comer rayos y vas a cagar truenos.", "Mickey", "Rocky III", "Mood de día de pierna.", "cita"],
  ["Un paso a la vez, un golpe a la vez, un asalto a la vez.", "Rocky Balboa", "Creed", "No pienses en el año entero. Piensa en esta serie.", "cita"],
  ["Protégete siempre.", "Frankie Dunn", "Million Dollar Baby", "Cuida tu técnica, tu descanso y tu cabeza. Sin eso no hay progreso que dure.", "cita"],
  ["Si hay magia en el boxeo, es la de pelear más allá de lo que aguantas.", "Scrap", "Million Dollar Baby", "Maggie empezó a los 31 sin que nadie quisiera entrenarla. Nunca es tarde.", "cita"],
  ["Nunca dejes que nadie te diga que no puedes hacer algo. Ni siquiera yo.", "Chris Gardner", "En busca de la felicidad", "Y menos la vocecita que te dice que eso no es para ti.", "cita"],
  ["No hay ingrediente secreto.", "El padre de Po", "Kung Fu Panda", "No hay atajos. Hay constancia.", "cita"],
  ["Ayer es historia, mañana es un misterio, pero hoy es un regalo.", "Maestro Oogway", "Kung Fu Panda", "Solo puedes entrenar hoy. Hazlo.", "cita"],
  ["Dar cera, pulir cera.", "Señor Miyagi", "Karate Kid", "Los básicos aburridos son los que luego te salvan.", "cita"],
  ["Hazlo o no lo hagas, pero no lo intentes.", "Yoda", "El Imperio contraataca", "Ve a por la serie con la cabeza puesta.", "cita"],
  ["¿Por qué nos caemos? Para aprender a levantarnos.", "Thomas Wayne", "Batman Begins", "Un mal entreno también enseña.", "cita"],
  ["Hay una diferencia entre conocer el camino y recorrerlo.", "Morfeo", "Matrix", "Saber la teoría está bien. Ir al gym está mejor.", "cita"],
  ["El miedo es el asesino de la mente.", "Paul Atreides", "Dune", "El miedo a hacerlo mal no te puede quitar el entreno.", "cita"],
  ["Lo único que debemos decidir es qué hacer con el tiempo que se nos ha dado.", "Gandalf", "El Señor de los Anillos", "Una hora al día te cambia el año.", "cita"],
  ["Cualquiera puede cocinar.", "Auguste Gusteau", "Ratatouille", "Hoy prueba una receta del Modo Sanji. Remy te mira.", "cita"],

  // ---- Deporte ----
  ["Odiaba cada minuto de entrenamiento, pero me decía: no abandones. Sufre ahora y vive el resto de tu vida como un campeón.", "Muhammad Ali", "Boxeo", "Ni a Ali le apetecía siempre. Lo hacía igual.", "cita"],
  ["He fallado más de 9.000 tiros en mi carrera. Por eso tengo éxito.", "Michael Jordan", "Baloncesto", "Cada serie fallida es un dato para la siguiente.", "cita"],
  ["Todo lo negativo, la presión, los retos, es una oportunidad para crecer.", "Kobe Bryant", "Baloncesto", "Ese peso que te intimida es tu próxima oportunidad.", "cita"],
  ["Solo los disciplinados son libres.", "Eliud Kipchoge", "Maratón", "La disciplina te ahorra decidir cada día si vas o no.", "cita"],
  ["No temo al hombre que ha practicado 10.000 patadas una vez, sino al que ha practicado una patada 10.000 veces.", "Bruce Lee", "Artes marciales", "Domina la sentadilla antes de buscar la variante rara.", "cita"],
  ["Sé agua, amigo mío.", "Bruce Lee", "Artes marciales", "Si la máquina está ocupada, cambia de ejercicio. Adáptate y sigue.", "cita"],
  ["Nadie va a venir a salvarte.", "David Goggins", "Ultrafondo", "Duro, pero liberador: el cambio depende de ti.", "cita"],
  ["El dolor es inevitable. El sufrimiento es opcional.", "Haruki Murakami", "De qué hablo cuando hablo de correr", "Las piernas arden, pero lo que te cuentas mientras lo eliges tú.", "cita"],

  // ---- Pensamiento ----
  ["Lo que se interpone en el camino se convierte en el camino.", "Marco Aurelio", "Meditaciones", "Si una lesión te frena un ejercicio, trabaja lo que sí puedes.", "cita"],
  ["Ningún ser humano es libre si no es dueño de sí mismo.", "Epicteto", "Filosofía estoica", "Ganarle a la pereza también es libertad.", "cita"],
  ["No es que tengamos poco tiempo, es que perdemos mucho.", "Séneca", "Sobre la brevedad de la vida", "Una hora de entreno es menos de lo que se va en scroll.", "cita"],
  ["Somos lo que hacemos repetidamente.", "Will Durant, sobre Aristóteles", "Filosofía", "Un día de gym no cambia nada. Cien seguidos, sí.", "cita"],
  ["Quien tiene un porqué para vivir puede soportar casi cualquier cómo.", "Friedrich Nietzsche", "Filosofía", "Ten claro para qué entrenas. El cómo se aguanta mejor.", "cita"],
  ["Cuando ya no podemos cambiar una situación, tenemos el reto de cambiarnos a nosotros mismos.", "Viktor Frankl", "El hombre en busca de sentido", "No controlas tu genética. Sí lo que haces con ella.", "cita"],
  ["Un viaje de mil millas comienza con un solo paso.", "Lao Tse", "Tao Te Ching", "Tu primer paso puede ser abrir la app y mirar tu rutina.", "cita"],
  ["Cada acción que haces es un voto por la persona que quieres ser.", "James Clear", "Hábitos atómicos", "Cada vaso de agua y cada serie cuentan como voto.", "cita"],
  ["No subes al nivel de tus metas. Caes al nivel de tus sistemas.", "James Clear", "Hábitos atómicos", "Por eso aquí subes de nivel con hábitos, no con propósitos de año nuevo.", "cita"],
  ["Nadie puede hacerte sentir inferior sin tu consentimiento.", "Eleanor Roosevelt", "Política y activismo", "Tu sitio en la zona de pesas es tuyo.", "cita"],
  ["Pies, ¿para qué os quiero si tengo alas para volar?", "Frida Kahlo", "Diario", "Frida pintó con dolor toda su vida. Tu cuerpo puede más de lo que crees.", "cita"],
  ["Nada en la vida debe ser temido, solo comprendido.", "Marie Curie", "Ciencia", "Entender la técnica quita el miedo a la barra.", "cita"],
  ["Atribuyo mi éxito a esto: nunca di ni acepté una excusa.", "Florence Nightingale", "Enfermería", "La fundadora de la enfermería moderna, también en el gym.", "cita"],
  ["Quiérete a ti misma. Habla por ti misma.", "BTS", "Discurso en la ONU", "Entrenar por amor a tu cuerpo, no por castigo.", "cita"],
];

/* ============================ ENTRENO ============================ */

// Base de datos de ejercicios de Luna (ARC-001 a ARC-068) + ARC-X: añadidos para tus rutinas, pendientes de tu ficha.
// [id, grupo, nombre, músculo, equipo, explicación simple, truquito]
const EX_DB = [
  ["ARC-001", "Pecho", "Flexiones", "Pectoral, tríceps, hombro anterior", "Peso corporal", "Apoyada en las manos y las puntas de los pies, bajas el pecho hacia el suelo flexionando los codos y vuelves a subir con el cuerpo recto como una tabla.", "Codos a unos 45° del cuerpo, no abiertos en cruz. Si no puedes con el suelo, apoya las manos en un banco y ve bajando la altura con las semanas."],
  ["ARC-002", "Pecho", "Press plano con mancuernas", "Pectoral", "Mancuernas", "Lo mismo que el press de banca con barra, pero cada brazo se mueve de forma independiente, así que exige más estabilidad.", "Baja las mancuernas hasta notar un estiramiento cómodo en el pecho, no hasta tocar el cuerpo. Bajar de más solo mete tensión en el hombro."],
  ["ARC-003", "Pecho", "Press inclinado con mancuernas", "Pectoral superior", "Mancuernas", "Igual que el anterior pero en un banco inclinado, para darle más trabajo a la parte alta del pecho.", "Un ángulo de 30-45° es suficiente. Si inclinas demasiado el banco, dejas de trabajar pecho y empiezas a trabajar hombro."],
  ["ARC-004", "Pecho", "Press de pecho en máquina", "Pectoral", "Máquina", "Empujas el peso hacia delante desde el pecho, con el recorrido ya guiado por la máquina.", "Aprieta los omóplatos entre sí antes de empezar cada repetición. Si no lo haces, el hombro se lleva parte del trabajo que debería hacer el pecho."],
  ["ARC-005", "Pecho", "Aperturas en máquina (pec deck)", "Pectoral", "Máquina", "Llevas los brazos desde abiertos hasta juntos por delante del pecho, en un movimiento de \"abrazo\".", "Codos ligeramente flexionados y fijos durante todo el recorrido. Si los flexionas y estiras, se convierte en press, no en aislamiento de pecho."],
  ["ARC-006", "Pecho", "Fondos en paralelas o banco", "Pectoral inferior, tríceps", "Peso corporal", "Bajas el cuerpo flexionando los codos y subes empujando, usando tu propio peso como carga.", "Inclina un poco el torso hacia delante si quieres más pecho; mantente más vertical si quieres más tríceps."],
  ["ARC-007", "Espalda", "Dominadas", "Dorsal ancho, bíceps", "Peso corporal", "Colgada de una barra con las palmas mirando hacia delante, tiras del cuerpo hacia arriba hasta pasar la barbilla por encima de la barra y bajas controlada.", "Antes de doblar los codos, baja los hombros alejándolos de las orejas. Piensa en llevar los codos al suelo, no en tirar con los brazos."],
  ["ARC-008", "Espalda", "Dominada asistida", "Dorsal ancho, bíceps", "Máquina / banda", "Versión de dominada con ayuda de un contrapeso o una banda elástica, para quienes todavía no hacen la dominada completa.", "Controla también la bajada, no solo la subida. Bajar lento es lo que más construye fuerza para llegar a la dominada sin ayuda."],
  ["ARC-009", "Espalda", "Jalón al pecho agarre prono", "Dorsal ancho", "Polea", "Tiras de la barra desde arriba hacia el pecho, sentada con las piernas ancladas.", "Antes de tirar con el brazo, lleva primero los hombros hacia abajo y atrás. Así activas la espalda antes que el bíceps."],
  ["ARC-010", "Espalda", "Jalón al pecho agarre supino", "Dorsal ancho, bíceps", "Polea", "Igual que el jalón normal, pero con las palmas mirando hacia ti y las manos a la anchura de los hombros. Trabaja el dorsal con algo más de bíceps.", "Lleva los codos hacia las costillas y saca pecho al llegar abajo. Con este agarre es fácil tirar solo con el bíceps; piensa en la espalda."],
  ["ARC-011", "Espalda", "Jalón unilateral en máquina (dorsal)", "Dorsal ancho", "Máquina", "Tiras de un asa con un solo brazo, llevando el codo hacia la cadera. Así trabajas cada lado de la espalda por separado y notas mejor el dorsal.", "Inclina un poco el torso hacia el lado que trabajas y no gires el cuerpo para ayudarte. Aguanta 1 segundo en la contracción."],
  ["ARC-012", "Espalda", "Remo en T", "Dorsal, trapecio medio, romboides", "Barra / máquina", "Inclinada hacia delante con una barra anclada por un extremo, tiras del peso hacia el abdomen. Se trabaja toda la espalda con mucha carga.", "Mantén el pecho alto y la espalda recta, y lleva los codos hacia atrás pegados al cuerpo. Si se te redondea la espalda, baja el peso."],
  ["ARC-013", "Espalda", "Remo agarre neutro sentado", "Dorsal, romboides", "Polea / máquina", "Sentada frente a la polea o la máquina, tiras del agarre con las palmas enfrentadas hacia tu abdomen, juntando los omóplatos.", "Primero lleva los hombros hacia atrás y luego los codos. Aguanta 1 segundo y vuelve despacio, sin inclinarte hacia delante al estirar."],
  ["ARC-014", "Espalda", "Remo agarre prono en máquina sentado", "Dorsal alto, trapecio, romboides", "Máquina", "Sentada con el pecho apoyado, tiras de las asas con las palmas hacia abajo y los codos abiertos, para trabajar la parte alta y media de la espalda.", "Agarre algo más abierto que los hombros. Lleva primero los hombros atrás y después los codos. Controla la vuelta: ahí se construye."],
  ["ARC-015", "Espalda", "Remo con mancuerna a una mano", "Dorsal, romboides", "Mancuerna", "Apoyas una rodilla y una mano en un banco, y tiras de la mancuerna con el otro brazo hacia la cadera.", "Evita rotar el torso al tirar. Si giras el cuerpo para ayudarte, es que el peso es demasiado alto."],
  ["ARC-016", "Espalda", "Remo con barra", "Dorsal, trapecio, romboides", "Barra", "Inclinada hacia delante con una barra en las manos, tiras de ella hacia el abdomen y la bajas controlada.", "Fija el torso desde el principio y no lo muevas. Si necesitas balancearte para subir la barra, baja el peso."],
  ["ARC-017", "Espalda", "Pull-over con mancuerna", "Dorsal ancho, pectoral", "Mancuerna", "Tumbada en un banco, bajas una mancuerna con los brazos casi rectos por detrás de la cabeza y la vuelves a subir, trabajando espalda y pecho a la vez.", "Piensa en mover el peso en un arco, con los brazos casi rectos. Si flexionas los codos, se convierte en un ejercicio de tríceps."],
  ["ARC-018", "Espalda", "Reverse fly con mancuernas", "Deltoide posterior, espalda alta", "Mancuernas", "Inclinada hacia delante, abres los brazos hacia los lados con mancuernas, como si quisieras juntar los omóplatos.", "Piensa en llevar los codos hacia fuera, no las manos. Usa poco peso: el hombro posterior es un músculo pequeño."],
  ["ARC-019", "Espalda", "Reverse fly en máquina", "Deltoide posterior, espalda alta", "Máquina", "Sentada mirando hacia el respaldo de la máquina, llevas los brazos hacia atrás y hacia los lados para trabajar la parte de atrás del hombro.", "Ajusta el asiento para que las asas queden a la altura del hombro y no encojas los hombros hacia las orejas."],
  ["ARC-020", "Espalda", "Face pull", "Deltoide posterior, trapecio, manguito", "Polea", "Con una cuerda en una polea a la altura de la cara, tiras hacia ti separando las manos, como si fueras a tocarte las orejas con los pulgares.", "Tira hacia la cara abriendo las manos y piensa en enseñar los codos. Usa poco peso y mucho control."],
  ["ARC-021", "Espalda", "Peso muerto convencional", "Espalda baja, glúteo, isquiotibiales", "Barra", "Levantas una barra cargada del suelo hasta quedar completamente de pie, manteniendo la espalda recta todo el recorrido.", "Antes de tirar, empuja el suelo con los pies y aprieta las axilas como si guardaras algo debajo. La barra siempre pegada a las piernas."],
  ["ARC-022", "Hombro", "Press militar con mancuernas", "Deltoide anterior y lateral, tríceps", "Mancuernas", "De pie o sentada, empujas las mancuernas desde la altura de los hombros hacia arriba.", "Aprieta el abdomen como si te fueran a dar un golpe en el estómago. Evita que la zona lumbar se arquee al empujar."],
  ["ARC-023", "Hombro", "Press de hombro en máquina", "Deltoide anterior y lateral", "Máquina", "Empujas el peso hacia arriba por encima de la cabeza, sentada, con el recorrido guiado.", "Baja solo hasta la altura de la barbilla/oreja, no más. Bajar en exceso mete tensión innecesaria en la articulación del hombro."],
  ["ARC-024", "Hombro", "Press Arnold", "Deltoide (las tres porciones)", "Mancuernas", "Press de hombro con mancuernas, pero empiezas con las palmas mirando hacia ti y vas rotando las muñecas mientras subes, hasta acabar con las palmas hacia delante arriba.", "Gira las muñecas de forma fluida mientras subes y usa menos peso que en el press normal. Es un ejercicio más técnico."],
  ["ARC-025", "Hombro", "Elevaciones laterales con mancuernas", "Deltoide lateral", "Mancuernas", "De pie, levantas los brazos hacia los lados hasta la altura del hombro.", "Imagina que estás vertiendo agua de una jarra al subir (muñeca ligeramente rotada hacia abajo). Ayuda a que trabaje el hombro y no el trapecio."],
  ["ARC-026", "Hombro", "Elevaciones laterales en máquina", "Deltoide lateral", "Máquina", "Sentada, abres los brazos hacia los lados contra las almohadillas hasta la altura de los hombros. La máquina guía el recorrido.", "Empuja con los codos, no con las manos. No subas por encima de la altura de los hombros y no encojas el trapecio."],
  ["ARC-027", "Hombro", "Elevaciones laterales en polea", "Deltoide lateral", "Polea", "Lo mismo que con mancuernas, pero con el cable de una polea baja, lo que mantiene tensión constante en todo el recorrido.", "Colócate algo alejada de la polea y deja que el brazo cruce ligeramente por delante del cuerpo al empezar; así el músculo trabaja desde el primer grado del movimiento."],
  ["ARC-028", "Hombro", "Elevaciones frontales con mancuernas", "Deltoide anterior", "Mancuernas", "De pie, levantas una o dos mancuernas hacia delante hasta la altura del hombro, con los brazos casi rectos.", "Sube solo hasta la altura de los ojos y baja lento. Si balanceas el cuerpo, la mancuerna pesa de más."],
  ["ARC-029", "Bíceps", "Curl de bíceps en máquina", "Bíceps braquial", "Máquina", "Sentada o de pie, flexionas el codo contra resistencia para acercar el peso al hombro.", "No uses impulso de los hombros. Si te cuesta subir sin balancearte, el peso es demasiado alto."],
  ["ARC-030", "Bíceps", "Curl predicador", "Bíceps braquial", "Máquina", "Con los brazos apoyados en un soporte inclinado, flexionas los codos para subir el peso y bajas hasta casi estirar el brazo. El soporte evita que hagas trampa.", "Baja del todo, hasta estirar el codo sin perder la tensión, y no despegues las axilas del apoyo al subir."],
  ["ARC-031", "Bíceps", "Curl con mancuernas agarre abierto", "Bíceps braquial", "Mancuernas", "Variante con los codos y las manos algo separados del cuerpo: subes las mancuernas hacia los hombros girando las palmas hacia arriba.", "Separa los codos solo un poco del torso y no los adelantes al subir. Controla la bajada."],
  ["ARC-032", "Bíceps", "Curl con mancuernas agarre cerrado", "Bíceps braquial", "Mancuernas", "Variante con los codos pegados al torso y las manos cerca de las caderas: subes las mancuernas hacia el centro del pecho.", "Pega los codos a las costillas y que no se muevan hacia delante. Si te cuesta subir sin balancearte, el peso es demasiado."],
  ["ARC-033", "Bíceps", "Curl de bíceps con barra en polea", "Bíceps braquial", "Polea", "De pie frente a una polea baja con una barra, flexionas los codos para subirla hacia el pecho y bajas despacio.", "Bajada controlada, estirando hasta abajo sin perder la tensión. Al subir, cuidado con no elevar los hombros."],
  ["ARC-034", "Tríceps", "Extensión de tríceps en polea", "Tríceps (las tres cabezas)", "Polea", "De pie frente a una polea alta, extiendes el codo empujando una cuerda o barra hacia abajo.", "Codos pegados al cuerpo y fijos, como si estuvieran clavados ahí. Solo se mueve el antebrazo."],
  ["ARC-035", "Tríceps", "Extensión de tríceps trasnuca en polea", "Tríceps (cabeza larga)", "Polea", "De espaldas a la polea, con la cuerda detrás de la cabeza, estiras los codos hacia delante y arriba y los vuelves a doblar. Trabaja mucho la parte larga del tríceps.", "Mantén los codos apuntando hacia delante, cerca de las orejas, y que solo se muevan los antebrazos. Si los codos se abren, baja el peso."],
  ["ARC-036", "Tríceps", "Extensión de tríceps trasnuca con mancuerna de pie", "Tríceps (cabeza larga)", "Mancuerna", "De pie, sujetas una mancuerna con las dos manos por encima de la cabeza, la bajas detrás de la nuca doblando los codos y la subes estirando los brazos.", "Codos apuntando al frente y cerca de la cabeza. Aprieta el abdomen para no arquear la espalda al subir."],
  ["ARC-037", "Tríceps", "Fondos de tríceps en banco", "Tríceps", "Peso corporal", "Apoyas las manos en un banco detrás de ti y bajas el cuerpo flexionando los codos.", "Cuanto más alejados tengas los pies del banco, más difícil se hace. Empieza con las rodillas flexionadas si es tu primera vez."],
  ["ARC-038", "Cuádriceps", "Prensa horizontal", "Cuádriceps, glúteo", "Máquina", "Empujas una plataforma con peso usando las piernas, sentada en un ángulo prácticamente plano.", "No bloquees la rodilla del todo arriba. Quedarte a medio estirar mantiene la tensión en el músculo en vez de pasarla a la articulación."],
  ["ARC-039", "Cuádriceps", "Prensa inclinada (45°)", "Cuádriceps, glúteo", "Máquina", "La versión más común de prensa, en ángulo, donde empujas el peso hacia arriba con las piernas.", "La posición de los pies cambia el enfoque: más arriba en la plataforma = más glúteo y femoral; más abajo = más cuádriceps."],
  ["ARC-040", "Cuádriceps", "Prensa vertical (acostada)", "Cuádriceps, glúteo", "Máquina", "Te tumbas bocarriba y empujas el peso hacia arriba, en vertical sobre ti.", "Cuidado con bajar demasiado: si la zona lumbar se despega del respaldo, es que has bajado más de lo que tu movilidad permite de forma segura."],
  ["ARC-041", "Cuádriceps", "Extensión de cuádriceps", "Cuádriceps", "Máquina", "Sentada, extiendes las piernas contra una resistencia hasta quedar rectas.", "Agárrate a las asas laterales tirando hacia abajo. Fija tu cuerpo y evita que compenses con la cadera."],
  ["ARC-042", "Cuádriceps", "Sentadilla con multipower", "Cuádriceps, glúteo", "Multipower", "Sentadilla con la barra fijada a unos raíles, que guían el movimiento verticalmente.", "Coloca los pies un poco más adelantados que en una sentadilla libre. Como la barra va recta, necesitas ese ajuste para no forzar el tobillo."],
  ["ARC-043", "Cuádriceps", "Sentadilla goblet con mancuerna", "Cuádriceps, glúteo", "Mancuerna", "Sentadilla sujetando una mancuerna o pesa rusa pegada al pecho con ambas manos.", "Usa el peso como \"contrapeso\" para mantenerte erguida: te ayuda a bajar más profundo sin perder el equilibrio."],
  ["ARC-044", "Cuádriceps", "Sumo en máquina de cinturón (belt squat)", "Cuádriceps, glúteo, aductores", "Máquina", "Te pones un cinturón enganchado a la máquina y haces sentadilla con las piernas bien abiertas, sin que el peso cargue sobre la columna.", "Empuja el suelo con todo el pie y abre las rodillas hacia las puntas de los pies. Si se te cierran hacia dentro, baja el peso."],
  ["ARC-045", "Cuádriceps", "Zancadas con mancuernas", "Cuádriceps, glúteo", "Mancuernas", "Con una mancuerna en cada mano, das un paso largo hacia delante y bajas doblando ambas rodillas, luego vuelves a la posición inicial.", "Da un paso lo bastante largo para que la rodilla de delante no sobrepase la punta del pie. Mira al frente, no al suelo."],
  ["ARC-046", "Cuádriceps", "Zancadas en Smith", "Cuádriceps, glúteo", "Multipower", "La misma zancada, pero con la barra guiada en los raíles de la máquina apoyada en los hombros, para mayor estabilidad.", "Coloca los pies un poco más adelantados que la barra. Así la rodilla delantera no se va hacia delante y trabajas más glúteo y cuádriceps."],
  ["ARC-047", "Cuádriceps", "Step up en banco", "Cuádriceps, glúteo", "Banco / peso corporal", "Subes a un banco o cajón con una pierna, apoyando todo el peso en ella hasta quedar de pie arriba, y bajas controlado.", "Empuja con el talón de la pierna que sube y no te ayudes con el pie de abajo. Elige una altura que te permita bajar con control."],
  ["ARC-048", "Cuádriceps", "Step up con polea", "Cuádriceps, glúteo", "Polea + banco", "El mismo movimiento de subir al banco, pero con una polea baja enganchada a la cintura o los hombros para añadir resistencia extra.", "Mantén el cable siempre tenso y no te impulses con la pierna de atrás. Si el cable tira de ti hacia delante, el peso es demasiado."],
  ["ARC-049", "Femoral", "Femoral tumbado", "Isquiotibiales", "Máquina", "Tumbada boca abajo, flexionas las rodillas llevando los talones hacia el glúteo contra resistencia.", "No levantes la cadera del banco al flexionar. Si la cadera sube, estás usando glúteo en vez de femoral."],
  ["ARC-050", "Femoral", "Femoral sentado", "Isquiotibiales", "Máquina", "Sentada, con las piernas estiradas sobre un rodillo, flexionas las rodillas llevando el rodillo hacia abajo/atrás.", "Mantén la espalda pegada al respaldo durante todo el recorrido; despegarla resta tensión al músculo que estás trabajando."],
  ["ARC-051", "Femoral", "Peso muerto rumano con mancuernas", "Isquiotibiales, glúteo", "Mancuernas", "Con las piernas casi rectas, bajas las mancuernas pegadas a las piernas manteniendo la espalda neutra, y vuelves a subir.", "La sensación de estiramiento en la parte de atrás del muslo es tu límite de bajada, no una distancia fija. Cuando notes ese tope, para ahí."],
  ["ARC-052", "Femoral", "Peso muerto rumano a una mano", "Isquiotibiales, glúteo", "Mancuerna", "Con una mancuerna en una mano, haces una bisagra de cadera: llevas el glúteo hacia atrás, bajas la mancuerna pegada a la pierna y vuelves a subir.", "Baja en 3-4 segundos y haz una micropausa abajo. Mantén la cadera cuadrada, sin girar el torso hacia el lado de la mancuerna."],
  ["ARC-053", "Femoral", "Buenos días", "Isquiotibiales, glúteo, lumbar", "Barra", "Con una barra ligera sobre la espalda alta, llevas la cadera hacia atrás inclinando el torso con la espalda recta y vuelves a subir.", "Empieza con muy poco peso. Baja hasta notar el estiramiento del femoral manteniendo la espalda recta; ese es tu límite de recorrido."],
  ["ARC-054", "Glúteo y cadera", "Hip thrust con barra", "Glúteo mayor", "Barra", "La versión con más carga: te apoyas en el banco con una barra con peso sobre la cadera (normalmente con una almohadilla protectora).", "Mira hacia abajo, no hacia delante, y aprieta el glúteo arriba 1-2 segundos. Si notas la zona lumbar, has subido demasiado."],
  ["ARC-055", "Glúteo y cadera", "Hip thrust a una pierna", "Glúteo mayor", "Peso corporal / banco", "Igual que el hip thrust normal, pero con una sola pierna apoyada y la otra estirada en el aire, para trabajar cada lado por separado.", "Empieza por la pierna que peor te sale y repite el mismo número de repeticiones en la otra. Mantén la cadera nivelada, sin girar."],
  ["ARC-056", "Glúteo y cadera", "Hip thrust con banda elástica", "Glúteo mayor y medio", "Banda elástica", "El mismo movimiento, con una banda elástica rodeando las rodillas que te obliga a empujarlas hacia fuera mientras subes.", "Empuja las rodillas hacia fuera durante toda la repetición. Si se juntan, baja la carga."],
  ["ARC-057", "Glúteo y cadera", "Patada de glúteo en máquina", "Glúteo mayor", "Máquina", "Empujas una plataforma hacia atrás con una pierna, en una máquina específica para glúteo.", "No uses impulso ni balanceo del cuerpo. El movimiento debe salir solo de la cadera hacia atrás, despacio."],
  ["ARC-058", "Glúteo y cadera", "Patada de glúteo a cuatro patas", "Glúteo mayor", "Peso corporal", "Apoyada en manos y rodillas, llevas una pierna hacia atrás y arriba manteniendo la rodilla flexionada.", "Aprieta el glúteo con fuerza en la parte más alta del movimiento durante 1 segundo antes de bajar."],
  ["ARC-059", "Glúteo y cadera", "Patada de rana", "Glúteo mayor", "Multipower / banco", "Apoyada en un banco frente al multipower, empujas la barra hacia arriba con la planta del pie y la rodilla flexionada. Trabaja el glúteo sin cargar la espalda.", "Agárrate bien al banco y mantén las piernas algo más abiertas que los hombros. Empuja con el glúteo, no con la zona lumbar."],
  ["ARC-060", "Glúteo y cadera", "Abducción de cadera en máquina", "Glúteo medio", "Máquina", "Sentada, separas las piernas hacia fuera contra resistencia.", "Inclínate ligeramente hacia delante en el asiento. Cambia el ángulo y mejora cuánto trabaja el glúteo frente a la cadera."],
  ["ARC-061", "Glúteo y cadera", "Aducción de cadera en máquina", "Aductores", "Máquina", "Sentada con las piernas abiertas contra las almohadillas, las cierras juntando los muslos y vuelves a abrir despacio. Trabaja la cara interna del muslo.", "Aguanta 1 segundo con las piernas juntas y controla la apertura en 3 segundos. No dejes que el peso te abra de golpe."],
  ["ARC-062", "Gemelo", "Gemelo de pie en máquina", "Gemelo", "Máquina", "De pie, te elevas sobre las puntas de los pies contra resistencia sobre los hombros.", "Baja el talón por debajo del nivel de la plataforma para estirar bien antes de volver a subir. El recorrido completo es lo que marca la diferencia aquí."],
  ["ARC-063", "Gemelo", "Gemelo sentado en máquina", "Sóleo", "Máquina", "Sentada, con el peso apoyado sobre las rodillas, te elevas sobre las puntas de los pies.", "Esta versión trabaja más la parte interna del gemelo (sóleo) que la de pie. Si solo haces una variante, te falta la otra."],
  ["ARC-064", "Abdomen", "Crunch abdominal en máquina", "Recto abdominal", "Máquina", "Sentada, flexionas el torso hacia delante contra resistencia.", "El movimiento es de la columna (te curvas), no de la cadera. Si \"doblas\" por la cintura sin curvar la espalda, no estás trabajando el abdomen de forma óptima."],
  ["ARC-065", "Abdomen", "Crunch en polea (de rodillas)", "Recto abdominal", "Polea", "De rodillas frente a una polea alta, flexionas el torso hacia abajo sujetando una cuerda junto a la cara.", "El movimiento sale de curvar la columna hacia abajo, no de bajar la cabeza ni tirar con los brazos. Los brazos solo sujetan el peso."],
  ["ARC-066", "Abdomen", "Plancha", "Core (transverso, recto)", "Peso corporal", "Mantienes el cuerpo recto apoyado en antebrazos y puntas de los pies, sin moverte.", "Aprieta los glúteos durante todo el ejercicio. Evita que la cadera se hunda, que es el fallo más común."],
  ["ARC-067", "Abdomen", "Elevación de piernas", "Abdomen inferior, flexores de cadera", "Peso corporal", "Levantas las piernas (rectas o flexionadas) usando el abdomen, en vez del impulso de las caderas.", "Si notas que trabaja más la zona lumbar o la cadera que el abdomen, flexiona más las rodillas hasta que sea manejable con buena técnica."],
  ["ARC-068", "Abdomen", "Bicicleta", "Oblicuos, recto abdominal", "Peso corporal", "Tumbada bocarriba, alternas llevar el codo contrario hacia la rodilla contraria, en un movimiento de pedaleo.", "Hazlo despacio y controlado. El beneficio real está en la rotación controlada, no en la velocidad."],
  // Añadidos (no están en tu base de datos): revisa y escribe tu propia ficha
  ["ARC-X01", "Cuádriceps", "Sentadilla búlgara en Smith", "Cuádriceps, glúteo", "Multipower + banco", "Con el empeine de atrás apoyado en un banco y la barra guiada sobre la espalda, bajas en vertical doblando la rodilla de delante.", "Pie de delante más adelantado = más glúteo; más cerca de la barra = más cuádriceps."],
  ["ARC-X02", "Femoral", "Peso muerto rumano en Smith", "Isquiotibiales, glúteo", "Multipower", "Bisagra de cadera con la barra guiada: llevas el glúteo hacia atrás y la barra baja pegada a las piernas.", "Para cuando notes el estiramiento del femoral, no cuando la barra llegue abajo."],
  ["ARC-X03", "Glúteo y cadera", "Patada de glúteo en polea", "Glúteo mayor", "Polea", "Con la tobillera enganchada a una polea baja, llevas la pierna hacia atrás desde la cadera y vuelves despacio.", "Inclínate un poco hacia delante y no arquees la zona lumbar al subir la pierna."],
  ["ARC-X04", "Pecho", "Press banca con barra", "Pectoral, tríceps", "Barra", "Tumbada en el banco, bajas la barra hasta el pecho y la empujas hasta estirar los brazos.", "Omóplatos juntos y pies firmes en el suelo; la barra baja a la altura del esternón."],
  ["ARC-X05", "Cuádriceps", "Sentadilla con barra", "Cuádriceps, glúteo", "Barra", "Con la barra sobre la espalda alta, bajas flexionando cadera y rodillas y vuelves a subir.", "Rodillas en la línea de las puntas de los pies y pecho alto todo el recorrido."],
  ["CARDIO", "Cardio", "Cardio (cinta inclinada, bici o elíptica)", "Corazón y piernas", "Máquina", "Ritmo en el que puedas hablar pero te cueste un poco.", "Si vas justa de tiempo, mejor 20 minutos que nada."],
  ["MOVILIDAD", "Movilidad", "Movilidad y estiramientos", "Todo el cuerpo", "Peso corporal", "Cadera, tobillos, espalda alta y hombros, sin prisa.", "Respira lento y no fuerces el estiramiento."],
];

const EX_EXTRA = {
  "ARC-042": { lift: "squat" },   // sentadilla en multipower cuenta para tu ratio
  "ARC-X05": { lift: "squat" },
  "ARC-021": { lift: "deadlift" },
  "ARC-X04": { lift: "bench" },
  "ARC-007": { pull: true, note: "No te preocupes si aún no te sale: en el vídeo tienes variantes (asistida, con banda y negativas)." },
  "ARC-066": { unit: "s" },
  "CARDIO": { unit: "min" },
  "MOVILIDAD": { unit: "min" },
};

let GROUPS = [...new Set(EX_DB.map((e) => e[1]))];
let EXERCISES = Object.fromEntries(EX_DB.map(([id, group, n, muscle, equip, simple, tip]) => [id, { id, group, n, muscle, equip, simple, tip, ...(EX_EXTRA[id] || {}) }]));

// sesiones guardadas con la versión anterior
const LEGACY_EX = { sentadilla: "ARC-X05", pesoMuerto: "ARC-021", pressBanca: "ARC-X04", dominadas: "ARC-007", hipThrust: "ARC-054", rumano: "ARC-051", bulgaras: "ARC-X01", prensa: "ARC-039", curlFemoral: "ARC-049", abduccion: "ARC-060", remo: "ARC-016", remoMancuerna: "ARC-015", pressMilitar: "ARC-022", elevLaterales: "ARC-025", jalon: "ARC-009", fondos: "ARC-006", flexiones: "ARC-001", crunch: "ARC-065", elevPiernas: "ARC-067", plancha: "ARC-066", cardio: "CARDIO", movilidad: "MOVILIDAD" };

// Días al estilo ARC: [ejercicio, series, reps, RIR, descanso en s]
const DAY_TEMPLATES = {
  piernaGluteo: { name: "Pierna y glúteo", ex: [["ARC-042", 4, "6–8", 2, 150], ["ARC-X01", 3, "8–10 por pierna", 2, 120], ["ARC-X02", 3, "8–10", 2, 120], ["ARC-049", 3, "10–12", 1, 90], ["ARC-060", 3, "12–15", 1, 60], ["ARC-X03", 3, "12–15 por pierna", 1, 60]] },
  espaldaBiceps: { name: "Espalda y bíceps", ex: [["ARC-007", 4, "máx.", 1, 150], ["ARC-009", 3, "8–10", 2, 120], ["ARC-013", 3, "10–12", 1, 90], ["ARC-011", 3, "10–12 por brazo", 1, 90], ["ARC-031", 3, "10–12", 1, 60], ["ARC-025", 3, "12–15", 1, 60], ["ARC-030", 3, "10–12", 1, 60]] },
  gluteoFemoral: { name: "Glúteo y femoral", ex: [["ARC-054", 4, "8–10", 1, 120], ["ARC-021", 3, "4–6", 2, 180], ["ARC-050", 3, "10–12", 1, 90], ["ARC-059", 3, "12–15", 1, 60], ["ARC-061", 3, "12–15", 1, 60], ["ARC-060", 3, "15", 1, 60]] },
  empuje: { name: "Pecho, hombro y tríceps", ex: [["ARC-003", 3, "8–10", 2, 120], ["ARC-004", 3, "10–12", 1, 90], ["ARC-023", 3, "8–10", 2, 90], ["ARC-027", 3, "12–15", 1, 60], ["ARC-034", 3, "10–12", 1, 60], ["ARC-035", 3, "10–12", 1, 60]] },
  cuadriceps: { name: "Cuádriceps y gemelo", ex: [["ARC-042", 4, "6–8", 2, 150], ["ARC-039", 3, "10–12", 1, 120], ["ARC-041", 3, "12–15", 1, 60], ["ARC-045", 3, "10 por pierna", 2, 90], ["ARC-062", 3, "12–15", 1, 60]] },
  calistenia: { name: "Calistenia y core", ex: [["ARC-007", 4, "máx.", 1, 120], ["ARC-001", 3, "máx.", 1, 90], ["ARC-006", 3, "máx.", 1, 90], ["ARC-067", 3, "10–15", 1, 60], ["ARC-066", 3, "30–45", 0, 60], ["ARC-068", 3, "20", 1, 45]] },
  cardioAbs: { name: "Cardio y abdominales", ex: [["CARDIO", 1, "30", 0, 60], ["ARC-064", 3, "12–15", 1, 60], ["ARC-065", 3, "12–15", 1, 60], ["ARC-067", 3, "10–15", 1, 60], ["ARC-066", 3, "45", 0, 60]] },
  fullA: { name: "Full body A", ex: [["ARC-042", 4, "6–8", 2, 150], ["ARC-054", 3, "8–10", 1, 120], ["ARC-009", 3, "8–10", 2, 90], ["ARC-004", 3, "10–12", 1, 90], ["ARC-025", 3, "12–15", 1, 60], ["ARC-066", 3, "30–45", 0, 60]] },
  fullB: { name: "Full body B", ex: [["ARC-021", 3, "4–6", 2, 180], ["ARC-007", 4, "máx.", 1, 150], ["ARC-039", 3, "10–12", 1, 120], ["ARC-013", 3, "10–12", 1, 90], ["ARC-023", 3, "8–10", 2, 90], ["ARC-065", 3, "12–15", 1, 60]] },
};
const SPLITS = {
  2: ["fullA", "fullB"],
  3: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral"],
  4: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje"],
  5: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje", "cuadriceps"],
  6: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje", "cuadriceps", "calistenia"],
  7: ["piernaGluteo", "espaldaBiceps", "gluteoFemoral", "empuje", "cuadriceps", "calistenia", "cardioAbs"],
};
// cada básico que cuenta para el nivel tiene que aparecer en la semana
const LIFT_HOME = {
  squat: { ex: "ARC-042", prefer: ["piernaGluteo", "cuadriceps", "fullA"] },
  deadlift: { ex: "ARC-021", prefer: ["gluteoFemoral", "fullB", "piernaGluteo"] },
  bench: { ex: "ARC-X04", prefer: ["empuje", "fullA", "espaldaBiceps"] },
};
function buildRoutine(days, branch) {
  const keys = SPLITS[days] || SPLITS[3];
  const plan = keys.map((k) => ({ key: k, ex: [...DAY_TEMPLATES[k].ex] }));
  const lifts = branch === "male" ? ["squat", "deadlift", "bench"] : ["squat", "deadlift"];
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
    ex: d.ex.map(([id, sets, reps, rir, rest]) => ({ id, sets, reps, rir, rest })),
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
  kiwi: { n: "Kiwi", p: 1.1, c: 11, f: 0.4 },
  mermelada: { n: "Mermelada 0%", p: 0.6, c: 11.5, f: 0 },
  cottage: { n: "Queso cottage", p: 13, c: 1.6, f: 4 },
  tortillaMaiz: { n: "Tortilla de maíz", p: 4.3, c: 37, f: 2.6 },
  pina: { n: "Piña", p: 0.5, c: 14, f: 0 },
  tofu: { n: "Tofu firme", p: 15, c: 2, f: 8 },
  soja: { n: "Soja texturizada", p: 50, c: 30, f: 1 },
};

const VEG_SWAP = {
  pollo: "soja", tirasPollo: "soja", hambPollo: "soja", terneraPicada: "soja",
  merluza: "tofu", salmon: "tofu", lomoAtun: "tofu", salmonAhumado: "quesoBurgos",
  pavo: "quesoBurgos", jamon: "quesoBurgos",
};

const LIMITS = { aove: 20, cremaCacahuete: 30, frutosSecos: 30, aguacate: 100, guacamole: 80, mozzarella: 60, quesoCrema: 60, proteina: 45, jamon: 120 };

// items: [alimento, "p"|"c"|"f" (se ajusta) o gramos fijos]
let RECIPES = [
  { slot: "desayuno", mode: "sencilla", name: "Tostadas de pavo y tomate", items: [["panIntegral", "c"], ["pavo", "p"], ["verduras", 50], ["aove", "f"]], how: "Tuesta el pan, ralla tomate por encima, un chorrito de aceite y el pavo." },
  { slot: "desayuno", mode: "sencilla", name: "Porridge proteico de cacao", items: [["avena", "c"], ["lecheSemi", 200], ["proteina", "p"], ["cacao", 5], ["cremaCacahuete", "f"]], how: "Avena con la leche 2 minutos al micro, mezcla la proteína y el cacao y pon la crema de cacahuete encima." },
  { slot: "desayuno", mode: "sanji", name: "Tortitas de avena con arándanos", items: [["avena", "c"], ["claras", "p"], ["platano", 40], ["arandanos", 50], ["cremaCacahuete", "f"]],
    steps: ["Tritura la avena con las claras y el plátano hasta tener una masa lisa.", "Sartén antiadherente a fuego medio, vierte cucharones pequeños y dales la vuelta cuando salgan burbujas.", "Apila, cubre con los arándanos y termina con la crema de cacahuete un poco templada."] },
  { slot: "desayuno", mode: "sanji", name: "Tostada de aguacate, salmón y huevo poché", items: [["panCristal", "c"], ["aguacate", "f"], ["salmonAhumado", "p"], ["huevo", 60]],
    steps: ["Agua a punto de hervir con un chorrito de vinagre; haz un remolino y deja caer el huevo 3 minutos.", "Machaca el aguacate con sal, limón y pimienta y úntalo en el pan tostado.", "Coloca el salmón y el huevo encima y abre la yema justo al servir."] },

  { slot: "pre", mode: "sencilla", name: "Pre-entreno exprés", items: [["datiles", "c"], ["yogurProt", "p"]], how: "Unos dátiles y un yogur proteico 30–45 minutos antes de entrenar." },

  { slot: "comida", mode: "sencilla", name: "Pollo con arroz y verduras", items: [["pollo", "p"], ["arroz", "c"], ["verduras", 150], ["aove", "f"]], how: "Pollo a la plancha, arroz hervido y verduras salteadas con el aceite." },
  { slot: "comida", mode: "sencilla", name: "Pasta boloñesa ligera", items: [["pasta", "c"], ["terneraPicada", "p"], ["salsaTomate", 100], ["aove", "f"]], how: "Dora la carne con el aceite, añade la salsa y mézclala con la pasta cocida." },
  { slot: "comida", mode: "sanji", name: "Poke de salmón", items: [["arroz", "c"], ["salmon", "p"], ["verduras", 100], ["aguacate", "f"]],
    steps: ["Cuece el arroz y aliña en templado con un poco de vinagre de arroz y una pizca de azúcar o edulcorante.", "Corta el salmón en dados y marínalo 10 minutos con soja, jengibre y sésamo.", "Monta el bol: arroz, salmón, verduras en tiras (pepino, zanahoria, cebolla morada) y el aguacate en láminas."] },
  { slot: "comida", mode: "sanji", name: "Burritos de pollo gratinados", items: [["maxiTortilla", "c"], ["tirasPollo", "p"], ["verduras", 100], ["mozzarella", 20], ["guacamole", "f"]],
    steps: ["Saltea el pollo con pimiento y cebolla y sazona con comino, pimentón y ajo en polvo.", "Rellena las tortillas, enróllalas y cúbrelas con la mozzarella.", "Horno a 200 °C unos 8 minutos hasta gratinar. Sirve con el guacamole."] },
  { slot: "comida", mode: "sanji", name: "Ñoquis con atún y tomate", items: [["noquis", "c"], ["lomoAtun", "p"], ["tomateFrito", 60], ["verduras", 80], ["aove", "f"]],
    steps: ["Marca los ñoquis en la sartén con el aceite hasta que queden dorados por fuera.", "Sella el lomo de atún en dados 1 minuto por cada lado.", "Junta todo con el tomate y las verduras y termina con albahaca fresca."] },

  { slot: "merienda", mode: "sencilla", name: "Yogur proteico con plátano y frutos secos", items: [["yogurProt", "p"], ["platano", "c"], ["frutosSecos", "f"]], how: "Yogur, plátano en rodajas y frutos secos por encima." },
  { slot: "merienda", mode: "sencilla", name: "Tortitas de arroz con jamón", items: [["tortitasArroz", "c"], ["jamon", "p"], ["quesoCrema", "f"]], how: "Unta el queso crema en las tortitas y pon el jamón encima." },
  { slot: "merienda", mode: "sanji", name: "Mug cake de chocolate", items: [["avena", "c"], ["proteina", "p"], ["claras", 60], ["cacao", 10], ["cremaCacahuete", "f"]],
    steps: ["Mezcla en una taza la avena molida, la proteína, el cacao y una pizca de levadura.", "Añade las claras y un chorrito de agua hasta tener una masa espesa.", "Micro 60–90 segundos y pon la crema de cacahuete encima para que se funda."] },

  { slot: "cena", mode: "sencilla", name: "Merluza al horno con patata", items: [["merluza", "p"], ["patata", "c"], ["verduras", 200], ["aove", "f"]], how: "Merluza y patata en rodajas al horno a 200 °C con verduras y aceite." },
  { slot: "cena", mode: "sencilla", name: "Revuelto de claras con tostada", items: [["claras", "p"], ["huevo", 60], ["verduras", 100], ["panIntegral", "c"], ["aove", "f"]], how: "Revuelto de huevo y claras con las verduras y pan tostado al lado." },
  { slot: "cena", mode: "sanji", name: "Pizza proteica casera", items: [["basePizza", "c"], ["tomateFrito", 50], ["pavo", "p"], ["verduras", 80], ["mozzarella", "f"]],
    steps: ["Precalienta el horno a 220 °C con la bandeja dentro.", "Extiende el tomate, reparte el pavo y las verduras y termina con la mozzarella.", "Hornea 10–12 minutos sobre la bandeja caliente para que la base quede crujiente."] },
  { slot: "cena", mode: "sanji", name: "Hamburguesa de pollo completa", items: [["panHamburguesa", "c"], ["hambPollo", "p"], ["verduras", 80], ["guacamole", "f"]],
    steps: ["Haz la hamburguesa a la plancha 4 minutos por lado a fuego medio-alto.", "Tuesta el pan por dentro en la misma sartén.", "Monta con lechuga, tomate, cebolla y el guacamole como salsa."] },
  { slot: "desayuno", mode: "sencilla", name: "Bol de yogur con muesli y kiwi", items: [["yogurProt", "p"], ["muesli", "c"], ["kiwi", 100], ["frutosSecos", "f"]], how: "Todo en un bol o en un táper para llevar." },
  { slot: "desayuno", mode: "sencilla", name: "Tostadas de queso batido y mermelada", items: [["panIntegral", "c"], ["quesoBatido", "p"], ["mermelada", 20], ["aove", "f"]], how: "Pan tostado con un hilo de aceite, queso batido y mermelada encima." },
  { slot: "desayuno", mode: "sencilla", name: "Tortitas con crema de cacahuete y plátano", items: [["tortitasArroz", "c"], ["platano", 60], ["cremaCacahuete", "f"], ["proteina", "p"]], how: "Unta la crema, pon el plátano y acompaña con un batido de proteína en agua o bebida vegetal." },
  { slot: "comida", mode: "sencilla", name: "Ensalada de legumbres con atún", items: [["legumbres", "c"], ["atun", "p"], ["verduras", 150], ["aove", "f"]], how: "Legumbres de bote enjuagadas, atún, verduras picadas y aceite. Aguanta perfecta en táper." },
  { slot: "comida", mode: "sencilla", name: "Wrap de pollo para llevar", items: [["tortillaIntegral", "c"], ["tirasPollo", "p"], ["verduras", 80], ["guacamole", "f"]], how: "Pollo a la plancha, lechuga, tomate y guacamole; enróllalo en papel de aluminio." },
  { slot: "comida", mode: "sanji", name: "Arroz con ternera al curry", items: [["arroz", "c"], ["terneraPicada", "p"], ["verduras", 150], ["aove", "f"]],
    steps: ["Sofríe cebolla, ajo y pimiento con el aceite y añade la carne hasta que se dore.", "Agrega una cucharada de curry, un poco de comino y un chorrito de agua; deja reducir 5 minutos.", "Sirve sobre el arroz con cilantro o perejil. Al día siguiente en táper está incluso mejor."] },
  { slot: "comida", mode: "sanji", name: "Emperador con batata asada", items: [["emperador", "p"], ["batata", "c"], ["verduras", 150], ["aove", "f"]],
    steps: ["Batata en gajos al horno a 200 °C unos 25 minutos con pimentón y sal.", "Marca el emperador en la plancha bien caliente 2–3 minutos por lado, que quede jugoso.", "Termina con limón, ajo picado y perejil por encima."] },
  { slot: "merienda", mode: "sencilla", name: "Batido de proteína y plátano", items: [["lecheAlmendras", 250], ["proteina", "p"], ["platano", "c"], ["cremaCacahuete", "f"]], how: "Todo a la batidora con hielo. Si comes fuera, lleva la proteína en un bote y mezcla en el momento." },
  { slot: "merienda", mode: "sencilla", name: "Cottage con fruta y tortitas", items: [["cottage", "p"], ["tortitasArroz", "c"], ["arandanos", 80], ["frutosSecos", "f"]], how: "Cottage con arándanos y frutos secos, y las tortitas al lado." },
  { slot: "desayuno", mode: "sencilla", name: "Revuelto con tortitas y aguacate", items: [["claras", "p"], ["huevo", 60], ["tortitasArroz", "c"], ["aguacate", "f"]], how: "Revuelto de huevo y claras, tortitas al lado y aguacate en láminas. Sin gluten ni lácteos." },
  { slot: "desayuno", mode: "sanji", name: "Pancakes de plátano sin harina", items: [["platano", "c"], ["claras", "p"], ["huevo", 60], ["arandanos", 60], ["cremaCacahuete", "f"]],
    steps: ["Machaca el plátano con un tenedor y bátelo con el huevo y las claras.", "Sartén antiadherente a fuego bajo, cucharadas pequeñas y vuelta cuando cuajen los bordes.", "Sirve con los arándanos y la crema de cacahuete templada por encima."] },
  { slot: "merienda", mode: "sencilla", name: "Tortitas con pavo y aguacate", items: [["tortitasArroz", "c"], ["pavo", "p"], ["aguacate", "f"]], how: "Aguacate machacado sobre las tortitas y el pavo encima." },
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
  cerdo: ["jamon"],
  gluten: ["panIntegral", "panCristal", "panHamburguesa", "maxiTortilla", "tortillaIntegral", "basePizza", "pasta", "noquis", "avena", "muesli"],
};
const EXCLUDE_OPTS = [["pescado", "Pescado"], ["lacteos", "Lácteos"], ["huevo", "Huevo"], ["cerdo", "Cerdo"], ["gluten", "Gluten"]];
let TUPPER = new Set(["Pollo con arroz y verduras", "Pasta boloñesa ligera", "Poke de salmón", "Ñoquis con atún y tomate", "Bol de yogur con muesli y kiwi", "Ensalada de legumbres con atún", "Wrap de pollo para llevar", "Arroz con ternera al curry", "Emperador con batata asada", "Batido de proteína y plátano", "Yogur proteico con plátano y frutos secos", "Tortitas de arroz con jamón", "Tortilla de patata fit", "Porridge proteico de cacao", "Tortitas con pavo y aguacate", "Overnight oats de tarta de queso", "Onigiris de atún", "Lasaña boloñesa fit", "Cheesecake en vaso", "Tacos de pollo con guacamole"]);
const COOK_OPTS = [["sencilla", "Modo fácil"], ["todas", "Un poco de todo"], ["sanji", "Modo Sanji (cocinitas)"]];

/* ============================ CONTENIDO EDITABLE ============================
   Frases, ejercicios, alimentos y recetas se pueden editar desde el panel de coach.
   Lo de arriba son los valores de fábrica; applyContent() los sustituye por los guardados.
   ======================================================================== */

const LIFT_OPTS = [["", "No cuenta para el nivel"], ["squat", "Sentadilla (nivel)"], ["deadlift", "Peso muerto (nivel)"], ["bench", "Press banca (nivel)"], ["pull", "Dominadas (nivel)"]];
const TAG_OPTS = EXCLUDE_OPTS;

function withFallback(obj) {
  return new Proxy(obj, {
    get(t, k) {
      if (k in t || typeof k !== "string" || !/^(ARC-|CARDIO|MOVILIDAD|EX-)/.test(k)) return t[k];
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
    recipes: RECIPES.map((r, i) => ({ id: `r${String(i + 1).padStart(3, "0")}`, slot: r.slot, mode: r.mode, name: r.name, items: r.items, how: r.how || "", steps: r.steps || [], plate: r.plate || "", tupper: TUPPER.has(r.name), active: true, sort: i })),
  };
}
const DEFAULT_CONTENT = buildDefaultContent();

function applyContent(c) {
  const quotes = c.quotes?.length ? c.quotes : DEFAULT_CONTENT.quotes;
  const exercises = c.exercises?.length ? c.exercises : DEFAULT_CONTENT.exercises;
  const foods = c.foods?.length ? c.foods : DEFAULT_CONTENT.foods;
  const recipes = c.recipes?.length ? c.recipes : DEFAULT_CONTENT.recipes;
  const act = quotes.filter((q) => q.active !== false);
  QUOTES = (act.length ? act : DEFAULT_CONTENT.quotes).map((q) => [q.text, q.who, q.source, q.why, q.kind]);
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
  { id: 1.3, label: "Poco movimiento", hint: "Sentada casi todo el día, menos de 5.000 pasos" },
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
  { key: "pullups", label: "Dominadas estrictas", fmt: (v) => `${v}` },
  { key: "months", label: "Meses sin parar", fmt: (v) => `${v}` },
  { key: "adherence", label: "Adherencia 30 días", fmt: (v) => `${v}%` },
];

function evaluate(branch, stats, mode) {
  const L = levelsOf(branch, mode);
  const val = (k) => (k === "adherence" && stats.provisional ? Infinity : stats[k] ?? 0);
  const reach = (k) => { let idx = 0; L.forEach((lv, i) => { if (val(k) >= lv[k]) idx = i; }); return idx; };
  const perFactor = Object.fromEntries(FACTORS.map((f) => [f.key, reach(f.key)]));
  const current = Math.min(...Object.values(perFactor));
  const next = L[current + 1] || null;
  let progress = 1;
  if (next) {
    progress = Math.min(...FACTORS.map((f) => {
      const a = L[current][f.key], b = next[f.key], v = val(f.key);
      return b <= a ? 1 : Math.max(0, Math.min(1, (v - a) / (b - a)));
    }));
  }
  const limiter = FACTORS.reduce((m, f) => (perFactor[f.key] < perFactor[m.key] ? f : m), FACTORS[0]);
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
.arc{--bg:#000;--sf:#0E0E11;--sf2:#16161A;--ln:#26262B;--tx:#fff;--dm:rgba(255,255,255,.6);--ac:#D48B92;--ok:rgba(110,231,183,.14);--okl:#6EE7B7;--wu:#F5B454;
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
.in{width:100%;background:var(--sf);border:1px solid var(--ln);color:var(--tx);border-radius:12px;padding:12px;font:inherit;font-size:15px}
.arc button:focus-visible,.in:focus{outline:2px solid var(--ac);outline-offset:2px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{background:var(--sf);border:1px solid var(--ln);color:var(--tx);border-radius:999px;padding:9px 14px;font:inherit;font-size:14px;cursor:pointer}
.chip.on{background:#fff;color:#000;border-color:#fff;font-weight:600}
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
.ex .note-in{background:none;border:0;color:var(--tx);font:inherit;font-size:14px;width:100%;padding:4px 0 8px}
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
.sets input{width:58px;background:var(--sf2);border:1px solid var(--ln);color:var(--tx);border-radius:8px;padding:7px 4px;text-align:center;font:inherit;font-weight:700;font-size:14px}
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
.edrow{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--ln);color:var(--tx);font:inherit;font-size:14px;padding:12px 0;cursor:pointer}
.edrow span{display:block;line-height:1.4}
.edrow small{display:block;color:var(--dm);font-size:12px;margin-top:3px}
.ingr{background:var(--sf);border:1px solid var(--ln);border-radius:12px;padding:10px;margin-bottom:8px}
textarea.in{resize:vertical;line-height:1.5}
select.in{appearance:none}
.tags{display:flex;gap:6px;margin-top:10px}
.tags span{font-size:11px;border:1px solid var(--ln);border-radius:999px;padding:3px 8px;color:var(--dm)}
@media (prefers-reduced-motion:no-preference){.fill{transition:stroke-dashoffset .9s ease}}
`;

function Logo() {
  return (
    <svg width="34" height="22" viewBox="0 0 120 76" aria-hidden="true">
      <path d="M4 38 C26 36 34 30 40 20 C52 -2 86 -4 102 22 C88 8 70 8 58 18 C44 30 44 48 58 58 C72 68 90 66 104 54 C88 80 52 80 40 56 C34 46 26 40 4 38 Z" fill="#fff" />
      <path d="M70 18 C72 32 76 36 116 38 C76 40 72 44 70 60 C68 44 64 40 52 38 C64 36 68 32 70 18 Z" fill="#fff" />
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
              <path className="fill" d={path(s, e)} stroke="#D48B92" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - progress)} />
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
  days: 3, meals: 4, cook: "sencilla", eatOut: false, exclude: [],
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
  return (
    <>
      <h1>{editing ? "Tus datos" : "Empecemos por ti"}</h1>
      <p className="sub">{editing ? "Si cambias algo, tu plan de comidas se recalcula." : "Con esto calculamos tu nivel de partida y tu plan de comidas. Solo te lo preguntamos una vez."}</p>

      <div className="field"><label>¿Cómo quieres subir de nivel?</label>
        <div className="chips">{[["otaku", "Modo otaku"], ["gymrat", "Modo gymrat"]].map(([v, l]) => <button key={v} className={`chip ${(q.mode || "otaku") === v ? "on" : ""}`} onClick={() => set("mode", v)}>{l}</button>)}</div>
        <div className="hint">{(q.mode || "otaku") === "gymrat" ? "Una rata que empieza con ojeras y acaba siendo leyenda del gimnasio." : "Desbloqueas personajes de anime según tu fuerza real."}</div>
      </div>
      <div className="field"><label>Rama del arco</label>
        <div className="chips">{[["female", "Femenina"], ["male", "Masculina"]].map(([v, l]) => <button key={v} className={`chip ${q.branch === v ? "on" : ""}`} onClick={() => set("branch", v)}>{l}</button>)}</div>
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
        <div className="chips">{COOK_OPTS.map(([v, l]) => <button key={v} className={`chip ${q.cook === v ? "on" : ""}`} onClick={() => set("cook", v)}>{l}</button>)}</div>
        <div className="hint">{q.cook === "sanji" ? "Recetas más elaboradas, con sus pasos." : q.cook === "todas" ? "Mezcla de platos rápidos y elaborados." : "Platos de 5 minutos para el día a día."}</div>
      </div>
      <div className="field"><label>¿Comes a menudo fuera de casa?</label>
        <div className="chips">
          <button className={`chip ${q.eatOut ? "on" : ""}`} onClick={() => set("eatOut", true)}>Sí, llevo táper</button>
          <button className={`chip ${!q.eatOut ? "on" : ""}`} onClick={() => set("eatOut", false)}>No, como en casa</button>
        </div>
      </div>
      <div className="field"><label>¿Quieres quitar algo de tus comidas?</label>
        <div className="chips">{EXCLUDE_OPTS.map(([v, l]) => {
          const on = q.exclude.includes(v);
          return <button key={v} className={`chip ${on ? "on" : ""}`} onClick={() => set("exclude", on ? q.exclude.filter((x) => x !== v) : [...q.exclude, v])}>{l}</button>;
        })}</div>
      </div>

      <h2>Tus marcas</h2>
      <p className="sub" style={{ marginBottom: 10 }}>Tu mejor serie reciente: peso y repeticiones (de 1 a 10).</p>
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

async function readFile(file, maxW = 640) {
  const raw = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  if (!file.type.startsWith("image/") || file.type === "image/gif") return raw;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = raw; });
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
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

function TechniqueModal({ exId, media, coach, setMedia, uploadMedia, onClose }) {
  const key = `ex:${exId}`;
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const src = media[key];
  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: 20 }}>{EXERCISES[exId].n}</h1>
        <p className="hint" style={{ marginTop: 0 }}>{EXERCISES[exId].muscle} · {EXERCISES[exId].equip}</p>
        {src ? <MediaView src={src} /> : <div className="empty">{coach ? "Este ejercicio aún no tiene vídeo. Sube uno o pega un enlace." : "Pronto tendrás aquí el vídeo de la técnica."}</div>}
        {EXERCISES[exId].note && <div className="note">{EXERCISES[exId].note}</div>}
        <h2 style={{ marginTop: 18 }}>Cómo se hace</h2>
        <p className="sub" style={{ marginBottom: 0 }}>{EXERCISES[exId].simple}</p>
        <h2 style={{ marginTop: 18 }}>Truquito</h2>
        <p className="sub" style={{ marginBottom: 0 }}>{EXERCISES[exId].tip}</p>
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

function Home({ state, stats, ev, quote, media, coach, setMedia, uploadMedia }) {
  const branch = state.profile.branch;
  const mode = state.profile.mode || "otaku";
  const L = levelsOf(branch, mode);
  const lv = L[ev.current];
  const [err, setErr] = useState("");
  const [vb, setVb] = useState(mode === "gymrat" ? "rat" : branch); // rama que se ve en "El arco completo" (la coach puede cambiarla)
  const ratioPoints = useMemo(() => {
    const pts = [{ x: new Date(state.profile.startDate).getTime(), y: ratioOf(branch, bestLifts({ ...state, sessions: [] }).best, Number(state.profile.weight)) }];
    [...state.sessions].sort((a, b) => a.date.localeCompare(b.date)).forEach((s) => {
      pts.push({ x: new Date(s.date).getTime(), y: ratioOf(branch, bestLifts(state, s.date).best, currentWeight(state)) });
    });
    return pts;
  }, [state, branch]);
  const weightPoints = Object.keys(state.habits).filter((k) => state.habits[k].weight).sort().map((k) => ({ x: new Date(k).getTime(), y: Number(state.habits[k].weight) }));
  const [qq, who, from, why, kind] = quote;
  const heroImg = media[levelKey(branch, mode, ev.current)] || AVATAR[branch];
  return (
    <>
      <div className="quote">
        <p>{kind === "cita" ? `“${qq}”` : qq}</p>
        <div className="who">{who}</div>
        <div className="from">{from}</div>
        <div className="why">{why}</div>
      </div>

      <div className="hero">
        <img src={heroImg} alt={lv.name} />
        <div className="hero-txt">
          <div className="name">{lv.name}</div>
          <div className="series">{lv.series}</div>
        </div>
      </div>
      <div className="gauge">
        <ArcGauge total={L.length} current={ev.current} progress={ev.progress} />
        <p className="line">{lv.line}</p>
        {stats.provisional && <div className="prov">Nivel provisional: la adherencia empieza a contar en tu día {RULES.ADHERENCE_MIN_DAYS}.</div>}
      </div>

      {ev.next ? (
        <>
          <h2>Para llegar a {ev.next.name}</h2>
          {FACTORS.map((f) => {
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
          {ev.perFactor.ratio > ev.current && (
            <div className="note">Tu fuerza ya es de nivel {ev.perFactor.ratio + 1}, {L[ev.perFactor.ratio].name}. Lo que te frena ahora: {ev.limiter.label.toLowerCase()}.</div>
          )}
        </>
      ) : <div className="note">Has completado el arco. No queda nadie por encima.</div>}

      <h2>Tu progreso</h2>
      <div className="chart">
        <div className="hd"><span>Fuerza relativa</span><b>{stats.ratio.toFixed(2)}x</b></div>
        <LineChart points={ratioPoints} empty="Registra tu primer entreno para ver la curva." />
      </div>
      <div className="chart">
        <div className="hd"><span>Peso corporal</span><b>{currentWeight(state)} kg</b></div>
        <LineChart points={weightPoints} empty="Apunta tu peso en Hábitos dos días para ver la tendencia." />
      </div>
      <div className="stat3" style={{ marginTop: 10 }}>
        <div><b>{state.sessions.length}</b><span>Entrenos</span></div>
        <div><b>{stats.streak}</b><span>Días de racha</span></div>
        <div><b>{state.gems}</b><span>Gemas</span></div>
      </div>

      <h2>El arco completo</h2>
      {coach && <>
        <div className="seg">
          <button className={vb === "female" ? "on" : ""} onClick={() => setVb("female")}>Femenina</button>
          <button className={vb === "male" ? "on" : ""} onClick={() => setVb("male")}>Masculina</button>
          <button className={vb === "rat" ? "on" : ""} onClick={() => setVb("rat")}>Gymrat</button>
        </div>
        <p className="hint" style={{ marginTop: -4 }}>Modo coach: sube una imagen para cada personaje. Mejor en vertical y con fondo oscuro.</p>
      </>}
      {err && <div className="err">{err}</div>}
      {(vb === "rat" ? RAT_LEVELS[branch] : LEVELS[vb]).map((l, i) => {
        const key = vb === "rat" ? `rat:${i}` : `lvl:${vb}:${i}`;
        const img = media[key];
        const mine = vb === "rat" ? mode === "gymrat" : mode !== "gymrat" && vb === branch;
        return (
          <div key={l.name} className="lvrow" style={{ opacity: mine && i > ev.current && !coach ? 0.4 : 1 }}>
            <div className="thumb">{img ? <img src={img} alt="" /> : <span>{i + 1}</span>}</div>
            <div style={{ flex: 1, minWidth: 0, fontWeight: mine && i === ev.current ? 700 : 400 }}>{l.name}<small>{l.ratio.toFixed(1)}x · {l.pullups} {l.pullups === 1 ? "dominada" : "dominadas"} · {l.months} {l.months === 1 ? "mes" : "meses"}</small></div>
            {coach && (
              <div className="chips" style={{ width: "100%", paddingLeft: 52 }}>
                <MediaPicker label={img ? "Cambiar" : "Imagen"} accept="image/*" onPick={(f) => uploadMedia(key, f)} onError={setErr} />
                {img && <button className="chip" onClick={() => setMedia(key, null)}>×</button>}
              </div>
            )}
          </div>
        );
      })}
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

function newSession(day, sessions) {
  return {
    dayId: day.id, dayName: day.name, start: Date.now(),
    exercises: day.ex.map((e) => {
      const prev = lastSetsFor(sessions, e.id);
      const timed = EXERCISES[e.id].unit;
      const sets = prev
        ? prev.map((s) => ({ type: s.type, kg: s.kg, reps: s.reps, done: false }))
        : [...(timed ? [] : [{ type: "W", kg: "", reps: "", done: false }]), ...Array.from({ length: e.sets }, () => ({ type: "N", kg: "", reps: timed ? e.reps.split("–")[0] : "", done: false }))];
      return { exId: e.id, rest: e.rest, note: "", sets, target: timed ? `${e.sets} × ${e.reps} ${timed}` : `${e.sets} × ${e.reps} · RIR ${e.rir}` };
    }),
  };
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

function Tracker({ active, sessions, setActive, onFinish, onCancel, media, coach, setMedia, uploadMedia, onRest, onRestCancel }) {
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
            <div className="tgt">{e.target}</div>
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
      {swap !== null && <SwapModal exId={active.exercises[swap].exId} onClose={() => setSwap(null)} onPick={(id) => { upd(swap, (x) => ({ ...x, exId: id })); setSwap(null); }} />}
    </>
  );
}

function Workouts({ state, routine, onStart, setDays, media, coach, setMedia, uploadMedia }) {
  const [tech, setTech] = useState(null);
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState(null);
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lib = Object.values(EXERCISES).filter((e) => (!grp || e.group === grp) && (!q || norm(`${e.n} ${e.muscle} ${e.equip} ${e.group}`).includes(norm(q))));
  return (
    <>
      <h1>Entrenos</h1>
      <p className="sub">Elige el día que toca. Al terminar sumas {RULES.XP_PER_SESSION} XP y {RULES.GEMS_PER_SESSION} gemas.</p>
      <div className="field"><label>Días por semana</label>
        <div className="chips">{[2, 3, 4, 5, 6, 7].map((d) => <button key={d} className={`chip ${state.profile.days === d ? "on" : ""}`} onClick={() => setDays(d)}>{d}</button>)}</div>
      </div>
      {routine.map((d) => (
        <div className="day" key={d.id}>
          <div className="hd"><b>Día {d.id}: {d.name}</b><button className="sbtn" onClick={() => onStart(d)}>Empezar</button></div>
          {d.ex.map((e) => (
            <button key={e.id} className="exrow" onClick={() => setTech(e.id)}>
              <span>{media[`ex:${e.id}`] && <span className="play">▶</span>}{EXERCISES[e.id].n}</span>
              <span>{e.sets} × {e.reps}{EXERCISES[e.id].unit ? ` ${EXERCISES[e.id].unit}` : ""}</span>
            </button>
          ))}
        </div>
      ))}
      <p className="hint">{coach ? "Modo coach: toca cualquier ejercicio para subir su vídeo o pegar el enlace." : "Toca un ejercicio para ver cómo se hace y su truquito."}</p>
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
          <span>{new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {mmss(s.dur)} · {s.volume.toLocaleString("es-ES")} kg</span>
        </div>
      ))}
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

function Nutrition({ profile, setCook }) {
  const [rest, setRest] = useState(false);
  const [pick, setPick] = useState({});
  const mode = profile.cook;
  const t = useMemo(() => macroTargets(profile, rest), [profile, rest]);
  const plan = { ...MEAL_PLANS[profile.meals] };
  if (profile.trainTime === "early" && !rest) { plan.pre = 0.08; plan.desayuno -= 0.08; }
  const order = ["pre", "desayuno", "mediaManana", "comida", "merienda", "cena"].filter((id) => plan[id]);
  const meals = order.map((id) => {
    const all = RECIPES.filter((r) => r.slot === (SLOT_RECIPES[id] || id) && recipeAllowed(r, profile));
    let opts = mode === "todas" ? all : all.filter((r) => r.mode === mode);
    if (!opts.length) opts = all;
    if (profile.eatOut) opts = [...opts].sort((a, b) => TUPPER.has(b.name) - TUPPER.has(a.name));
    if (!opts.length) return { id, empty: true };
    const k = `${id}-${mode}`;
    const recipe = opts[Math.min(pick[k] || 0, opts.length - 1)];
    const share = plan[id];
    return { id, k, opts, recipe, ...solveRecipe(recipe, { p: t.p * share, c: t.c * share, f: t.f * share }, profile.veg) };
  });
  const day = meals.filter((m) => !m.empty).reduce((a, m) => ({ p: a.p + m.tot.p, c: a.c + m.tot.c, f: a.f + m.tot.f, kcal: a.kcal + m.tot.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  return (
    <>
      <h1>Nutrición</h1>
      <div className="seg" style={{ marginTop: 14 }}>
        <button className={!rest ? "on" : ""} onClick={() => setRest(false)}>Día de entreno</button>
        <button className={rest ? "on" : ""} onClick={() => setRest(true)}>Día de descanso</button>
      </div>
      <div className="kcal" style={{ marginTop: 16 }}>{t.kcal}<span style={{ fontSize: 18, fontWeight: 600, marginLeft: 6 }}>kcal</span></div>
      <div className="macros">
        <div><b>{t.p} g</b><span>Proteína</span></div>
        <div><b>{t.c} g</b><span>Hidratos</span></div>
        <div><b>{t.f} g</b><span>Grasas</span></div>
      </div>

      <h2>Tus comidas</h2>
      <div className="seg">{COOK_OPTS.map(([v, l]) => <button key={v} className={mode === v ? "on" : ""} onClick={() => setCook(v)}>{l}</button>)}</div>
      {profile.eatOut && <p className="hint" style={{ marginTop: 0 }}>Primero te salen las que aguantan bien en táper.</p>}

      {meals.map((m) => m.empty ? (
        <div className="meal" key={m.id}><div className="hd"><b>{SLOT_NAMES[m.id]}</b></div><p className="hint">Con lo que has quitado no hay recetas para esta comida todavía.</p></div>
      ) : (
        <div className="meal" key={m.id}>
          <div className="hd"><b>{SLOT_NAMES[m.id]}</b><span>{Math.round(m.tot.kcal)} kcal · P {Math.round(m.tot.p)} · H {Math.round(m.tot.c)} · G {Math.round(m.tot.f)}</span></div>
          {m.opts.length > 1
            ? <div className="chips">{m.opts.map((r, i) => <button key={r.name} className={`chip ${r === m.recipe ? "on" : ""}`} onClick={() => setPick({ ...pick, [m.k]: i })}>{r.name}</button>)}</div>
            : <div className="rname">{m.recipe.name}</div>}
          <div className="tags">
            <span>{m.recipe.mode === "sanji" ? "Modo Sanji (cocinitas)" : "Fácil"}</span>
            {TUPPER.has(m.recipe.name) && <span>Apta para táper</span>}
          </div>
          <div style={{ marginTop: 8 }}>{m.items.map((it) => <div className="food" key={it.food}><span>{FOODS[it.food].n}</span><em>{Math.round(it.g)} g</em></div>)}</div>
          {m.recipe.steps ? <ol className="steps">{m.recipe.steps.map((st) => <li key={st}>{st}</li>)}</ol> : <p className="hint">{m.recipe.how}</p>}
          {m.recipe.plate && <p className="plate">{m.recipe.plate}</p>}
        </div>
      ))}
      <div className="note">Total del día: {Math.round(day.kcal)} kcal, {Math.round(day.p)} g de proteína, {Math.round(day.c)} g de hidratos y {Math.round(day.f)} g de grasas. Pesos en crudo salvo patata, legumbres y cremas, que van ya cocinadas.</div>

      <h2>Suplementación</h2>
      <p className="sub">Información general, no una recomendación personal. La creatina monohidrato es el suplemento con más evidencia para ganar fuerza; en los estudios se usan 3–5 g al día. Antes de tomar cualquier suplemento, consúltalo con tu médico o farmacéutico, sobre todo si tomas medicación o tienes alguna enfermedad.</p>
      <p className="hint">Plan orientativo calculado con tu cuestionario. No sustituye la consulta con un dietista-nutricionista.</p>
    </>
  );
}

/* ============================ HÁBITOS ============================ */

function Habits({ state, setHabit, adh, steps }) {
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
        <div className="hd"><b>Pasos</b><span>Meta {RULES.STEPS_GOAL.toLocaleString("es-ES")}</span></div>
        <input className="in" type="number" inputMode="numeric" placeholder="Pasos de hoy" value={h.steps ?? ""} onChange={(e) => setHabit("steps", e.target.value === "" ? "" : Number(e.target.value))} />
        <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${Math.min(100, ((h.steps || 0) / RULES.STEPS_GOAL) * 100)}%`, background: "var(--ac)" }} /></div>
        {steps?.available && (steps.linked
          ? <div className="chips" style={{ marginTop: 10 }}>
              <button className="chip" disabled={steps.busy} onClick={steps.sync}>{steps.busy ? "Leyendo pasos…" : "Actualizar pasos del móvil"}</button>
            </div>
          : <button className="btn ghost" style={{ marginTop: 10 }} disabled={steps.busy} onClick={steps.connect}>{steps.busy ? "Un momento…" : steps.label}</button>)}
        {steps?.error && <div className="err">{steps.error}</div>}
        {steps?.linked && !steps.error && <p className="hint">Se leen solos de {steps.source} cada vez que abres Hábitos.</p>}
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
    </>
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
  const sub = (r) => table === "quotes" ? `${r.who} · ${r.source}` : table === "recipes" ? `${SLOT_NAMES[r.slot] || r.slot} · ${r.mode === "sanji" ? "Sanji" : "Fácil"}` : table === "exercises" ? `${r.id} · ${r.grp}` : `P ${r.p} · H ${r.c} · G ${r.f}`;
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
    if (table === "quotes" && (!r.text.trim() || !r.who.trim())) return "Pon la frase y quién la dice.";
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
          <div style={{ flex: 1 }}><Field label="Quién la dice">{txt("who", "Rock Lee")}</Field></div>
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
const REPORT_REASONS = ["Nombre ofensivo", "Suplanta a alguien", "Otro motivo"];

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
const levelLabel = (branch, level, mode) => (branch ? levelsOf(branch, mode)[level]?.name || "" : "");
const fmtDay = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

function Ranking({ me, state, api }) {
  const [board, setBoard] = useState(null);
  const [last, setLast] = useState(null);
  const [err, setErr] = useState("");
  const [nick, setNick] = useState(me.nickname || "");
  const [nickErr, setNickErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [report, setReport] = useState(null);
  const [sent, setSent] = useState("");

  const load = async () => {
    setErr("");
    try { const [b, l] = await Promise.all([api.load(0), api.load(1)]); setBoard(b); setLast(l.filter((r) => r.rank <= 3)); }
    catch (e) { setErr("No se ha podido cargar el ranking. Revisa tu conexión."); }
  };
  useEffect(() => { if (me.optIn) load(); }, [me.optIn, state.sessions.length]);

  const start = weekStart(), end = new Date(start); end.setDate(end.getDate() + 6);
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);
  const mine = myWeekPoints(state);

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
      <p className="sub">Cada semana empieza de cero. Sumas {RANK_POINTS.session} puntos por cada día que entrenas y {RANK_POINTS.habitDay} por cada día que cumples tus hábitos. Gana la constancia, no los kilos.</p>
      <div className="note" style={{ marginTop: 0, marginBottom: 18 }}>Solo se verá tu apodo, tu nivel y tus puntos. Nunca tu peso ni ningún otro dato.</div>
      <div className="field"><label>Tu apodo en el ranking</label>
        <input className="in" maxLength={20} placeholder="Por ejemplo: luna_lifts" value={nick} onChange={(e) => { setNick(e.target.value); setNickErr(""); }} />
        {nickErr && <div className="err">{nickErr}</div>}
      </div>
      <button className="btn ac" disabled={busy || !nick.trim()} onClick={join}>{busy ? "Un momento…" : me.optIn ? "Guardar apodo" : "Unirme al ranking"}</button>
      {editing && <button className="btn ghost" onClick={() => setEditing(false)}>Cancelar</button>}
    </>
  );

  return (
    <>
      <h1>Ranking semanal</h1>
      <p className="sub">Del {fmtDay(start)} al {fmtDay(end)} · se reinicia en {daysLeft} {daysLeft === 1 ? "día" : "días"}</p>

      <div className="mycard">
        <div><span>Tu posición</span><b>{board?.find((r) => r.is_me)?.rank ? `${board.find((r) => r.is_me).rank}º` : "—"}</b></div>
        <div><span>Puntos</span><b>{mine.points}</b></div>
        <div><span>Días entrenados</span><b>{mine.sessions}</b></div>
      </div>
      <p className="hint">+{RANK_POINTS.session} por día entrenado · +{RANK_POINTS.habitDay} por día de hábitos cumplido</p>

      {err && <><div className="err">{err}</div><button className="btn ghost" onClick={load}>Reintentar</button></>}
      {!board && !err && <p className="sub">Cargando…</p>}
      {board && (
        <div style={{ marginTop: 14 }}>
          {board.length <= 1 && <div className="empty">Esta semana aún no hay nadie más. ¡Tienes la corona a tiro!</div>}
          {board.map((r) => (
            <div key={r.nickname} className={`rkrow ${r.is_me ? "me" : ""}`}>
              <span className={`pos ${r.rank <= 3 ? "top" : ""}`}>{r.rank}</span>
              <span className="who">{r.nickname}{r.is_me && " (tú)"}<small>{levelLabel(r.branch, r.level, r.mode)}</small></span>
              <b>{r.points}</b>
              {!r.is_me && <button className="dots" aria-label="Opciones" onClick={() => { setReport(r.nickname); setSent(""); }}>⋮</button>}
            </div>
          ))}
        </div>
      )}

      {last?.length > 0 && (
        <>
          <h2>Ganadoras de la semana pasada</h2>
          {last.map((r) => <div key={r.nickname} className="hist"><span>{r.rank}º · {r.nickname}</span><span>{r.points} puntos</span></div>)}
        </>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <button className="link" onClick={() => { setNick(me.nickname || ""); setEditing(true); }}>Cambiar mi apodo</button>
        <button className="link" onClick={async () => { await api.leave(); }}>Dejar de salir en el ranking</button>
      </div>

      {report && (
        <div className="modal" onClick={() => setReport(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <h1 style={{ fontSize: 20 }}>Denunciar a {report}</h1>
            {sent ? <p className="sub">{sent}</p> : <>
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

/* ============================ AJUSTES ============================ */

const WEEK = [[2, "L"], [3, "M"], [4, "X"], [5, "J"], [6, "V"], [7, "S"], [1, "D"]];

function Reminders({ value, onChange }) {
  const r = { ...native.DEFAULT_REMINDERS, ...(value || {}) };
  const [err, setErr] = useState("");
  const save = async (next) => {
    setErr("");
    const anyOn = next.train.on || next.water.on || next.sunday.on;
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
      {err && <div className="err">{err}</div>}
    </>
  );
}

function Settings({ email, isCoach, coachView, setCoachView, onEdit, onContent, onReports, reminders, setReminders, onSignOut, onResetData, onDeleteAccount, onClose }) {
  const [confirm, setConfirm] = useState(null); // "data" | "account"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr("No se ha podido completar. Vuelve a intentarlo."); } finally { setBusy(false); } };
  return (
    <>
      <h1>Ajustes</h1>
      <p className="sub">{email}</p>
      <button className="btn" onClick={onEdit}>Editar mis datos y preferencias</button>
      {isCoach && (
        <>
          <h2>Modo coach</h2>
          <p className="sub">Sube imágenes de cada personaje y vídeos de cada ejercicio. Solo lo ve tu cuenta.</p>
          <div className="seg">
            <button className={!coachView ? "on" : ""} onClick={() => setCoachView(false)}>Ver como clienta</button>
            <button className={coachView ? "on" : ""} onClick={() => setCoachView(true)}>Modo coach</button>
          </div>
          <button className="btn" onClick={onContent}>Editar frases, recetas, ejercicios y alimentos</button>
          <button className="btn ghost" onClick={onReports}>Denuncias del ranking</button>
        </>
      )}
      <Reminders value={reminders} onChange={setReminders} />
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
      <h1>Denuncias del ranking</h1>
      <p className="sub">Si quitas a alguien, desaparece del ranking y pierde su apodo.</p>
      {err && <div className="err">{err}</div>}
      {list && list.length === 0 && <div className="empty">No hay denuncias pendientes.</div>}
      {list?.map((r) => (
        <div key={r.id} className="day">
          <div className="hd"><b>{r.nickname}</b><small>{new Date(r.created_at).toLocaleDateString("es-ES")}</small></div>
          <small>{r.reason}</small>
          <div className="chips" style={{ marginTop: 10 }}>
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

function fromDb({ profile, sessions, habits }) {
  return {
    onboarded: profile.onboarded,
    profile: profile.data ? { ...DEFAULT_PROFILE, ...profile.data, startDate: profile.start_date } : null,
    sessions: sessions.map((s) => ({ id: s.id, date: s.performed_at, dayId: s.day_id, dayName: s.day_name, dur: s.duration_s, volume: Number(s.volume_kg), sets: s.sets_done, exercises: s.exercises })),
    habits: Object.fromEntries(habits.map((h) => [h.day, { water: h.water ?? undefined, steps: h.steps ?? undefined, sleep: h.sleep != null ? Number(h.sleep) : undefined, weight: h.weight != null ? Number(h.weight) : undefined }])),
    xp: profile.xp, gems: profile.gems, active: profile.active_session, role: profile.role,
    nickname: profile.nickname, rankOptIn: profile.rank_opt_in && !!profile.nickname, savedLevel: profile.level,
  };
}

function ArcApp({ user }) {
  const [state, setState] = useState(EMPTY);
  const [media, setMediaState] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("inicio");
  const [screen, setScreen] = useState(null);
  const [toast, setToast] = useState("");
  const [coachView, setCoachView] = useState(true);
  const [stepsAvail, setStepsAvail] = useState(false);
  const [stepsBusy, setStepsBusy] = useState(false);
  const [stepsErr, setStepsErr] = useState("");
  const [quote, setQuote] = useState(null);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const timers = useRef({});

  const load = async () => {
    setLoadErr("");
    try {
      const [all, remote] = await Promise.all([db.loadAll(user.id), db.loadContent().catch(() => null)]);
      if (remote) { applyContent(remote); setContent({ quotes: remote.quotes.length ? remote.quotes : DEFAULT_CONTENT.quotes, exercises: remote.exercises.length ? remote.exercises : DEFAULT_CONTENT.exercises, foods: remote.foods.length ? remote.foods : DEFAULT_CONTENT.foods, recipes: remote.recipes.length ? remote.recipes : DEFAULT_CONTENT.recipes }); }
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      setState(fromDb(all));
      setMediaState(Object.fromEntries(all.media.map((m) => [m.key, m.url])));
      setLoaded(true);
    } catch (e) { setLoadErr("No hemos podido cargar tus datos. Revisa tu conexión."); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  const fail = () => setToast("No se ha podido guardar. Revisa tu conexión.");
  const later = (key, fn, ms = 800) => { clearTimeout(timers.current[key]); timers.current[key] = setTimeout(() => fn().catch(fail), ms); };

  const isCoach = state.role === "coach" || state.role === "admin";
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
      const data = await readFile(file, 900);
      blob = await (await fetch(data)).blob(); type = blob.type; ext = type === "image/png" ? "png" : "jpg";
    }
    const url = await db.uploadFile(`${key.replace(/:/g, "/")}/${Date.now()}.${ext}`, blob, type);
    await setMedia(key, url);
  };

  const routine = useMemo(() => buildRoutine(state.profile?.days || 3, state.profile?.branch), [state.profile?.days, state.profile?.branch]);
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
  useEffect(() => { if (tab === "habitos" && state.profile?.stepsLinked && stepsAvail) syncSteps(); }, [tab, stepsAvail]);

  if (!loaded) return <Shell>{loadErr ? <><div className="err">{loadErr}</div><button className="btn" onClick={load}>Reintentar</button></> : <p className="sub">Cargando tu arco…</p>}</Shell>;

  const profileData = (p) => { const { startDate, ...rest } = p; return rest; };
  const setProfile = (patch) => setState((s) => {
    const profile = { ...s.profile, ...patch };
    later("profile", () => db.updateProfile(user.id, { data: profileData(profile) }), 300);
    return { ...s, profile };
  });
  const saveProfile = async (q) => {
    const startDate = state.profile?.startDate || dkey();
    setState((s) => ({ ...s, onboarded: true, profile: { ...q, startDate } }));
    setScreen(null); setTab("inicio");
    try { await db.updateProfile(user.id, { onboarded: true, data: profileData(q), start_date: startDate }); } catch (e) { fail(); }
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
      const saved = await db.addSession(row);
      const session = { id: saved.id, date: saved.performed_at, dayId: a.dayId, dayName: a.dayName, dur: row.duration_s, volume, sets, exercises: row.exercises };
      const next = { ...state, active: null, sessions: [...state.sessions, session], xp: state.xp + RULES.XP_PER_SESSION, gems: state.gems + RULES.GEMS_PER_SESSION };
      setState(next);
      const { best, pullups } = bestLifts(next);
      const lv = evaluate(next.profile.branch, { ...stats, ratio: ratioOf(next.profile.branch, best, currentWeight(next)), pullups }, next.profile.mode).current;
      setToast(lv > prevLevel ? `Has subido a ${levelsOf(next.profile.branch, next.profile.mode)[lv].name}` : `Entreno guardado · +${RULES.XP_PER_SESSION} XP · +${RULES.GEMS_PER_SESSION} gemas`);
      setTab("inicio");
    } catch (e) { setToast("No se ha podido guardar el entreno. Tu sesión sigue abierta: vuelve a darle a Terminar."); }
  };

  const showQuestionnaire = !state.onboarded || screen === "editar";
  const inTracker = tab === "entrenos" && state.active && !showQuestionnaire && !screen;

  let body;
  if (showQuestionnaire) {
    body = <Questionnaire initial={state.profile || DEFAULT_PROFILE} editing={state.onboarded} onSave={saveProfile} onCancel={() => setScreen("ajustes")} />;
  } else if (screen === "contenido" && isCoach) {
    body = <ContentEditor content={content} onSave={onSaveItem} onDelete={onDeleteItem} onClose={() => setScreen("ajustes")} media={media} setMedia={setMedia} uploadMedia={uploadMedia} />;
  } else if (screen === "denuncias" && isCoach) {
    body = <Reports onClose={() => setScreen("ajustes")} />;
  } else if (screen === "ajustes") {
    body = <Settings email={user.email} isCoach={isCoach} coachView={coachView} setCoachView={setCoachView}
      reminders={state.profile?.reminders} setReminders={(r) => setProfile({ reminders: r })}
      onEdit={() => setScreen("editar")}
      onContent={() => setScreen("contenido")}
      onReports={() => setScreen("denuncias")}
      onSignOut={() => supabase.auth.signOut()}
      onResetData={async () => { await db.deleteMyData(user.id); setState((s) => ({ ...EMPTY, xp: s.xp, gems: s.gems, role: s.role })); setScreen(null); }}
      onDeleteAccount={() => db.deleteAccount()}
      onClose={() => setScreen(null)} />;
  } else if (inTracker) {
    body = <Tracker active={state.active} sessions={state.sessions} setActive={setActive} onFinish={finish} onCancel={() => setActive(null)} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} onRest={native.scheduleRest} onRestCancel={native.cancelRest} />;
  } else if (tab === "inicio") {
    body = <Home state={state} stats={stats} ev={ev} quote={quote} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} />;
  } else if (tab === "entrenos") {
    body = <Workouts state={state} routine={routine} onStart={(d) => setActive(newSession(d, state.sessions))} setDays={(d) => setProfile({ days: d })} media={media} coach={coach} setMedia={setMedia} uploadMedia={uploadMedia} />;
  } else if (tab === "ranking") {
    body = <Ranking me={{ optIn: !!state.rankOptIn, nickname: state.nickname }} state={state} api={rankApi} />;
  } else if (tab === "nutricion") {
    body = <Nutrition profile={state.profile} setCook={(c) => setProfile({ cook: c })} />;
  } else {
    body = <Habits state={state} setHabit={setHabit} adh={adh} steps={native.isNative ? {
      available: native.platform === "android" || stepsAvail,
      linked: !!state.profile?.stepsLinked && stepsAvail,
      label: native.platform === "android" && !stepsAvail ? "Instalar Health Connect para leer tus pasos" : `Conectar con ${native.platform === "ios" ? "Apple Salud" : "Health Connect"}`,
      source: native.platform === "ios" ? "Apple Salud" : "Health Connect",
      busy: stepsBusy, error: stepsErr, connect: connectSteps, sync: syncSteps,
    } : null} />;
  }

  return (
    <div className="arc">
      <style>{CSS + EXTRA_CSS}</style>
      {toast && <div className="toast" role="status">{toast}</div>}
      <div className="phone">
        {!inTracker && (
          <div className="top">
            <Logo /><b>ARC</b><span className="by">by Lunarovx</span>
            {state.onboarded && !screen && <><span className="xp">{state.xp} XP</span><button className="link" style={{ marginLeft: 12 }} onClick={() => setScreen("ajustes")}>Ajustes</button></>}
          </div>
        )}
        {body}
      </div>
      {!showQuestionnaire && !inTracker && !screen && (
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
