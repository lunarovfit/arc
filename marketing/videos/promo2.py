# ARC · promo 2 (corto, ~9 s): la rata evoluciona de Chuminá a Leyenda al ritmo
import numpy as np, subprocess, math, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
BRANCH = sys.argv[1] if len(sys.argv) > 1 else "fem"
RATS = f"/home/claude/rats/{'fem' if BRANCH == 'fem' else 'v2'}/"
OUT = f"/home/claude/promo/ARC_promo_2_ratas_{BRANCH}.mp4"
F = "/usr/share/fonts/opentype/inter/Inter-%s.otf"; font = lambda w, s: ImageFont.truetype(F % w, s)
PINK = (212, 139, 146); WHITE = (255, 255, 255); DIM = (165, 165, 172)
NAMES = ["Chuminá", "Enclenque", "Mantecado", "Mazao", "Bestia", "Leyenda"]
WHEN = ["Día 1", "Mes 2", "Mes 4", "Mes 9", "Año 1,5", "Año 3"]
files = ["rata-1-chumina", "rata-2-enclenque", "rata-3-mantecado", "rata-4-mazao", "rata-5-bestia", "rata-6-leyenda"]
rats = [Image.open(RATS + f + ".png").convert("RGBA") for f in files]
logo = Image.open("/home/claude/arc/public/logo-mark.png").convert("RGBA")

def eo(t): t = min(max(t, 0), 1); return 1 - (1 - t) ** 3
def bo(t, s=2.2): t = min(max(t, 0), 1) - 1; return t * t * ((s + 1) * t + s) + 1

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def bg(t, pulse):
    dd = ((xx - W / 2) / 640) ** 2 + ((yy - H * 0.58) / 820) ** 2
    g = np.exp(-dd)[..., None] * (0.75 + 0.6 * pulse)
    return Image.fromarray(np.clip(g * np.array([70, 36, 44]), 0, 255).astype(np.uint8))

def ctext(d, y, txt, f, col):
    d.text((W / 2, y), txt, font=f, fill=col, anchor="ma")

BEAT = 0.95; INTRO = 1.0; OUTRO = 2.4
total = INTRO + BEAT * 6 + OUTRO
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for i in range(int(total * FPS)):
    t = i / FPS
    k = int((t - INTRO) // BEAT) if t >= INTRO else -1
    k = min(k, 5); lt = (t - INTRO - k * BEAT) if k >= 0 else 0
    pulse = max(0, 1 - lt / 0.35) if 0 <= k and t < INTRO + 6 * BEAT else 0
    img = bg(t, pulse).convert("RGBA"); d = ImageDraw.Draw(img)
    # titular fijo arriba
    a = eo(t / 0.4)
    ctext(d, 150, "Tu rata de gym", font("ExtraBold", 92), WHITE + (int(255 * a),))
    ctext(d, 262, "según lo que entrenas", font("SemiBold", 52), DIM + (int(255 * a),))
    if t < INTRO + 6 * BEAT:
        kk = max(k, 0)
        r = rats[kk]; hgt = int(980 + 34 * kk)
        sc = 1.0 + 0.10 * (1 - bo(lt / 0.32)) if k >= 0 else 0.9 + 0.1 * eo(t / INTRO)
        rh = int(hgt * sc); rw = int(r.size[0] * rh / r.size[1])
        if rw > 1000: rw = 1000; rh = int(r.size[1] * rw / r.size[0])
        ri = r.resize((rw, rh), Image.LANCZOS)
        if k < 0: ri.putalpha(ri.getchannel("A").point(lambda v: int(v * eo(t / 0.6))))
        img.alpha_composite(ri, (int(W / 2 - rw / 2), int(1640 - rh)))
        # destello en cada cambio
        if pulse > 0.6:
            fl = Image.new("RGBA", (W, H), (255, 255, 255, int(110 * (pulse - 0.6) / 0.4))); img.alpha_composite(fl)
        d = ImageDraw.Draw(img)
        ctext(d, 1680, NAMES[kk], font("ExtraBold", 96), PINK)
        ctext(d, 1800, f"{WHEN[kk]}  ·  Nivel {kk + 1}", font("SemiBold", 46), WHITE)
        # barra de progreso del arco
        bx, by, bw = 240, 420, 600
        d.rounded_rectangle((bx, by, bx + bw, by + 14), 7, fill=(50, 50, 56))
        prog = (kk + min(1, lt / BEAT)) / 6 if k >= 0 else 0
        d.rounded_rectangle((bx, by, bx + max(14, bw * prog), by + 14), 7, fill=PINK)
    else:
        ot = t - INTRO - 6 * BEAT
        # cierre: Leyenda pequeña + logo
        r = rats[5]; rh = int(820 - 120 * eo(ot / 0.5)); rw = int(r.size[0] * rh / r.size[1]); ri = r.resize((rw, rh), Image.LANCZOS)
        img.alpha_composite(ri, (int(W / 2 - rw / 2), int(1480 - rh)))
        d = ImageDraw.Draw(img)
        a = eo((ot - 0.3) / 0.4)
        lw = 130; lg = logo.resize((lw, int(logo.size[1] * lw / logo.size[0])), Image.LANCZOS); lg.putalpha(lg.getchannel("A").point(lambda v: int(v * a)))
        fb = font("ExtraBold", 84); tw = d.textlength("ARC", font=fb); x0 = W / 2 - (lw + 20 + tw) / 2
        img.alpha_composite(lg, (int(x0), 1540)); d.text((x0 + lw + 20, 1540 + lg.size[1] / 2), "ARC", font=fb, fill=WHITE + (int(255 * a),), anchor="lm")
        b = eo((ot - 0.7) / 0.4)
        f2 = font("Bold", 40); txt = "Ya en iPhone · 3 días gratis"; tw2 = d.textlength(txt, font=f2)
        d.rounded_rectangle((W / 2 - tw2 / 2 - 30, 1720, W / 2 + tw2 / 2 + 30, 1792), 36, fill=PINK + (int(255 * b),))
        d.text((W / 2, 1756), txt, font=f2, fill=(0, 0, 0, int(255 * b)), anchor="mm")
        if ot > OUTRO - 0.35:
            img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (ot - (OUTRO - 0.35)) / 0.35))))
    ff.stdin.write(np.asarray(img.convert("RGB")).tobytes())
ff.stdin.close(); ff.wait(); print("ok", OUT, total)
