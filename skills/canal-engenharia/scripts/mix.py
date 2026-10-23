#!/usr/bin/env python3
"""Trilha do canal de engenharia: voz + base leve (marimba e baixo, 112 bpm) + efeitos nas trocas de etapa.

Uso: python3 mix.py historia.json voz.wav tempos.json trilha.m4a
Efeitos: "whoosh" em cada cena nova, buzina curta em "erro", sino em "certo", acorde em "tada".
Tudo sintetizado aqui (custo zero, sem licenca de musica).
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import carregar, resolver

SR = 44100
rng = np.random.default_rng(7)


def tom(f, dur, queda=6.0, harm=((1, 1.0),)):
    t = np.arange(int(dur * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * h * t) for h, a in harm) * np.exp(-t * queda)


def marimba(f, dur=0.35):
    return tom(f, dur, 9, ((1, 1.0), (4, 0.25), (10, 0.05)))


def whoosh(dur=0.35):
    n = int(dur * SR); x = rng.standard_normal(n)
    for _ in range(2): x = np.convolve(x, np.ones(12) / 12, "same")
    return x * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.5


def erro():
    t = np.arange(int(0.32 * SR)) / SR
    return 0.22 * np.sign(np.sin(2 * np.pi * 140 * t)) * np.exp(-t * 4) * (t < 0.3)


def certo():
    return 0.35 * (np.pad(marimba(1318, 0.5), (0, int(0.1 * SR))) + np.pad(marimba(1760, 0.5), (int(0.1 * SR), 0)))


def tada():
    return 0.3 * sum(np.pad(marimba(f, 1.2), (int(i * 0.07 * SR), int((3 - i) * 0.07 * SR))) for i, f in enumerate([523, 659, 784, 1046]))


def base(dur):
    """Loop de 4 compassos: baixo em semínimas e marimba sincopada, volume baixo atras da voz."""
    n = int(dur * SR); out = np.zeros(n + SR)
    bt = 60 / 112
    acordes = [(220, [440, 554, 659]), (174.6, [349, 440, 523]), (130.8, [392, 523, 659]), (196, [392, 494, 587])]
    b = 0
    while b * bt < dur:
        raiz, notas = acordes[(b // 4) % 4]
        i = int(b * bt * SR)
        s = tom(raiz / 2, bt * 0.9, 5, ((1, 1.0), (2, 0.3))) * 0.5; out[i:i + len(s)] += s
        for k, off in enumerate((0, 0.5, 0.75)):
            j = int((b + off) * bt * SR); m = marimba(notas[(b + k) % 3]) * 0.25
            out[j:j + len(m)] += m[:len(out) - j]
        b += 1
    return out[:n]


def main(historia, voz, tempos, saida):
    r = resolver(carregar(historia), json.load(open(tempos)))
    dur = r["dur"]; n = int(dur * SR)
    v, vsr = sf.read(voz, dtype="float32")
    v = np.interp(np.arange(int(len(v) * SR / vsr)) * vsr / SR, np.arange(len(v)), v)[:n]
    mix = np.zeros(n)
    mix[:len(v)] += v / max(1e-6, np.abs(v).max()) * 0.9
    t = np.arange(n) / SR
    mix += base(dur) * 0.16 * np.clip(t / 1.0, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)

    def por(som, em, g=1.0):
        i = int(max(0, em) * SR); mix[i:i + len(som)] += (som * g)[:n - i]
    for c in r["cenas"][1:]:
        por(whoosh(), c["t0"] - 0.1, 0.5)
    fx = {"erro": erro, "certo": certo, "tada": tada}
    for e in r["eventos"]:
        if e["tipo"] in fx:
            por(fx[e["tipo"]](), e["t"])
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    wav = os.path.splitext(saida)[0] + "_tmp.wav"
    sf.write(wav, mix.astype(np.float32), SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", "loudnorm=I=-14:TP=-1.5", "-c:a", "aac", "-b:a", "160k", saida], check=True)
    os.remove(wav)
    print("ok", saida)


if __name__ == "__main__":
    main(*sys.argv[1:5])
