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

    # ancora cada fim de frase numa pausa
    bounds, t0, used = [], start, -1
    for i in range(len(phrases) - 1):
        rem_w = sum(pw[i:])
        exp = t0
        need = speech_len(t0, end) * pw[i] / rem_w
        # avanca no tempo de fala ate consumir 'need'
        x, t = need, t0
        for s0, s1 in [s for s in inner if s[1] > t0] + [(end, end)]:
            seg = s0 - max(t, t0)
            if x <= seg:
                exp = max(t, t0) + x; break
            x -= max(seg, 0); t = s1
        else:
            exp = end
        strong = re.search(r"[.:?!]$", phrases[i][-1])
        win = 1.6 if strong else 0.9
        cands = [(j, s) for j, s in enumerate(inner) if j > used and abs((s[0] + s[1]) / 2 - exp) < win
                 and s[0] > t0]
        if cands:
            j, s = min(cands, key=lambda c: abs(c[1][0] - exp) - (0.3 if c[1][1] - c[1][0] > 0.25 else 0))
            used = j
            bounds.append((s[0], s[1]))
            t0 = s[1]
        else:
            bounds.append((exp, exp))
            t0 = exp
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
