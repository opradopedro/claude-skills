"""Corta um trecho da voz JA GRAVADA (ex.: uma palavra que ficou errada) e acerta legenda/tempos. Nao gasta narracao.
Uso: python motor-en/cortar_trecho.py <historia_copia.json> <base> <de_s> <ate_s> "<texto novo da linha>"
Depois remonta trilha + video. A linha afetada e a que contem o trecho.
"""
import json, os, subprocess, sys
import soundfile as sf

AQUI = os.path.dirname(os.path.abspath(__file__))
MOTOR = os.path.join(os.path.dirname(AQUI), "skills", "canal-terror", "scripts")
historia, base, de, ate, novo = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
corte = ate - de
voz = base + "_voz.wav"; tp = base + "_tempos.json"
a, sr = sf.read(voz, dtype="float32")
sf.write(voz, __import__("numpy").concatenate([a[:int(de * sr)], a[int(ate * sr):]]), sr)
d = json.load(open(tp, encoding="utf-8"))
for s in d["segs"]:
    if s["t0"] <= de < s["t1"] + 0.5:
        velhas = s["text"].split()
        manter = [i for i, w in enumerate(s.get("w", [])) if not (de <= w < ate)]
        s["w"] = [s["w"][i] if s["w"][i] < de else round(s["w"][i] - corte, 3) for i in manter]
        antigo = s["text"]; s["text"] = novo
        if len(s["w"]) != len(novo.split()):
            sys.exit(f"o texto novo tem {len(novo.split())} palavras e sobraram {len(s['w'])} tempos: {velhas}")
        h = json.load(open(historia, encoding="utf-8"))
        for l in h["lineas"]:
            if l["texto"] == antigo:
                l["texto"] = novo
        json.dump(h, open(historia, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for k in ("t0", "t1"):
        if s[k] >= ate:
            s[k] = round(s[k] - corte, 3)
    if s.get("w") and s["text"] != novo:  # a linha cortada ja foi acertada acima (nao desloca duas vezes)
        s["w"] = [w if w < ate else round(w - corte, 3) for w in s["w"]]
d["dur"] = round(d["dur"] - corte, 3)
json.dump(d, open(tp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, os.path.join(AQUI, "mix_en.py"), historia, voz, tp, base + "_trilha.m4a"], check=True)
subprocess.run([sys.executable, os.path.join(MOTOR, "render.py"), historia, tp, base + "_video.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a",
                "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
                "-af", f"afade=t=out:st={max(0.0, d['dur'] - 0.8):.2f}:d=0.8", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", "-shortest", base + ".mp4"], check=True)
os.remove(base + "_video.mp4")
sys.path.insert(0, MOTOR); os.environ.setdefault("LEGENDA_MODELO", "small")
import legenda_whisper as L
print("LEGENDA:", json.dumps(L.conferir(base + ".mp4", tp, "en", voz=voz)))
