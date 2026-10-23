#!/usr/bin/env python3
"""Produz um Short do So You Built It de ponta a ponta e (opcional) agenda no YouTube.

Uso:
  python3 produce.py stories/002-eraser.json --saida /tmp/yb        # so produz o MP4
  python3 produce.py --proximo --saida /tmp/yb                       # produz o proximo de cada tipo, sem subir
  python3 produce.py --proximo --subir --saida /tmp/yb               # e agenda (exige o arquivo APROVADO)
Dois Shorts por dia: "Evolucao" (you built it, engenharia) as 12h de Nova York e "Curiosidade"
(como funciona) as 19h de Nova York. --proximo pega o primeiro roteiro de cada tipo ainda nao subido.
Opcoes: --motor gemini|kokoro (padrao: gemini se houver GEMINI_API_KEY) | --teste (so quadros JPG)
        --fila N (padrao 4): com --subir, nao produz se ja houver N videos agendados no futuro.
Trava: --subir so funciona com o arquivo APROVADO na pasta da skill (o Pedro aprova o 1o video antes).
Saida: <codigo>.mp4, <codigo>_upload.json e, com --subir, uma linha "AGENDADO YBxxx https://youtu.be/...".
"""
import argparse, datetime as dt, glob, json, os, shutil, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(AQUI)
STORIES = os.path.join(SKILL, "stories")
sys.path.insert(0, AQUI)
from comum import carregar, resolver

HORA_UTC = {"Evolucao": 16, "Curiosidade": 23}  # 12h e 19h em Nova York (EDT); no inverno caem 1 h antes

# voz e ritmo do canal (o tts.py veio do Hora Muerta, que usa voz sussurrada e lenta)
VOZ = {"GEMINI_TTS_VOICE": "Charon", "GEMINI_TTS_ESTILO": "", "HM_VOZ_TEMPO": "1.0", "HM_PAUSA_FATOR": "1.0",
       "KOKORO_LANG": "en", "KOKORO_SID": "16", "KOKORO_VEL": "1.15"}


def run(*cmd):
    print("+", " ".join(os.path.basename(c) if c.startswith("/") else c for c in cmd), flush=True)
    subprocess.run(cmd, check=True)


def proximo_horario(formato, ocupados):
    agora = dt.datetime.now(dt.timezone.utc)
    dia = agora.replace(hour=HORA_UTC.get(formato, 16), minute=0, second=0, microsecond=0)
    while dia < agora + dt.timedelta(hours=2) or dia.strftime("%Y-%m-%dT%H") in ocupados:
        dia += dt.timedelta(days=1)
    return dia.strftime("%Y-%m-%dT%H:%M:%SZ")


