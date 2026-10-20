# ARC · promo 1 (9:16, 30 fps) — titulares con golpe + móvil 3D + B-roll real + ratas + cierre
import cv2, numpy as np, subprocess, math, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
REC = "/mnt/user-data/uploads/ScreenRecording_10-20-2026_10-04-26_1.mp4"
CLIPS = "/home/claude/vids/out/"
RATS = "/home/claude/rats/fem/"
LOGO = "/home/claude/arc/public/logo-mark.png"
F = "/usr/share/fonts/opentype/inter/Inter-%s.otf"
PINK = (212, 139, 146); WHITE = (255, 255, 255); DIM = (165, 165, 172)
font = lambda w, s: ImageFont.truetype(F % w, s)
OUT = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/promo/ARC_promo_1.mp4"
PREVIEW = "--preview" in sys.argv

# ---------- utilidades ----------
def ease_out(t): t = min(max(t, 0), 1); return 1 - (1 - t) ** 3
def ease_io(t): t = min(max(t, 0), 1); return 3 * t * t - 2 * t * t * t
def back_out(t, s=1.7): t = min(max(t, 0), 1) - 1; return t * t * ((s + 1) * t + s) + 1
def lerp(a, b, t): return a + (b - a) * t

cap = cv2.VideoCapture(REC)
def rec_frame(sec):
    cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
    ok, f = cap.read()
    f = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
    f[:86] = 0  # tapa la barra de estado con el punto de grabación
    return f

clip_cache = {}
def clip_frame(name, sec):
    if name not in clip_cache:
        c = cv2.VideoCapture(CLIPS + name); frames = []
        while True:
            ok, f = c.read()
            if not ok: break
            frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
        clip_cache[name] = frames
    fr = clip_cache[name]; return fr[int(sec * 25) % len(fr)]

