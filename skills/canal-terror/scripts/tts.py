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
import argparse, base64, difflib, json, os, re, subprocess, sys, tarfile, time, unicodedata, urllib.error, urllib.request
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


def tags_faladas(audio, linhas):
    """O Gemini (3.8 flash tts, 24/10) as vezes le as tags de estilo em voz alta ("Whispering, slow, deep voice...")
    antes do roteiro: a voz sai com palavras a mais e o corte das linhas desanda. O Whisper ouve os primeiros 8 s;
    se o comeco nao for o roteiro, devolve o segundo onde cortar (no meio do silencio entre a ultima tag e a
    1a palavra do roteiro). None se limpo. Porte do canal-engenharia (PR #31/#32)."""
    tags = {legenda_norm(w) for t in re.findall(r"\[([^\]]+)\]", ESTILO) for w in t.split()}
    roteiro = [legenda_norm(w) for w in linhas[0].split() if legenda_norm(w)]
    try:
        import legenda_whisper
        trecho = audio[: int(SR * 8)]  # o Whisper quer 16 kHz
        n16 = int(len(trecho) * legenda_whisper.SR / SR)
        trecho = np.interp(np.linspace(0, len(trecho) - 1, n16), np.arange(len(trecho)), trecho).astype(np.float32)
        ouvidas = legenda_whisper.ouvir(trecho, os.environ.get("LEGENDA_IDIOMA", "es"))
    except Exception as e:
        print("tags: whisper indisponivel (%s)" % e, file=sys.stderr)
        return None
    ouv = [(legenda_norm(w), a, b) for w, a, b in ouvidas]
    # 1a palavra ouvida que comeca o roteiro (duas seguidas batendo, ou a 1a parecida): tudo antes dela e tag.
    # Em espanhol o Whisper escreve as tags em ingles de qualquer jeito ("Güisperin"), entao nao basta casar o texto.
    parece = lambda x, y: x == y or (len(x) > 2 and difflib.SequenceMatcher(None, x, y).ratio() >= 0.75)
    ini = None
    for j, (n, a, b) in enumerate(ouv[:10]):
        if roteiro and parece(n, roteiro[0]) and (len(roteiro) < 2 or j + 1 >= len(ouv) or parece(ouv[j + 1][0], roteiro[1])):
            ini = j
            break
        if roteiro and j + 1 < len(ouv) and parece(n + ouv[j + 1][0], roteiro[0]):  # "Anoche" ouvido como "A noche"
            ini = j
            break
        if n in tags or not n:
            continue
        if j == 0 and n in roteiro[:3]:
            return None
    if ini is None:  # nao achou o comeco do roteiro: so corta se o que ouviu for tag mesmo (como no engenharia)
        fim = None
        for n, a, b in ouv[:6]:
            if n in tags and n not in roteiro:
                fim = b
            elif n:
                break
        if fim is None:
            return None
        prox = next((a for n, a, b in ouv if a >= fim and n not in tags), fim + 0.3)
    elif ini == 0:
        return None
    else:
        fim, prox = ouv[ini - 1][2], ouv[ini][1]
    if fim - ouv[0][1] < 0.8:  # "whispering slow deep voice" dura mais de 1 s; menos que isso e respiro ou erro do Whisper
        return None
    corte = (fim + prox) / 2
    print("tags faladas pelo Gemini (%s): corto ate %.2f s" % (" ".join(w for w, a, b in ouvidas if b <= fim), corte), file=sys.stderr)
    return corte