def produzir(historia, a, base):
    for k, v in VOZ.items():
        os.environ.setdefault(k, v)
    if a.subir and a.motor != "kokoro":
        os.environ["HM_SEM_KOKORO"] = "1"  # nunca publicar com a voz de reserva
    tts = [sys.executable, f"{AQUI}/tts.py", historia, base + "_voz.wav", base + "_tempos.json"]
    run(*(tts + (["--motor", a.motor] if a.motor else [])))
    if a.teste:
        tm = json.load(open(base + "_tempos.json")); r = resolver(carregar(historia), tm)
        pontos = [0.3] + [round(c["t0"] + 1.5, 1) for c in r["cenas"][1:]]
        run(sys.executable, f"{AQUI}/render.py", historia, base + "_tempos.json", base + ".mp4", "--teste", ",".join(map(str, pontos[:12])))
        return
    run(sys.executable, f"{AQUI}/render.py", historia, base + "_tempos.json", base + "_video.mp4")
    run(sys.executable, f"{AQUI}/mix.py", historia, base + "_voz.wav", base + "_tempos.json", base + "_trilha.m4a")
    run("ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a", "-c:v", "libx264",
        "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-shortest", base + ".mp4")
    for s in ("_video.mp4", "_voz.wav"):
        os.remove(base + s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("historia", nargs="*"); ap.add_argument("--proximo", action="store_true")
    ap.add_argument("--saida", default="saida"); ap.add_argument("--subir", action="store_true")
    ap.add_argument("--motor"); ap.add_argument("--teste", action="store_true")
    ap.add_argument("--fila", type=int, default=4)
    a = ap.parse_args()
    if a.subir and not os.path.exists(os.path.join(SKILL, "APROVADO")):
        sys.exit("SEM APROVACAO: o Pedro ainda nao aprovou o primeiro video; rode sem --subir e mande o MP4 para ele")
    os.makedirs(a.saida, exist_ok=True)

    ja = {}
    if a.subir or a.proximo:
        import yt_upload
        try:
            ja = yt_upload.publicados()
        except SystemExit:
            if a.subir:
                raise
            print("canal fora do ar nesta sessao; seguindo sem consultar", flush=True)
        print("ja no canal:", ", ".join(sorted(ja)) or "nada", flush=True)
    historias = a.historia
    if a.proximo:
        agora = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        fila = [c for c, v in ja.items() if (v.get("publishAt") or "") > agora]
        if a.subir and len(fila) >= a.fila:
            print(f"FILA CHEIA: {len(fila)} videos ja agendados ({', '.join(sorted(fila))}); nada a fazer hoje")
            return
        historias = []
        for formato in HORA_UTC:
            pend = [f for f in sorted(glob.glob(os.path.join(STORIES, "*.json")))
                    if carregar(f).get("formato") == formato and carregar(f)["codigo"] not in ja]
            if pend:
                historias.append(pend[0])
            else:
                print(f"SEM ROTEIRO {formato}: escreva o proximo (ver SKILL.md)", flush=True)
        if not historias:
            sys.exit("SEM ROTEIRO: nenhum roteiro pendente em stories/")
    ocupados = {v["publishAt"][:13] for v in ja.values() if v.get("publishAt")}
    for historia in historias:
        h = carregar(historia)
        cod = h["codigo"]
        if a.subir and cod in ja:
            print(f"{cod} ja esta no canal"); continue
        base = os.path.join(a.saida, cod)
        produzir(historia, a, base)
        if a.teste:
            continue
        up = {"arquivo": os.path.abspath(base + ".mp4"), "titulo": h["titulo"], "descripcion": h["descripcion"],
              "tags": list(dict.fromkeys(h.get("tags", []) + [cod])), "categoria": "27", "sintetico": False}
        if a.subir:
            up["publicar_em"] = proximo_horario(h.get("formato"), ocupados)
            ocupados.add(up["publicar_em"][:13])
        json.dump(up, open(base + "_upload.json", "w"), ensure_ascii=False, indent=1)
        print("video:", base + ".mp4", flush=True)
        vid = None
        if a.subir:
            import yt_upload
            vid = yt_upload.subir(base + "_upload.json")["id"]
            print(f"AGENDADO {cod} https://youtu.be/{vid} publica em {up['publicar_em']} (UTC)", flush=True)
        guardar(cod, base, up, vid)


def guardar(cod, base, up, vid):
    """Copia o video e os dados para a pasta do projeto, onde o Pedro assiste."""
    pasta = os.environ.get("YB_VIDEOS", "/mnt/project-files/canal-engenharia/videos")
    if not os.path.isdir(os.path.dirname(pasta)):
        return
    os.makedirs(pasta, exist_ok=True)
    shutil.copy(base + ".mp4", os.path.join(pasta, cod + ".mp4"))
    meta = {"codigo": cod, "titulo": up["titulo"], "motor_voz": json.load(open(base + "_tempos.json")).get("motor")}
    if vid:
        meta.update(url=f"https://youtube.com/shorts/{vid}", publishAt=up["publicar_em"])
    json.dump(meta, open(os.path.join(pasta, cod + ".json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
