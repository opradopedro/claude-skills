#!/usr/bin/env python3
"""Narracao pela API do Gemini (Google AI Studio), que tem cota gratis sem cartao.

Uso: python3 tts_gemini.py roteiro.txt voz.mp3
Chave: variavel de ambiente GEMINI_API_KEY ou, sem ela, o segredo de rede do ambiente da nuvem
(cabecalho x-goog-api-key injetado para generativelanguage.googleapis.com). Nunca gravar a chave no repositorio.
GEMINI_TTS_VOICE (padrao Orus, escolhida pelo Pedro) e GEMINI_TTS_MODEL (padrao gemini-2.5-flash-preview-tts) sao opcionais.
"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request

ESTILO = ("Leia em português do Brasil como um youtuber gamer brasileiro comentando notícia quente de GTA 6: "
          "animado, ritmo rápido, tom de conversa de podcast, sem pausas longas. Texto: ")


def main(src, out):
    key = os.environ.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
    voice = os.environ.get("GEMINI_TTS_VOICE", "Orus")
    text = open(src, encoding="utf-8").read().strip()
    body = {"contents": [{"parts": [{"text": ESTILO + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    hdr = {"Content-Type": "application/json"}
    if key:
        hdr["x-goog-api-key"] = key
    req = urllib.request.Request(url, json.dumps(body).encode(), hdr)
    for tent in range(4):
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=180))
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and tent < 3:
                time.sleep(20 * (tent + 1)); continue
            sys.exit(f"erro {e.code}: {e.read().decode()[:400]}")
    part = resp["candidates"][0]["content"]["parts"][0]["inlineData"]
    pcm = base64.b64decode(part["data"])
    rate = 24000
    for p in part.get("mimeType", "").split(";"):
        if p.strip().startswith("rate="):
            rate = int(p.split("=")[1])
    with tempfile.NamedTemporaryFile(suffix=".pcm", delete=False) as f:
        f.write(pcm)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", f.name,
                    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                           "silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                    "-b:a", "192k", out], check=True)
    os.unlink(f.name)
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
