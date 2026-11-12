# v90: foto real do Grotti Cheetah na vitrine da Selfridges nas falas do carro + b-roll do banco no resto.
import json, subprocess, os
from PIL import Image, ImageFilter, ImageEnhance
IMG = 'cheetah.jpg'; FPS = 30
im = Image.open(IMG).convert('RGB'); BG = im.getpixel((20, 20))
def still(box, dur, name, zin=True, maxw=1080, maxh=700, cy=580):
    c = im.crop(box); s = min(maxw / c.width, maxh / c.height) * 2
    c = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
    bg = im.resize((int(im.width * 3840 / im.height), 3840)); x0 = (bg.width - 2160) // 2
    cv = ImageEnhance.Brightness(bg.crop((x0, 0, x0 + 2160, 3840)).filter(ImageFilter.GaussianBlur(60))).enhance(0.45); cv.paste(c, ((2160 - c.width) // 2, cy * 2 - c.height // 2))
    p = f'cenas/{name}.png'; cv.save(p); n = int(dur * FPS) + 2
    z = f"1+0.10*on/{n}" if zin else f"1.10-0.10*on/{n}"
    out = f'cenas/{name}.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', p, '-vf',
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={n}:s=1080x1920:fps={FPS}",
        '-frames:v', str(n), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], check=True)
    return os.path.abspath(out)
FULL = (300, 0, 1700, 1079)
CAR = (570, 640, 1430, 990)
SIGN = (1130, 380, 1620, 1000)
troca = {1.95: (FULL, True), 5.78: (CAR, True), 7.48: (CAR, False), 12.9: (CAR, True),
         16.69: ((560, 250, 1440, 1000), True), 19.17: (SIGN, True), 25.7: (FULL, True), 27.26: (FULL, False)}
cfg = json.load(open('config.json'))
for i, sc in enumerate(cfg['scenes']):
    k = round(sc['start'], 2)
    if k in troca:
        box, zin = troca[k]
        sc.update({'src': still(box, sc['end'] - sc['start'] + 0.5, f'c{i:02d}', zin), 'cx': 0.5, 'ss': 0.0, 'pan': 0})
json.dump(cfg, open('config.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
