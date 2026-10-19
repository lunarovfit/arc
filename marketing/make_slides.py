from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1290,2796
PINK=(212,139,146); WHITE=(255,255,255); DIM=(160,160,166)
F="/usr/share/fonts/opentype/inter/"
fH=ImageFont.truetype(F+"Inter-ExtraBold.otf",128)
fS=ImageFont.truetype(F+"Inter-Medium.otf",46)
fB=ImageFont.truetype(F+"Inter-Bold.otf",40)

SLIDES=[
 ("inicio-sin-personajes.png", None, ["Sube de nivel", "con fuerza ", "real"], "Tu nivel sale de lo que levantas,\ntu constancia y tus hábitos."),
 ("rutina.jpg", None, ["Tu rutina,", "hecha ", "para ti"], "Según tus objetivos o la tuya propia,\nde 2 a 7 días por semana."),
 ("registro-series.jpg", None, ["Registra", "cada ", "serie"], "Kilos, repeticiones, RIR y descansos\ncon temporizador."),
 ("video-tecnica.jpg", (270,232,625,858), ["Técnica", "en ", "vídeo"], "Cada ejercicio con su vídeo,\ngrabado en el gym de verdad."),
 ("mapa-muscular.jpg", None, ["Mira tus", "", "músculos"], "Series por músculo cada semana:\nsabes qué te falta y qué te sobra."),
 ("nutricion.png", None, ["Comidas a", "tu ", "medida"], "Recetas reales ajustadas a tus macros.\nFácil o modo cocinitas."),
 ("habitos-ipad.png", (752,60,1608,1500), ["Pasos, agua", "y ", "sueño"], "Con 2 de 3 el día cuenta.\nConecta con Apple Salud."),
]

def rounded(im, r):
    m=Image.new("L",im.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,im.size[0]-1,im.size[1]-1),r,fill=255); return m

def slide(src, crop, head, sub, out):
    c=Image.new("RGB",(W,H),(0,0,0))
    # glow
    g=Image.new("RGB",(W,H),(0,0,0)); gd=ImageDraw.Draw(g); gd.ellipse((W//2-650,1300,W//2+650,2700),fill=(30,30,34)); g=g.filter(ImageFilter.GaussianBlur(260)); c=Image.blend(c,g,1.0)
    d=ImageDraw.Draw(c)
    # logo
    logo=Image.open("raw/logo-mark.png").convert("RGBA"); lw=110; logo=logo.resize((lw,int(logo.size[1]*lw/logo.size[0])))
    lx=W//2-lw//2-70; c.paste(logo,(lx,150),logo); d.text((lx+lw+18,150+logo.size[1]//2),"ARC",font=fB,fill=WHITE,anchor="lm")
    # headline: line1 white; line2 = white prefix + pink word
    y=300
    d.text((W//2,y),head[0],font=fH,fill=WHITE,anchor="ma"); y+=150
    pre,acc=head[1],head[2]
    wp=d.textlength(pre,font=fH); wa=d.textlength(acc,font=fH); x=W//2-(wp+wa)/2
    d.text((x,y),pre,font=fH,fill=WHITE); d.text((x+wp,y),acc,font=fH,fill=PINK)
    y+=185
    for i,l in enumerate(sub.split("\n")): d.text((W//2,y+i*62),l,font=fS,fill=DIM,anchor="ma")
    # phone
    pw=1040; px=(W-pw)//2; py=880; bez=26; r=150
    sw=pw-2*bez
    img=Image.open("raw/"+src).convert("RGB")
    if crop: img=img.crop(crop)
    img=img.resize((sw,int(img.size[1]*sw/img.size[0])),Image.LANCZOS)
    top=120  # status bar band
    ph=H-py+200
    phone=Image.new("RGB",(pw,ph),(28,28,32))
    screen=Image.new("RGB",(sw,ph-2*bez),(0,0,0)); screen.paste(img,(0,top))
    sd=ImageDraw.Draw(screen)
    sd.rounded_rectangle((sw//2-120,30,sw//2+120,100),35,fill=(0,0,0))
    sd.text((70,52),"9:41",font=ImageFont.truetype(F+"Inter-SemiBold.otf",38),fill=WHITE,anchor="lm")
    sd.rounded_rectangle((sw-130,40,sw-72,66),8,outline=WHITE,width=3); sd.rectangle((sw-125,45,sw-85,61),fill=WHITE)
    phone.paste(screen,(bez,bez),rounded(screen,r-bez))
    # outer highlight
    pd=ImageDraw.Draw(phone); 
    c.paste(phone,(px,py),rounded(phone,r))
    ImageDraw.Draw(c).rounded_rectangle((px,py,px+pw-1,py+ph),r,outline=(70,70,78),width=3)
    c.save(out,quality=95)

for i,(src,crop,head,sub) in enumerate(SLIDES,1):
    slide(src,crop,head,sub,f"appstore/{i:02d}.png")
print("ok")
