# v95: teaser oficial de Macca & Friends (DiscussingFilm/RockstarGames no X, 13/11) nas falas do desenho + b-roll do banco no resto.
import json, subprocess, os
T = '/tmp/macca_4k.mp4'
def corte(ss, dur, name):
    out = os.path.abspath(f'cenas/{name}.mp4')
    vf = ("[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=40:2,eq=brightness=-0.25[bg];"
          "[b]scale=1300:-2,crop=1080:ih[fg];[bg][fg]overlay=0:600-h/2,fps=30,format=yuv420p")
    subprocess.run(['ffmpeg','-loglevel','error','-y','-ss',str(ss),'-t',str(dur+0.6),'-i',T,'-filter_complex',vf,
                    '-an','-c:v','libx264','-crf','14',out],check=True)
    return out
TEASER = {0:6.2, 1:12.0, 3:25.3, 4:3.6, 8:1.0, 9:10.0, 10:13.0, 11:14.8, 12:8.0, 13:20.0, 14:26.0}
BROLL = {2:'tJbzMqJGH4k_140.mp4', 7:'tJbzMqJGH4k_280.mp4', 18:'tJbzMqJGH4k_330.mp4'}
cfg = json.load(open('config.json'))
for i, sc in enumerate(cfg['scenes']):
    if i in TEASER:
        sc.update({'src': corte(TEASER[i], sc['end']-sc['start'], f'c{i:02d}'), 'cx': 0.5, 'ss': 0.0, 'pan': 0})
    elif i in BROLL:
        sc['src'] = sc['src'].rsplit('/',1)[0] + '/' + BROLL[i]; sc['ss'] = 0.5; sc['cx'] = 0.5
json.dump(cfg, open('config.json','w'), ensure_ascii=False, indent=1)
print('ok')
