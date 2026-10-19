from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=3840,1646; F="/usr/share/fonts/opentype/inter/"
PINK=(212,139,146); WHITE=(255,255,255); DIM=(165,165,172)
c=Image.new("RGB",(W,H),(0,0,0))
g=Image.new("RGB",(W,H),(0,0,0)); ImageDraw.Draw(g).ellipse((1300,350,2540,1500),fill=(26,26,30)); g=g.filter(ImageFilter.GaussianBlur(300)); c=Image.blend(c,g,1)
def rounded(im,r):
    m=Image.new("L",im.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,im.size[0]-1,im.size[1]-1),r,fill=255); return m
def phone(src,crop=None,w=600):
    img=Image.open("raw/"+src).convert("RGB")
    if crop: img=img.crop(crop)
    sh=int(w*2.05); img=img.resize((w,int(img.size[1]*w/img.size[0])),Image.LANCZOS)
    scr=Image.new("RGB",(w,sh),(0,0,0)); scr.paste(img,(0,70))
    b=22; ph=Image.new("RGB",(w+2*b,sh+2*b),(30,30,34)); ph.paste(scr,(b,b),rounded(scr,90)); return ph
# móviles a los lados (decorativos)
for (s,cr),x,y,a in [(("rutina.jpg",None),-60,380,0.35),(("registro-series.jpg",None),620,260,0.6),(("nutricion.png",None),2576,260,0.6),(("video-tecnica.jpg",(270,232,625,858)),3256,380,0.35)]:
    p=phone(s,cr); dark=Image.new("RGB",p.size,(0,0,0)); p=Image.blend(dark,p,a)
    c.paste(p,(x,y),rounded(p,110))
# centro: logo + titular (zona segura central)
d=ImageDraw.Draw(c)
fH=ImageFont.truetype(F+"Inter-ExtraBold.otf",128)
logo=Image.open("raw/logo-mark.png").convert("RGBA"); lw=230; logo=logo.resize((lw,int(logo.size[1]*lw/logo.size[0])))
c.paste(logo,(W//2-lw//2,430),logo)
d.text((W//2,640),"ARC",font=ImageFont.truetype(F+"Inter-ExtraBold.otf",120),fill=WHITE,anchor="ma")
d.text((W//2,860),"Sube de nivel",font=fH,fill=WHITE,anchor="ma")
w1=d.textlength("con fuerza ",font=fH); w2=d.textlength("real",font=fH); x=W//2-(w1+w2)/2
d.text((x,1010),"con fuerza ",font=fH,fill=WHITE); d.text((x+w1,1010),"real",font=fH,fill=PINK)
c.save("header_3840x1646.png")
# simulación del recorte en iPhone (zona central)
cw=1300; c.crop((W//2-cw//2,0,W//2+cw//2,H)).resize((700,823)).save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/header_crop.png")
c.resize((1280,549)).save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/header_prev.png")
