from PIL import Image, ImageOps
import os
U="/root/.claude/uploads/3bae07ba-c8c3-5f0e-adb3-78f0953fb194/"
# (cx, cy, lado) en un marco de 1500x2000
C={"902e81a0":("rl01",740,985,1240),"19c41049":("r008",750,975,1500),"810b9908":("rl02",725,1130,1300),
"1167a5d1":("rl03",740,1025,1380),"cac3019c":("rl04",750,1100,1500),"62762dc7":("rl05",740,1050,1460),
"22a1e32e":("rl06",725,1150,1250),"d0ebbbfd":("rl07",740,1070,1440),"bfc31c40":("rl08",690,1330,1250),
"6daac3d4":("r029",900,1500,1000),"1b1eae82":("rl09",735,1115,1400),"bcadf144":("rl10",760,1010,1400),
"e955c753":("rl11",730,1130,1460),"f5fa5ac9":("rl12",750,1150,1500),"f036b5ef":("rl13",785,990,1430),
"d04c4ac7":("rl14",750,965,1500),"e50707bb":("rl15",700,1000,1500),"9cbde605":("rl16",735,970,1300),
"6a496062":("rl17",800,1330,1300)}
out="/home/claude/arc/public/recetas/"
for k,(rid,cx,cy,s) in C.items():
    im=ImageOps.exif_transpose(Image.open(U+k+"-image.jpg")).convert("RGB")
    w,h=im.size; fx=w/1500; fy=h/2000
    cx,cy,sx=cx*fx,cy*fy,s*fx
    l=max(0,min(w-sx,cx-sx/2)); t=max(0,min(h-sx,cy-sx/2))
    im=im.crop((int(l),int(t),int(l+sx),int(t+sx))).resize((900,900),Image.LANCZOS)
    im.save(out+rid+".jpg",quality=82,optimize=True,progressive=True)
print(Image.open(U+"902e81a0-image.jpg").size)
