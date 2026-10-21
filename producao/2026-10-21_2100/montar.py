"""Reel espaço no console (120 GB+): cenas de todos os trailers, enquadradas no rosto ou detalhe."""
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
SEG = [("pode ocupar", [(L + "tJbzMqJGH4k_255.mp4", 0, 1.8), (L + "tJbzMqJGH4k_293.mp4", 0, 1.8), (25.2, 26.0), (L + "tJbzMqJGH4k_292.mp4", 0, 1.8)]),
       ("A Rockstar", [(L + "tJbzMqJGH4k_109.mp4", 0, 1.8), (L + "tJbzMqJGH4k_107.mp4", 0, 1.8), (L + "tJbzMqJGH4k_190.mp4", 0, 1.8), (L + "tJbzMqJGH4k_110.mp4", 0, 1.8)]),
       ("Pra comparar", [(L + "tJbzMqJGH4k_295.mp4", 0, 1.8), (55.0, 55.9), (L + "tJbzMqJGH4k_389.mp4", 0, 1.8), (L + "tJbzMqJGH4k_294.mp4", 0, 1.8)]),
       ("E cuidado", [(L + "tJbzMqJGH4k_341.mp4", 0, 1.8), (L + "QdBZY2fkU-0_011.mp4", 0, 1.8), (L + "tJbzMqJGH4k_286.mp4", 0, 1.8), (L + "tJbzMqJGH4k_344.mp4", 0, 1.8)]),
       ("O pré-download", [(L + "tJbzMqJGH4k_094.mp4", 0, 1.8), (L + "tJbzMqJGH4k_285.mp4", 0, 1.8)]),
       ("E quem", [(L + "tJbzMqJGH4k_142.mp4", 0, 1.8), (6.0, 7.8), (L + "tJbzMqJGH4k_191.mp4", 0, 1.8)]),
       ("Seu console", [(L + "tJbzMqJGH4k_301.mp4", 0, 1.8), (L + "tJbzMqJGH4k_299.mp4", 0, 1.8), (L + "tJbzMqJGH4k_300.mp4", 0, 1.8)]),
       ("Manda", [(L + "tJbzMqJGH4k_307.mp4", 0, 1.8), (L + "tJbzMqJGH4k_303.mp4", 0, 1.8), (L + "tJbzMqJGH4k_288.mp4", 0, 1.8)])]
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
cfg = {"audio": "voz.mp3", "out": "radar_v30_espaco_console.mp4", "font": "../../assets/fonts/Anton.ttf",
       "handle": "@radar.gta6br", "scenes": scenes, "captions": chunks(words, CENSOR)}
json.dump(cfg, open("config.json", "w"), ensure_ascii=False, indent=1)
for s in scenes:
    print(s["start"], s["end"], os.path.basename(s["src"]), s["ss"], s["cx"])
