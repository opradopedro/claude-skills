# v103: trailer oficial NBA 2K27 Vice City (YouTube 93W0zh7ThBo, 2K) nas falas + b-roll GTA 6 do banco no resto.
import json, subprocess, os
T = '/root/dl/trailer.mp4'
def corte(ss, dur, name):
    out = os.path.abspath(f'cenas/{name}.mp4')
    vf = ("[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=40:2,eq=brightness=-0.25[bg];"
          "[b]scale=1400:-2,crop=1080:ih[fg];[bg][fg]overlay=0:620-h/2,fps=30,format=yuv420p")
    subprocess.run(['ffmpeg','-loglevel','error','-y','-ss',str(ss),'-t',str(dur+0.6),'-i',T,'-filter_complex',vf,
                    '-an','-c:v','libx264','-crf','14',out],check=True)
    return out
TRAILER = {0:27.3, 1:3.5, 2:6.3, 3:33.2, 4:30.3, 5:9.3, 6:42.3, 7:39.2, 8:51.3, 9:60.3, 10:54.2, 11:57.2,
           12:78.3, 13:36.3, 14:45.3, 16:63.2, 17:21.2, 18:69.2}
BROLL = {15:'tJbzMqJGH4k_320.mp4', 19:'tJbzMqJGH4k_300.mp4', 20:'tJbzMqJGH4k_254.mp4'}
cfg = json.load(open('config.json'))
sc = cfg['scenes']
sc[6]['end'] = sc[7]['start'] = 14.55  # estátua do Macca entra quando a voz fala
for i, s in enumerate(sc):
    if i in TRAILER:
        s.update({'src': corte(TRAILER[i], s['end']-s['start'], f'c{i:02d}'), 'cx': 0.5, 'ss': 0.0, 'pan': 0})
    elif i in BROLL:
        s['src'] = s['src'].rsplit('/',1)[0] + '/' + BROLL[i]; s['ss'] = 0.5; s['cx'] = 0.5
json.dump(cfg, open('config.json','w'), ensure_ascii=False, indent=1)
print('ok')
