"""Trava da legenda (REGRA do Pedro, 30/10: legenda nunca atrasada nem antes da voz, vale para todo vídeo).

Roda DEPOIS do make_short.py, no MP4 final: alinha de novo o áudio do vídeo pronto com o roteiro (alinhamento forçado,
pipeline/sincronia.py) e compara com o instante em que cada palavra entra na tela (config.json -> "palavras").
Passa se toda palavra entrar entre 0,12 s antes e 0,07 s depois da voz e áudio e vídeo começarem juntos.
Sai com código 1 e "ATENÇÃO LEGENDA FORA DA VOZ" se reprovar: não publique, refaça o auto_short.py + make_short.py.

Uso: python3 pipeline/checar_sync.py producao/AAAA-MM-DD_HHMM   (pasta com config.json e o MP4 do "out")
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sincronia  # noqa: E402

pasta = sys.argv[1]
cfg = json.load(open(os.path.join(pasta, "config.json"), encoding="utf-8"))
video = os.path.join(pasta, cfg["out"])
pal = cfg.get("palavras")
if not pal:
    sys.exit("ATENÇÃO LEGENDA FORA DA VOZ: config.json sem \"palavras\" (gere de novo com o auto_short.py novo)")
al = sincronia.alinhar(video, [p["falado"] for p in pal], "pt")
ruins = []
for p, (a, _) in zip(pal, al):
    tela = math.ceil(p["tela"] * 30 - 1e-6) / 30  # quadro em que a palavra entra (30 fps)
    d = tela - a
    if not -sincronia.ADIANTO <= d <= sincronia.ATRASO:
        ruins.append((abs(d), f"{p['txt']} tela {tela:.2f}s voz {a:.2f}s"))
tr = sincronia.trilhas(video)
if ruins or not tr["ok"]:
    print(f"ATENÇÃO LEGENDA FORA DA VOZ: {len(ruins)} de {len(pal)} palavras fora; áudio x vídeo {tr}")
    for _, r in sorted(ruins, reverse=True)[:8]:
        print("  ", r)
    sys.exit(1)
print(f"OK legenda colada na voz ({len(pal)} palavras)")
