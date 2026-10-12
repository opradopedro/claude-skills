#!/usr/bin/env python3
"""Narração local e grátis com Piper (voz pt_BR "faber"), sem chave e sem cota. Reserva quando o Gemini falha.

Uso: python3 tts_piper.py roteiro.txt voz.mp3
Instala piper-tts se faltar e baixa o modelo (63 MB, Hugging Face) para /tmp/piper na primeira vez.
PIPER_SPEED (padrão 0.88; menor = mais rápido) é opcional.
"""
import os, subprocess, sys, tempfile, urllib.request

DIR = "/tmp/piper"
MODEL = "pt_BR-faber-medium.onnx"
URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/"


def main(src, out):
    try:
        import piper  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "piper-tts", "--break-system-packages"],
                       check=True)
    os.makedirs(DIR, exist_ok=True)
    for f in (MODEL, MODEL + ".json"):
        p = os.path.join(DIR, f)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            urllib.request.urlretrieve(URL + f, p)
    text = open(src, encoding="utf-8").read().strip()
    wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    subprocess.run([sys.executable, "-m", "piper", "-m", os.path.join(DIR, MODEL), "-f", wav,
                    "--length-scale", os.environ.get("PIPER_SPEED", "0.88"), "--sentence-silence", "0.12"],
                   input=text, text=True, check=True, capture_output=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-14",
                    "-ar", "44100", "-b:a", "192k", out], check=True)
    os.unlink(wav)
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
