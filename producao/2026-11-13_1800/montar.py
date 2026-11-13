# v94: print real da atualizacao 01.002.000 no PS5 (Beebom, 13/11, credito Rockstar) nas falas da atualizacao + b-roll do banco no resto.
import json, subprocess, os
from PIL import Image, ImageFilter, ImageEnhance
FPS = 30
IM = Image.open('update.jpg').convert('RGB')
def still(box, dur, name, zin=True, maxw=1040, maxh=700, cy=580):
    c = IM.crop(box); s = min(maxw / c.width, maxh / c.height) * 2
    c = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
    bg = IM.resize((int(IM.width * 3840 / IM.height), 3840)); x0 = (bg.width - 2160) // 2
    cv = ImageEnhance.Brightness(bg.crop((x0, 0, x0 + 2160, 3840)).filter(ImageFilter.GaussianBlur(60))).enhance(0.45)
    cv.paste(c, ((2160 - c.width) // 2, cy * 2 - c.height // 2))
    p = f'cenas/{name}.png'; cv.save(p); n = int(dur * FPS) + 2
    z = f"1+0.08*on/{n}" if zin else f"1.08-0.08*on/{n}"
    out = f'cenas/{name}.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', p, '-vf',
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={n}:s=1080x1920:fps={FPS}",
        '-frames:v', str(n), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], check=True)
    return os.path.abspath(out)
troca = {3.94: ((0, 0, 1200, 675), True),
         6.04: ((365, 45, 925, 225), True),
         7.64: ((640, 150, 915, 186), False),
         11.08: ((372, 110, 700, 205), True)}
BROLL = {12.85: 'tJbzMqJGH4k_330.mp4', 17.63: 'tJbzMqJGH4k_140.mp4', 28.82: 'tJbzMqJGH4k_280.mp4'}
cfg = json.load(open('config.json'))
for i, sc in enumerate(cfg['scenes']):
    k = round(sc['start'], 2)
    if k in troca:
        box, zin = troca[k]
        sc.update({'src': still(box, sc['end'] - sc['start'] + 0.5, f'c{i:02d}', zin), 'cx': 0.5, 'ss': 0.0, 'pan': 0})
    elif k in BROLL:
        sc['src'] = sc['src'].rsplit('/', 1)[0] + '/' + BROLL[k]; sc['ss'] = 0.5; sc['cx'] = 0.5
json.dump(cfg, open('config.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
