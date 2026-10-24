#!/usr/bin/env python3
"""Narracao pela API do Gemini (Google AI Studio), que tem cota gratis sem cartao.

Uso: python3 tts_gemini.py roteiro.txt voz.mp3
Chave: variavel de ambiente GEMINI_API_KEY ou, sem ela, o segredo de rede do ambiente da nuvem
(cabecalho x-goog-api-key injetado para generativelanguage.googleapis.com). Nunca gravar a chave no repositorio.
VOZ FIXA: Orus (escolhida pelo Pedro em 12/10). Outra voz so com RADAR_VOZ_LIVRE=1 (nunca na rotina).
ENTONACAO FIXA (Pedro, 24/10): UMA gravacao por video, sem testar varias (a cota do Gemini e curta).
O estilo abaixo e a semente fixa seguram o jeito das narracoes boas de 14/10 a 22/10 (tom medio-agudo,
bem variado, ~3,2 palavras/s). O v37 saiu grave, rapido e monotono (f0 142 Hz, 3,5 palavras/s): e isso que evitar.
Depois de gravar, conferir_voz.py mede voz e entonacao de graca (local) e so avisa. GEMINI_TTS_MODEL e opcional.
"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ESTILO = ("Leia em português do Brasil como um youtuber gamer brasileiro empolgado comentando notícia quente de GTA 6: "
          "voz animada e para cima, tom médio, nada grave; entonação bem variada, subindo nas novidades e nas perguntas; "
          "ritmo de conversa, nem corrido nem arrastado, com pausa curta em cada vírgula e ponto; nunca monótono. Texto: ")
SEMENTE = 1012  # fixa: mesma configuracao de sorteio em todo video


VOZ = "Orus"


def main(src, out):
    voice = os.environ.get("GEMINI_TTS_VOICE", VOZ)
    if voice != VOZ and os.environ.get("RADAR_VOZ_LIVRE") != "1":
        sys.exit(f"voz {voice} recusada: a voz do Radar e {VOZ} (Pedro, 12/10 e 24/10)")
    gravar(src, out, voice)
    try:
        from conferir_voz import conferir
        conferir(out, open(src, encoding="utf-8").read())
    except ImportError:
        print("aviso: resemblyzer ausente, voz sem conferencia (pip install resemblyzer)", file=sys.stderr)
    print("ok", out)


def gravar(src, out, voice):
    key = os.environ.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
    text = open(src, encoding="utf-8").read().strip()
    body = {"contents": [{"parts": [{"text": ESTILO + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"], "seed": SEMENTE,
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
            msg = e.read().decode()
            if e.code == 400 and "seed" in msg and "seed" in body["generationConfig"]:
                body["generationConfig"].pop("seed")  # modelo sem semente: segue so com o estilo fixo
                req = urllib.request.Request(url, json.dumps(body).encode(), hdr); continue
            if e.code in (429, 500, 503) and tent < 3:
                time.sleep(20 * (tent + 1)); continue
            sys.exit(f"erro {e.code}: {msg[:400]}")
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


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
