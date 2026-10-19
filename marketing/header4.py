from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=3840,1646; F="/usr/share/fonts/opentype/inter/"; PINK=(212,139,146)
c=Image.new("RGB",(W,H),(0,0,0))
ks=["C0447","C0435","C0446","C0438"]; sw=W//4
for i,k in enumerate(ks):
    im=Image.open(f"/tmp/hf_{k}.png").convert("RGB")
    s=sw/im.size[0]; im=im.resize((sw,int(im.size[1]*s)),Image.LANCZOS)
    top=(im.size[1]-H)//2; c.paste(im.crop((0,top,sw,top+H)),(i*sw,0))
# separadores finos negros
d=ImageDraw.Draw(c)
for i in range(1,4): d.rectangle((i*sw-4,0,i*sw+4,H),fill=(0,0,0))
# oscurecer el centro para leer el texto
ov=Image.new("L",(W,H),0); od=ImageDraw.Draw(ov)
od.ellipse((W//2-1250,H//2-640,W//2+1250,H//2+640),fill=185); ov=ov.filter(ImageFilter.GaussianBlur(220))
c.paste(Image.new("RGB",(W,H),(0,0,0)),(0,0),ov)
# viñeta suave arriba y abajo
g=Image.new("L",(1,H)); 
for y in range(H): g.putpixel((0,y),int(110*max(0,1-y/300)**2+120*max(0,(y-H+380)/380)**2))
c.paste(Image.new("RGB",(W,H),(0,0,0)),(0,0),g.resize((W,H)))
d=ImageDraw.Draw(c); cx,cy=W//2,H//2
jp=ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",58,index=0)
logo=Image.open("/home/claude/mk/raw/logo-mark.png").convert("RGBA"); lw=120; logo=logo.resize((lw,int(logo.size[1]*lw/logo.size[0])))
fB=ImageFont.truetype(F+"Inter-ExtraBold.otf",68); tw=d.textlength("ARC",font=fB); lx=cx-(lw+20+tw)/2
c.paste(logo,(int(lx),cy-360),logo); d.text((lx+lw+20,cy-360+logo.size[1]/2),"ARC",font=fB,fill=(255,255,255),anchor="lm")
fH=ImageFont.truetype(F+"Inter-ExtraBold.otf",150)
d.text((cx,cy-200),"Sube de nivel",font=fH,fill=(255,255,255),anchor="ma")
w1=d.textlength("con fuerza ",font=fH); w2=d.textlength("real",font=fH); x=cx-(w1+w2)/2
d.text((x,cy-20),"con fuerza ",font=fH,fill=(255,255,255)); d.text((x+w1,cy-20),"real",font=fH,fill=PINK)
d.text((cx,cy+230),"レベルアップ",font=jp,fill=PINK,anchor="mm")
c.save("header_3840x1646.png")
S="/tmp/claude-0/-home-claude/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/scratchpad/"
c.resize((1280,549)).save(S+"h4.png"); cw=1700; c.crop((cx-cw//2,0,cx+cw//2,H)).resize((380,368)).save(S+"h4c.png")
a=Image.open(S+"h4.png"); o=Image.new("RGB",(1680,549),"gray"); o.paste(a,(0,0)); o.paste(Image.open(S+"h4c.png"),(1295,90)); o.save(S+"h4_both.png")
