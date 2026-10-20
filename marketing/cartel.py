from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
W,H=2480,3508; F="/usr/share/fonts/opentype/inter/"; PINK=(212,139,146); WHITE=(255,255,255); DIM=(170,170,178)
URL="https://arc-by-lunarovx.netlify.app"
c=Image.new("RGB",(W,H),(0,0,0)); d=ImageDraw.Draw(c)
g=Image.new("RGB",(W,H),(0,0,0)); ImageDraw.Draw(g).ellipse((300,1100,2180,2500),fill=(34,30,33)); g=g.filter(ImageFilter.GaussianBlur(260)); c=Image.blend(c,g,1); d=ImageDraw.Draw(c)
f=lambda w,s: ImageFont.truetype(F+f"Inter-{w}.otf",s)
logo=Image.open("raw/logo-mark.png").convert("RGBA"); lw=150; logo=logo.resize((lw,int(logo.size[1]*lw/logo.size[0])))
fb=f("ExtraBold",92); tw=d.textlength("ARC",font=fb); x0=W//2-(lw+24+tw+24+d.textlength("by Lunarovx",font=f("Medium",56)))/2
c.paste(logo,(int(x0),190),logo); d.text((x0+lw+24,190+logo.size[1]/2),"ARC",font=fb,fill=WHITE,anchor="lm")
d.text((x0+lw+24+tw+24,190+logo.size[1]/2+6),"by Lunarovx",font=f("Medium",56),fill=DIM,anchor="lm")
fH=f("ExtraBold",168)
d.text((W//2,420),"¿Y si entrenar",font=fH,fill=WHITE,anchor="ma")
w1=d.textlength("fuera un ",font=fH); w2=d.textlength("juego?",font=fH); x=W//2-(w1+w2)/2
d.text((x,615),"fuera un ",font=fH,fill=WHITE); d.text((x+w1,615),"juego?",font=fH,fill=PINK)
d.text((W//2,855),"Sube de nivel con tu fuerza real, tu constancia y tus hábitos.",font=f("Medium",62),fill=DIM,anchor="ma")
def rounded(im,r):
    m=Image.new("L",im.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,im.size[0]-1,im.size[1]-1),r,fill=255); return m
def phone(src,crop=None,w=600):
    img=Image.open("raw/"+src).convert("RGB")
    if crop: img=img.crop(crop)
    sh=int(w*2.05); img=img.resize((w,int(img.size[1]*w/img.size[0])),Image.LANCZOS)
    scr=Image.new("RGB",(w,sh),(0,0,0)); scr.paste(img,(0,64))
    b=22; ph=Image.new("RGB",(w+2*b,sh+2*b),(36,36,40)); ph.paste(scr,(b,b),rounded(scr,92)); return ph
for (s,cr),px,py in [(("nutricion.png",None),250,1120),(("video-tecnica.jpg",(270,232,625,858)),1590,1120),(("inicio-sin-personajes.png",None),900,1030)]:
    p=phone(s,cr); c.paste(p,(px,py),rounded(p,112)); ImageDraw.Draw(c).rounded_rectangle((px,py,px+p.size[0]-1,py+p.size[1]),112,outline=(80,80,88),width=4)
# degradado inferior para tapar el final de los móviles
gr=Image.new("L",(1,H))
for y in range(H): gr.putpixel((0,y),0 if y<2000 else min(255,int(255*((y-2000)/420)**1.2)))
c.paste(Image.new("RGB",(W,H),(0,0,0)),(0,0),gr.resize((W,H))); d=ImageDraw.Draw(c)
feats=[("Rutina","según tu objetivo o la tuya"),("Registro","series, pesos y descansos"),("Comidas","recetas a tus macros"),("Técnica","vídeos de cada ejercicio")]
cw=(W-240)//4
for i,(t,s) in enumerate(feats):
    cx=120+cw*i+cw//2
    d.text((cx,2470),t,font=f("ExtraBold",64),fill=PINK if i%2==0 else WHITE,anchor="ma")
    d.text((cx,2560),s,font=f("Medium",40),fill=DIM,anchor="ma")
# QR
q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=20,border=2); q.add_data(URL); q.make(fit=True)
qi=q.make_image(fill_color="black",back_color="white").convert("RGB").resize((620,620),Image.NEAREST)
card=Image.new("RGB",(700,700),WHITE); card.paste(qi,(40,40))
lm=Image.open("raw/logo-mark.png").convert("RGBA"); lm=lm.resize((110,int(lm.size[1]*110/lm.size[0])))
bg=Image.new("RGBA",(150,120),(0,0,0,255)); bgm=Image.new("L",(150,120),0); ImageDraw.Draw(bgm).rounded_rectangle((0,0,149,119),26,fill=255)
card.paste(Image.new("RGB",(150,120),(0,0,0)),(275,290),bgm); card.paste(lm,(295,290+(120-lm.size[1])//2),lm)
qx,qy=260,2720
c.paste(card,(qx,qy),rounded(card,48)); d=ImageDraw.Draw(c)
tx=qx+700+90
d.text((tx,qy+70),"Escanéame",font=f("ExtraBold",130),fill=WHITE)
d.text((tx,qy+250),"y empieza tu arco",font=f("SemiBold",72),fill=PINK)
d.text((tx,qy+390),"Próximamente en iPhone",font=f("Medium",58),fill=DIM)
d.text((tx,qy+470),"3 días gratis para probarla",font=f("Medium",58),fill=DIM)
c.save("cartel/ARC_cartel_A4.png",dpi=(300,300)); c.save("cartel/ARC_cartel_A4.pdf",resolution=300)
c.resize((620,877)).save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/cartel.png")
