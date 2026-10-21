"""Leitura do roteiro (stories/*.json) e conversao de eventos e cenas para segundos."""
import json


def carregar(path):
    h = json.load(open(path, encoding="utf-8"))
    h["lineas"] = [l if isinstance(l, dict) else {"texto": l} for l in h["lineas"]]
    return h


def _tempo(segs, ref):
    """ref = {"linea": i, "en": "inicio"|"fin"|fracao 0..1, "mas": segundos}"""
    s = segs[ref["linea"]]
    en = ref.get("en", "inicio")
    base = s["t0"] if en == "inicio" else s["t1"] if en == "fin" else s["t0"] + (s["t1"] - s["t0"]) * float(en)
    return round(base + float(ref.get("mas", 0)), 3)


def resolver(h, timing):
    """Devolve o dicionario que o engine.html recebe em setup()."""
    segs = timing["segs"]
    cenas = []
    for i, c in enumerate(h["cenas"]):
        t0 = 0 if i == 0 else _tempo(segs, {"en": "inicio", "mas": -0.25, **c})
        cenas.append({"t0": t0, "comp": c["comp"], "p": c.get("p", {})})
    eventos = [{"tipo": e["tipo"], "t": _tempo(segs, e), "dur": e.get("dur")} for e in h.get("eventos", [])]
    eventos.sort(key=lambda e: e["t"])
    gancho = None
    if h.get("gancho"):
        g = h["gancho"]
        ev = next((e for e in eventos if e["tipo"] == g["evento"]), None)
        if ev:
            gancho = {"cena": g["cena"], "t": ev["t"] + g.get("mas", 0.4), "dur": g.get("dur", 0.8)}
    return {"segs": segs, "cenas": cenas, "eventos": eventos, "destaque": h.get("destaque", []),
            "gancho": gancho, "dur": timing["dur"]}
