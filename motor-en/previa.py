"""Previa GRATIS das cenas de um roteiro: estima os tempos pelo tamanho do texto (sem chamar o Gemini)
e salva um JPG no meio de cada cena + a capa. Use antes de gastar narracao.
Uso: python motor-en/previa.py <historia.json> <pasta_saida>
"""
import json, os, subprocess, sys

MOTOR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills", "canal-terror", "scripts")
sys.path.insert(0, MOTOR)
from comum import carregar  # noqa: E402

historia, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
h = carregar(historia)
# a previa nao sabe a data real: troca os marcadores por um exemplo (numa copia, nunca no original)
_txt = open(historia, encoding="utf-8").read()
for _k, _v in {"{when_next}": "tomorrow, Friday", "{next_card}": "TOMORROW", "{next_day}": "Friday"}.items():
    _txt = _txt.replace(_k, _v)
historia = os.path.join(saida, os.path.basename(historia))
open(historia, "w", encoding="utf-8").write(_txt)
h = carregar(historia)
t, segs = 0.6, []
for l in h["lineas"]:
    txt = l["texto"].replace("{when_next}", "tomorrow, Friday")
    ws = txt.split(); d = 0.36 * len(ws) + 0.3
    segs.append({"t0": round(t, 3), "t1": round(t + d, 3), "text": txt,
                 "w": [round(t + d * i / len(ws), 3) for i in range(len(ws))]})
    t += d + float(l.get("pausa", 0.6)) * 1.4
dur = round(t + 1.2, 3)
base = os.path.join(saida, h["codigo"] + "_previa")
tp = base + "_tempos.json"
json.dump({"dur": dur, "motor": "estimativa", "segs": segs}, open(tp, "w"), ensure_ascii=False, indent=1)
pontos = []
for i, c in enumerate(h["cenas"]):
    a = segs[c["linea"]]["t0"]
    b = segs[h["cenas"][i + 1]["linea"]]["t0"] if i + 1 < len(h["cenas"]) else dur
    pontos.append(round((a + b) / 2, 1))
subprocess.run([sys.executable, os.path.join(MOTOR, "render.py"), historia, tp, base + ".mp4", "--teste", ",".join(map(str, pontos))], check=True)
subprocess.run([sys.executable, os.path.join(MOTOR, "capa.py"), historia, tp, base + "_capa.jpg"], check=True)
print("previa:", saida)
