"""ESTATICA DO GEMINI: o TTS do Gemini as vezes devolve um estalo de chiado (estatica de TV, ruido branco a ~-6 dB,
mais alto que a propria voz) colado no COMECO e/ou no FIM da gravacao.
Visto no Hora Muerta (HM001-HM022, 05/11) e no Old Tales. Copia do canais-dark/motor-en/estatica.py.

tirar_estatica(audio, sr): acha trechos de ruido branco (espectro chato de 2,5 a 11,5 kHz, energia quase toda
acima de 3 kHz e volume perto da fala; um "s" da fala nao e chato) e corta (perto do fim) ou silencia (no meio).
"""
import numpy as np


def achar_estatica(mono, sr, ref=None, jan=0.04):
    """Trechos de ESTATICA DE TV (ruido branco). Devolve [(inicio, fim)] em amostras, janelas de 40 ms emendadas."""
    x = np.asarray(mono, dtype="float64")
    q = int(jan * sr); n = len(x) // q
    if n < 3:
        return []
    b = x[: n * q].reshape(n, q)
    r = 20 * np.log10(np.sqrt((b ** 2).mean(axis=1)) + 1e-9)
    if ref is None:
        voz = r[r > -40]
        ref = float(np.percentile(voz, 90)) if len(voz) else -20.0
    sp = np.abs(np.fft.rfft(b * np.hanning(q), axis=1)) ** 2 + 1e-15
    f = np.fft.rfftfreq(q, 1 / sr)
    hf = 10 * np.log10(sp[:, f > 3000].sum(axis=1) / sp.sum(axis=1))
    lim = np.arange(2500, min(11501, sr / 2), 500)
    e = np.stack([sp[:, (f >= lim[i]) & (f < lim[i + 1])].sum(axis=1) for i in range(len(lim) - 1)], axis=1)
    plana = np.exp(np.log(e).mean(axis=1)) / e.mean(axis=1)
    ruim = (hf > -6.0) & (plana > 0.8) & (r > ref - 6.0)
    out = []
    i = 0
    while i < n:
        if ruim[i]:
            j = i
            while j + 1 < n and ruim[j + 1]:
                j += 1
            out.append((i * q, (j + 1) * q))
            i = j + 1
        else:
            i += 1
    return out


def tirar_estatica(audio, sr, nome="narracao"):
    """Estatica colada na fala: perto do fim corta dali em diante; no meio, silencia o trecho."""
    a = np.array(audio, dtype="float32", copy=True)
    mono = a.mean(axis=1) if a.ndim > 1 else a
    trechos = achar_estatica(mono, sr)
    if not trechos:
        return a
    total = len(mono)
    for i0, i1 in reversed(trechos):
        i0 = max(0, i0 - int(0.01 * sr)); i1 = min(total, i1 + int(0.02 * sr))
        if total - i1 < int(1.5 * sr):  # perto do fim: nada depois disso e fala
            print(f"{nome}: cortei estatica de TV colada no fim ({i0 / sr:.2f} s ate o fim)", flush=True)
            a = a[:i0]; total = i0
        else:
            print(f"{nome}: silenciei estatica de TV em {i0 / sr:.2f}-{i1 / sr:.2f} s", flush=True)
            a[i0:i1] = 0
    return a
