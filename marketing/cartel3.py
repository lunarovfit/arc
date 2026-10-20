from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
W,H=2480,3508; M=170
F="/usr/share/fonts/opentype/inter/"; f=lambda w,s: ImageFont.truetype(F+f"Inter-{w}.otf",s)
PINK=(212,139,146); WHITE=(255,255,255); DIM=(160,160,168); CARD=(17,17,20); LINE=(44,44,50)
URL="https://arc-by-lunarovx.netlify.app"
c=Image.new("RGB",(W,H),(0,0,0))
g=Image.new("RGB",(W,H),(0,0,0)); gd=ImageDraw.Draw(g)
gd.ellipse((260,820,2220,2150),fill=(40,32,36)); g=g.filter(ImageFilter.GaussianBlur(280)); c=Image.blend(c,g,1)
d=ImageDraw.Draw(c)
def rounded(size,r):
    m=Image.new("L",size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,size[0]-1,size[1]-1),r,fill=255); return m
def ctext(y,parts,font):  # parts=[(texto,color)]
    tw=sum(d.textlength(t,font=font) for t,_ in parts); x=W/2-tw/2
    for t,col in parts: d.text((x,y),t,font=font,fill=col); x+=d.textlength(t,font=font)
# 1 · marca
logo=Image.open("raw/logo-mark.png").convert("RGBA"); lw=120; logo=logo.resize((lw,int(logo.size[1]*lw/logo.size[0])))
fb,fby=f("ExtraBold",78),f("Medium",50)
tw=lw+22+d.textlength("ARC",font=fb)+20+d.textlength("by Lunarovx",font=fby); x0=W/2-tw/2; ly=190
c.paste(logo,(int(x0),ly),logo); my=ly+logo.size[1]/2
d.text((x0+lw+22,my),"ARC",font=fb,fill=WHITE,anchor="lm")
d.text((x0+lw+22+d.textlength("ARC",font=fb)+20,my+4),"by Lunarovx",font=fby,fill=DIM,anchor="lm")
# 2 · titular
fH=f("ExtraBold",172)
ctext(350,[("¿Y si entrenar",WHITE)],fH); ctext(545,[("fuera un ",WHITE),("juego?",PINK)],fH)
d.text((W/2,790),"Sube de nivel con tu fuerza real, tu constancia y tus hábitos.",font=f("Medium",58),fill=DIM,anchor="ma")
# 3 · móviles
def phone(src,crop=None,w=520):
    img=Image.open("raw/"+src).convert("RGB")
    if crop: img=img.crop(crop)
    sh=int(w*2.05); img=img.resize((w,int(img.size[1]*w/img.size[0])),Image.LANCZOS)
    scr=Image.new("RGB",(w,sh),(0,0,0)); scr.paste(img,(0,60))
    b=20; ph=Image.new("RGB",(w+2*b,sh+2*b),(34,34,38)); ph.paste(scr,(b,b),rounded(scr.size,86)); return ph
for (s,cr),px,py in [(("nutricion.png",None),330,1060),(("video-tecnica.jpg",(270,232,625,858)),1590,1060),(("mapa-muscular.jpg",None),960,960)]:
    p=phone(s,cr); c.paste(p,(px,py),rounded(p.size,104)); ImageDraw.Draw(c).rounded_rectangle((px,py,px+p.size[0]-1,py+p.size[1]),104,outline=(70,70,78),width=4)
gr=Image.new("L",(1,H))
for y in range(H): gr.putpixel((0,y),0 if y<1640 else min(255,int(255*((y-1640)/340)**1.15)))
c.paste(Image.new("RGB",(W,H),(0,0,0)),(0,0),gr.resize((W,H))); d=ImageDraw.Draw(c)
# 4 · qué hace (fila)
feats=[("Rutina","a tu medida"),("Registro","de cada serie"),("Comidas","a tus macros"),("Técnica","en vídeo")]
cw=(W-2*M)//4
for i,(t,s) in enumerate(feats):
    cx=M+cw*i+cw//2
    d.text((cx,2010),t,font=f("ExtraBold",66),fill=WHITE,anchor="ma")
    d.text((cx,2095),s,font=f("Medium",44),fill=DIM,anchor="ma")
    if i: d.line((M+cw*i,2020,M+cw*i,2135),fill=LINE,width=3)
