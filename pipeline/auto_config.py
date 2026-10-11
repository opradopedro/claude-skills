#!/usr/bin/env python3
"""Gera config.json para make_reel.py a partir da narracao.

Uso: python3 auto_config.py spec.json
spec: {"audio": "voz.mp3", "out": "x.mp4", "headline": "...", "source": "...",
       "images": [["hero.jpg", 0.48], ...], "badges": [[t0, t1, "1"], ...],
       "stamps": [[t0, t1, "NAO CONFIRMADO"]], "replace": {"VI": "6"}}
Legendas: blocos de ate 3 palavras (quebra em pontuacao); numeros/R$ em destaque.
Cenas: troca a cada ~2,6 s, alinhada ao inicio de um bloco de legenda.
"""
import json, os, re, subprocess, sys, wave
import numpy as np


def words_of(audio):
    wav = os.path.splitext(audio)[0] + "_16k.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", audio, "-ar", "16000", "-ac", "1", wav], check=True)
    from faster_whisper import WhisperModel
    w = wave.open(wav)
    a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    m = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(a, language="pt", word_timestamps=True)
    return [(x.word.strip(), x.start, x.end) for s in segs for x in s.words]


def main(path):
    spec = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    words = words_of(os.path.join(base, spec["audio"]))
    rep = spec.get("replace", {"VI": "6", "VI.": "6.", "VI,": "6,", "VI?": "6?"})
    words = [(rep.get(w, w), s, e) for w, s, e in words]
    # junta "R" "$" "449" etc.
    merged = []
    for w, s, e in words:
        if merged and (w in ("$",) or merged[-1][0] in ("R", "R$") or re.match(r"^,\d", w)):
            pw, ps, pe = merged.pop()
            merged.append(((pw + w) if w != "$" else pw + "$", ps, e))
        else:
            merged.append((w, s, e))
    chunks, cur = [], []
    for w, s, e in merged:
        cur.append((w, s, e))
        if len(cur) >= 3 or re.search(r"[.,!?:]$", w):
            chunks.append(cur); cur = []
    if cur:
        chunks.append(cur)
    caps = []
    for i, c in enumerate(chunks):
        txt = " ".join(w for w, _, _ in c).upper().strip(" ,.")
        txt = re.sub(r"[.,]$", "", txt)
        start = c[0][1]
        end = chunks[i + 1][0][1] if i + 1 < len(chunks) else c[-1][2] + 3
        hl = bool(re.search(r"\d|R\$|\?", txt)) or any(k.upper() in txt for k in spec.get("hl_words", []))
        caps.append({"start": round(start, 2), "end": round(end, 2), "text": txt, "hl": hl})
    caps[0]["start"] = 0.0
    # cenas
    imgs = spec["images"]
    scenes, t, k = [], 0.0, 0
    starts = [c["start"] for c in caps]
    total = caps[-1]["end"]
    while t < total:
        nxt = next((s for s in starts if s >= t + 2.4), total + 5)
        img, cx = imgs[k % len(imgs)]
        sc = {"img": img, "start": round(t, 2), "end": round(nxt, 2), "cx": cx}
        if k == 0:
            sc["shake"] = True
        for b0, b1, lab in spec.get("badges", []):
            if b0 <= t < b1:
                sc["badge"] = lab
        for s0, s1, lab in spec.get("stamps", []):
            if s0 <= t < s1:
                sc["stamp"] = lab
        scenes.append(sc)
        t, k = nxt, k + 1
    scenes[-1]["end"] = total + 10
    cfg = {k2: spec[k2] for k2 in ("audio", "out", "headline", "source")}
    cfg.update({"logo": spec.get("logo", "logo.png"), "handle": "@radar.gta6br",
                "font": spec.get("font", "fonts/Anton.ttf"), "scenes": scenes, "captions": caps})
    json.dump(cfg, open(os.path.join(base, "config.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for c in caps:
        print(c["start"], c["text"], "*" if c["hl"] else "")


if __name__ == "__main__":
    main(sys.argv[1])
