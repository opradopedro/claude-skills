"""Acerta palavras soltas da legenda e remonta o MP4 (sem refazer a voz).
Uso: python acertar_palavras.py <historia.json> <base sem extensao> palavra=segundos [palavra=segundos ...]
"""
import json, os, subprocess, sys

MOTOR = r"C:\claude-skills\skills\canal-terror\scripts"
historia, base = sys.argv[1], sys.argv[2]
tp = base + "_tempos.json"
d = json.load(open(tp, encoding="utf-8"))
for arg in sys.argv[3:]:
    palavra, seg = arg.rsplit("=", 1)
    seg = float(seg)
    melhor = None
    for s in d["segs"]:
        for i, w in enumerate(s["text"].split()):
            if w.lower().strip(".,!?") == palavra.lower() and s.get("w") and len(s["w"]) == len(s["text"].split()):
                dist = abs(s["w"][i] - seg)
                if melhor is None or dist < melhor[0]:
                    melhor = (dist, s, i)
    if not melhor:
        sys.exit(f"palavra nao achada: {palavra}")
    _, s, i = melhor
    print(f"{palavra}: {s['w'][i]} -> {seg}")
    s["w"][i] = seg
    for k in range(i + 1, len(s["w"])):  # as seguintes nao podem vir antes (so mexe se for preciso)
        if s["w"][k] <= s["w"][k - 1]:
            s["w"][k] = round(s["w"][k - 1] + 0.12, 3)
json.dump(d, open(tp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, os.path.join(MOTOR, "render.py"), historia, tp, base + "_video.mp4"], check=True)
dur = float(d["dur"])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a",
                "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
                "-af", f"afade=t=out:st={max(0.0, dur - 0.8):.2f}:d=0.8", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", "-shortest", base + ".mp4"], check=True)
os.remove(base + "_video.mp4")
sys.path.insert(0, MOTOR)
os.environ.setdefault("LEGENDA_MODELO", "small")
import legenda_whisper as L
voz = base + "_voz.wav"
print("LEGENDA:", json.dumps(L.conferir(base + ".mp4", tp, "en", voz=voz if os.path.exists(voz) else None)))
