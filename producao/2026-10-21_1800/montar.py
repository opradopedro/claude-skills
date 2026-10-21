"""Reel rádios de GTA 6 (Bad Bunny, Slayer...): cenas de todos os trailers, enquadradas no rosto ou detalhe."""
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
SEG = [("vai ter", [(L + "QdBZY2fkU-0_015.mp4", 0, 1.8), (L + "tJbzMqJGH4k_323.mp4", 0, 1.8), (46.25, 47.0)]),
       ("A Rockstar", [(L + "QdBZY2fkU-0_001.mp4", 0, 1.8), (L + "tJbzMqJGH4k_124.mp4", 0, 1.8), (L + "tJbzMqJGH4k_194.mp4", 0, 1.8)]),
       ("Na Cocoteo", [(L + "tJbzMqJGH4k_322.mp4", 0, 1.8), (L + "tJbzMqJGH4k_316.mp4", 0, 1.8), (L + "tJbzMqJGH4k_320.mp4", 0, 1.8)]),
       ("Na Back", [(27.3, 28.7), (L + "tJbzMqJGH4k_112.mp4", 0, 1.8), (60.25, 60.95), (L + "QdBZY2fkU-0_013.mp4", 0, 1.8)]),
       ("Os caras", [(59.3, 60.1), (52.3, 53.4), (L + "tJbzMqJGH4k_281.mp4", 0, 1.8)]),
       ("a Flash", [(L + "QdBZY2fkU-0_010.mp4", 0, 1.8), (L + "tJbzMqJGH4k_155.mp4", 0, 1.8), (L + "tJbzMqJGH4k_287.mp4", 0, 1.8)]),
       ("e tem rap", [(L + "tJbzMqJGH4k_314.mp4", 0, 1.8), (L + "tJbzMqJGH4k_318.mp4", 0, 1.8)]),
       ("E pela", [(L + "tJbzMqJGH4k_056.mp4", 0, 1.8), (11.2, 13.2), (L + "tJbzMqJGH4k_267.mp4", 0, 1.8), (L + "tJbzMqJGH4k_282.mp4", 0, 1.8), (L + "tJbzMqJGH4k_125.mp4", 0, 1.8)]),
       ("Você vai", [(L + "tJbzMqJGH4k_128.mp4", 0, 1.8), (L + "tJbzMqJGH4k_131.mp4", 0, 1.8), (L + "tJbzMqJGH4k_197.mp4", 0, 1.8)]),
       ("Manda", [(L + "tJbzMqJGH4k_199.mp4", 0, 1.8), (L + "tJbzMqJGH4k_201.mp4", 0, 1.8), (L + "tJbzMqJGH4k_272.mp4", 0, 1.8)])]
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
FIXO = {"tJbzMqJGH4k_323.mp4": 0.62}  # cx manual por clipe, quando o detector errar
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
cfg = {"audio": "voz.mp3", "out": "radar_v29_radios_bad_bunny.mp4", "font": "../../assets/fonts/Anton.ttf",
       "handle": "@radar.gta6br", "scenes": scenes, "captions": chunks(words, CENSOR)}
json.dump(cfg, open("config.json", "w"), ensure_ascii=False, indent=1)
for s in scenes:
    print(s["start"], s["end"], os.path.basename(s["src"]), s["ss"], s["cx"])
