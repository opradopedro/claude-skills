"""Trilha dos canais em ingles com SONS GRAVADOS (substitui o mix.py sintetico do motor para estes canais).

Uso: python motor-en/mix_en.py historia.json voz.wav tempos.json trilha.m4a

Camadas:
  1. voz (mesmo tratamento do motor: sem eco, so tira o ronco e segura os picos)
  2. musica: tema "calmo" = musica de alaude gravada, baixinha; terror = piano grave do motor (como antes)
  3. ambiente de cada cena (passaros na vila, fogo na casa, zumbido no elevador...), troca suave entre cenas
  4. efeitos pontuais gravados nos eventos (sino, batida na porta, choro...)
Musica e ambiente abaixam sozinhos enquanto a voz fala (a voz sempre fica na frente).
Sem chiado no fim: tudo some suave no ultimo 1 s.
"""
import json, os, subprocess, sys, tempfile
import numpy as np, soundfile as sf

AQUI = os.path.dirname(os.path.abspath(__file__))
MOTOR = os.path.join(os.path.dirname(AQUI), "skills", "canal-terror", "scripts")
sys.path.insert(0, MOTOR); sys.path.insert(0, AQUI)
from comum import carregar, resolver  # noqa: E402
import sons  # noqa: E402

SR = 44100


def rms_norm(a, alvo=0.1):
    r = float(np.sqrt((a ** 2).mean())) if len(a) else 0.0
    return a * (alvo / r) if r > 1e-6 else a


def em_loop(a, n, cruz=SR):
    """Repete o som ate n amostras, com emenda suave (sem clique na volta)."""
    if len(a) == 0:
        return np.zeros(n, np.float32)
    if len(a) >= n:
        return a[:n].copy()
    cruz = min(cruz, len(a) // 3)
    out = np.zeros(n + len(a), np.float32); pos = 0
    rampa = np.linspace(0, 1, cruz, dtype=np.float32)
    while pos < n:
        b = a.copy()
        if pos > 0:
            b[:cruz] *= rampa; out[pos:pos + cruz] *= 1 - rampa
        out[pos:pos + len(b)] += b
        pos += len(a) - cruz
    return out[:n]


def envelope_voz(v, n):
    """1 onde a voz fala, 0 no silencio, suavizado (para abaixar musica/ambiente sob a fala)."""
    q = int(SR * 0.05); m = min(len(v), n) // q
    e = np.zeros(n, np.float32)
    if m:
        r = np.sqrt((v[:m * q].reshape(m, q) ** 2).mean(axis=1))
        on = (r > 0.02).astype(np.float32)
        on = np.convolve(on, np.ones(8) / 8, "same")  # ~0,4 s de transicao
        e[:m * q] = np.repeat(np.clip(on * 1.5, 0, 1), q)
    return e


def main(historia, voz, tempos, saida):
    h = carregar(historia); tm = json.load(open(tempos)); r = resolver(h, tm)
    dur = tm["dur"]; n = int(dur * SR) + SR
    calmo = h.get("tema") == "calmo"
    tmp = tempfile.mkdtemp(); vt = os.path.join(tmp, "v.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", voz, "-af",
                    "aresample=44100,highpass=f=70,acompressor=threshold=0.1:ratio=2.5:attack=15:release=200,volume=1.5",
                    "-ac", "1", vt], check=True)
    v, _ = sf.read(vt, dtype="float32")
    mix = np.zeros(n, np.float32); mix[:min(len(v), n)] += v[:n]
    fala = envelope_voz(v, n)
    t = np.arange(n) / SR
    entrada = np.minimum(1, t / 1.5).astype(np.float32)

    # 2. musica
    if calmo:
        arq = sons.obter("musica_calma")
        if arq:
            m = em_loop(rms_norm(sons.ler(arq, SR), 0.1), n)
            mix += m * entrada * (0.30 - 0.18 * fala)  # 0,30 nas pausas, 0,12 sob a voz
    else:
        import mix as mix_motor  # piano de suspense do motor, que ja era aprovado
        sustos = [e["t"] for e in r["eventos"] if e["tipo"] in ("susto", "grito")]
        mix += mix_motor.trilha_piano(n, sustos, dur)[:n] * float(h.get("piano", 1.0))

    # 3. ambiente por cena, com troca suave de 0,6 s
    cenas = r["cenas"]
    for i, c in enumerate(cenas):
        nome = (c.get("p") or {}).get("ambiente") or sons.AMBIENTE.get(c["comp"])
        arq = sons.obter(nome) if nome else None
        if not arq:
            continue
        a0 = int(max(0, c["t0"] - 0.3) * SR)
        a1 = int(min(dur, cenas[i + 1]["t0"] + 0.3 if i + 1 < len(cenas) else dur) * SR)
        if a1 <= a0:
            continue
        seg = em_loop(rms_norm(sons.ler(arq, SR), 0.1), a1 - a0)
        f = min(int(0.6 * SR), (a1 - a0) // 2)
        if f > 0:
            seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        ganho = 0.55 if calmo else 0.45
        mix[a0:a1] += seg * (ganho - 0.3 * fala[a0:a1])

    # 4. efeitos pontuais
    cache = {}
    for e in r["eventos"]:
        nome = sons.EVENTO.get(e["tipo"])
        if e["tipo"] == "golpe":  # batida em porta de metal quando a cena e o elevador
            cena = next((c for c in reversed(cenas) if c["t0"] <= e["t"]), None)
            if cena and cena["comp"] == "elevator":
                nome = "golpe_metal"
        if not nome:
            continue
        if nome not in cache:
            arq = sons.obter(nome)
            cache[nome] = rms_norm(sons.ler(arq, SR), 0.12) if arq else None
        s = cache[nome]
        if s is None:
            continue
        lim = {"golpe": 0.9, "golpe_metal": 0.9, "susto": 2.5, "choro": 6, "sino": 8}.get(nome, 5)
        s = s[:int(lim * SR)].copy()
        f = min(int(0.3 * SR), len(s) // 3)
        if f > 0:
            s[-f:] *= np.linspace(1, 0, f)
        i0 = int(e["t"] * SR); j = min(n, i0 + len(s))
        if i0 < n:
            mix[i0:j] += s[:j - i0] * (0.9 if nome in ("golpe", "golpe_metal") else 0.6)

    mix = mix[:int(dur * SR)]
    wt = os.path.join(tmp, "m.wav"); sf.write(wt, mix, SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wt, "-af",
                    f"loudnorm=I=-15:TP=-1.5,afade=t=out:st={max(0, dur - 1):.2f}:d=1", "-ar", str(SR),
                    "-c:a", "aac", "-b:a", "160k", saida], check=True)
    print("ok", saida)


if __name__ == "__main__":
    main(*sys.argv[1:5])
