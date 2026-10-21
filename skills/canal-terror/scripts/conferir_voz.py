#!/usr/bin/env python3
"""Confere se o corte da narracao bate com o roteiro: corta, transcreve cada pedaco com o Gemini e compara.

Uso: python3 conferir_voz.py historia.json voz_bruto.wav
Gasta 2 pedidos do modelo de texto do Gemini (cota separada da do TTS). Linha com nota < 0,6 = corte errado.
"""
import difflib, json, os, re, sys
import numpy as np, soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts
from comum import carregar


def norm(s):
    return re.sub(r"[^\w ]", "", s.lower()).split()


def main(historia, bruto):
    key = os.environ["GEMINI_API_KEY"]
    linhas = [l["texto"] for l in carregar(historia)["lineas"]]
    audio = tts.esticar(sf.read(bruto, dtype="float32")[0], tts.TEMPO)
    guia = tts.marcas(audio, linhas, key)
    pedacos = tts.cortar(audio, linhas, guia)
    if not pedacos:
        sys.exit("corte falhou")
    gap = np.zeros(int(1.0 * tts.SR), np.float32)
    juntos = np.concatenate([x for p in pedacos for x in (p, gap)])
    corpo = {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": tts.wav_b64(juntos)}},
        {"text": f"El audio tiene {len(pedacos)} fragmentos separados por un segundo de silencio. "
                 "Transcribe cada fragmento palabra por palabra. Responde solo con una lista JSON de textos."}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
    r = tts._get(f"{tts.API}/models/{tts.modelo_texto(key)}:generateContent", key, corpo)
    ouvido = json.loads(r["candidates"][0]["content"]["parts"][0]["text"])
    ruim = 0
    for k, l in enumerate(linhas):
        o = ouvido[k] if k < len(ouvido) else ""
        nota = difflib.SequenceMatcher(None, norm(l), norm(o)).ratio()
        ruim += nota < 0.6
        print(f"{k + 1}. {len(pedacos[k]) / tts.SR:5.2f}s nota {nota:.2f}\n   roteiro: {l}\n   ouvido:  {o}")
    print("OK" if not ruim else f"{ruim} LINHAS ERRADAS")


if __name__ == "__main__":
    main(*sys.argv[1:3])
