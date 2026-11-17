from PIL import Image, ImageDraw, ImageFont
def make(size, path):
    S=1024
    img=Image.new('RGB',(S,S))
    px=img.load()
    a=(0x7b,0x3f,0xe4); b=(0xe0,0x40,0x7b)
    for y in range(S):
        for x in range(S):
            t=(x+y)/(2*S)
            px[x,y]=tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
    d=ImageDraw.Draw(img,'RGBA')
    cell=S//8
    for r in range(8):
        for c in range(8):
            if (r+c)%2: d.rectangle([c*cell,r*cell,(c+1)*cell,(r+1)*cell],fill=(255,255,255,30))
    f=ImageFont.truetype('C:/Windows/Fonts/seguisym.ttf',700)
    g='\u265e'
    bb=d.textbbox((0,0),g,font=f)
    x=(S-(bb[2]-bb[0]))//2-bb[0]; y=(S-(bb[3]-bb[1]))//2-bb[1]-20
    d.text((x,y),g,font=f,fill=(255,255,255),stroke_width=14,stroke_fill=(42,31,85))
    d.ellipse([700,700,860,860],fill=(255,207,63),outline=(42,31,85),width=14)
    img.resize((size,size),Image.LANCZOS).save(path)
make(180,'icon-180.png'); make(512,'icon-512.png')
print('ok')
