#!/usr/bin/env python3
"""Narracao do roteiro, linha a linha, com os tempos de cada linha para a legenda e as cenas.

Uso: python3 tts.py historia.json voz.wav tempos.json [--motor gemini|kokoro]

Gemini (padrao quando GEMINI_API_KEY existe): uma unica chamada com o roteiro inteiro (gasta 1 pedido
da cota gratis por video), depois o audio e cortado nos silencios entre paragrafos. Se o corte nao bater
com o numero de linhas, tenta de novo e, na falha, cai para o Kokoro.
GEMINI_TTS_MODEL forca um modelo; sem ele, o script lista os modelos da chave e usa o TTS mais novo.
GEMINI_TTS_VOICE (padrao Algenib, voz grave e rouca).

Kokoro (reserva, gratis e local): sherpa-onnx + kokoro-multi-lang-v1_0, voz em_alex (sid 29) em espanhol.
O modelo e baixado do GitHub releases para ~/.cache/hora-muerta na primeira vez (KOKORO_DIR muda o lugar).
"""
import argparse, base64, json, os, re, subprocess, sys, tarfile, time, urllib.error, urllib.request
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import carregar

SR = 24000
# O TTS do Gemini LE em voz alta qualquer instrucao em prosa (e systemInstruction da erro 400):
# o estilo vai so em tags no comeco do texto.
ESTILO = os.environ.get("GEMINI_TTS_ESTILO", "[whispering] [slow] [deep voice] ")
# Pedido do Pedro (2026-10-21): fala mais calma e pausada para dar suspense. A voz do Gemini e esticada
# sem mudar o tom (atempo) e as pausas do roteiro ficam mais longas.
TEMPO = float(os.environ.get("HM_VOZ_TEMPO", "0.9"))
PAUSA_FATOR = float(os.environ.get("HM_PAUSA_FATOR", "1.4"))
API = "https://generativelanguage.googleapis.com/v1beta"
KOKORO_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2"


def _get(url, key, body=None):
    req = urllib.request.Request(url, json.dumps(body).encode() if body else None,
                                 {"Content-Type": "application/json", "x-goog-api-key": key})
    return json.load(urllib.request.urlopen(req, timeout=240))


def modelos_tts(key):
    if os.environ.get("GEMINI_TTS_MODEL"):
        return [os.environ["GEMINI_TTS_MODEL"]]
    nomes = []
    url = f"{API}/models?pageSize=1000"
    for m in _get(url, key).get("models", []):
        n = m["name"].split("/")[-1]
        if "tts" in n and "generateContent" in m.get("supportedGenerationMethods", ["generateContent"]):
            nomes.append(n)
    versao = lambda n: [float(v) for v in re.findall(r"\d+(?:\.\d+)?", n)[:1]] or [0]
    # flash antes de pro (cota gratis), mais novo primeiro
    nomes.sort(key=lambda n: ("pro" in n, [-v for v in versao(n)]))
    return nomes or ["gemini-2.5-flash-preview-tts"]


def gemini(linhas, key):
    voz = os.environ.get("GEMINI_TTS_VOICE", "Algenib")
    texto = ESTILO + "\n\n".join(linhas)
    corpo = {"contents": [{"parts": [{"text": texto}]}],
             "generationConfig": {"responseModalities": ["AUDIO"],
                                  "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voz}}}}}
    erro = None
    for modelo in modelos_tts(key):
        for tent in range(3):
            try:
                r = _get(f"{API}/models/{modelo}:generateContent", key, corpo)
                part = r["candidates"][0]["content"]["parts"][0]["inlineData"]
                rate = int((re.search(r"rate=(\d+)", part.get("mimeType", "")) or [0, SR])[1])
                pcm = np.frombuffer(base64.b64decode(part["data"]), dtype="<i2").astype(np.float32) / 32768
                print("gemini:", modelo, voz, file=sys.stderr)
                return reamostrar(pcm, rate)
            except urllib.error.HTTPError as e:
                erro = f"{modelo} {e.code} {e.read().decode()[:300]}"
                if e.code in (429, 500, 503) and tent < 2:
                    time.sleep(25 * (tent + 1)); continue
                break
            except (KeyError, IndexError) as e:
                erro = f"{modelo} resposta sem audio: {e}"
                break
    raise RuntimeError(erro)


def esticar(a, tempo):
    if abs(tempo - 1) < 0.01:
        return a
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-af", f"atempo={tempo}", "-f", "f32le", "-"], input=a.astype("<f4").tobytes(),
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype="<f4").copy()


def reamostrar(a, rate):
    if rate == SR:
        return a
    n = int(len(a) * SR / rate)
    return np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)


