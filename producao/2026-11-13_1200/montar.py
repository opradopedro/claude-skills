# v93: arte oficial do Palworld e o aviso real da Pocketpair (X @Palworld_EN, 12/11) nas falas do anuncio + b-roll do banco no resto.
import json, subprocess, os
from PIL import Image, ImageFilter, ImageEnhance
FPS = 30
IMGS = {'pal': Image.open('a_push.jpg').convert('RGB'), 'aviso': Image.open('aviso.jpg').convert('RGB')}
def still(img, box, dur, name, zin=True, maxw=1040, maxh=760, cy=600):
    im = IMGS[img]; c = im.crop(box); s = min(maxw / c.width, maxh / c.height) * 2
    c = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
    src = im.crop(box) if img == 'pal' else im
    bg = src.resize((int(src.width * 3840 / src.height), 3840)); x0 = max(0, (bg.width - 2160) // 2)
    if bg.width < 2160: bg = bg.resize((2160, int(bg.height * 2160 / bg.width))); x0 = 0
    cv = ImageEnhance.Brightness(bg.crop((x0, 0, x0 + 2160, 3840)).filter(ImageFilter.GaussianBlur(60))).enhance(0.45)
    cv.paste(c, ((2160 - c.width) // 2, cy * 2 - c.height // 2))
    p = f'cenas/{name}.png'; cv.save(p); n = int(dur * FPS) + 2
    z = f"1+0.08*on/{n}" if zin else f"1.08-0.08*on/{n}"
    out = f'cenas/{name}.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', p, '-vf',
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={n}:s=1080x1920:fps={FPS}",
        '-frames:v', str(n), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], check=True)
    return os.path.abspath(out)
troca = {1.31: ('pal', (0, 0, 650, 720), True),
         6.7: ('aviso', (90, 20, 700, 220), True),
         8.0: ('aviso', (110, 498, 580, 548), True),
         10.44: ('aviso', (135, 522, 575, 546), False),
         11.96: ('aviso', (88, 740, 528, 766), True),
         17.56: ('aviso', (95, 632, 690, 678), True)}
BROLL = {26.15: 'tJbzMqJGH4k_140.mp4'}
cfg = json.load(open('config.json'))
for i, sc in enumerate(cfg['scenes']):
    k = round(sc['start'], 2)
    if k in troca:
        img, box, zin = troca[k]
        sc.update({'src': still(img, box, sc['end'] - sc['start'] + 0.5, f'c{i:02d}', zin), 'cx': 0.5, 'ss': 0.0, 'pan': 0})
    elif k in BROLL:
        sc['src'] = sc['src'].rsplit('/', 1)[0] + '/' + BROLL[k]; sc['ss'] = 0.5; sc['cx'] = 0.5
json.dump(cfg, open('config.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
