# v87: arte oficial da Vice City Collection (Rockstar) nas falas sobre a caixa + b-roll do banco no resto.
import json, subprocess, os
from PIL import Image
IMG = 'colecao.jpg'; FPS = 30
im = Image.open(IMG).convert('RGB'); BG = im.getpixel((20, 20))
def still(box, dur, name, zin=True, maxw=1000, maxh=1300, cy=900):
    c = im.crop(box); s = min(maxw / c.width, maxh / c.height) * 2
    c = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
    cv = Image.new('RGB', (2160, 3840), BG); cv.paste(c, ((2160 - c.width) // 2, cy * 2 - c.height // 2))
    p = f'cenas/{name}.png'; cv.save(p); n = int(dur * FPS) + 2
    z = f"1+0.10*on/{n}" if zin else f"1.10-0.10*on/{n}"
    out = f'cenas/{name}.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', p, '-vf',
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={n}:s=1080x1920:fps={FPS}",
        '-frames:v', str(n), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], check=True)
    return os.path.abspath(out)
FULL = (200, 0, 1720, 1080)
troca = {7.06: (FULL, True), 12.28: (FULL, False), 13.74: ((290, 270, 720, 1000), True),
         15.51: ((300, 300, 720, 760), True), 29.9: (FULL, True)}
cfg = json.load(open('config.json'))
for i, sc in enumerate(cfg['scenes']):
    k = round(sc['start'], 2)
    if k in troca:
        box, zin = troca[k]
        sc.update({'src': still(box, sc['end'] - sc['start'] + 0.5, f'c{i:02d}', zin, **({'maxw': 1080, 'cy': 620} if box == FULL else {})), 'cx': 0.5, 'ss': 0.0, 'pan': 0})
json.dump(cfg, open('config.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
