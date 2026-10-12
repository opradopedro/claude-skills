#!/usr/bin/env python3
"""Config do make_short.py no ESTILO DEMO (demo_short/demo_estilo_corte.mp4, aprovado pelo Pedro em 12/10):
legenda amarela de 2 a 3 palavras no centro, cortes curtos (1,3 a 2,4 s) alternando foto em faixa ("band")
e foto em tela cheia ("full"), padrão band, band, full.

Uso: python3 estilo_demo.py spec.json   (gera config.json na pasta do spec; depois make_short.py config.json)
spec:
{
  "audio": "voz.mp3", "out": "video.mp4",
  "text": "roteiro exato narrado",              # alinhado com align2 (igual ao auto_short)
  "captions_from": "../refeitos/x/config2.json", # OU: reaproveita legendas com tempo de um config antigo
  "merge": {}, "censor": {}, "broll": ["../assets/jason.jpg", ...], "seed": 3
}
"""
import json, os, random, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from auto_short import CENSOR, chunks, duration  # noqa: E402

PADRAO = ["band", "band", "full"]


def rechunk(caps, censor):
    """Quebra legendas antigas (4+ palavras) em blocos de 2 a 3 palavras, dividindo o tempo por letras."""
    words = []
    for c in caps:
        ws = re.sub(r"\bGTA (6|VI)\b", r"GTA_\1", c["text"]).split()  # "GTA 6" nunca se separa
        tot = sum(len(w) for w in ws) or 1
        t = c["start"]
        for w in ws:
            d = (c["end"] - c["start"]) * len(w) / tot
            words.append((w, t, t + d))
            t += d
    return [dict(c, text=c["text"].replace("GTA_", "GTA ")) for c in chunks(words, censor)]


def main(path):
    spec = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    rnd = random.Random(spec.get("seed", 3))
    audio = os.path.join(base, spec["audio"])
    censor = dict(CENSOR, **spec.get("censor", {}))
    if spec.get("captions_from"):
        old = json.load(open(os.path.join(base, spec["captions_from"]), encoding="utf-8"))["captions"]
        caps = rechunk(old, censor)
    else:
        from align2 import align
        caps = chunks(align(audio, spec["text"], spec.get("merge", {})), censor)
    total = duration(audio) + 0.4
    srcs = spec["broll"]
    cuts = [0.0]
    for c in caps:
        if c["start"] - cuts[-1] >= 1.3:
            cuts.append(c["start"])
        while c["start"] - cuts[-1] > 2.4:
            cuts.append(cuts[-1] + 1.8)
    while total - cuts[-1] > 2.4:
        cuts.append(cuts[-1] + 1.8)
    scenes = []
    for i, t0 in enumerate(cuts):
        t1 = cuts[i + 1] if i + 1 < len(cuts) else total
        scenes.append({"src": srcs[i % len(srcs)], "start": round(t0, 3), "end": round(t1, 3),
                       "layout": PADRAO[i % 3], "cx": round(rnd.uniform(0.35, 0.65), 2)})
    cfg = {"audio": spec["audio"], "out": spec["out"], "font": spec.get("font", "../assets/fonts/Anton.ttf"),
           "handle": spec.get("handle", "@radar.gta6br"), "scenes": scenes, "captions": caps}
    json.dump(cfg, open(os.path.join(base, "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(caps), "legendas,", len(scenes), "cortes,", round(total, 1), "s")


if __name__ == "__main__":
    main(sys.argv[1])
