# Monta as cenas do v82: imagem real do Flightradar24 (rota do piloto) em recortes que seguem a fala + b-roll aereo do banco.
import json, subprocess, os
from PIL import Image
IMG = 'ceu.jpg'; BG = (37, 37, 37); FPS = 30
CL = '/home/claude/fabrica-de-paginas/radar-gta6/broll/clips/'
im = Image.open(IMG).convert('RGB')

def canvas(box, maxw=960, maxh=1060, cy=700, name='x'):
    c = im.crop(box); s = min(maxw / c.width, maxh / c.height) * 2
    c = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
    cv = Image.new('RGB', (2160, 3840), BG)
    cv.paste(c, ((2160 - c.width) // 2, cy * 2 - c.height // 2))
    p = f'cenas/{name}.png'; cv.save(p); return p

def still(box, dur, name, zin=True, **kw):
    p = canvas(box, name=name, **kw); n = int(dur * FPS) + 2
    z = f"1+0.10*on/{n}" if zin else f"1.10-0.10*on/{n}"
    out = f'cenas/{name}.mp4'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', p, '-vf',
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d={n}:s=1080x1920:fps={FPS}",
        '-frames:v', str(n), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], check=True)
    return os.path.abspath(out)

FULL = (320, 100, 950, 580)
plano = [  # (inicio, fim, tipo, arg)
 (0.0, 2.672, 'img', dict(box=FULL, zin=True)),
 (2.672, 5.913, 'img', dict(box=(430, 140, 950, 520), zin=True)),
 (5.913, 7.935, 'clip', ('tJbzMqJGH4k_292', 0.0, 0.55)),
 (7.935, 9.696, 'clip', ('QdBZY2fkU-0_004', 0.5, 0.5)),
 (9.696, 11.957, 'img', dict(box=(0, 0, 640, 500), zin=True)),
 (11.957, 15.259, 'img', dict(box=FULL, zin=False)),
 (15.259, 16.88, 'img', dict(box=(415, 115, 935, 265), zin=True)),
 (16.88, 17.981, 'img', dict(box=(335, 190, 565, 485), zin=True)),
 (17.981, 20.042, 'img', dict(box=(525, 240, 800, 485), zin=True)),
 (20.042, 22.383, 'img', dict(box=(760, 190, 950, 510), zin=True)),
 (22.383, 23.444, 'img', dict(box=(320, 455, 655, 570), zin=True)),
 (23.444, 25.805, 'img', dict(box=(630, 460, 950, 572), zin=True)),
 (25.805, 28.287, 'img', dict(box=(150, 60, 600, 490), zin=False)),
 (28.287, 30.488, 'clip', ('tJbzMqJGH4k_255', 0.0, 0.5)),
 (30.488, 33.59, 'img', dict(box=FULL, zin=True)),
 (33.59, 36.071, 'clip', ('tJbzMqJGH4k_254', 0.0, 0.5)),
 (36.071, 39.753, 'img', dict(box=(520, 175, 955, 525), zin=True)),
 (39.753, 99, 'img', dict(box=FULL, zin=False)),
]
cfg = json.load(open('config.json'))
fim = cfg['captions'][-1]['end'] + 0.6
scenes = []
for i, (a, b, t, arg) in enumerate(plano):
    b = min(b, fim)
    if t == 'img':
        src = still(arg['box'], b - a + 0.5, f'c{i:02d}', arg['zin'])
        scenes.append({'src': src, 'start': a, 'end': b, 'layout': 'full', 'cx': 0.5, 'ss': 0.0})
    else:
        cid, ss, cx = arg
        scenes.append({'src': CL + cid + '.mp4', 'start': a, 'end': b, 'layout': 'full', 'cx': cx, 'ss': ss})
cfg['scenes'] = scenes
json.dump(cfg, open('config.json', 'w'), ensure_ascii=False, indent=1)
print(len(scenes), 'cenas; fim', fim)
