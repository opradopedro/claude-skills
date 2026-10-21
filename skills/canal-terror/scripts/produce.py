#!/usr/bin/env python3
"""Produz um episodio do Hora Muerta de ponta a ponta e (opcional) agenda no YouTube.

Uso:
  python3 produce.py stories/001-espejo-1.json --saida /tmp/hm        # so produz o MP4
  python3 produce.py --proximo --subir --saida /tmp/hm                 # agenda a proxima serie inteira
Com --proximo, pega a primeira serie (campo "serie") com parte ainda nao subida e agenda todas as partes em
dias seguidos as 21h. Se ja houver --fila (padrao 2) videos agendados no futuro, nao faz nada (FILA CHEIA).
Opcoes: --publicar 2026-10-23T00:00:00Z (UTC) | --publicar auto (padrao: proximo horario livre das 21h de Brasilia)
        --motor gemini|kokoro (padrao: gemini se houver GEMINI_API_KEY) | --teste (so quadros JPG de conferencia)
Saida: <codigo>.mp4, <codigo>_upload.json e, com --subir, o id do video.
"""
import argparse, datetime as dt, glob, json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
STORIES = os.path.join(os.path.dirname(AQUI), "stories")
sys.path.insert(0, AQUI)
from comum import carregar, resolver

HORA_UTC = 0  # 21h em Brasilia (UTC-3) = 00h UTC do dia seguinte


def run(*cmd):
    print("+", " ".join(os.path.basename(c) if c.startswith("/") else c for c in cmd), flush=True)
    subprocess.run(cmd, check=True)


def proximo_horario(ocupados):
    agora = dt.datetime.now(dt.timezone.utc)
    dia = agora.replace(hour=HORA_UTC, minute=0, second=0, microsecond=0)
    while dia < agora + dt.timedelta(hours=2) or dia.strftime("%Y-%m-%dT%H") in ocupados:
        dia += dt.timedelta(days=1)
    return dia.strftime("%Y-%m-%dT%H:%M:%SZ")


def serie_de(f):
    h = carregar(f)
    return h.get("serie", h["codigo"]), h.get("parte", 1)


def produzir(historia, a, base):
    tts = [sys.executable, f"{AQUI}/tts.py", historia, base + "_voz.wav", base + "_tempos.json"]
    run(*(tts + (["--motor", a.motor] if a.motor else [])))
    if a.teste:
        h = carregar(historia); tm = json.load(open(base + "_tempos.json")); r = resolver(h, tm)
        pontos = [0.3] + [round(c["t0"] + 1.2, 1) for c in r["cenas"][1:]] + [round(e["t"] + 0.25, 1) for e in r["eventos"] if e["tipo"] == "susto"]
        run(sys.executable, f"{AQUI}/render.py", historia, base + "_tempos.json", base + ".mp4", "--teste", ",".join(map(str, pontos[:12])))
        return
    run(sys.executable, f"{AQUI}/render.py", historia, base + "_tempos.json", base + "_video.mp4")
    run(sys.executable, f"{AQUI}/mix.py", historia, base + "_voz.wav", base + "_tempos.json", base + "_trilha.m4a")
    run("ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a", "-c:v", "libx264",
        "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-shortest", base + ".mp4")
    for s in ("_video.mp4", "_voz.wav"):
        os.remove(base + s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("historia", nargs="*"); ap.add_argument("--proximo", action="store_true")
    ap.add_argument("--saida", default="saida"); ap.add_argument("--subir", action="store_true")
    ap.add_argument("--publicar", default="auto"); ap.add_argument("--motor"); ap.add_argument("--teste", action="store_true")
    ap.add_argument("--fila", type=int, default=2, help="com --proximo: nao produz se ja houver tantos videos agendados")
    a = ap.parse_args()
    os.makedirs(a.saida, exist_ok=True)

    ja = {}
    if a.subir or a.proximo:
        import yt_upload
        ja = yt_upload.publicados()
        print("ja no canal:", ", ".join(sorted(ja)) or "nada", flush=True)
    historias = a.historia
    if a.proximo:
        agora = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        fila = [c for c, v in ja.items() if (v.get("publishAt") or "") > agora]
        if a.subir and len(fila) >= a.fila:
            print(f"FILA CHEIA: {len(fila)} videos ja agendados ({', '.join(sorted(fila))}); nada a fazer hoje")
            return
        series = {}
        for f in sorted(glob.glob(os.path.join(STORIES, "*.json"))):
            series.setdefault(serie_de(f)[0], []).append(f)
        pend = [fs for fs in series.values() if any(carregar(f)["codigo"] not in ja for f in fs)]
        if not pend:
            sys.exit("SEM ROTEIRO: todas as series de stories/ ja foram subidas; escreva uma nova (ver SKILL.md)")
        # a serie inteira de uma vez, partes em dias seguidos (a parte 1 promete a 2 para "manana")
        historias = sorted(pend[0], key=lambda f: serie_de(f)[1])
    ocupados = {v["publishAt"][:13] for v in ja.values() if v.get("publishAt")}
    ids = {c: v["id"] for c, v in ja.items()}
    for historia in historias:
        h = carregar(historia)
        cod = h["codigo"]
        if a.subir and cod in ja:
            print(f"{cod} ja esta no canal ({ja[cod]['id']})"); continue
        base = os.path.join(a.saida, cod)
        produzir(historia, a, base)
        if a.teste:
            continue
        desc = h["descripcion"]
        ant = h.get("anterior")
        if ant and ant in ids:
            desc = f"▶ Parte anterior: https://youtube.com/shorts/{ids[ant]}\n\n" + desc
        tags = list(dict.fromkeys(h.get("tags", []) + [cod]))
        up = {"arquivo": os.path.abspath(base + ".mp4"), "titulo": h["titulo"], "descripcion": desc,
              "tags": tags, "categoria": "24", "sintetico": False, "serie_titulo": h.get("serie_titulo")}
        if a.subir:
            up["publicar_em"] = proximo_horario(ocupados) if a.publicar == "auto" else a.publicar
            ocupados.add(up["publicar_em"][:13])
        json.dump(up, open(base + "_upload.json", "w"), ensure_ascii=False, indent=1)
        print("video:", base + ".mp4", flush=True)
        if a.subir:
            import yt_upload
            r = yt_upload.subir(base + "_upload.json")
            ids[cod] = r["id"]
            print(f"AGENDADO {cod} https://youtu.be/{r['id']} publica em {up['publicar_em']} (UTC)", flush=True)


if __name__ == "__main__":
    main()
