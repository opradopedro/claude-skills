#!/usr/bin/env python3
"""Gera o config.json do make_short.py (estilo corte de podcast) a partir do roteiro narrado.

Uso: python3 auto_short.py spec.json
spec:
{
  "audio": "voz.mp3", "out": "video.mp4", "text": "roteiro exato narrado",
  "merge": {"dezenove de novembro": "19/11"},      # falado -> escrito na tela
  "broll": ["../broll/clips/t2_0153.mp4", "../assets/jason.jpg", ...],   # ou
  "tags": ["jason", "carro", "praia"],             # escolhe do ../broll/index.json
  "headline": "opcional", "censor": {"PELADO": "P3L@D0"}, "seed": 7
}
Legenda: 2 a 3 palavras por bloco, em amarelo; numeros em destaque (roxo).
Cortes: a cada 1,3 a 2,2 s (so fotos: 2,4 a 3,6 s, com a foto deslizando de lado), sempre no inicio de um bloco de legenda.
"""
import json, os, random, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align2 import align  # noqa: E402

CENSOR = {"PELADO": "P3L@D0", "PELADA": "P3L@D@", "PELADOS": "P3L@D0S", "NUDEZ": "NUD3Z",
          "SEXO": "S3X0", "MORTE": "M0RT3", "MORTO": "M0RT0", "MATAR": "M@T@R", "DROGA": "DR0G@",
          "DROGAS": "DR0G@S", "ARMA": "@RM@", "ARMAS": "@RM@S", "TIRO": "T1R0", "ASSASSINATO": "@SS@SS1N@T0",
          "HACKER": "H@CKER", "VAZOU": "V@Z0U", "VAZAMENTO": "V@Z@MENTO", "PIRATA": "P1R@T@"}


def duration(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", p]).strip())


def chunks(words, censor):
    caps, cur = [], []
    for w, s, e in words:
        cur.append((w, s, e))
        end_punct = bool(re.search(r"[.!?,;:]$", w))
        if len(cur) == 3 or end_punct or (len(cur) == 2 and len(" ".join(x[0] for x in cur)) > 16):
            caps.append(cur); cur = []
    if cur:
        caps.append(cur)
    out = []
    for c in caps:
        txt = " ".join(re.sub(r"[.,;:!?]+$", "", x[0]) if not x[0].endswith("?") else x[0] for x in c).upper()
        txt = " ".join(censor.get(t.strip("?!"), t.strip("?!")) + ("?" if t.endswith("?") else "")
                       for t in txt.split())
        hl = any(re.search(r"\d", x[0]) for x in c)
        out.append({"start": round(c[0][1], 3), "end": round(c[-1][2], 3), "text": txt, "hl": hl})
    for a, b in zip(out, out[1:]):  # sem buraco entre blocos
        a["end"] = b["start"]
    return out


def pick_broll(spec, base, rnd):
    if spec.get("broll"):
        return [os.path.join(base, p) if not os.path.isabs(p) else p for p in spec["broll"]]
    idx_path = spec.get("index", "../broll/index.json")
    idx_path = idx_path if os.path.isabs(idx_path) else os.path.join(base, idx_path)
    idx = json.load(open(idx_path, encoding="utf-8"))
    root = os.path.dirname(idx_path)
    tag_path = os.path.join(os.path.dirname(idx_path), "tags.json")  # tags revisadas a mao, por arquivo
    if os.path.exists(tag_path):
        extra = json.load(open(tag_path, encoding="utf-8"))
        for c in idx:
            c.update(extra.get(c["file"], {}))
    idx = [c for c in idx if not c.get("excluir")]  # cartelas, logos e textos ficam de fora
    tags = set(spec.get("tags", []))
    good = [c for c in idx if tags & set(c.get("tags", []))]
    resto = [c for c in idx if c not in good]
    rnd.shuffle(resto)
    good = good + resto[:max(0, 12 - len(good))]  # completa com outros clipes se a tag tiver poucos
    rnd.shuffle(good)
    return [os.path.join(root, c["file"]) for c in good]


def baixar_faltando(arqs):
    """Banco de b-roll clonado so com index, tags e miniaturas (clone parcial + sparse-checkout):
    baixa do git so os clipes que este video vai usar."""
    falta = sorted({a for a in arqs if not os.path.exists(a)})
    if not falta:
        return
    pasta = os.path.dirname(falta[0])
    top = subprocess.check_output(["git", "-C", pasta, "rev-parse", "--show-toplevel"], text=True).strip()
    rel = ["/" + os.path.relpath(a, top) for a in falta]
    subprocess.run(["git", "-C", top, "sparse-checkout", "add", *rel], check=True)
    print("baixou", len(rel), "clipes do banco")


def main(path):
    spec = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    rnd = random.Random(spec.get("seed", 1))
    audio = os.path.join(base, spec["audio"])
    words = align(audio, spec["text"], spec.get("merge", {}))
    censor = dict(CENSOR, **spec.get("censor", {}))
    caps = chunks(words, censor)
    total = duration(audio) + 0.4
    srcs = pick_broll(spec, base, rnd)
    # cortes: 1,3 a 2,2 s com clipes; so com fotos, 2,4 a 3,6 s para dar tempo da foto deslizar
    so_fotos = all(p.lower().endswith((".jpg", ".jpeg", ".png", ".webp")) for p in srcs)
    mn, mx, passo = (2.4, 3.6, 3.0) if so_fotos else (1.3, 2.2, 1.6)
    cuts = [0.0]
    for c in caps:
        if c["start"] - cuts[-1] >= mn:
            cuts.append(c["start"])
        while c["start"] - cuts[-1] > mx:
            cuts.append(cuts[-1] + passo)
    while total - cuts[-1] > mx:
        cuts.append(cuts[-1] + passo)
    baixar_faltando([srcs[i % len(srcs)] for i in range(len(cuts))])
    scenes = []
    for i, t0 in enumerate(cuts):
        t1 = cuts[i + 1] if i + 1 < len(cuts) else total
        src = srcs[i % len(srcs)]
        sc = {"src": os.path.relpath(src, base), "start": round(t0, 3), "end": round(t1, 3),
              "layout": spec.get("layout") or "full", "cx": round(rnd.uniform(0.35, 0.65), 2),
              "pan": 1 if i % 2 == 0 else -1}
        if not src.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            d = duration(src)
            sc["ss"] = round(rnd.uniform(0, max(0.0, d - (t1 - t0) - 0.1)), 2)
        scenes.append(sc)
    cfg = {"audio": spec["audio"], "out": spec["out"], "font": spec.get("font", "../assets/fonts/Anton.ttf"),
           "handle": spec.get("handle", "@radar.gta6br"), "scenes": scenes, "captions": caps}
    if spec.get("headline"):
        cfg["headline"] = spec["headline"]
    if so_fotos:
        cfg["transicao"] = spec.get("transicao", "deslize")
    json.dump(cfg, open(os.path.join(base, "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(caps), "legendas,", len(scenes), "cortes,", round(total, 1), "s")


if __name__ == "__main__":
    main(sys.argv[1])
