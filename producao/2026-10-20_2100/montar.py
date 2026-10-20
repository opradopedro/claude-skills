"""Reel do trailer de lançamento: cada trecho da fala usa as cenas do trailer que mostram aquilo."""
import json, os, sys
sys.path.insert(0, "../../pipeline")
from align2 import align
from auto_short import chunks, CENSOR, duration

SRC = "/home/claude/trailer/launch_crop.mp4"  # trailer oficial sem as faixas pretas (1920x960)
TEXT = open("roteiro.txt").read().strip()
# (primeira palavra do trecho, [(inicio, fim, cx), ...]) em segundos do trailer
SEG = [("vai ter", [(52.3, 53.4, .5), (25.2, 26.0, .5), (14.0, 14.9, .5), (62.5, 63.2, .5)]),
       ("A Rockstar", [(44.0, 45.9, .55), (2.0, 3.9, .5), (4.0, 5.9, .5), (35.8, 37.2, .5), (63.25, 64.1, .5)]),
       ("As nuvens", [(6.0, 8.9, .5), (55.0, 55.9, .4), (27.3, 28.7, .5), (70.2, 70.95, .5), (68.0, 69.2, .5)]),
       ("O vento", [(26.0, 27.0, .38), (40.0, 41.9, .45), (66.5, 67.7, .55), (48.2, 49.9, .5)]),
       ("Só não", [(33.0, 34.4, .5), (34.5, 35.7, .5), (47.0, 48.1, .5)]),
       ("Você", [(46.25, 47.0, .65), (38.3, 39.7, .5), (72.0, 73.0, .5)]),
       ("Manda", [(11.2, 13.9, .62), (61.0, 62.2, .5), (29.7, 32.0, .5)])]

words = align("voz.mp3", TEXT, {"GTA 6": "GTA 6"})
total = duration("voz.mp3") + 0.4
seq = [w for w, s, e in words]
starts = []
for chave, _ in SEG:
    ks = chave.split()
    i = next(i for i in range(len(seq)) if [x.strip(",.!?:\"").lower() for x in seq[i:i + len(ks)]] == [k.lower() for k in ks]
             and (not starts or i > starts[-1][0]))
    starts.append((i, words[i][1]))
scenes = []
for n, (chave, rngs) in enumerate(SEG):
    t0 = 0.0 if n == 0 else starts[n][1]
    t1 = starts[n + 1][1] if n + 1 < len(SEG) else total
    L, M = t1 - t0, sum(b - a for a, b, _ in rngs)
    # cada cena do trecho entra na ordem; se sobra material, corta proporcional; se falta, repete do inicio
    pecas, k = [], 0
    if M >= L:
        for a, b, cx in rngs:
            pecas.append((a, (b - a) * L / M, cx))
    else:
        resto = L
        while resto > 0.05:
            a, b, cx = rngs[k % len(rngs)]
            d = min(b - a, resto); pecas.append((a, d, cx)); resto -= d; k += 1
    t = t0
    for a, d, cx in pecas:
        while d > 0.05:  # corta pecas longas em pedacos de ate 2,2 s
            p = d if d <= 2.2 else (d / 2 if d < 4.4 else 2.2)
            scenes.append({"src": SRC, "start": round(t, 3), "end": round(t + p, 3), "layout": "full", "cx": cx,
                           "ss": round(a, 2)})
            t += p; a += p; d -= p
    scenes[-1]["end"] = round(t1, 3)
# pedaco muito curto vira parte do anterior (sem piscada)
limpo = []
for sc in scenes:
    if limpo and sc["end"] - sc["start"] < 0.45:
        limpo[-1]["end"] = sc["end"]
    else:
        limpo.append(sc)
scenes = limpo
cfg = {"audio": "voz.mp3", "out": "radar_v27_furacao_clima.mp4", "font": "../../assets/fonts/Anton.ttf",
       "handle": "@radar.gta6br", "scenes": scenes, "captions": chunks(words, CENSOR)}
json.dump(cfg, open("config.json", "w"), ensure_ascii=False, indent=1)
for s in scenes:
    print(s["start"], s["end"], s["ss"])
