"""Confere se a narração é a voz fixa do Radar (Gemini Orus, escolhida pelo Pedro em 12/10).

Compara a voz com a impressão vocal média das narrações aprovadas (pipeline/voz_ref_orus.json, feita com
as voz.mp3 de 14/10 a 22/10). Mesma voz dá 0,91 a 0,97; abaixo de LIMITE a voz mudou e o vídeo não sobe.
Precisa de: pip install resemblyzer (com torch CPU).

Uso: python3 pipeline/conferir_voz.py voz.mp3 [outra.mp3 ...]   (sai com código 1 se alguma não passar)
"""
import json, os, sys

LIMITE = 0.90
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voz_ref_orus.json")
_enc = None


def nota(mp3):
    """Semelhança (0 a 1) da voz do arquivo com a voz de referência."""
    global _enc
    import numpy as np
    from resemblyzer import VoiceEncoder, preprocess_wav
    if _enc is None:
        _enc = VoiceEncoder(verbose=False)
    ref = np.array(json.load(open(REF))["emb"])
    return float(_enc.embed_utterance(preprocess_wav(mp3)) @ (ref / np.linalg.norm(ref)))


if __name__ == "__main__":
    ruim = False
    for f in sys.argv[1:]:
        n = nota(f)
        ok = n >= LIMITE
        ruim |= not ok
        print(f"{'OK' if ok else 'VOZ DIFERENTE'} {n:.3f} {f}")
    sys.exit(1 if ruim else 0)
