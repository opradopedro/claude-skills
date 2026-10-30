#!/usr/bin/env python3
"""Legenda colada na voz, para TODOS os canais (pedido do Pedro, 30/10: "nunca mais legenda atrasada").

Por que existe: ate 30/10 o tempo de cada palavra vinha do Whisper (faster-whisper com word_timestamps), e a
conferencia final usava o MESMO Whisper. O Whisper marca o inicio das palavras com erro de 0,1 a 0,5 s, e como
quem marcava e quem conferia erravam igual, a conferencia passava com a legenda atrasada.

Agora o tempo vem de ALINHAMENTO FORCADO (wav2vec2 MMS_FA do torchaudio, o mesmo metodo do WhisperX): como o texto
do roteiro e conhecido, o modelo so precisa achar ONDE cada letra esta no audio, com precisao de ~20 ms.
Roda no CPU, gratis (modelo de ~1,2 GB baixado uma vez e guardado no cache do Actions).

Uso:
  python3 sincronia.py alinhar audio.wav tempos.json --idioma en   # reescreve seg["w"] com o inicio real de cada palavra
  python3 sincronia.py conferir video.mp4 tempos.json --idioma en  # TRAVA: sai com erro se alguma palavra escorregar
  python3 sincronia.py medir video.mp4 roteiro.txt --idioma en     # so mede um video pronto (legenda lida dos quadros)
Em Python: alinhar(audio, palavras, idioma) -> [(inicio, fim)]; ajustar(audio, tempos_path, idioma);
conferir(video, tempos_path, idioma) -> dict com "ok".

Regras da trava (conferir), medidas no MP4 FINAL ja mixado (pega atraso do mix, do corte e do render):
  1. cada palavra entra na tela (no quadro em que entra de fato) entre ADIANTO s antes e ATRASO s depois de a voz
     comecar a fala-la (padrao: ate 0,12 s antes e no maximo 0,07 s depois, ~2 quadros a 30 fps);
  2. audio e video comecam juntos no MP4;
  3. lendo os quadros, a legenda nova surge quando o tempos.json manda (render nao soma adianto/atraso proprio).
Se reprovar, o produce.py refaz uma vez; se reprovar de novo, NAO SOBE (a tarefa falha e o erro vai para a
Release "logs"). Legenda fora da voz nunca vai ao ar.
"""
import argparse, json, os, re, subprocess, sys, unicodedata
import numpy as np

SR = 16000
ADIANTO = float(os.environ.get("LEGENDA_ADIANTO", "0.12"))  # a palavra pode surgir ate isto ANTES da voz (s)
ATRASO = float(os.environ.get("LEGENDA_ATRASO", "0.07"))    # e no maximo isto DEPOIS (s): ~2 quadros a 30 fps
LEAD = float(os.environ.get("LEGENDA_LEAD", "0.03"))        # a palavra entra 1 quadro antes da voz
FPS = 30
_M = {}


# ---------------------------------------------------------------------------------------------- texto -> letras


def _num(tok, idioma):
    try:
        from num2words import num2words
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "num2words"], check=True)
        from num2words import num2words
    t = tok.replace(",", "")
    try:
        if re.fullmatch(r"\d+(\.\d+)?", t):
            return num2words(float(t) if "." in t else int(t), lang=idioma)
        m = re.fullmatch(r"(\d+)(st|nd|rd|th|s|º|ª|%)", t)
        if m:
            n = int(m.group(1))
            if m.group(2) == "%":
                return num2words(n, lang=idioma) + {"en": " percent", "es": " por ciento"}.get(idioma, " por cento")
            if m.group(2) == "s":
                return num2words(n, lang=idioma, to="year") + "s"
            return num2words(n, lang=idioma, to="ordinal")
    except Exception:
        pass
    return re.sub(r"\d", " ", tok)


def falado(palavra, idioma):
    """Palavra da legenda -> como e falada, so com a-z e apostrofo (o dicionario do MMS_FA)."""
    w = palavra.lower().replace("’", "'")
    if re.search(r"\d", w):
        w = " ".join(_num(t, idioma) if re.search(r"\d", t) else t for t in re.split(r"(?<=\d)(?=[a-z])|\s+", w))
    w = w.replace("&", {"en": " and ", "es": " y "}.get(idioma, " e ")).replace("-", " ")
    w = unicodedata.normalize("NFKD", w)
    w = "".join(c for c in w if not unicodedata.combining(c))
    w = re.sub(r"[^a-z' ]", "", w)
    return " ".join(p.strip("'") for p in w.split() if p.strip("'"))


