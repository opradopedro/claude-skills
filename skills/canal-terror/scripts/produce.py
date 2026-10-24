#!/usr/bin/env python3
"""Produz um episodio do Hora Muerta de ponta a ponta e (opcional) agenda no YouTube.

Uso:
  python3 produce.py stories/001-espejo-1.json --saida /tmp/hm        # so produz o MP4
  python3 produce.py --proximo --subir --saida /tmp/hm                 # agenda a proxima serie inteira
Com --proximo, pega a primeira serie (campo "serie") com parte ainda nao subida e agenda todas as partes em
dias seguidos as 21h. Se ja houver --fila (padrao 2) videos agendados no futuro, nao faz nada (FILA CHEIA).
Opcoes: --publicar 2026-10-23T00:00:00Z (UTC, so a primeira parte; as outras vao para as 21h livres seguintes)
        | --publicar auto (padrao: proximo horario livre das 21h de Brasilia)
        --motor gemini|kokoro (padrao: gemini se houver GEMINI_API_KEY) | --teste (so quadros JPG de conferencia)
Saida: <codigo>.mp4, <codigo>_capa.jpg (thumbnail), <codigo>_upload.json e, com --subir, o id do video.
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
    if a.subir and a.motor != "kokoro":
        os.environ["HM_SEM_KOKORO"] = "1"  # o Pedro reprovou a voz Kokoro: nunca publicar com ela
    tts = [sys.executable, f"{AQUI}/tts.py", historia, base + "_voz.wav", base + "_tempos.json"]
    run(*(tts + (["--motor", a.motor] if a.motor else [])))
    if a.teste:
        h = carregar(historia); tm = json.load(open(base + "_tempos.json")); r = resolver(h, tm)
        pontos = [0.3] + [round(c["t0"] + 1.2, 1) for c in r["cenas"][1:]] + [round(e["t"] + 0.25, 1) for e in r["eventos"] if e["tipo"] == "susto"]
        run(sys.executable, f"{AQUI}/render.py", historia, base + "_tempos.json", base + ".mp4", "--teste", ",".join(map(str, pontos[:12])))
        run(sys.executable, f"{AQUI}/capa.py", historia, base + "_tempos.json", base + "_capa.jpg")
        return
    run(sys.executable, f"{AQUI}/render.py", historia, base + "_tempos.json", base + "_video.mp4")
    run(sys.executable, f"{AQUI}/capa.py", historia, base + "_tempos.json", base + "_capa.jpg")
    run(sys.executable, f"{AQUI}/mix.py", historia, base + "_voz.wav", base + "_tempos.json", base + "_trilha.m4a")
    run("ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a", "-c:v", "libx264",
        "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-shortest", base + ".mp4")
    for s in ("_video.mp4", "_voz.wav"):
        os.remove(base + s)


DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def dia_local(slot):
    """Dia da semana e do mes de um horario UTC, no fuso de Brasilia (o publico e quase todo da America)."""
    d = dt.datetime.strptime(slot, "%Y-%m-%dT%H:%M:%SZ") - dt.timedelta(hours=3)
    return DIAS[d.weekday()], d.day


def preencher(historia, slot_seguinte, saida):
    """Troca {dia_siguiente} e {fecha_siguiente} pelo dia em que sai a proxima parte e grava uma copia."""
    if not slot_seguinte:
        return historia
    dia, n = dia_local(slot_seguinte)
    txt = open(historia, encoding="utf-8").read()
    if "{dia_siguiente}" not in txt and "{fecha_siguiente}" not in txt:
        return historia
    txt = txt.replace("{dia_siguiente}", dia).replace("{fecha_siguiente}", f"{dia} {n}")
    out = os.path.join(saida, os.path.basename(historia))
    open(out, "w", encoding="utf-8").write(txt)
    return out


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
    # horarios decididos antes de narrar: a parte 1 fala o dia em que sai a parte 2
    pend = [f for f in historias if not (a.subir and carregar(f)["codigo"] in ja)]
    slots = []
    for i, _ in enumerate(pend):
        if i == 0 and a.publicar != "auto":
            slots.append(a.publicar)  # so a primeira parte; as seguintes vao para as proximas 21h livres
        else:
            slots.append(proximo_horario(ocupados))
        ocupados.add(slots[-1][:13])
    for historia in historias:
        if historia not in pend:
            print(f"{carregar(historia)['codigo']} ja esta no canal"); continue
        k = pend.index(historia)
        seguinte = slots[k + 1] if k + 1 < len(slots) else (
            (dt.datetime.strptime(slots[k], "%Y-%m-%dT%H:%M:%SZ") + dt.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"))
        historia = preencher(historia, seguinte, a.saida)
        h = carregar(historia)
        cod = h["codigo"]
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
              "tags": tags, "categoria": "24", "sintetico": False,
              "miniatura": os.path.abspath(base + "_capa.jpg"), "serie_titulo": h.get("serie_titulo")}
        if a.subir:
            up["publicar_em"] = slots[k]
        json.dump(up, open(base + "_upload.json", "w"), ensure_ascii=False, indent=1)
        print("video:", base + ".mp4", flush=True)
        if not revisar(base, "es") and a.subir:
            sys.exit(f"NAO SUBIU {cod}: legenda fora da voz ou audio com problema (ver acima); conserte e rode de novo")
        if a.subir:
            import yt_upload
            r = yt_upload.subir(base + "_upload.json")
            ids[cod] = r["id"]
            print(f"AGENDADO {cod} https://youtu.be/{r['id']} publica em {up['publicar_em']} (UTC)", flush=True)
        guardar(cod, base, up, ids.get(cod) if a.subir else None)


def revisar(base, idioma):
    """Conferencia final do MP4, obrigatoria antes de subir (pedido do Pedro, 23/10): legenda acompanha a voz
    (Whisper ouve o arquivo final) e o audio nao tem estalo nem corte."""
    import legenda_whisper
    ok = True
    try:
        rel = legenda_whisper.conferir(base + ".mp4", base + "_tempos.json", idioma)
    except Exception as e:
        rel = {"ok": False, "erro": str(e)[:200]}
    print(("LEGENDA OK " if rel["ok"] else "LEGENDA FORA DA VOZ ") + json.dumps(rel, ensure_ascii=False), flush=True)
    ok &= rel["ok"]
    if os.path.exists(os.path.join(AQUI, "mix.py")):
        import mix
        if hasattr(mix, "conferir_audio"):
            prob = mix.conferir_audio(base + ".mp4")
            print("AUDIO OK" if not prob else "AUDIO COM PROBLEMA: " + "; ".join(prob), flush=True)
            ok &= not prob
    return ok


def guardar(cod, base, up, vid):
    """Copia o video, uma capa e os dados para a pasta da pagina de revisao (scripts/pagina.py)."""
    pasta = os.environ.get("HM_VIDEOS", "/mnt/project-files/canal-terror/videos")
    if not os.path.isdir(os.path.dirname(pasta)):
        return
    os.makedirs(pasta, exist_ok=True)
    import shutil
    shutil.copy(base + ".mp4", os.path.join(pasta, cod + ".mp4"))
    run("ffmpeg", "-v", "error", "-y", "-i", base + "_capa.jpg", "-vf", "scale=360:-1", os.path.join(pasta, cod + ".jpg"))
    meta = {"codigo": cod, "titulo": up["titulo"], "motor_voz": json.load(open(base + "_tempos.json")).get("motor")}
    if vid:
        meta.update(url=f"https://youtube.com/shorts/{vid}", publishAt=up["publicar_em"])
    json.dump(meta, open(os.path.join(pasta, cod + ".json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
