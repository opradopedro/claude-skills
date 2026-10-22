"""Reel os 8 personagens de GTA 6: cada fala mostra o personagem ou o mundo dele."""
import json, os, sys
sys.path.insert(0, "../../pipeline")
from align2 import align
from auto_short import chunks, CENSOR, duration
from enquadrar import cx_auto

SRC = "/home/claude/trailer/launch_crop.mp4"  # trailer oficial sem as faixas pretas (1920x960)
TEXT = open("roteiro.txt").read().strip()
# (primeira palavra do trecho, [(inicio, fim, cx), ...]) em segundos do trailer
L = "/home/claude/fabrica-de-paginas/radar-gta6/broll/clips/"
# (fonte, inicio, fim) ou (inicio, fim) do trailer de lançamento; o cx sai do enquadrar.py (rosto ou detalhe)
SEG = [("tem oito", [(59.3, 60.1), (L + "tJbzMqJGH4k_138.mp4", 0, 1.8), (63.25, 64.1), (L + "tJbzMqJGH4k_174.mp4", 0, 1.8)]),
       ("O Jason serviu", [(L + "tJbzMqJGH4k_099.mp4", 0, 1.8), (L + "tJbzMqJGH4k_362.mp4", 0, 1.8)]),
       ("A Lucia", [(50.8, 52.1), (L + "tJbzMqJGH4k_226.mp4", 0, 1.8)]),
       ("O Cal", [(L + "tJbzMqJGH4k_110.mp4", 0, 1.8), (L + "tJbzMqJGH4k_111.mp4", 0, 1.8)]),
       ("O Boobie", [(L + "tJbzMqJGH4k_326.mp4", 0, 1.8), (L + "tJbzMqJGH4k_330.mp4", 0, 1.8), (L + "tJbzMqJGH4k_321.mp4", 0, 1.8)]),
       ("O Dre'Quan", [(L + "tJbzMqJGH4k_350.mp4", 0, 1.8), (L + "tJbzMqJGH4k_319.mp4", 0, 1.8), (L + "tJbzMqJGH4k_317.mp4", 0, 1.8)]),
       ("O Raul", [(L + "tJbzMqJGH4k_232.mp4", 0, 1.8), (33.0, 34.4), (L + "tJbzMqJGH4k_354.mp4", 0, 1.8)]),
       ("E o Brian", [(4.0, 5.9), (L + "tJbzMqJGH4k_394.mp4", 0, 1.8)]),
       ("Você acha", [(L + "tJbzMqJGH4k_212.mp4", 0, 1.8), (L + "tJbzMqJGH4k_186.mp4", 0, 1.8), (72.0, 73.0)]),
       ("Manda", [(L + "tJbzMqJGH4k_170.mp4", 0, 1.8), (L + "tJbzMqJGH4k_220.mp4", 0, 1.8), (L + "tJbzMqJGH4k_216.mp4", 0, 1.8)])]
SEG = [(k, [r if isinstance(r[0], str) else (SRC,) + r for r in rs]) for k, rs in SEG]

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
    Lt, M = t1 - t0, sum(b - a for _, a, b in rngs)
    # cada cena do trecho entra na ordem; se sobra material, corta proporcional; se falta, repete do inicio
    pecas, k = [], 0
    if M >= Lt:
        for src, a, b in rngs:
            pecas.append((src, a, (b - a) * Lt / M))
    else:
        resto = Lt
        while resto > 0.05:
            src, a, b = rngs[k % len(rngs)]
            d = min(b - a, resto); pecas.append((src, a, d)); resto -= d; k += 1
    t = t0
    for src, a, d in pecas:
        while d > 0.05:  # corta pecas longas em pedacos de ate 2,2 s
            p = d if d <= 2.2 else (d / 2 if d < 4.4 else 2.2)
            scenes.append({"src": src, "start": round(t, 3), "end": round(t + p, 3), "layout": "full",
                           "cx": round(cx_auto(src, round(a, 2), round(p, 2)), 3), "ss": round(a, 2)})
            t += p; a += p; d -= p
    scenes[-1]["end"] = round(t1, 3)
FIXO = {}  # cx manual por clipe, quando o detector errar
for sc in scenes:
    sc["cx"] = FIXO.get(os.path.basename(sc["src"]), sc["cx"])
# pedaco muito curto vira parte do anterior (sem piscada)
limpo = []
for sc in scenes:
    if limpo and sc["end"] - sc["start"] < 0.45:
        limpo[-1]["end"] = sc["end"]
    else:
        limpo.append(sc)
scenes = limpo
cfg = {"audio": "voz.mp3", "out": "radar_v32_personagens.mp4", "font": "../../assets/fonts/Anton.ttf",
       "handle": "@radar.gta6br", "scenes": scenes, "captions": chunks(words, CENSOR)}
json.dump(cfg, open("config.json", "w"), ensure_ascii=False, indent=1)
for s in scenes:
    print(s["start"], s["end"], os.path.basename(s["src"]), s["ss"], s["cx"])
