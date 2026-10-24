#!/usr/bin/env python3
"""Legenda presa na voz: ouve a narracao com o Whisper (faster-whisper, CPU, gratis) e acerta o inicio de cada palavra.

Pedido do Pedro (23/10): "SEMPRE verifique se a legenda acompanha o audio antes de finalizar o video, para todas as paginas".
A legenda antes saia de uma estimativa (tamanho das palavras dentro do trecho com voz) e escorregava no fim das frases.

Uso:
  python3 legenda_whisper.py ajustar voz.wav tempos.json --idioma en    # reescreve seg["w"] com os tempos ouvidos
  python3 legenda_whisper.py conferir video.mp4 tempos.json --idioma en # confere o arquivo final; sai com erro se escorregar
Em Python: ajustar(wav, tempos, idioma) e conferir(arquivo, tempos, idioma) devolvem um relatorio (dict com "ok").

tempos.json = {"segs": [{"t0", "t1", "text", "w": [inicio de cada palavra de text.split()]}]} (formato do tts.py).
Modelo: LEGENDA_MODELO (padrao "base", baixado do HuggingFace na 1a vez; se falhar tenta o "tiny"). Instale com
pip install faster-whisper. Sem o modelo, o produce.py nao sobe (a conferencia e obrigatoria).
"""
import argparse, difflib, json, os, re, subprocess, sys, unicodedata
import numpy as np

SR = 16000
TOL = float(os.environ.get("LEGENDA_TOL", "0.3"))  # escorregao maximo aceito (s) entre a palavra na tela e na voz
_M = {}


def modelo():
    if "m" in _M:
        return _M["m"]
    try:
        from faster_whisper import WhisperModel
    except ImportError:  # rotina antiga sem o pacote no pip install: instala aqui (a conferencia e obrigatoria)
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "faster-whisper"], check=True)
        from faster_whisper import WhisperModel
    nome = os.environ.get("LEGENDA_MODELO", "base")
    try:
        m = WhisperModel(nome, device="cpu", compute_type="int8")
    except Exception as e:
        print("whisper: modelo %s falhou (%s); tentando o tiny" % (nome, str(e)[:80]), file=sys.stderr)
        m = WhisperModel("tiny", device="cpu", compute_type="int8")
    _M["m"] = m
    return m


