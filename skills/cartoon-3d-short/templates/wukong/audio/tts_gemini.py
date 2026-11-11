import base64, json, os, sys, urllib.request, wave
API = "https://generativelanguage.googleapis.com/v1beta"
key = os.environ["GEMINI_API_KEY"]
txt = "[warm] [vivid] [storyteller] " + open(sys.argv[1]).read().strip()
body = {"contents": [{"parts": [{"text": txt}]}], "generationConfig": {"responseModalities": ["AUDIO"],
        "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Algieba"}}}}}
for model in sys.argv[3:]:
    try:
        req = urllib.request.Request(f"{API}/models/{model}:generateContent", data=json.dumps(body).encode(),
              headers={"Content-Type": "application/json", "x-goog-api-key": key})
        r = json.load(urllib.request.urlopen(req, timeout=300))
        pcm = base64.b64decode(r["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
        with wave.open(sys.argv[2], "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        print("ok", model, len(pcm) / 48000, "s"); break
    except urllib.error.HTTPError as e:
        print(model, e.code, e.read().decode()[:200])
