from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import math, random
random.seed(7)
W,H=3840,1646; F="/usr/share/fonts/opentype/inter/"
PINK=(212,139,146); BLACK=(10,10,12)
c=Image.new("RGB",(W,H),(255,255,255)); d=ImageDraw.Draw(c)
cx,cy=W//2,H//2-40
# líneas de velocidad estilo manga
for i in range(260):
    a=random.uniform(0,2*math.pi); w=random.uniform(0.004,0.016); r0=random.uniform(700,1050)
    r1=3000
    p=[(cx+r0*math.cos(a),cy+r0*0.62*math.sin(a)),(cx+r1*math.cos(a-w),cy+r1*0.62*math.sin(a-w)),(cx+r1*math.cos(a+w),cy+r1*0.62*math.sin(a+w))]
    d.polygon(p,fill=BLACK)
# trama de puntos rosa (halftone) en las esquinas
dots=Image.new("RGBA",(W,H),(0,0,0,0)); dd=ImageDraw.Draw(dots)
for y in range(0,H,34):
    for x in range(0,W,34):
        k=max(abs(x-cx)/(W/2),abs(y-cy)/(H/2))
        rr=max(0,(k-0.6))*20
        if rr>0.5: dd.ellipse((x-rr,y-rr,x+rr,y+rr),fill=PINK+(255,))
c.paste(dots,(0,0),dots)
# óvalo blanco central limpio
m=Image.new("L",(W,H),0); ImageDraw.Draw(m).ellipse((cx-1050,cy-560,cx+1050,cy+560),fill=255); m=m.filter(ImageFilter.GaussianBlur(40))
c.paste(Image.new("RGB",(W,H),(255,255,255)),(0,0),m)
d=ImageDraw.Draw(c)
# móviles reales a los lados, a todo brillo
def rounded(im,r):
    mm=Image.new("L",im.size,0); ImageDraw.Draw(mm).rounded_rectangle((0,0,im.size[0]-1,im.size[1]-1),r,fill=255); return mm
def phone(src,crop=None,w=560):
    img=Image.open("raw/"+src).convert("RGB")
    if crop: img=img.crop(crop)
    sh=int(w*2.05); img=img.resize((w,int(img.size[1]*w/img.size[0])),Image.LANCZOS)
    scr=Image.new("RGB",(w,sh),(0,0,0)); scr.paste(img,(0,60))
    b=20; ph=Image.new("RGB",(w+2*b,sh+2*b),BLACK); ph.paste(scr,(b,b),rounded(scr,84)); return ph
for (s,cr),x,y,rot in [(("inicio-sin-personajes.png",None),80,230,6),(("video-tecnica.jpg",(270,232,625,858)),640,330,-4),(("nutricion.png",None),2610,330,4),(("mapa-muscular.jpg",None),3170,230,-6)]:
    p=phone(s,cr).convert("RGBA"); p.putalpha(rounded(p,100)); p=p.rotate(rot,resample=Image.BICUBIC,expand=True)
    sh=Image.new("RGBA",p.size,(0,0,0,0)); sh.putalpha(p.getchannel("A").point(lambda v:int(v*0.35))); sh=sh.filter(ImageFilter.GaussianBlur(30))
    c.paste((0,0,0),(x+18,y+30),sh); c.paste(p,(x,y),p)
# texto central
jp=ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",92,index=0)
d.text((cx,cy-430),"レベルアップ",font=jp,fill=PINK,anchor="mm")
logo=Image.open("raw/logo-mark.png").convert("RGBA"); lw=150; logo=logo.resize((lw,int(logo.size[1]*lw/logo.size[0])))
logo=Image.merge("RGBA",(*[Image.new("L",logo.size,10)]*3,logo.getchannel("A")))
fB=ImageFont.truetype(F+"Inter-ExtraBold.otf",84); tw=d.textlength("ARC",font=fB)
lx=cx-(lw+22+tw)/2; c.paste(logo,(int(lx),cy-330),logo); d.text((lx+lw+22,cy-330+logo.size[1]/2),"ARC",font=fB,fill=BLACK,anchor="lm")
fH=ImageFont.truetype(F+"Inter-ExtraBold.otf",132)
d.text((cx,cy-150),"Sube de nivel",font=fH,fill=BLACK,anchor="ma")
w1=d.textlength("con fuerza ",font=fH); w2=d.textlength("real",font=fH); x=cx-(w1+w2)/2
d.text((x,cy+20),"con fuerza ",font=fH,fill=BLACK); d.text((x+w1,cy+20),"real",font=fH,fill=PINK)
fS=ImageFont.truetype(F+"Inter-SemiBold.otf",54)
d.text((cx,cy+250),"Entrena · Come bien · Sube de nivel",font=fS,fill=(90,90,96),anchor="ma")
c.save("header_3840x1646.png")
c.resize((1280,549)).save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/header3.png")
cw=1700; c.crop((cx-cw//2,0,cx+cw//2,H)).resize((560,542)).save("/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/header3_crop.png")