def ler(arquivo, inicio=0.0):
    """Qualquer audio ou video -> mono 16 kHz float32 (via ffmpeg)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(inicio), "-i", arquivo, "-vn", "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def norm(w):
    w = unicodedata.normalize("NFKD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if not unicodedata.combining(c)))


def ouvir(audio, idioma):
    segs, _ = modelo().transcribe(audio, language=idioma, word_timestamps=True, beam_size=5,
                                  condition_on_previous_text=False, vad_filter=False)
    return [(w.word.strip(), float(w.start), float(w.end)) for s in segs for w in s.words if norm(w.word)]


def casar(roteiro, ouvidas):
    """Para cada palavra do roteiro: (inicio ouvido ou None). Casa por sequencia (difflib) e, nos trechos trocados
    de mesmo tamanho (numeros por extenso, nomes), aceita palavra a palavra."""
    a = [norm(w) for w in roteiro]; b = [norm(w) for w, _, _ in ouvidas]
    out = [None] * len(a)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                out[i1 + k] = ouvidas[j1 + k][1]
        elif tag == "replace" and j2 > j1:  # tamanhos diferentes: so o comeco do trecho e confiavel
            out[i1] = ouvidas[j1][1]
    return out


def _tela(tempos):
    """Lista (palavra, inicio na tela, indice do seg) na ordem do video."""
    out = []
    for k, s in enumerate(tempos["segs"]):
        ws = s["text"].split(); ts = s.get("w") or []
        if len(ts) != len(ws):  # sem tempo por palavra: distribui pelo trecho (como o motor faz)
            ts = list(np.linspace(s["t0"], s["t1"], len(ws), endpoint=False))
        out += [(w, float(t), k) for w, t in zip(ws, ts)]
    return out


def ajustar(wav, tempos_path, idioma, inicio=0.0):
    """Reescreve seg["w"] com os inicios ouvidos; palavras nao ouvidas ficam entre as vizinhas (pelo tamanho)."""
    tempos = json.load(open(tempos_path))
    tela = _tela(tempos)
    voz = ler(wav, inicio)
    ouvidas = ouvir(voz, idioma)
    achado = casar([w for w, _, _ in tela], ouvidas)
    # palavra cujo trecho ouvido engole uma pausa ("y" de 13,34 a 14,46 s, HM008): ela comeca depois da pausa
    fins = {a: b for _, a, b in ouvidas}
    achado = [t if t is None or t not in fins else _fim_da_pausa(voz, t, fins[t]) for t in achado]
    n_ok = sum(t is not None for t in achado)
    if n_ok < 0.6 * len(tela):
        return {"ok": False, "casadas": n_ok, "total": len(tela), "motivo": "o Whisper nao reconheceu o roteiro na voz"}
    novo = []
    for k, s in enumerate(tempos["segs"]):
        idx = [i for i, x in enumerate(tela) if x[2] == k]
        ts = [achado[i] + inicio if achado[i] is not None else None for i in idx]
        # o inicio de cada linha vem do corte (t0); o Whisper e mais preciso dentro da linha
        ts = [min(max(t, s["t0"]), s["t1"] - 0.05) if t is not None else None for t in ts]
        ts[0] = s["t0"] if ts[0] is None or ts[0] - s["t0"] > 0.6 else ts[0]
        ws = [tela[i][0] for i in idx]
        for i in range(len(ts)):
            if ts[i] is None:  # interpola entre o ultimo conhecido e o proximo conhecido, pelo tamanho das palavras
                j = next((j for j in range(i + 1, len(ts)) if ts[j] is not None), None)
                fim = ts[j] if j is not None else s["t1"] - 0.15
                pesos = [len(norm(w)) + 1 for w in ws[i - 1:(j if j is not None else len(ts))]]
                ts[i] = ts[i - 1] + (fim - ts[i - 1]) * pesos[0] / max(1, sum(pesos))
        for i in range(len(ts)):  # palavra depois de pausa: o Whisper poe o inicio no silencio (HM007 "ya", "Y")
            fim = ts[i + 1] if i + 1 < len(ts) else s["t1"]
            ts[i] = _depois_do_silencio(voz, ts[i] - inicio, fim - inicio) + inicio
        for i in range(1, len(ts)):  # sempre em ordem, com pelo menos 2 quadros por palavra
            ts[i] = max(ts[i], ts[i - 1] + 0.066)
        s["w"] = [round(t, 3) for t in ts]
        novo.append(s)
    tempos["segs"] = novo
    tempos["legenda"] = "whisper"
    json.dump(tempos, open(tempos_path, "w"), ensure_ascii=False, indent=1)
    return {"ok": True, "casadas": n_ok, "total": len(tela)}


def _inicio_voz(voz, a, t):
    """Whisper no MP4 final (com trilha) marca palavra depois de pausa ate 1,6 s cedo, dentro do silencio (HM007, 24/10).
    Com a voz limpa em maos: se nao ha voz entre o inicio ouvido e a legenda, a voz comeca no 1o trecho com som."""
    if voz is None or a >= t - 0.1:
        return a
    q = int(SR * 0.05)
    i0, i1 = int(a * SR), min(len(voz), int((t + 1.5) * SR))
    mudo, ini = 0, a
    for i in range(i0, i1 - q, q):  # o inicio ouvido pode cair no rabo da palavra anterior: vale o som depois do silencio
        if np.sqrt((voz[i:i + q] ** 2).mean()) > 0.01:
            if mudo >= 6:  # 0,3 s de silencio antes
                return i / SR
            mudo = 0
        else:
            mudo += 1
    return a


def _depois_do_silencio(voz, x, fim):
    """Se a voz esta muda em x (0,25 s seguidos), devolve o comeco do som seguinte antes de fim; senao x."""
    q = int(SR * 0.05)
    mudo = lambda i: np.sqrt((voz[i:i + q] ** 2).mean()) <= 0.01 if i + q <= len(voz) else True
    i = int(x * SR)
    if not all(mudo(i + k * q) for k in range(5)):
        return x
    for j in range(i, min(len(voz), int(fim * SR)) - q, q):
        if not mudo(j):
            return max(x, j / SR - 0.03)
    return x


def _fim_da_pausa(voz, a, b):
    """Fim (menos 30 ms) da ultima pausa de 0,3 s ou mais entre a e b; a se nao houver."""
    q = int(SR * 0.05)
    mudo, fim = 0, a
    for j in range(int(a * SR), min(len(voz), int(b * SR)) - q, q):
        if np.sqrt((voz[j:j + q] ** 2).mean()) <= 0.01:
            mudo += 1
        else:
            if mudo >= 6:
                fim = j / SR - 0.03
            mudo = 0
    return fim


def conferir(arquivo, tempos_path, idioma, tol=TOL, voz=None):
    """Ouve o arquivo final e compara com a legenda.
    ok = 85% das palavras ouvidas, 90% delas a ate 0,2 s e nenhuma fora mais que tol (0,45 s).
    A 1a palavra de cada frase vem do corte da voz (que e preciso); o Whisper costuma marcar o inicio dela cedo demais,
    dentro do silencio anterior, entao ela so reprova se a legenda chegar mais de 0,3 s DEPOIS da voz.
    voz: a narracao limpa (wav, mesmo relogio do video); com ela, inicio ouvido dentro de silencio e corrigido."""
    tempos = json.load(open(tempos_path)) if isinstance(tempos_path, str) else tempos_path
    tela = _tela(tempos)
    ouvidas = ouvir(ler(arquivo), idioma)
    voz_a = ler(voz) if voz else None
    achado = casar([w for w, _, _ in tela], ouvidas)
    primeira = [i == 0 or tela[i - 1][2] != tela[i][2] for i in range(len(tela))]
    desvios = []
    for (w, t, _), a, p1 in zip(tela, achado, primeira):
        if a is None:
            continue
        a = _inicio_voz(voz_a, a, t)
        d = max(0.0, t - a - 0.3) if p1 else abs(t - a)
        desvios.append((d, w, a, t))
    ds = sorted(d for d, *_ in desvios)
    piores = sorted(desvios, reverse=True)[:5]
    casadas = len(desvios) / max(1, len(tela))
    p90 = ds[int(0.9 * (len(ds) - 1))] if ds else 0
    ok = casadas >= 0.85 and p90 <= 0.2 and (not ds or ds[-1] <= max(tol, 0.45))
    return {"ok": ok, "casadas": round(casadas, 2), "p90": round(p90, 2), "max": round(ds[-1], 2) if ds else None,
            "media": round(float(np.mean(ds)), 3) if ds else None,
            "piores": [f"{w} tela {t:.2f}s voz {a:.2f}s" for d, w, a, t in piores]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("acao", choices=["ajustar", "conferir"]); ap.add_argument("audio"); ap.add_argument("tempos")
    ap.add_argument("--idioma", default="en"); ap.add_argument("--tol", type=float, default=TOL)
    a = ap.parse_args()
    rel = ajustar(a.audio, a.tempos, a.idioma) if a.acao == "ajustar" else conferir(a.audio, a.tempos, a.idioma, a.tol)
    print(("LEGENDA OK " if rel["ok"] else "LEGENDA FORA DA VOZ ") + json.dumps(rel, ensure_ascii=False))
    sys.exit(0 if rel["ok"] else 1)


if __name__ == "__main__":
    main()