# 5 · modos
d.text((W/2,2255),"TRES FORMAS DE SUBIR DE NIVEL",font=f("Bold",42),fill=PINK,anchor="ma")
def cover(img,w,h):
    r=max(w/img.size[0],h/img.size[1]); img=img.resize((int(img.size[0]*r)+1,int(img.size[1]*r)+1),Image.LANCZOS)
    l=(img.size[0]-w)//2; t=(img.size[1]-h)//2; return img.crop((l,t,l+w,t+h))
gap=56; kw=(W-2*M-2*gap)//3; ih=360; kh=ih+200; ky=2335
an=cover(Image.open("raw/inicio-anime-NO-APPSTORE.jpg").convert("RGB").crop((52,500,378,700)),kw,ih)
rt=Image.new("RGB",(kw,ih),(24,24,28)); r=Image.open("raw/rat-leyenda-sinfondo.png").convert("RGBA"); r=r.crop((0,0,r.size[0],int(r.size[1]*0.58))); r.thumbnail((kw-80,ih-30)); rt.paste(r,((kw-r.size[0])//2,ih-r.size[1]),r)
_s=Image.open("raw/inicio-simple.png").convert("RGB").crop((18,262,412,470)); _s=_s.resize((kw,int(_s.size[1]*kw/_s.size[0])),Image.LANCZOS); sm=Image.new("RGB",(kw,ih),(0,0,0)); sm.paste(_s,(0,max(0,(ih-_s.size[1])//2)))
cards=[(an,"Personajes anime","Personajes según tu fuerza"),(rt,"Gymrat","Tu rata, de enclenque a mazada"),(sm,"Sin niveles","Solo registrar y entrenar")]
for i,(im,t,s) in enumerate(cards):
    x=M+i*(kw+gap)
    card=Image.new("RGB",(kw,kh),CARD); card.paste(im,(0,0))
    cd=ImageDraw.Draw(card); cd.line((0,ih,kw,ih),fill=LINE,width=2)
    cd.text((44,ih+48),t,font=f("ExtraBold",56),fill=WHITE)
    cd.text((44,ih+128),s,font=f("Medium",36),fill=DIM)
    c.paste(card,(x,ky),rounded((kw,kh),40)); ImageDraw.Draw(c).rounded_rectangle((x,ky,x+kw-1,ky+kh-1),40,outline=LINE,width=3)
d=ImageDraw.Draw(c)
# 6 · llamada + QR
q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=20,border=2); q.add_data(URL); q.make(fit=True)
qs=400; qi=q.make_image(fill_color="black",back_color="white").convert("RGB").resize((qs,qs),Image.NEAREST)
qc=Image.new("RGB",(qs+60,qs+60),WHITE); qc.paste(qi,(30,30))
lm=Image.open("raw/logo-mark.png").convert("RGBA"); lm=lm.resize((96,int(lm.size[1]*96/lm.size[0])))
bx=(qc.size[0]-110)//2; qc.paste(Image.new("RGB",(110,88),(0,0,0)),(bx,(qc.size[1]-88)//2),rounded((110,88),20)); lm.thumbnail((80,80)); qc.paste(lm,(bx+15,(qc.size[1]-lm.size[1])//2),lm)
fy=3020; qx=W-M-qc.size[0]
c.paste(qc,(qx,fy-10),rounded(qc.size,40)); d=ImageDraw.Draw(c)
d.text((M,fy),"Escanéame",font=f("ExtraBold",140),fill=WHITE)
d.text((M,fy+175),"y empieza tu arco",font=f("SemiBold",68),fill=PINK)
d.text((M+4,fy+290),"Próximamente en iPhone  ·  3 días gratis",font=f("Medium",48),fill=DIM)
c.save("cartel/ARC_cartel_A4.png",dpi=(300,300)); c.save("cartel/ARC_cartel_A4.pdf",resolution=300)
c.resize((620,877)).save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/cartel.png")
