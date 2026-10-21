#!/usr/bin/env python3
"""Trilha do video: voz tratada (mais grave, com eco) + ambiente + efeitos sincronizados com os eventos.

Uso: python3 mix.py historia.json voz.wav tempos.json trilha.m4a
Tudo sintetizado aqui (sem bancos de som): drone grave, golpes, vibracao de celular, susto, assobio,
grito, zumbido de apagao. Volume final normalizado em -15 LUFS (padrao bom para Shorts).
"""
import json, os, subprocess, sys, tempfile
import numpy as np, soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import carregar, resolver

SR = 44100
rng = np.random.default_rng(7)


def env(n, ataque=0.005, queda=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / ataque)
    return e * (np.exp(-t / queda) if queda else 1)


def golpe():
    n = int(0.35 * SR); t = np.arange(n) / SR
    corpo = np.sin(2 * np.pi * (62 + 30 * np.exp(-t / 0.03)) * t) * env(n, 0.002, 0.07)
    estalo = rng.normal(0, 1, n) * env(n, 0.001, 0.012) * 0.35
    return (corpo + estalo) * 0.9


def vibra(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 150 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * t))
    return s * ((t % 0.8) < 0.45) * 0.35


def susto():
    n = int(1.1 * SR); t = np.arange(n) / SR
    ruido = np.cumsum(rng.normal(0, 1, n)); ruido = ruido - np.convolve(ruido, np.ones(200) / 200, "same"); ruido /= np.abs(ruido).max()
    boom = np.sin(2 * np.pi * (45 - 15 * t) * t) * env(n, 0.003, 0.4)
    agudo = sum(np.sin(2 * np.pi * f * t) for f in (1830, 1940, 2210)) / 3 * env(n, 0.01, 0.25) * 0.25
    return (ruido * env(n, 0.002, 0.3) * 0.6 + boom * 0.9 + agudo)


def silbido(dur):
    # assobio subindo nota a nota (o Silbon assobia do-re-mi-fa-sol-la-si)
    notas = [523, 587, 659, 698, 784, 880, 988]
    n = int(dur * SR); t = np.arange(n) / SR
    idx = np.minimum((t / dur * len(notas)).astype(int), len(notas) - 1)
    f = np.array(notas)[idx] * 2 * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.05) * np.minimum(1, (dur - t) / 0.2)
    return s * 0.12


def grito(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = (720 - 380 * t / dur) * (1 + 0.03 * np.sin(2 * np.pi * 6 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return (s * 0.18 + rng.normal(0, 0.03, n)) * env(n, 0.08) * np.minimum(1, (dur - t) / 0.4)


def apagon(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.06
    return s * (rng.random(int(dur * 16) + 1)[(t * 16).astype(int)] > 0.4)


def apaga():
    n = int(0.5 * SR)
    r = np.cumsum(rng.normal(0, 1, n)); r /= np.abs(r).max()
    return (r - r.mean()) * env(n, 0.05, 0.15) * 0.3


SONS = {"golpe": lambda e: golpe(), "vibra": lambda e: vibra(e.get("dur") or 1.6), "susto": lambda e: susto(),
        "silbido": lambda e: silbido(e.get("dur") or 2.8), "grito": lambda e: grito(e.get("dur") or 1.8),
        "apagon": lambda e: apagon(e.get("dur") or 1.5), "apaga": lambda e: apaga()}


def main(historia, voz, tempos, saida):
    h = carregar(historia); tm = json.load(open(tempos)); r = resolver(h, tm)
    dur = tm["dur"]; n = int(dur * SR)
    grave = float(h.get("voz_grave", 0.96 if tm.get("motor") == "kokoro" else 1.0))
    tmp = tempfile.mkdtemp()
    vt = os.path.join(tmp, "v.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", voz, "-af",
                    f"aresample={SR},asetrate={SR}*{grave},aresample={SR},atempo={1 / grave:.4f},"
                    "aecho=0.8:0.5:50|110:0.18|0.08,volume=1.5", "-ac", "1", vt], check=True)
    v, _ = sf.read(vt, dtype="float32")
    mix = np.zeros(n + SR, np.float32); mix[:min(len(v), len(mix))] += v[:len(mix)]
    t = np.arange(len(mix)) / SR
    marrom = np.cumsum(rng.normal(0, 1, len(mix))); marrom -= np.convolve(marrom, np.ones(4410) / 4410, "same")
    marrom /= np.abs(marrom).max() + 1e-9
    mix += (marrom * 0.10 * np.minimum(1, t / 1.0)).astype(np.float32)
    mix += (np.sin(2 * np.pi * 48 * t) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.2 * t)) * 0.05).astype(np.float32)
    eventos = list(r["eventos"])
    if r["gancho"]:
        eventos.append({"tipo": "susto", "t": 0.02})
    for e in eventos:
        if e["tipo"] in SONS:
            s = SONS[e["tipo"]](e).astype(np.float32); i = int(e["t"] * SR)
            j = min(len(mix), i + len(s)); mix[i:j] += s[:j - i]
    mix = mix[:n]
    wt = os.path.join(tmp, "m.wav"); sf.write(wt, mix, SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wt, "-af",
                    f"loudnorm=I=-15:TP=-1.5,afade=t=out:st={max(0, dur - 1):.2f}:d=1", "-ar", str(SR),
                    "-c:a", "aac", "-b:a", "160k", saida], check=True)
    print("ok", saida)


if __name__ == "__main__":
    main(*sys.argv[1:5])
