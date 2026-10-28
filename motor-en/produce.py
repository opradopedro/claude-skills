#!/usr/bin/env python3
"""Motor compartilhado dos canais em ingles (canal-survival, canal-classics).

Reaproveita o motor JA TESTADO do canal-terror (tts, render, capa, mix, legenda_whisper, comum)
sem alterar nenhum arquivo dele. Tudo que muda de canal para canal vem do canal.json.

Uso:
  python3 motor-en/produce.py skills/canal-survival --teste --saida /tmp/sv   # so quadros JPG
  python3 motor-en/produce.py skills/canal-survival --saida /tmp/sv           # produz o MP4
  python3 motor-en/produce.py skills/canal-survival --proximo --subir --saida /tmp/sv

Diferencas em relacao ao produce.py do canal-terror:
  - horario em fuso real (America/New_York), nao em hora UTC fixa: nao escorrega no horario de verao
  - idioma, prefixo do codigo, voz e pasta de videos vem do canal.json
  - nomes dos dias da semana em ingles
"""
import argparse, datetime as dt, glob, json, os, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTOR = os.path.join(RAIZ, "skills", "canal-terror", "scripts")  # motor testado, nunca alterado
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, MOTOR)
from comum import carregar, resolver  # noqa: E402  (vem do motor do canal-terror)

DIAS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MESES_EN = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"]


def fuso(nome):
    """Fuso horario de verdade (ajusta sozinho no horario de verao).

    No Windows o Python nao vem com a tabela de fusos: precisa do pacote tzdata.
    """
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(nome)
    except Exception as e:
        sys.exit(f"FUSO NAO ENCONTRADO ({nome}): {e}\n"
                 f"No Windows rode: pip install tzdata")


def ler_canal(pasta):
    """Le o canal.json e preenche o que faltar com valores padrao."""
    pasta = os.path.abspath(pasta)
    c = json.load(open(os.path.join(pasta, "canal.json"), encoding="utf-8"))
    c["pasta"] = pasta
    c["stories"] = os.path.join(pasta, "stories")
    c.setdefault("idioma", "en")
    c.setdefault("fuso", "America/New_York")
    c.setdefault("hora_local", 19)
    c.setdefault("categoria", "24")
    c.setdefault("fila", 2)
    c.setdefault("crf", "26")
    c.setdefault("voz_tempo", "0.9")
    for k in ("prefixo", "token_var"):
        if not c.get(k):
            sys.exit(f"canal.json sem '{k}' (obrigatorio)")
    return c


def aplicar_ambiente(c):
    """Passa as escolhas do canal para os scripts do motor, so por variavel de ambiente."""
    os.environ["YT_TOKEN_VAR"] = c["token_var"]
    os.environ["HM_VOZ_TEMPO"] = str(c["voz_tempo"])
    if c.get("voz"):
        os.environ["GEMINI_TTS_VOICE"] = c["voz"]
    if c.get("modelo_tts"):
        os.environ["GEMINI_TTS_MODEL"] = c["modelo_tts"]
    os.environ.setdefault("KOKORO_LANG", c["idioma"])


def run(*cmd):
    print("+", " ".join(os.path.basename(x) if os.path.isabs(x) else x for x in cmd), flush=True)
    subprocess.run(cmd, check=True)


def proximo_horario(c, ocupados):
    """Proximo dia livre na hora local do canal, devolvido em UTC (como a API do YouTube quer)."""
    tz = fuso(c["fuso"])
    agora = dt.datetime.now(dt.timezone.utc)
    local = agora.astimezone(tz).replace(hour=int(c["hora_local"]), minute=0, second=0, microsecond=0)
    while True:
        utc = local.astimezone(dt.timezone.utc)
        if utc > agora + dt.timedelta(hours=2) and utc.strftime("%Y-%m-%dT%H") not in ocupados:
            return utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        local += dt.timedelta(days=1)


def dia_local(c, slot):
    """Dia da semana e data de um horario UTC, no fuso do canal."""
    tz = fuso(c["fuso"])
    d = dt.datetime.strptime(slot, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).astimezone(tz)
    return DIAS_EN[d.weekday()], d.day, MESES_EN[d.month - 1]


def serie_de(f):
    h = carregar(f)
    return h.get("serie", h["codigo"]), h.get("parte", 1)


def preencher(c, historia, slot_seguinte, saida):
    """Troca os marcadores do dia da proxima parte e grava uma copia (nunca mexe no original)."""
    if not slot_seguinte:
        return historia
    dia, n, mes = dia_local(c, slot_seguinte)
    txt = open(historia, encoding="utf-8").read()
    trocas = {"{next_day}": dia, "{next_date}": f"{dia}, {mes} {n}",
              "{dia_siguiente}": dia, "{fecha_siguiente}": f"{dia}, {mes} {n}"}
    if not any(k in txt for k in trocas):
        return historia
    for k, v in trocas.items():
        txt = txt.replace(k, v)
    out = os.path.join(saida, os.path.basename(historia))
    open(out, "w", encoding="utf-8").write(txt)
    return out