def legenda_norm(w):
    w = unicodedata.normalize("NFKD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if not unicodedata.combining(c)))


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


def wav_b64(audio):
    import io
    buf = io.BytesIO(); sf.write(buf, audio, SR, format="WAV", subtype="PCM_16")
    return base64.b64encode(buf.getvalue()).decode()


def modelo_texto(key):
    if os.environ.get("GEMINI_TEXT_MODEL"):
        return os.environ["GEMINI_TEXT_MODEL"]
    nomes = [m["name"].split("/")[-1] for m in _get(f"{API}/models?pageSize=1000", key).get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]
    ok = [n for n in nomes if "flash" in n and not re.search(r"tts|image|live|audio|lite|exp", n)]
    versao = lambda n: float((re.findall(r"\d+(?:\.\d+)?", n) or ["0"])[0])
    ok.sort(key=lambda n: ("preview" in n, -versao(n)))
    return (ok or ["gemini-2.5-flash"])[0]


def marcas(audio, linhas, key):
    """Pergunta ao Gemini (modelo de texto, cota separada da do TTS) em que segundo comeca cada linha.

    A precisao e de ~0,5 s, mas basta para o corte escolher o silencio certo entre linhas."""
    lista = "\n".join(f"{k + 1}. {l}" for k, l in enumerate(linhas))
    corpo = {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": wav_b64(audio)}},
        {"text": f"Este audio narra, en orden, estas {len(linhas)} frases:\n{lista}\n\n"
                 "Para cada frase, di en qué segundo del audio EMPIEZA a hablarse (con un decimal). "
                 f"Responde solo con una lista JSON de {len(linhas)} números."}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
    try:
        for tent in range(3):
            try:
                r = _get(f"{API}/models/{modelo_texto(key)}:generateContent", key, corpo); break
            except urllib.error.HTTPError as e:
                if e.code not in (429, 500, 503) or tent == 2:
                    raise
                time.sleep(10 * (tent + 1))
        v = json.loads(r["candidates"][0]["content"]["parts"][0]["text"])
        v = [float(x) for x in v]
        if len(v) == len(linhas) and all(b >= a for a, b in zip(v, v[1:])):
            print("marcas gemini:", v, file=sys.stderr)
            return v
        print("marcas invalidas:", v, file=sys.stderr)
    except Exception as e:
        print("marcas falharam:", e, file=sys.stderr)
    return None


def cortar(audio, linhas, guia=None):
    """Corta o audio continuo em len(linhas) pedacos nos silencios entre as linhas.

    guia: segundo em que cada linha comeca (marcas do Gemini), se houver."""
    r = limites(audio, linhas, guia)
    if not r:
        return None
    fr = int(SR * 0.02)
    # folga de 80 ms antes e 160 ms depois para nao comer o fim das palavras (silencio tem >= 250 ms)
    pedacos = [audio[max(0, i - 4) * fr: (j + 8) * fr] for i, j in r]
    # confere: duracao de cada pedaco proporcional ao tamanho do texto
    chars = np.array([len(re.sub(r"[^\w]", "", l)) + 0.5 * len(l.split()) for l in linhas], float)
    durs = np.array([len(p) / SR for p in pedacos])
    razao = (durs / durs.sum()) / (chars / chars.sum())
    if razao.min() < 0.35 or razao.max() > 2.8:
        print("corte suspeito:", np.round(razao, 2).tolist(), file=sys.stderr)
        return None
    return pedacos


def limites(audio, linhas, guia=None, minimo=0.25):
    """(inicio, fim) de cada linha, em quadros de 20 ms, escolhendo os silencios que separam as linhas."""
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
    trechos = [(i, j) for i, j in trechos if i > a and j < b and (j - i) * 0.02 >= minimo]
    n = len(linhas) - 1
    if len(trechos) < n:
        return None
    # Escolhe os n cortes por programacao dinamica: cada linha deve ter tempo de VOZ (sem contar pausas)
    # proporcional ao tamanho do texto, e cortes em silencios longos ganham bonus. A versao anterior
    # mirava a posicao acumulada e, com a fala lenta cheia de pausas internas, errava a linha e
    # deixava a voz adiantada em relacao a legenda (HM002, 21/10).
    voz_ac = np.concatenate([[0], np.cumsum(~silencio)]).astype(float)
    pesos = np.array([len(re.sub(r"[^\w]", "", l)) + 0.5 * len(l.split()) for l in linhas], float)
    pontos = [a] + [(i + j) // 2 for i, j in trechos] + [b + 1]
    bonus = [0] + [min((j - i) * 0.02, 1.5) for i, j in trechos] + [0]
    V = voz_ac[np.array(pontos)]
    taxa = (V[-1] - V[0]) / pesos.sum()
    P, INF = len(pontos), float("inf")
    melhor = np.full((n + 2, P), INF); de = np.zeros((n + 2, P), int); melhor[0, 0] = 0
    for k in range(1, n + 2):
        esp = taxa * pesos[k - 1]
        js = [P - 1] if k == n + 1 else range(1, P - 1)
        for j in js:
            ant = melhor[k - 1, :j]
            if not np.isfinite(ant).any():
                continue
            c = ant + ((V[j] - V[:j] - esp) / max(esp, 10)) ** 2 * pesos[k - 1] - 0.6 * bonus[j]
            if guia and k <= n:
                # o corte j abre a linha k: perto de onde o Gemini ouviu essa linha comecar
                c = c + 3.0 * min(abs(pontos[j] * 0.02 - guia[k]), 3.0) ** 2
            i = int(np.argmin(c)); melhor[k, j] = c[i]; de[k, j] = i
    if not np.isfinite(melhor[n + 1, P - 1]):
        return None
    j, idx = P - 1, []
    for k in range(n + 1, 1, -1):
        j = de[k, j]; idx.append(j)
    cortes = [trechos[j - 1] for j in reversed(idx)]
    bordas = [a] + [k for i, j in cortes for k in (i, j)] + [b + 1]
    return [(bordas[2 * k], bordas[2 * k + 1]) for k in range(len(linhas))]


def palavras(pedaco, texto):
    """Inicio de cada palavra (segundos desde o inicio do pedaco), contando so o tempo com voz.

    A legenda antes andava proporcional ao texto pelo pedaco inteiro, entao as pausas internas
    ("Parte dos. [2 s] Mi reflejo...", reticencias, voz lenta) deixavam a legenda fora da voz.
    Aqui cada frase (separada por pontuacao) cai no trecho de voz dela e as palavras se distribuem
    so no tempo com voz."""
    fr = int(SR * 0.02)
    ws = texto.split()
    # frases: corta depois de palavra terminada em . , ; : ? ! ou reticencias
    grupos, atual = [], []
    for w in ws:
        atual.append(w)
        if re.search(r"[.,;:?!…»]$", w):
            grupos.append(atual); atual = []
    if atual:
        grupos.append(atual)
    rms = np.sqrt(np.convolve(pedaco ** 2, np.ones(fr) / fr, mode="same")[::fr] + 1e-12)
    voz = rms > max(0.004, np.percentile(rms, 90) * 0.12)
    faixas = None
    if len(grupos) > 1:
        faixas = limites(pedaco, [" ".join(g) for g in grupos], minimo=0.3)
    if not faixas:
        grupos = [ws]; idx = np.where(voz)[0]
        if len(idx) == 0:
            return None
        faixas = [(idx[0], idx[-1] + 1)]
    out = []
    for g, (i, j) in zip(grupos, faixas):
        v = voz[i:j].copy()
        if not v.any():
            v[:] = True
        acum = np.concatenate([[0], np.cumsum(v)]).astype(float)
        pesos = np.array([len(re.sub(r"[^\w]", "", w)) + 1 for w in g], float)
        ini = np.concatenate([[0], np.cumsum(pesos)[:-1]]) / pesos.sum() * acum[-1]
        out += [round((i + float(np.searchsorted(acum, x + 0.5)) - 1) * 0.02, 3) for x in ini]
    return out


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
        for tent in range(3):
            try:
                # guarda a narracao bruta: se o corte falhar, a proxima rodada nao gasta outra das 10 diarias
                bruto = os.path.splitext(a.wav)[0] + "_bruto.wav"
                if tent == 0 and os.path.exists(bruto):
                    audio = sf.read(bruto, dtype="float32")[0]
                else:
                    audio = gemini(linhas, os.environ["GEMINI_API_KEY"])
                    sf.write(bruto, audio, SR)
                corte = tags_faladas(audio, linhas)  # narracao com "Whispering, slow, deep voice..." no comeco: corta fora
                if corte:
                    audio = audio[int(corte * SR):]
                audio = esticar(audio, TEMPO)
                pedacos = cortar(audio, linhas, marcas(audio, linhas, os.environ["GEMINI_API_KEY"]))
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
        seg = {"t0": round(t, 3), "t1": round(t + d, 3), "text": txt}
        w = palavras(p, txt)
        if w:
            seg["w"] = [round(t + float(x), 3) for x in w]
        segs.append(seg)
        out += [p, np.zeros(int(pz * SR), np.float32)]; t += d + pz
    t += 1.2
    out.append(np.zeros(int(1.2 * SR), np.float32))
    sf.write(a.wav, np.concatenate(out), SR)
    json.dump({"dur": round(t, 3), "motor": motor, "segs": segs}, open(a.tempos, "w"), ensure_ascii=False, indent=1)
    # legenda presa na voz de verdade (pedido do Pedro, 23/10): o Whisper ouve a narracao e acerta cada palavra
    try:
        import legenda_whisper
        print("legenda:", legenda_whisper.ajustar(a.wav, a.tempos, os.environ.get("LEGENDA_IDIOMA", "es")), flush=True)
    except Exception as e:
        print("legenda: whisper indisponivel (%s); fica a estimativa e o produce.py confere" % e, file=sys.stderr)
    print(motor, round(t, 1), "s")


if __name__ == "__main__":
    main()