# ---------------------------------------------------------------------------------------------- audio
def ler(arquivo):
    """Qualquer audio ou video -> mono 16 kHz float32 (via ffmpeg)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", arquivo, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def _modelo():
    if "m" not in _M:
        try:
            import torch, torchaudio
        except ImportError:  # sessao sem o requirements do Actions: instala a versao so de CPU (~200 MB)
            subprocess.run([sys.executable, "-m", "pip", "install", "-q", "torch==2.8.0", "torchaudio==2.8.0",
                            "--index-url", "https://download.pytorch.org/whl/cpu"], check=True)
            import torch, torchaudio
        torch.set_num_threads(max(1, os.cpu_count() or 1))
        b = torchaudio.pipelines.MMS_FA
        _M["m"] = (b.get_model(with_star=False).eval(), b.get_dict(star=None), torch, torchaudio)
    return _M["m"]


def alinhar(audio, palavras, idioma="en"):
    """Alinhamento forcado: para cada palavra (texto da legenda), (inicio, fim) em segundos no audio.
    audio = caminho ou array 16 kHz. Palavras sem som (so pontuacao) herdam o tempo da vizinha."""
    au = ler(audio) if isinstance(audio, str) else audio
    model, dic, torch, ta = _modelo()
    faladas = [falado(w, idioma) for w in palavras]
    toks, dono = [], []
    for i, f in enumerate(faladas):
        for sub in f.split():
            toks.append([dic[c] for c in sub if c in dic]); dono.append(i)
    keep = [k for k, t in enumerate(toks) if t]
    toks = [toks[k] for k in keep]; dono = [dono[k] for k in keep]
    wav = torch.from_numpy(au).unsqueeze(0)
    # janelas de 30 s com sobra: o modelo e leve mas um minuto inteiro de uma vez usa ~3 GB; aqui cabe em 1 GB
    with torch.inference_mode():
        emis = []
        passo, sobra = SR * 30, SR * 1
        for ini in range(0, wav.shape[1], passo):
            pedaco = wav[:, max(0, ini - sobra): ini + passo + sobra]
            e, _ = model(pedaco)
            fr = e.shape[1] / pedaco.shape[1]  # quadros por amostra
            a = int(round((ini - max(0, ini - sobra)) * fr)); b = a + int(round(min(passo, wav.shape[1] - ini) * fr))
            emis.append(e[:, a:b])
        emis = torch.cat(emis, dim=1)
    flat = [c for t in toks for c in t]
    import warnings
    warnings.filterwarnings("ignore", message=".*forced_align.*")
    al, sc = ta.functional.forced_align(emis, torch.tensor([flat], dtype=torch.int32), blank=0)
    spans = ta.functional.merge_tokens(al[0], sc[0].exp())
    seg = wav.shape[1] / emis.shape[1] / SR  # segundos por quadro de emissao (~0,02)
    out = [None] * len(palavras)
    nota = [[] for _ in palavras]
    k = 0
    for t, d in zip(toks, dono):
        sp = spans[k:k + len(t)]; k += len(t)
        ini, fim = sp[0].start * seg, sp[-1].end * seg
        out[d] = (ini, fim) if out[d] is None else (out[d][0], fim)
        nota[d] += [x.score for x in sp]
    # confianca de cada palavra (0..1): baixa = a voz nao fala aquilo ali (palavra pulada, tag lida em voz alta)
    _M["nota"] = [float(np.mean(n)) if n else 1.0 for n in nota]
    for i in range(len(out)):  # palavra so de simbolo: cola na anterior (ou na seguinte)
        if out[i] is None:
            viz = next((out[j] for j in list(range(i - 1, -1, -1)) + list(range(i + 1, len(out))) if out[j]), (0, 0))
            out[i] = (viz[1], viz[1]) if i and out[i - 1] else (viz[0], viz[0])
    return [(round(a, 3), round(b, 3)) for a, b in out]


# ---------------------------------------------------------------------------------------------- tempos.json
def _palavras(tempos):
    """[(palavra, seg, indice dentro do seg)] na ordem do video (formato do tts.py)."""
    return [(w, k, i) for k, s in enumerate(tempos["segs"]) for i, w in enumerate(s["text"].split())]


def ajustar(audio, tempos_path, idioma="en"):
    """Reescreve seg["w"] (inicio de cada palavra na tela) com o alinhamento forcado do audio, LEAD s antes da voz.
    Use o audio FINAL (mixado), que e o que o espectador ouve. t0/t1 do seg passam a cobrir as palavras."""
    tempos = json.load(open(tempos_path))
    pal = _palavras(tempos)
    al = alinhar(audio, [w for w, _, _ in pal], idioma)
    for k, s in enumerate(tempos["segs"]):
        idx = [n for n, (_, kk, _) in enumerate(pal) if kk == k]
        if not idx:
            continue
        ws = [max(0.0, al[n][0] - LEAD) for n in idx]
        for i in range(1, len(ws)):
            ws[i] = max(ws[i], ws[i - 1] + 0.034)  # sempre em ordem (1 quadro no minimo)
        s["w"] = [round(t, 3) for t in ws]
        s["w_fim"] = [round(al[n][1], 3) for n in idx]
        s["t0"] = round(min(s["t0"], ws[0]), 3)
        s["t1"] = round(max(s["t1"], al[idx[-1]][1]), 3)
    tempos["legenda"] = "alinhamento"
    json.dump(tempos, open(tempos_path, "w"), ensure_ascii=False, indent=1)
    return {"ok": True, "palavras": len(pal)}


def conferir(video, tempos_path, idioma="en", adianto=ADIANTO, atraso=ATRASO, fps=FPS):
    """Trava final: ouve o MP4 pronto e compara o inicio de cada palavra na voz com o quadro em que ela entra na tela.
    d = tela - voz. Passa se TODAS ficarem em [-adianto, +atraso], audio e video comecam juntos e os quadros batem."""
    tempos = json.load(open(tempos_path)) if isinstance(tempos_path, str) else tempos_path
    pal = _palavras(tempos)
    tela = []
    for w, k, i in pal:
        s = tempos["segs"][k]; ws = s.get("w") or []
        # o quadro i mostra o instante i/fps: a palavra entra no 1o quadro com i/fps >= w
        tela.append(np.ceil(float(ws[i]) * fps - 1e-6) / fps if len(ws) == len(s["text"].split()) else None)
    al = alinhar(video, [w for w, _, _ in pal], idioma)
    nota = _M.get("nota") or [1.0] * len(pal)
    rel = [(9.9 if t is None else t - a, w, a, -1 if t is None else t) for (w, _, _), t, (a, _) in zip(pal, tela, al)]
    ruins = [r for r in rel if not (-adianto <= r[0] <= atraso)]
    ds = [r[0] for r in rel if r[3] >= 0]
    out = {"ok": not ruins and tempos.get("legenda") == "alinhamento", "palavras": len(rel), "fora": len(ruins),
           "media": round(float(np.mean(ds)), 3) if ds else None,
           "max_atraso": round(max(ds), 3) if ds else None, "max_adianto": round(-min(ds), 3) if ds else None,
           "piores": ["%s tela %.2fs voz %.2fs" % (w, t, a) for d, w, a, t in sorted(ruins, key=lambda r: -abs(r[0]))[:6]]}
    # 3+ palavras seguidas que a voz nao fala (nota ~0): roteiro e voz nao batem (frase pulada, tag lida em voz alta)
    seq, pior = 0, []
    for (w, _, _), n in zip(pal, nota):
        seq = seq + 1 if n < 0.1 else 0
        if seq >= 3:
            pior.append(w)
    if pior:
        out["ok"] = False
        out["voz_nao_fala"] = pior[:8]
    if tempos.get("legenda") != "alinhamento":
        out["motivo"] = "tempos.json nao passou pelo alinhamento (sincronia.ajustar) antes do render"
    out["trilhas"] = trilhas(video)
    out["ok"] &= out["trilhas"]["ok"]
    q = quadros(video, tempos, fps=fps)
    out["quadros"] = q or "nao lidos (vale a voz)"
    if q:
        out["ok"] &= q["ok"]
    return out


# ---------------------------------------------------------------------------------------------- quadros do video
def _texto(video, y0=0.25, y1=0.75, fps=30):
    """Mascara do texto da legenda em cada quadro (faixa central): branco puro ou cor forte (vermelho/dourado)
    com contorno escuro do lado. 270x480 basta e e rapido."""
    w, h = 270, 480
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"fps={fps},scale={w}:{h}", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)[:, int(h * y0):int(h * y1)].astype(np.int16)
    mx, mn = fr.max(-1), fr.min(-1)
    texto = (mn > 225) | ((mx > 200) & (mx - mn > 150))
    escuro = mx < 45
    viz = np.zeros_like(escuro)
    for dy, dx in ((0, 2), (0, -2), (2, 0), (-2, 0)):
        viz |= np.roll(np.roll(escuro, dy, 1), dx, 2)
    return texto & viz


def surgimentos(video, fps=30):
    """Instantes (s) em que aparece texto novo na legenda (palavra nova ou bloco novo)."""
    m = _texto(video, fps=fps)
    tam = m.reshape(len(m), -1).sum(1)
    novo = (m[1:] & ~m[:-1]).reshape(len(m) - 1, -1).sum(1)
    base = np.median(tam[tam > 20]) if (tam > 20).any() else 100
    return [(i + 1) / fps for i in np.nonzero(novo > max(40, 0.18 * base))[0]]


def quadros(video, tempos, tol=0.07, fps=30):
    """Confere nos QUADROS que cada palavra entra na tela quando o tempos.json manda (pega render que ignora os
    tempos ou soma adianto proprio, como o +0,1 s antigo do Hora Muerta). None = nao deu para ler a legenda."""
    try:
        ev = np.array(surgimentos(video, fps))
    except Exception:
        return None
    esperado = np.array([np.ceil(float(t) * fps - 1e-6) / fps for s in tempos["segs"] for t in (s.get("w") or [])])
    if len(ev) < 0.5 * len(esperado) or not len(esperado):
        return None
    # deslocamento que melhor explica os quadros: testa de -0,5 a +0,5 s, quadro a quadro, e fica com o que mais
    # casa palavra esperada com texto surgindo (+-1 quadro). Legenda certa = deslocamento 0.
    def casa(o):
        return float(np.mean([np.min(np.abs(ev - (e + o))) <= 1.01 / fps for e in esperado]))
    notas = {round(k / fps, 3): casa(k / fps) for k in range(-int(0.5 * fps), int(0.5 * fps) + 1)}
    melhor = max(notas, key=lambda o: (notas[o], -abs(o)))
    if notas[melhor] < 0.6:
        return None  # nao deu para ler a legenda nos quadros com seguranca
    return {"ok": abs(melhor) <= tol, "deslocamento": melhor, "casadas": round(notas[melhor], 2),
            "casadas_em_0": round(notas[0.0], 2)}


def trilhas(video):
    """Video e audio comecam juntos no MP4 (sem atraso de uma trilha sobre a outra)."""
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,start_time", "-of", "csv=p=0",
                          video], capture_output=True, text=True).stdout.split()
    ini = {l.split(",")[0]: float(l.split(",")[1]) for l in out if "," in l and l.split(",")[1] not in ("", "N/A")}
    d = abs(ini.get("video", 0) - ini.get("audio", 0))
    return {"ok": d <= 0.02, "diferenca": round(d, 3)}


def medir(video, palavras, idioma="en"):
    """Diagnostico de um video ja pronto (sem tempos.json): compara cada texto novo que aparece nos quadros com o
    inicio da palavra mais proxima na voz. d > 0 = legenda atrasada, d < 0 = adiantada."""
    al = alinhar(video, palavras, idioma)
    ev = surgimentos(video)
    ini = np.array([a for a, _ in al])
    ds = np.array([t - ini[np.argmin(np.abs(ini - t))] for t in ev if np.min(np.abs(ini - t)) <= 0.8])
    if not len(ds):
        return {"surgimentos": len(ev)}
    return {"surgimentos": len(ev), "mediana": round(float(np.median(ds)), 3), "p10": round(float(np.percentile(ds, 10)), 3),
            "p90": round(float(np.percentile(ds, 90)), 3), "atrasadas>0.1s": int((ds > 0.1).sum()),
            "adiantadas>0.15s": int((ds < -0.15).sum())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("acao", choices=["alinhar", "conferir", "medir"]); ap.add_argument("arquivo"); ap.add_argument("tempos")
    ap.add_argument("--idioma", default="en")
    a = ap.parse_args()
    if a.acao == "alinhar":
        rel = ajustar(a.arquivo, a.tempos, a.idioma)
    elif a.acao == "medir":
        txt = open(a.tempos, encoding="utf-8").read().split()
        rel = medir(a.arquivo, txt, a.idioma); rel["ok"] = True
    else:
        rel = conferir(a.arquivo, a.tempos, a.idioma)
    print(("LEGENDA OK " if rel["ok"] else "LEGENDA FORA DA VOZ ") + json.dumps(rel, ensure_ascii=False))
    sys.exit(0 if rel["ok"] else 1)


if __name__ == "__main__":
    main()
