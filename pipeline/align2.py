"""Alinhamento roteiro x narracao sem ASR: ancora fins de frase nas pausas do audio,
e dentro de cada frase distribui as palavras por silabas faladas, pulando silencios."""
import re, subprocess

SPOKEN = {"GTA 6": "ge te a seis", "revista LOVE": "revista lov", "PS5": "pe esse cinco", "GTA": "ge te a", "6": "seis", "19": "dezenove", "Xbox": "equis box",
          "TV": "te ve", "PC": "pe ce", "LOVE": "lov", "14.10": "quatorze ponto dez", "13.60": "treze ponto sessenta",
          "19/11": "dezenove de novembro"}


def syl(word):
    w = re.sub(r"[^\w/. ]", "", word)
    sp = SPOKEN.get(w, w)
    sp = re.sub(r"\d+", lambda m: "xa" * len(m.group()), sp)
    n = len(re.findall(r"[aeiouáéíóúâêôãõày]+", sp.lower()))
    return max(n, 1)


def silences(audio, d=0.12):
    out = subprocess.run(["ffmpeg", "-i", audio, "-af", f"silencedetect=n=-35dB:d={d}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    total = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                           "-of", "csv=p=0", audio]).strip())
    ss = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    se = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    sil = list(zip(ss, se + [total] * (len(ss) - len(se))))
    return sil, total


def dp_bounds(phrases, pw, inner, start, end, speech_len):
    """Escolhe em que pausa cai cada fim de frase (programação dinâmica): o ritmo (sílabas/s) de cada trecho
    entre pausas usadas deve ficar perto do ritmo médio, pausa longa não usada custa caro e fim de frase
    forte (. ? ! :) sem pausa também. Antes era guloso e, com muita vírgula, empurrava o fim da legenda."""
    import math
    n, m = len(phrases), len(inner)
    if n < 2:
        return []
    rate = sum(pw) / max(speech_len(start, end), 0.1)
    strong = [bool(re.search(r"[.:?!]$", p[-1])) for p in phrases]
    cum = [0]
    for w in pw:
        cum.append(cum[-1] + w)

    def seg_cost(i0, i1, t0, t1):  # frases i0..i1-1 entre os instantes t0 e t1
        d = speech_len(t0, t1)
        if d <= 0.05:
            return 1e6
        syl_ = cum[i1] - cum[i0]
        dev = math.log((syl_ / d) / rate)
        skipped = sum(4 * max(0, (q1 - q0) - 0.15) for q0, q1 in inner if t0 < q0 and q1 < t1)
        soft = sum(0.6 if strong[k] else 0.2 for k in range(i0, i1 - 1))
        return syl_ * dev * dev * 0.5 + skipped + soft

    pts = [(start, start)] + inner + [(end, end)]
    INF = float("inf")
    best = {(0, 0): (0.0, None)}  # (frases consumidas, índice da pausa) -> custo, anterior
    for i in range(0, n):
        for j in range(0, m + 1):
            if (i, j) not in best:
                continue
            c0 = best[(i, j)][0]
            t0 = pts[j][1]
            for i1 in range(i + 1, n + 1):
                js = [m + 1] if i1 == n else range(j + 1, m + 1)
                for j1 in js:
                    t1 = pts[j1][0]
                    if t1 <= t0:
                        continue
                    c = c0 + seg_cost(i, i1, t0, t1)
                    if c < best.get((i1, j1), (INF,))[0]:
                        best[(i1, j1)] = (c, (i, j))
    key, chain = (n, m + 1), []
    while key and key in best and best[key][1] is not None:
        prev = best[key][1]
        chain.append((prev, key))
        key = prev
    chain.reverse()
    bounds = []
    for (i0, j0), (i1, j1) in chain:
        t0, t1 = pts[j0][1], pts[j1][0]
        L, tot, acc = speech_len(t0, t1), cum[i1] - cum[i0], 0
        for k in range(i0, i1 - 1):  # fins de frase sem pausa: interpola pelo número de sílabas
            acc += pw[k]
            x, t = L * acc / tot, t0
            for q0, q1 in [q for q in inner if t0 < q[0] < t1] + [(t1, t1)]:
                if x <= q0 - t:
                    t = t + x; break
                x -= q0 - t; t = q1
            bounds.append((t, t))
        if i1 < n:
            bounds.append(pts[j1])
    return bounds


def align(audio, text, merge):
    sil, total = silences(audio)
    start = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    end = sil[-1][0] if sil and sil[-1][1] >= total - 0.05 else total
    inner = [(a, b) for a, b in sil if a > start + 0.05 and b < end - 0.05]
    merge = dict(merge, **{"GTA 6": "GTA 6", "revista LOVE": "revista LOVE"})
    for k, v in merge.items():
        text = text.replace(k, v.replace(" ", "§"))
    words = [w.replace("§", " ") for w in text.split()]
    # frases
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.,:;?!]$", w):
            phrases.append(cur); cur = []
    if cur:
        phrases.append(cur)
    pw = [sum(syl(x) for x in p) for p in phrases]

    def speech_len(a, b):
        return (b - a) - sum(max(0, min(b, s1) - max(a, s0)) for s0, s1 in inner)

    bounds = dp_bounds(phrases, pw, inner, start, end, speech_len)
    res = []
    seg_start = start
    for i, p in enumerate(phrases):
        seg_end = bounds[i][0] if i < len(bounds) else end
        L = speech_len(seg_start, seg_end)
        ws = [syl(x) for x in p]
        tot, acc = sum(ws), 0

        def at(x, a=seg_start, b=seg_end):
            t = a
            for s0, s1 in [s for s in inner if a < s[0] < b] + [(b, b)]:
                if x <= s0 - t:
                    return t + x
                x -= s0 - t; t = s1
            return b
        for w, k in zip(p, ws):
            s = at(L * acc / tot); acc += k; e = at(L * acc / tot)
            res.append((w, s, e))
        seg_start = bounds[i][1] if i < len(bounds) else end
    return res
