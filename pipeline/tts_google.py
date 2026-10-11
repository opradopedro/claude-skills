#!/usr/bin/env python3
"""Narracao com Google Cloud Text-to-Speech (alternativa gratis ao vidIQ).

Uso: python3 tts_google.py roteiro.txt voz.mp3
Le a chave da variavel de ambiente GOOGLE_TTS_API_KEY (nunca salvar a chave no repositorio).
Voz: GOOGLE_TTS_VOICE (padrao pt-BR-Chirp3-HD-Puck); se falhar, cai para pt-BR-Neural2-B.
"""
import base64, json, os, sys, urllib.request, urllib.error

URL = "https://texttospeech.googleapis.com/v1/text:synthesize?key="


def synth(text, voice, rate):
    body = {"input": {"text": text},
            "voice": {"languageCode": "pt-BR", "name": voice},
            "audioConfig": {"audioEncoding": "MP3", "speakingRate": rate}}
    req = urllib.request.Request(URL + os.environ["GOOGLE_TTS_API_KEY"], data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return base64.b64decode(json.load(r)["audioContent"])


def main(src, out):
    if not os.environ.get("GOOGLE_TTS_API_KEY"):
        sys.exit("GOOGLE_TTS_API_KEY ausente: use a narracao do vidIQ")
    text = open(src, encoding="utf-8").read().strip()
    rate = float(os.environ.get("GOOGLE_TTS_RATE", "1.12"))
    for voice in (os.environ.get("GOOGLE_TTS_VOICE", "pt-BR-Chirp3-HD-Puck"), "pt-BR-Neural2-B"):
        try:
            open(out, "wb").write(synth(text, voice, rate))
            print("ok", voice, out)
            return
        except urllib.error.HTTPError as e:
            print("falhou", voice, e.code, e.read()[:200], file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