def cortar(audio, linhas):
    """Corta o audio continuo em len(linhas) pedacos nos maiores silencios."""
    fr = int(SR * 0.02)
    rms = np.sqrt(np.convolve(audio ** 2, np.ones(fr) / fr, mode="same")[::fr] + 1e-12)
    silencio = rms < max(0.004, np.percentile(rms, 30) * 0.6)
    trechos, ini = [], None
    for i, s in enumerate(silencio):
        if s and ini is None:
            ini = i
        elif not s and ini is not None:
            trechos.append((ini, i)); ini = None
    voz = np.where(~silencio)[0]
    if len(voz) == 0:
        return None
    a, b = voz[0], voz[-1]
    trechos = [(i, j) for i, j in trechos if i > a and j < b and (j - i) * 0.02 >= 0.25]
    n = len(linhas) - 1
    if len(trechos) < n:
        return None
    # escolhe os n silencios mais perto de onde cada linha deveria acabar (proporcional ao texto);
    # so os maiores silencios falha quando uma linha tem pausa interna ("Y luego... sonrio.")
    chars = np.array([len(l) + 12 * l.count("...") for l in linhas], float)  # reticencias viram pausa longa
    alvo = a + (b - a) * np.cumsum(chars)[:-1] / chars.sum()
    centro = np.array([(i + j) / 2 for i, j in trechos]); dur = np.array([(j - i) * 0.02 for i, j in trechos])
    custo = np.abs(centro[None, :] - alvo[:, None]) / (b - a) - 0.01 * np.minimum(dur, 1.5)[None, :]
    m = len(trechos)
    melhor = np.full((n, m), np.inf); de = np.zeros((n, m), int)
    melhor[0] = custo[0]
    for k in range(1, n):
        acum = np.minimum.accumulate(melhor[k - 1])
        arg = np.array([int(np.argmin(melhor[k - 1][:j + 1])) for j in range(m)])
        melhor[k, 1:] = acum[:-1] + custo[k, 1:]; de[k, 1:] = arg[:-1]
    j = int(np.argmin(melhor[n - 1])); escolha = [j]
    for k in range(n - 1, 0, -1):
        j = de[k, j]; escolha.append(j)
    cortes = [trechos[j] for j in reversed(escolha)]
    bordas = [a] + [k for i, j in cortes for k in (i, j)] + [b + 1]
    # folga de 80 ms antes e 160 ms depois para nao comer o fim das palavras (silencio tem >= 250 ms)
    pedacos = [audio[max(0, bordas[2 * k] - 4) * fr: (bordas[2 * k + 1] + 8) * fr] for k in range(len(linhas))]
    # confere: duracao de cada pedaco proporcional ao tamanho do texto
    durs = np.array([len(p) / SR for p in pedacos])
    razao = (durs / durs.sum()) / (chars / chars.sum())
    if razao.min() < 0.35 or razao.max() > 2.8:
        print("corte suspeito:", np.round(razao, 2).tolist(), file=sys.stderr)
        return None
    return pedacos