def produzir(c, historia, a, base):
    if a.subir and a.motor != "kokoro":
        os.environ["HM_SEM_KOKORO"] = "1"  # nunca publicar com a voz de reserva
    tts = [sys.executable, os.path.join(MOTOR, "tts.py"), historia, base + "_voz.wav", base + "_tempos.json"]
    run(*(tts + (["--motor", a.motor] if a.motor else [])))
    if a.teste:
        h = carregar(historia)
        tm = json.load(open(base + "_tempos.json"))
        r = resolver(h, tm)
        pontos = ([0.3] + [round(x["t0"] + 1.2, 1) for x in r["cenas"][1:]]
                  + [round(e["t"] + 0.25, 1) for e in r["eventos"] if e["tipo"] == "susto"])
        run(sys.executable, os.path.join(MOTOR, "render.py"), historia, base + "_tempos.json",
            base + ".mp4", "--teste", ",".join(map(str, pontos[:12])))
        run(sys.executable, os.path.join(MOTOR, "capa.py"), historia, base + "_tempos.json", base + "_capa.jpg")
        return
    run(sys.executable, os.path.join(MOTOR, "render.py"), historia, base + "_tempos.json", base + "_video.mp4")
    run(sys.executable, os.path.join(MOTOR, "capa.py"), historia, base + "_tempos.json", base + "_capa.jpg")
    run(sys.executable, os.path.join(MOTOR, "mix.py"), historia, base + "_voz.wav",
        base + "_tempos.json", base + "_trilha.m4a")
    run("ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a",
        "-c:v", "libx264", "-crf", str(c["crf"]), "-preset", "slow", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", "-shortest", base + ".mp4")
    os.remove(base + "_video.mp4")


def revisar(base, idioma):
    """Conferencia obrigatoria antes de subir: legenda acompanha a voz e audio sem estalo."""
    import legenda_whisper
    ok = True
    try:
        voz = base + "_voz.wav"
        rel = legenda_whisper.conferir(base + ".mp4", base + "_tempos.json", idioma,
                                       voz=voz if os.path.exists(voz) else None)
    except Exception as e:
        rel = {"ok": False, "erro": str(e)[:200]}
    print(("LEGENDA OK " if rel["ok"] else "LEGENDA FORA DA VOZ ") + json.dumps(rel, ensure_ascii=False), flush=True)
    ok &= bool(rel["ok"])
    import mix
    if hasattr(mix, "conferir_audio"):
        prob = mix.conferir_audio(base + ".mp4")
        print("AUDIO OK" if not prob else "AUDIO COM PROBLEMA: " + "; ".join(prob), flush=True)
        ok &= not prob
    return ok


def guardar(c, cod, base, up, vid):
    """Copia o video e os dados para a pasta de arquivo do canal. Se a pasta nao existir, nao faz nada."""
    padrao = c.get("pasta_videos") or ""
    pasta = os.environ.get(c.get("pasta_videos_var", ""), padrao) if c.get("pasta_videos_var") else padrao
    if not pasta or not os.path.isdir(os.path.dirname(os.path.abspath(pasta))):
        return
    os.makedirs(pasta, exist_ok=True)
    import shutil
    shutil.copy(base + ".mp4", os.path.join(pasta, cod + ".mp4"))
    try:
        run("ffmpeg", "-v", "error", "-y", "-i", base + "_capa.jpg", "-vf", "scale=360:-1",
            os.path.join(pasta, cod + ".jpg"))
    except Exception as e:
        print("miniatura do arquivo falhou (o video esta salvo):", e, file=sys.stderr)
    meta = {"codigo": cod, "titulo": up["titulo"],
            "motor_voz": json.load(open(base + "_tempos.json")).get("motor")}
    if vid:
        meta.update(url=f"https://youtube.com/shorts/{vid}", publishAt=up.get("publicar_em"))
    json.dump(meta, open(os.path.join(pasta, cod + ".json"), "w"), ensure_ascii=False, indent=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("canal", help="pasta do canal (tem canal.json e stories/)")
    ap.add_argument("historia", nargs="*")
    ap.add_argument("--proximo", action="store_true")
    ap.add_argument("--saida", default="saida")
    ap.add_argument("--subir", action="store_true")
    ap.add_argument("--publicar", default="auto")
    ap.add_argument("--motor")
    ap.add_argument("--teste", action="store_true")
    ap.add_argument("--fila", type=int, default=None)
    a = ap.parse_args()

    c = ler_canal(a.canal)
    aplicar_ambiente(c)
    if a.fila is None:
        a.fila = int(c["fila"])
    os.makedirs(a.saida, exist_ok=True)
    print(f"canal: {c.get('nome', c['prefixo'])} | codigo {c['prefixo']} | "
          f"{c['hora_local']}h {c['fuso']} | idioma {c['idioma']}", flush=True)

    import yt_upload
    yt_upload.configurar(c["prefixo"], c["idioma"])

    ja = {}
    if a.subir or a.proximo:
        # trava de seguranca: confere de qual canal e o token ANTES de produzir qualquer coisa
        yt_upload.verificar_canal(c.get("canal_titulo"))
        ja = yt_upload.publicados()
        print("ja no canal:", ", ".join(sorted(ja)) or "nada", flush=True)

    historias = list(a.historia)
    if a.proximo:
        agora = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        fila = [k for k, v in ja.items() if (v.get("publishAt") or "") > agora]
        series = {}
        for f in sorted(glob.glob(os.path.join(c["stories"], "*.json"))):
            series.setdefault(serie_de(f)[0], []).append(f)
        pend = [fs for fs in series.values() if any(carregar(f)["codigo"] not in ja for f in fs)]
        meio = bool(pend) and any(carregar(f)["codigo"] in ja for f in pend[0])
        if a.subir and len(fila) >= a.fila and not meio:
            print(f"FILA CHEIA: {len(fila)} videos ja agendados ({', '.join(sorted(fila))}); nada a fazer hoje")
            return
        if not pend:
            sys.exit("SEM ROTEIRO: todas as series de stories/ ja foram subidas; escreva uma nova (ver SKILL.md)")
        historias = sorted(pend[0], key=lambda f: serie_de(f)[1])

    ocupados = {v["publishAt"][:13] for v in ja.values() if v.get("publishAt")}
    ids = {k: v["id"] for k, v in ja.items()}
    pend = [f for f in historias if not (a.subir and carregar(f)["codigo"] in ja)]
    slots = []
    for i, _ in enumerate(pend):
        slots.append(a.publicar if (i == 0 and a.publicar != "auto") else proximo_horario(c, ocupados))
        ocupados.add(slots[-1][:13])

    for historia in historias:
        if historia not in pend:
            print(f"{carregar(historia)['codigo']} ja esta no canal")
            continue
        k = pend.index(historia)
        seguinte = slots[k + 1] if k + 1 < len(slots) else (
            dt.datetime.strptime(slots[k], "%Y-%m-%dT%H:%M:%SZ") + dt.timedelta(days=1)
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
        historia = preencher(c, historia, seguinte, a.saida)
        h = carregar(historia)
        cod = h["codigo"]
        if not cod.startswith(c["prefixo"]):
            sys.exit(f"CODIGO ERRADO: {cod} nao comeca com {c['prefixo']} (roteiro na pasta do canal errado?)")
        base = os.path.join(a.saida, cod)
        produzir(c, historia, a, base)
        if a.teste:
            continue
        desc = h.get("descripcion") or h.get("description", "")
        ant = h.get("anterior")
        if ant and ant in ids:
            desc = f"> Previous part: https://youtube.com/shorts/{ids[ant]}\n\n" + desc
        tags = list(dict.fromkeys(h.get("tags", []) + [cod]))
        up = {"arquivo": os.path.abspath(base + ".mp4"), "titulo": h["titulo"], "descripcion": desc,
              "tags": tags, "categoria": str(c["categoria"]), "sintetico": False,
              "miniatura": os.path.abspath(base + "_capa.jpg"), "serie_titulo": h.get("serie_titulo")}
        if a.subir:
            up["publicar_em"] = slots[k]
        json.dump(up, open(base + "_upload.json", "w"), ensure_ascii=False, indent=1)
        print("video:", base + ".mp4", flush=True)

        ok = revisar(base, c["idioma"])
        if os.path.exists(base + "_voz.wav"):
            os.remove(base + "_voz.wav")
        if not ok and a.subir:
            sys.exit(f"NAO SUBIU {cod}: legenda fora da voz ou audio com problema (ver acima); conserte e rode de novo")
        if a.subir:
            r = yt_upload.subir(base + "_upload.json", c.get("canal_titulo"))
            ids[cod] = r["id"]
            print(f"AGENDADO {cod} https://youtu.be/{r['id']} publica em {up['publicar_em']} (UTC)", flush=True)
        guardar(c, cod, base, up, ids.get(cod) if a.subir else None)


if __name__ == "__main__":
    main()
