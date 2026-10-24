"""Confere a narração do Radar: voz (Gemini Orus, escolhida pelo Pedro em 12/10) e entonação.

Grátis e local: não grava nada de novo. Só avisa; a decisão de regravar é de quem roda (Pedro, 24/10: nada de
testar várias gravações por vídeo, a cota do Gemini é curta).
- Voz: semelhança com a impressão vocal média das narrações aprovadas de 14/10 a 22/10 (voz_ref_orus.json).
  Mesma voz dá 0,91 a 0,97; a do vidIQ dá 0,75.
- Entonação: as narrações boas têm tom médio (f0 mediano ~160 Hz), bem variado (~4,7 semitons) e ~3,2 palavras/s.
  O v37 (24/10), de que o Pedro reclamou, saiu grave, monótono e corrido: 142 Hz, 4,1 st, 3,5 palavras/s.
Precisa de: pip install resemblyzer (com torch CPU) e numpy.

Uso: python3 pipeline/conferir_voz.py voz.mp3 [roteiro.txt]   (sai com código 1 se algo ficou fora)
"""
import json, os, subprocess, sys

LIMITE = 0.90
F0_MIN, VAR_MIN, PPS_MAX = 145, 4.2, 3.45
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voz_ref_orus.json")


def _pcm(mp3):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(float) / 32768


def nota(mp3):
    """Semelhança (0 a 1) da voz do arquivo com a voz de referência."""
    import numpy as np
    from resemblyzer import VoiceEncoder, preprocess_wav
    ref = np.array(json.load(open(REF))["emb"])
    return float(VoiceEncoder(verbose=False).embed_utterance(preprocess_wav(mp3)) @ (ref / np.linalg.norm(ref)))


def entonacao(mp3):
    """(f0 mediano em Hz, variação em semitons, duração em s) por autocorrelação nos trechos com voz."""
    import numpy as np
    a, fr, f0 = _pcm(mp3), 640, []
    for i in range(0, len(a) - fr, 320):
        x = a[i:i + fr]
        if np.sqrt((x ** 2).mean()) < 0.03:
            continue
        x = x - x.mean()
        c = np.correlate(x, x, "full")[fr - 1:]
        k = 40 + int(np.argmax(c[40:266]))
        if c[k] > 0.4 * c[0]:
            f0.append(16000 / k)
    f0 = np.array(f0)
    return float(np.median(f0)), float(np.std(12 * np.log2(f0 / np.median(f0)))), len(a) / 16000


def conferir(mp3, texto=""):
    probs = []
    n = nota(mp3)
    if n < LIMITE:
        probs.append(f"voz {n:.3f} (não é a Orus)")
    f0, var, dur = entonacao(mp3)
    pps = len(texto.split()) / dur if texto else 0
    if f0 < F0_MIN:
        probs.append(f"tom grave ({f0:.0f} Hz)")
    if var < VAR_MIN:
        probs.append(f"monótona ({var:.1f} st)")
    if pps > PPS_MAX:
        probs.append(f"corrida ({pps:.2f} palavras/s)")
    print(f"{'ATENÇÃO VOZ: ' + '; '.join(probs) if probs else 'VOZ OK'} | voz {n:.3f}, {f0:.0f} Hz, {var:.1f} st, {pps:.2f} p/s | {mp3}")
    return not probs


if __name__ == "__main__":
    txt = open(sys.argv[2], encoding="utf-8").read() if len(sys.argv) > 2 else ""
    sys.exit(0 if conferir(sys.argv[1], txt) else 1)