def kokoro_dir():
    d = os.environ.get("KOKORO_DIR") or os.path.expanduser("~/.cache/hora-muerta/kokoro-multi-lang-v1_0")
    if not os.path.exists(os.path.join(d, "model.onnx")):
        base = os.path.dirname(d); os.makedirs(base, exist_ok=True)
        tar = os.path.join(base, "kokoro.tar.bz2")
        subprocess.run(["curl", "-sSL", "--retry", "5", "-C", "-", "-o", tar, KOKORO_URL], check=True)
        with tarfile.open(tar) as t:
            t.extractall(base, filter="data")
        os.unlink(tar)
    return d


def kokoro(linhas, vels):
    import sherpa_onnx
    d = kokoro_dir()
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=f"{d}/model.onnx", voices=f"{d}/voices.bin", tokens=f"{d}/tokens.txt", data_dir=f"{d}/espeak-ng-data",
            lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt", dict_dir=f"{d}/dict", lang="es"), num_threads=4))
    tts = sherpa_onnx.OfflineTts(cfg)
    sid = int(os.environ.get("KOKORO_SID", "29"))
    out = []
    for l, v in zip(linhas, vels):
        a = tts.generate(l, sid=sid, speed=v)
        out.append(reamostrar(np.array(a.samples, dtype=np.float32), a.sample_rate))
    print("kokoro: sid", sid, file=sys.stderr)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("historia"); ap.add_argument("wav"); ap.add_argument("tempos")
    ap.add_argument("--motor", choices=["gemini", "kokoro"])
    a = ap.parse_args()
    h = carregar(a.historia)
    linhas = [l["texto"] for l in h["lineas"]]
    pausas = [float(l.get("pausa", 0.6)) * PAUSA_FATOR for l in h["lineas"]]
    vels = [float(l.get("vel", 0.9)) for l in h["lineas"]]
    motor = a.motor or ("gemini" if os.environ.get("GEMINI_API_KEY") else "kokoro")
    pedacos = None
    if motor == "gemini":
        for tent in range(2):
            try:
                # guarda a narracao bruta: se o corte falhar, a proxima rodada nao gasta outra das 10 diarias
                bruto = os.path.splitext(a.wav)[0] + "_bruto.wav"
                if tent == 0 and os.path.exists(bruto):
                    audio = sf.read(bruto, dtype="float32")[0]
                else:
                    audio = gemini(linhas, os.environ["GEMINI_API_KEY"])
                    sf.write(bruto, audio, SR)
                pedacos = cortar(esticar(audio, TEMPO), linhas)
            except Exception as e:
                print("gemini falhou:", e, file=sys.stderr)
                break
            if pedacos:
                break
        if not pedacos:
            if os.environ.get("HM_SEM_KOKORO"):
                sys.exit("VOZ FALHOU: o Gemini nao narrou e a reserva Kokoro (sotaque americano) esta proibida para publicar")
            motor = "kokoro"
    if motor == "kokoro":
        if os.environ.get("HM_SEM_KOKORO"):
            sys.exit("VOZ FALHOU: sem GEMINI_API_KEY e a reserva Kokoro esta proibida para publicar")
        pedacos = kokoro(linhas, vels)

    lead = (h.get("gancho") or {}).get("dur", 0.25) + 0.15
    out, segs, t = [np.zeros(int(lead * SR), np.float32)], [], lead
    for txt, p, pz in zip(linhas, pedacos, pausas):
        d = len(p) / SR
        segs.append({"t0": round(t, 3), "t1": round(t + d, 3), "text": txt})
        out += [p, np.zeros(int(pz * SR), np.float32)]; t += d + pz
    t += 1.2
    out.append(np.zeros(int(1.2 * SR), np.float32))
    sf.write(a.wav, np.concatenate(out), SR)
    json.dump({"dur": round(t, 3), "motor": motor, "segs": segs}, open(a.tempos, "w"), ensure_ascii=False, indent=1)
    print(motor, round(t, 1), "s")


if __name__ == "__main__":
    main()
