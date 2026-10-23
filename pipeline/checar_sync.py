"""Confere se a legenda acompanha a voz antes de fechar o vídeo (pedido do Pedro, 23/10: vale para todo vídeo).

Sem ASR: refaz o alinhamento do align2 e mede, frase por frase, a velocidade de fala (sílabas por segundo).
Frase muito mais rápida ou lenta que a mediana, fim de frase que não caiu numa pausa real e pausa longa
que ficou no meio de uma frase são sinais de legenda fora do áudio. Sai com código 1 se achar problema.

Uso: python3 pipeline/checar_sync.py producao/AAAA-MM-DD_HHMM   (pasta com voz.mp3 e roteiro.txt)
"""
import os, re, statistics, sys
sys.path.insert(0, os.path.dirname(__file__))
from align2 import align, silences, syl

pasta = sys.argv[1]
voz, texto = os.path.join(pasta, "voz.mp3"), open(os.path.join(pasta, "roteiro.txt")).read().strip()
words = align(voz, texto, {"GTA 6": "GTA 6"})
sil, total = silences(voz)
pausas = [(a, b) for a, b in sil if b - a >= 0.25 and a > 0.1 and b < total - 0.1]

frases, cur = [], []
for w in words:
    cur.append(w)
    if re.search(r"[.,:;?!]$", w[0]):
        frases.append(cur); cur = []
if cur:
    frases.append(cur)

taxas = []
for f in frases:
    d = f[-1][2] - f[0][1]
    taxas.append(sum(syl(w) for w, _, _ in f) / d if d > 0 else 99)
med = statistics.median(taxas)
problemas = []
for i, (f, r) in enumerate(zip(frases, taxas)):
    ini, fim = f[0][1], f[-1][2]
    txt = " ".join(w for w, _, _ in f)
    marca = ""
    if r > med * 1.45 or r < med / 1.45:
        marca = f"  <-- ritmo {r:.1f} sil/s (mediana {med:.1f})"
    dentro = [p for p in pausas if ini + 0.15 < p[0] and p[1] < fim - 0.15 and p[1] - p[0] >= 0.35]
    if dentro:
        marca += f"  <-- pausa longa no meio ({dentro[0][0]:.2f}-{dentro[0][1]:.2f})"
    if i < len(frases) - 1 and re.search(r"[.?!:]$", f[-1][0]):
        if not any(abs(p[0] - fim) < 0.12 for p in pausas):
            marca += "  <-- fim de frase fora de pausa"
    if marca:
        problemas.append(i)
    print(f"{ini:6.2f}-{fim:6.2f}  {txt[:70]}{marca}")
print(f"áudio {total:.2f}s, última legenda termina em {frases[-1][-1][2]:.2f}s")
if problemas:
    print(f"ATENÇÃO: {len(problemas)} frase(s) suspeitas; confira no contact sheet com o áudio ou ajuste o roteiro/pontuação.")
    sys.exit(1)
print("OK: legenda acompanha a voz")
