#!/usr/bin/env python3
"""Trilha do canal de engenharia: voz + efeitos nas trocas de etapa (sem musica de fundo: o Pedro nao gostou, 23/10).
YB_MUSICA=1 volta a base de marimba e baixo (112 bpm).

Uso: python3 mix.py historia.json voz.wav tempos.json trilha.m4a
Efeitos: "whoosh" em cada cena nova, buzina curta em "erro", "piririm" curto em "certo" e longo em "tada".
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


def sino(f, dur=1.1):
    """Sininho brilhante: parciais de sino (inarmonicos) com ataque rapido e cauda longa."""
    t = np.arange(int(dur * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * q) for h, a, q in ((1, 1.0, 4), (2.76, 0.35, 7), (5.4, 0.15, 12), (8.9, 0.06, 18)))
    return s * np.minimum(1, t / 0.004)


def piririm(notas, passo=0.055, dur=1.1):
    """Arpejo subindo rapido ("piririm"), o som de conquista que o Pedro pediu (23/10)."""
    n = int((passo * len(notas) + dur) * SR); out = np.zeros(n)
    for i, f in enumerate(notas):
        j = int(i * passo * SR); s = sino(f, dur) * (0.7 + 0.3 * i / len(notas)); out[j:j + len(s)] += s
    return out / np.abs(out).max()


def certo():  # problema resolvido: piririm curto
    return 0.42 * piririm([1046, 1318, 1568, 2093])


def tada():  # "Congratulations!": piririm longo, subindo duas oitavas, com brilho por cima
    p = piririm([784, 988, 1175, 1568, 1976, 2349, 3136], passo=0.05, dur=1.6)
    t = np.arange(len(p)) / SR
    brilho = sum(np.sin(2 * np.pi * f * t) for f in (4186, 4699, 5274)) * np.exp(-((t - 0.45) / 0.25) ** 2) * 0.12
    return 0.5 * (p + brilho * np.sin(2 * np.pi * 9 * t) ** 2)


def limpar_voz(v, sr=SR):
    """Tira o estalo do fim (pedido do Pedro, 23/10: "audio estourado no final" do YB002).
    O Gemini solta o "t" de "next?" sozinho, 0,3 s depois da palavra: um chiado de 0,13 s tao alto quanto a voz.
    Toda ilha de som curta (< 0,25 s), aguda (centroide > 3,5 kHz) e cercada de silencio cai 18 dB."""
    fr = int(0.02 * sr); n = len(v) // fr
    rms = np.sqrt((v[:n * fr].reshape(n, fr) ** 2).mean(1))
    on = rms > max(0.01, np.percentile(rms, 95) * 0.05)
    ilhas, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            ilhas.append((i, j)); i = j
        else:
            i += 1
    g = np.ones(len(v))
    for k, (a, b) in enumerate(ilhas):
        antes = (a - ilhas[k - 1][1]) * 0.02 if k else 9
        depois = (ilhas[k + 1][0] - b) * 0.02 if k + 1 < len(ilhas) else 9
        seg = v[a * fr:b * fr]
        S = np.abs(np.fft.rfft(seg)) + 1e-9; f = np.fft.rfftfreq(len(seg), 1 / sr)
        if (b - a) * 0.02 < 0.25 and antes >= 0.15 and depois >= 0.15 and (S * f).sum() / S.sum() > 3500:
            x0, x1 = max(0, a * fr - fr), min(len(v), b * fr + fr)
            env = np.full(x1 - x0, 0.125); r = min(fr, (x1 - x0) // 2)
            env[:r] = np.linspace(1, 0.125, r); env[-r:] = np.linspace(0.125, 1, r)
            g[x0:x1] = np.minimum(g[x0:x1], env)
    return v * g


def deesser(v, sr=SR, corte=5000, teto=0.35):
    """Segura os sibilantes: a faixa acima de 5 kHz nunca passa de 35% do pico da voz (janela de 10 ms)."""
    V = np.fft.rfft(v); f = np.fft.rfftfreq(len(v), 1 / sr)
    alto = np.fft.irfft(V * (f >= corte), len(v)); baixo = v - alto
    w = int(0.01 * sr)
    env = np.sqrt(np.convolve(alto ** 2, np.ones(w) / w, "same")) * 1.414
    lim = teto * np.abs(v).max()
    return baixo + alto * np.minimum(1, lim / np.maximum(env, 1e-9))


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
    v = deesser(limpar_voz(v))
    mix[:len(v)] += v / max(1e-6, np.abs(v).max()) * 0.9
    t = np.arange(n) / SR
    if os.environ.get("YB_MUSICA") == "1":
        mix += base(dur) * 0.16 * np.clip(t / 1.0, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)

    def por(som, em, g=1.0):
        i = int(max(0, em) * SR); mix[i:i + len(som)] += (som * g)[:n - i]
    for c in r["cenas"][1:]:
        por(whoosh(), c["t0"] - 0.1, 0.5)
    fx = {"erro": erro, "certo": certo, "tada": tada}
    for e in r["eventos"]:
        if e["tipo"] in fx:
            por(fx[e["tipo"]](), e["t"])
    fim = r["segs"][-1]["t1"] + 0.25  # silencio limpo depois da ultima palavra (o tada pode soar ate o fim)
    if not any(e["t"] > fim - 1.5 for e in r["eventos"]):
        mix *= np.clip((fim + 0.15 - t) / 0.15, 0, 1)
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    wav = os.path.splitext(saida)[0] + "_tmp.wav"
    sf.write(wav, mix.astype(np.float32), SR)
    # loudnorm em 2 passadas (linear): no modo dinamico ele subia o ganho nos silencios e realcava chiado no fim
    med = subprocess.run(["ffmpeg", "-hide_banner", "-i", wav, "-af", "loudnorm=I=-14:TP=-1.5:print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = json.loads(med[med.rindex("{"):med.rindex("}") + 1])
    af = ("loudnorm=I=-14:TP=-1.5:LRA=20:linear=true:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
          "measured_thresh={input_thresh}:offset={target_offset},alimiter=limit=0.84:attack=2:release=50:level=disabled").format(**m)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", af, "-ar", str(SR), "-c:a", "aac", "-b:a", "160k", saida], check=True)
    os.remove(wav)
    print("ok", saida)


def conferir_audio(arquivo):
    """Problemas que o ouvido do publico pega: corte digital e estalo isolado (o "audio estourado no final")."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", arquivo, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    prob = []
    if (np.abs(x) > 0.995).sum() > 10:
        prob.append("audio clipado (%d amostras no teto)" % int((np.abs(x) > 0.995).sum()))
    fr = int(0.02 * SR); n = len(x) // fr
    rms = np.sqrt((x[:n * fr].reshape(n, fr) ** 2).mean(1)); on = rms > 0.01
    ult = np.where(on)[0]
    if len(ult):
        j = ult[-1] + 1; i = j
        while i > 0 and on[i - 1]:
            i -= 1
        antes = i - (np.where(on[:i])[0][-1] + 1 if on[:i].any() else 0)
        if (j - i) * 0.02 < 0.25 and antes * 0.02 >= 0.2 and np.abs(x[i * fr:j * fr]).max() > 0.3:
            prob.append(f"estalo isolado no fim ({i * 0.02:.2f}s)")
    return prob


if __name__ == "__main__":
    main(*sys.argv[1:5])