# ---------- móvil 3D ----------
PW, PH, BEZ, R = 600, 1260, 22, 92
def phone_texture(screen):
    s = cv2.resize(screen, (PW - 2 * BEZ, PH - 2 * BEZ), interpolation=cv2.INTER_AREA)
    body = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, PW - 1, PH - 1), R, fill=(28, 28, 32, 255), outline=(92, 92, 100, 255), width=3)
    sc = Image.fromarray(s).convert("RGBA")
    m = Image.new("L", sc.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, sc.size[0] - 1, sc.size[1] - 1), R - BEZ, fill=255)
    body.paste(sc, (BEZ, BEZ), m)
    d.rounded_rectangle((PW // 2 - 78, BEZ + 18, PW // 2 + 78, BEZ + 58), 20, fill=(0, 0, 0, 255))  # isla
    d.text((BEZ + 46, BEZ + 38), "9:41", font=font("SemiBold", 26), fill=WHITE, anchor="lm")
    return np.asarray(body)

def project(tex, cx, cy, scale, ry, rx, rz=0.0):
    h, w = tex.shape[:2]
    pts = np.array([[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]], float) * scale
    ay, ax, az = math.radians(ry), math.radians(rx), math.radians(rz)
    Ry = np.array([[math.cos(ay), 0, math.sin(ay)], [0, 1, 0], [-math.sin(ay), 0, math.cos(ay)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]])
    Rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    p = pts @ (Rz @ Rx @ Ry).T
    f = 2200.0
    dst = np.array([[cx + x * f / (f + z), cy + y * f / (f + z)] for x, y, z in p], np.float32)
    src = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(tex, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)), dst

def comp_rgba(base, layer):
    a = layer[..., 3:4].astype(np.float32) / 255
    base[:] = (base * (1 - a) + layer[..., :3] * a).astype(np.uint8)

def draw_phone(canvas, screen, cx, cy, scale, ry, rx, rz=0.0, alpha=1.0):
    tex = phone_texture(screen)
    layer, dst = project(tex, cx, cy, scale, ry, rx, rz)
    # sombra
    sh = np.zeros((H, W), np.uint8)
    poly = dst.copy(); poly[:, 1] += 40 * scale; poly[:, 0] += 30 * scale
    cv2.fillConvexPoly(sh, poly.astype(np.int32), int(140 * alpha))
    sh = cv2.GaussianBlur(sh, (0, 0), 38)
    canvas[:] = (canvas * (1 - sh[..., None] / 255.0)).astype(np.uint8)
    if alpha < 1: layer = layer.copy(); layer[..., 3] = (layer[..., 3] * alpha).astype(np.uint8)
    comp_rgba(canvas, layer)

# ---------- fondo ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def background(t, glow=1.0):
    gx = W / 2 + 160 * math.sin(t * 0.6); gy = H * 0.55 + 120 * math.cos(t * 0.45)
    dd = ((xx - gx) / 620) ** 2 + ((yy - gy) / 760) ** 2
    g = np.exp(-dd)[..., None] * glow
    col = np.array([62, 34, 40], np.float32)
    return np.clip(g * col, 0, 255).astype(np.uint8).repeat(1, axis=2) if False else np.clip(g * col, 0, 255).astype(np.uint8)

# ---------- texto ----------
def text_layer(lines, y, size=150, t=1.0, accent=None, weight="ExtraBold", stagger=0.12, color=WHITE):
    """lines: lista de líneas; cada palabra entra con escala+opacidad. accent: set de palabras en rosa."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    f = font(weight, size); d = ImageDraw.Draw(img)
    k = 0
    for li, line in enumerate(lines):
        words = line.split(" "); sp = d.textlength(" ", font=f)
        widths = [d.textlength(w, font=f) for w in words]; tot = sum(widths) + sp * (len(words) - 1)
        x = W / 2 - tot / 2; ly = y + li * size * 1.12
        for w, ww in zip(words, widths):
            p = ease_out((t - k * stagger) / 0.35); k += 1
            if p <= 0: x += ww + sp; continue
            sc = lerp(1.35, 1.0, back_out(min(1, (t - (k - 1) * stagger) / 0.35)))
            col = PINK if accent and w.strip("¿?.,!¡") in accent else color
            wi = Image.new("RGBA", (int(ww) + 40, int(size * 1.4)), (0, 0, 0, 0))
            ImageDraw.Draw(wi).text((20, size * 0.2), w, font=f, fill=col + (int(255 * p),))
            if sc != 1: wi = wi.resize((max(1, int(wi.size[0] * sc)), max(1, int(wi.size[1] * sc))), Image.LANCZOS)
            img.alpha_composite(wi, (int(x + ww / 2 - wi.size[0] / 2), int(ly + size * 0.5 - wi.size[1] / 2)))
            x += ww + sp
    return np.asarray(img)

def small_text(txt, y, size=44, color=DIM, alpha=1.0, weight="Medium"):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((W / 2, y), txt, font=font(weight, size), fill=color + (int(255 * alpha),), anchor="ma")
    return np.asarray(img)

def pill(txt, y, alpha=1.0):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img); f = font("Bold", 38)
    tw = d.textlength(txt, font=f); x0 = W / 2 - tw / 2 - 30
    d.rounded_rectangle((x0, y, x0 + tw + 60, y + 72), 36, fill=PINK + (int(255 * alpha),))
    d.text((W / 2, y + 36), txt, font=f, fill=(0, 0, 0, int(255 * alpha)), anchor="mm")
    return np.asarray(img)

logo_img = Image.open(LOGO).convert("RGBA")
def logo_layer(y, lw=150, alpha=1.0, with_text=True, sub=None):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    lg = logo_img.resize((lw, int(logo_img.size[1] * lw / logo_img.size[0])), Image.LANCZOS)
    if alpha < 1: lg.putalpha(lg.getchannel("A").point(lambda v: int(v * alpha)))
    if with_text:
        fb = font("ExtraBold", int(lw * 0.62)); tw = d.textlength("ARC", font=fb)
        x0 = W / 2 - (lw + 24 + tw) / 2
        img.alpha_composite(lg, (int(x0), int(y)))
        d.text((x0 + lw + 24, y + lg.size[1] / 2), "ARC", font=fb, fill=WHITE + (int(255 * alpha),), anchor="lm")
    else:
        img.alpha_composite(lg, (int(W / 2 - lw / 2), int(y)))
    if sub: d.text((W / 2, y + lg.size[1] + 40), sub, font=font("Medium", 44), fill=DIM + (int(255 * alpha),), anchor="ma")
    return np.asarray(img)

# ---------- escenas ----------
REC_HOME = rec_frame(46.5); REC_NUT = rec_frame(75.5); REC_HAB = rec_frame(79.0); REC_RANK = rec_frame(88.0)
REC_QUIZ = rec_frame(22.0); REC_FIN = rec_frame(70.6)
rats = [Image.open(RATS + f) for f in ["rata-1-chumina.png", "rata-2-enclenque.png", "rata-3-mantecado.png", "rata-4-mazao.png", "rata-5-bestia.png", "rata-6-leyenda.png"]]
RAT_NAMES = ["Chuminá", "Enclenque", "Mantecado", "Mazao", "Bestia", "Leyenda"]

SCENES = [  # (duración, función)
]
def scene(d):
    def deco(fn): SCENES.append((d, fn)); return fn
    return deco

@scene(2.2)
def s_hook(t, c):
    c[:] = background(t, 0.6)
    comp_rgba(c, text_layer(["¿Y si", "entrenar", "fuera un", "juego?"], 560, 168, t, accent={"juego"}, stagger=0.16))

@scene(2.6)
def s_level(t, c):
    c[:] = background(t + 3)
    p = ease_out(t / 0.9)
    draw_phone(c, REC_HOME, W / 2 + lerp(380, 110, p), 1250 + lerp(500, 0, p), 0.88, lerp(-55, -18, ease_io(t / 2.6)), 8, lerp(10, 2, p))
    comp_rgba(c, text_layer(["Sube", "de nivel"], 170, 150, t - 0.25, accent={"nivel"}))
    comp_rgba(c, small_text("con tu fuerza real", 520, 52, WHITE, ease_out((t - 0.8) / 0.4), "SemiBold"))

@scene(3.0)
def s_log(t, c):
    c[:] = background(t + 6)
    p = ease_out(t / 0.8)
    scr = rec_frame(59.2 + min(t, 2.9) * 2.6)
    draw_phone(c, scr, W / 2 - lerp(400, 100, p), 1230, 0.88, lerp(50, 16, ease_io(t / 3)), 6, lerp(-8, -2, p))
    comp_rgba(c, text_layer(["Registra", "cada serie"], 170, 150, t - 0.2, accent={"serie"}))

@scene(2.7)
def s_broll(t, c):
    seq = [("ARC-009_jalon-al-pecho-agarre-prono.mp4", 0.9), ("ARC-054_hip-thrust-maquina.mp4", 0.9), ("ARC-X01_sentadilla-bulgara-smith.mp4", 0.9)]
    i = min(int(t / 0.9), 2); name, _ = seq[i]
    fr = clip_frame(name, (t - i * 0.9) + 0.4)
    zoom = 1.0 + 0.06 * ((t - i * 0.9) / 0.9)
    fr = cv2.resize(fr, (int(W * zoom), int(H * zoom))); oy = (fr.shape[0] - H) // 2; ox = (fr.shape[1] - W) // 2
    c[:] = fr[oy:oy + H, ox:ox + W]
    top = np.zeros((H, W), np.float32); top[:700] = np.linspace(0.75, 0, 700)[:, None]
    c[:] = (c * (1 - top[..., None])).astype(np.uint8)
    comp_rgba(c, text_layer(["Técnica", "en vídeo"], 170, 150, t, accent={"vídeo"}))
    comp_rgba(c, small_text("grabado en el gym de verdad", 520, 48, WHITE, ease_out((t - 0.6) / 0.4), "SemiBold"))

@scene(2.8)
def s_food(t, c):
    c[:] = background(t + 9)
    p = ease_out(t / 0.8)
    draw_phone(c, REC_QUIZ, W / 2 - 230, 1290 + lerp(400, 0, p), 0.66, 22, 6, -6, alpha=min(1, t / 0.5))
    p2 = ease_out((t - 0.35) / 0.8)
    if t > 0.35: draw_phone(c, REC_NUT, W / 2 + 200, 1240 + lerp(500, 0, p2), 0.78, -20, 6, 5)
    comp_rgba(c, text_layer(["Comidas", "a tu medida"], 170, 150, t - 0.2, accent={"medida"}))
    comp_rgba(c, small_text("recetas reales ajustadas a tus macros", 520, 46, WHITE, ease_out((t - 0.8) / 0.4), "SemiBold"))

@scene(3.2)
def s_rats(t, c):
    c[:] = background(t + 12, 0.8)
    comp_rgba(c, text_layer(["Tu rata,", "de Chuminá", "a Leyenda"], 170, 130, t, accent={"Leyenda"}))
    # aparecen una a una, cada vez más grandes
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(base)
    idx = min(5, int(max(0, t - 0.5) / 0.38))
    for k in range(idx + 1):
        if t < 0.5: break
        p = ease_out((t - 0.5 - k * 0.38) / 0.3)
        r = rats[k]; hgt = int(lerp(520, 980, k / 5)); r = r.resize((int(r.size[0] * hgt / r.size[1]), hgt), Image.LANCZOS)
        if k < idx:  # las anteriores se quedan pequeñas a los lados
            continue
        r.putalpha(r.getchannel("A").point(lambda v: int(v * p)))
        base.alpha_composite(r, (int(W / 2 - r.size[0] / 2), int(1760 - hgt + (1 - p) * 60)))
        d.text((W / 2, 1790), RAT_NAMES[k], font=font("ExtraBold", 64), fill=PINK + (int(255 * p),), anchor="ma")
        d.text((W / 2, 1660 - hgt), f"Nivel {k + 1}", font=font("Bold", 40), fill=DIM + (int(255 * p),), anchor="ma")
    comp_rgba(c, np.asarray(base))

@scene(2.6)
def s_modes(t, c):
    c[:] = background(t + 15)
    comp_rgba(c, text_layer(["Elige", "tu modo"], 170, 150, t, accent={"modo"}))
    opts = [("Personajes anime", 620), ("Gymrat", 800), ("Sin niveles", 980)]
    for k, (txt, y) in enumerate(opts):
        a = ease_out((t - 0.5 - k * 0.22) / 0.35)
        if a > 0:
            img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
            x0 = 140 + (1 - a) * 80
            d.rounded_rectangle((x0, y, x0 + 800, y + 140), 36, fill=(22, 22, 26, int(255 * a)), outline=PINK + (int(255 * a),) if k == 1 else (60, 60, 68, int(255 * a)), width=3)
            d.text((x0 + 50, y + 70), txt, font=font("ExtraBold", 58), fill=WHITE + (int(255 * a),), anchor="lm")
            comp_rgba(c, np.asarray(img))
    p = ease_out((t - 1.1) / 0.7)
    if t > 1.1: draw_phone(c, REC_RANK, W / 2, 1500 + lerp(500, 120, p), 0.62, 0, 22, 0)

@scene(2.0)
def s_finish(t, c):
    c[:] = background(t + 18)
    p = ease_out(t / 0.6)
    draw_phone(c, REC_FIN, W / 2, 1290, lerp(0.7, 0.86, ease_io(t / 2)), lerp(-25, 12, ease_io(t / 2)), 8, 0)
    comp_rgba(c, text_layer(["Y cada", "entreno", "suma."], 160, 140, t, accent={"suma"}))

@scene(2.6)
def s_end(t, c):
    c[:] = background(t + 20, 1.1)
    a = ease_out(t / 0.5)
    comp_rgba(c, logo_layer(700, 190, a))
    comp_rgba(c, text_layer(["Sube de nivel", "con fuerza real"], 900, 92, t - 0.3, accent={"real"}, stagger=0.06))
    comp_rgba(c, pill("Ya en iPhone · 3 días gratis", 1180, ease_out((t - 0.8) / 0.4)))
    comp_rgba(c, small_text("by Lunarovx", 1330, 40, DIM, ease_out((t - 1.0) / 0.4)))

# ---------- render ----------
total = sum(d for d, _ in SCENES)
if PREVIEW:
    times = []; acc = 0
    for d, fn in SCENES: times.append((acc + d * 0.7, fn, d * 0.7)); acc += d
    tiles = []
    for gt, fn, lt in times:
        c = np.zeros((H, W, 3), np.uint8); fn(lt, c); tiles.append(Image.fromarray(c).resize((270, 480)))
    o = Image.new("RGB", (270 * len(tiles) + 4 * len(tiles), 480), (90, 90, 90))
    for i, im in enumerate(tiles): o.paste(im, (i * 274, 0))
    o.save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/promo1_preview.png"); print("preview", total); sys.exit()

ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
FADE = 0.18
prev_last = None
for si, (d, fn) in enumerate(SCENES):
    n = int(round(d * FPS))
    for i in range(n):
        t = i / FPS; c = np.zeros((H, W, 3), np.uint8); fn(t, c)
        if si > 0 and t < FADE and prev_last is not None:  # corte con flash corto
            k = 1 - t / FADE; c = (c * (1 - k * 0.5) + prev_last * (k * 0.5)).astype(np.uint8)
        if si == len(SCENES) - 1 and t > d - 0.4: c = (c * max(0, (d - t) / 0.4)).astype(np.uint8)
        ff.stdin.write(c.tobytes())
    prev_last = c
ff.stdin.close(); ff.wait(); print("ok", OUT, total)
