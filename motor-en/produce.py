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
import argparse, datetime as dt, glob, json, os, subprocess, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTOR = os.path.join(RAIZ, "skills", "canal-terror", "scripts")  # motor testado, nunca alterado
# ORDEM IMPORTA: a pasta motor-en vem ANTES do motor do canal-terror, senao o "import yt_upload"
# acharia o yt_upload do Hora Muerta (codigo HM, idioma es, token ES) em vez deste daqui.
# comum, tts, mix e legenda_whisper nao existem em motor-en, entao continuam vindo do motor.
sys.path.insert(0, MOTOR)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
    # horas de publicacao no dia (lista). Aceita "hora_local" antigo (uma hora so).
    if not c.get("horas_locais"):
        c["horas_locais"] = [int(c.get("hora_local", 19))]
    c["horas_locais"] = sorted(int(h) for h in c["horas_locais"])
    c.setdefault("categoria", "24")
    c.setdefault("fila", 2 * len(c["horas_locais"]))
    # quantas partes produzir por execucao. 1 = uma por noite (poupa cota de voz e memoria);
    # 0 ou ausente = a serie inteira de uma vez (comportamento antigo).
    c["partes_por_vez"] = int(c.get("partes_por_vez", 0) or 0)
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
    if c.get("estilo_voz"):
        # tom da voz por canal; sem isto vale o sussurro de terror do motor ("[whispering] [slow] [deep voice]")
        os.environ["GEMINI_TTS_ESTILO"] = c["estilo_voz"]
    os.environ.setdefault("KOKORO_LANG", c["idioma"])
    # o tts.py do motor ouve a voz em LEGENDA_IDIOMA, que por padrao e "es" (canal Hora Muerta).
    # Sem isto o Whisper ouvia a narracao em ingles como se fosse espanhol e a legenda escorregava.
    os.environ["LEGENDA_IDIOMA"] = c["idioma"]
    # selo da capa no idioma do canal (o motor usa "PARTE" do Hora Muerta por padrao)
    os.environ["CAPA_SELO"] = c.get("selo_parte", "PART" if c["idioma"] == "en" else "PARTE")
    # a voz sussurrada engana o Whisper "base" (casava 18-30 de 92 palavras); o "small" casa 90 de 91
    os.environ.setdefault("LEGENDA_MODELO", c.get("legenda_modelo", "small"))


def ram_livre_mb():
    """RAM disponivel agora, em MB. None se nao der para medir (ai nao espera)."""
    try:
        if os.name == "nt":
            import ctypes

            class Mem(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = Mem()
            m.dwLength = ctypes.sizeof(Mem)
            if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
                return None
            return int(m.ullAvailPhys // (1024 * 1024))
        with open("/proc/meminfo") as f:
            for linha in f:
                if linha.startswith("MemAvailable:"):
                    return int(linha.split()[1]) // 1024
    except Exception:
        return None
    return None


# Blindagem de memoria: antes de cada etapa pesada, espera a RAM liberar; se a etapa cair
# (falta de memoria, travamento), espera e repete. A narracao vem do banco (tts_guard.py),
# entao repetir NUNCA gasta outra narracao do Gemini.
RAM_MIN_MB = int(os.environ.get("CANAIS_RAM_MIN_MB", "1200"))
RAM_ESPERA_S = int(os.environ.get("CANAIS_RAM_ESPERA_MIN", "30")) * 60
TENTATIVAS = int(os.environ.get("CANAIS_TENTATIVAS", "3"))


def esperar_memoria(etapa):
    livre = ram_livre_mb()
    if livre is None or livre >= RAM_MIN_MB:
        return
    print(f"POUCA MEMORIA: {livre} MB livres (quero {RAM_MIN_MB}). Esperando antes de {etapa}...", flush=True)
    fim = time.time() + RAM_ESPERA_S
    while time.time() < fim:
        time.sleep(15)
        livre = ram_livre_mb()
        if livre is None or livre >= RAM_MIN_MB:
            print(f"memoria liberou ({livre} MB): seguindo com {etapa}", flush=True)
            return
    print(f"memoria segue baixa ({livre} MB) apos {RAM_ESPERA_S // 60} min: tentando {etapa} assim mesmo", flush=True)


def run(*cmd):
    nome = " ".join(os.path.basename(x) if os.path.isabs(x) else x for x in cmd)
    etapa = os.path.basename(cmd[1]) if len(cmd) > 1 and cmd[0] == sys.executable else os.path.basename(cmd[0])
    for t in range(1, TENTATIVAS + 1):
        esperar_memoria(etapa)
        print("+", nome, flush=True)
        r = subprocess.run(cmd)
        if r.returncode == 0:
            return
        if t < TENTATIVAS:
            print(f"ETAPA CAIU: {etapa} (codigo {r.returncode}), tentativa {t} de {TENTATIVAS}. "
                  f"Espero 60 s e repito.", flush=True)
            time.sleep(60)
    raise subprocess.CalledProcessError(r.returncode, cmd)


def proximo_horario(c, ocupados):
    """Proximo horario livre do canal, devolvido em UTC (como a API do YouTube quer).

    O canal pode ter mais de uma hora de publicacao por dia (ex. 12h e 19h): percorre
    dia por dia, hora por hora, e devolve o primeiro vago com pelo menos 2h de folga.
    """
    tz = fuso(c["fuso"])
    agora = dt.datetime.now(dt.timezone.utc)
    dia = agora.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    for _ in range(366):
        for h in c["horas_locais"]:
            utc = dia.replace(hour=h).astimezone(dt.timezone.utc)
            if utc > agora + dt.timedelta(hours=2) and utc.strftime("%Y-%m-%dT%H") not in ocupados:
                return utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        dia += dt.timedelta(days=1)
    sys.exit("SEM HORARIO LIVRE no proximo ano (fila muito cheia?)")


def hora_local_de(c, slot):
    """Converte um horario UTC para o fuso do canal."""
    return dt.datetime.strptime(slot, "%Y-%m-%dT%H:%M:%SZ").replace(
        tzinfo=dt.timezone.utc).astimezone(fuso(c["fuso"]))


def dia_local(c, slot):
    """Dia da semana e data de um horario UTC, no fuso do canal."""
    d = hora_local_de(c, slot)
    return DIAS_EN[d.weekday()], d.day, MESES_EN[d.month - 1]


def quando_sai(c, slot_atual, slot_seguinte):
    """Como a parte atual deve se referir a parte seguinte.

    Com duas publicacoes por dia, a parte 2 pode sair NO MESMO DIA da parte 1: dizer
    "tomorrow" seria mentira. Devolve a frase certa para cada caso.
    """
    prox = hora_local_de(c, slot_seguinte)
    dia_sem, n, mes = DIAS_EN[prox.weekday()], prox.day, MESES_EN[prox.month - 1]
    dif = (prox.date() - hora_local_de(c, slot_atual).date()).days
    if dif <= 0:
        frase, cartao = ("tonight", "TONIGHT") if prox.hour >= 17 else ("later today", "LATER TODAY")
    elif dif == 1:
        frase, cartao = f"tomorrow, {dia_sem}", "TOMORROW"
    else:
        frase, cartao = f"on {dia_sem}, {mes} {n}", dia_sem.upper()
    return {"{when_next}": frase, "{next_card}": cartao, "{next_day}": dia_sem,
            "{next_date}": f"{dia_sem}, {mes} {n}",
            # compatibilidade com os marcadores em espanhol do canal-terror
            "{dia_siguiente}": dia_sem, "{fecha_siguiente}": f"{dia_sem}, {mes} {n}"}


def serie_de(f):
    h = carregar(f)
    return h.get("serie", h["codigo"]), h.get("parte", 1)


def preencher(c, historia, slot_atual, slot_seguinte, saida):
    """Troca os marcadores da proxima parte e grava uma copia (nunca mexe no original)."""
    if not slot_seguinte:
        return historia
    trocas = quando_sai(c, slot_atual, slot_seguinte)
    txt = open(historia, encoding="utf-8").read()
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
    # tts_guard.py embrulha o tts.py do motor: grava a voz uma vez e reaproveita (ver o arquivo)
    tts = [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts_guard.py"),
           historia, base + "_voz.wav", base + "_tempos.json"]
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
    # sons GRAVADOS (Freesound CC0) no lugar dos sintetizados: ver motor-en/mix_en.py e sons.py
    run(sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "mix_en.py"), historia, base + "_voz.wav",
        base + "_tempos.json", base + "_trilha.m4a")
    # segunda trava contra chiado no fim: o som some suave nos ultimos 0,8 s de TODO video
    dur = float(json.load(open(base + "_tempos.json"))["dur"])
    run("ffmpeg", "-v", "error", "-y", "-i", base + "_video.mp4", "-i", base + "_trilha.m4a",
        "-c:v", "libx264", "-crf", str(c["crf"]), "-preset", "slow", "-pix_fmt", "yuv420p",
        "-af", f"afade=t=out:st={max(0.0, dur - 0.8):.2f}:d=0.8", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", base + ".mp4")
    os.remove(base + "_video.mp4")


def revisar(base, idioma):
    """Conferencia obrigatoria antes de subir: legenda acompanha a voz e audio sem estalo."""
    import legenda_whisper
    ok = True
    voz = base + "_voz.wav"
    for t in range(1, TENTATIVAS + 1):
        esperar_memoria("conferencia da legenda")
        try:
            rel = legenda_whisper.conferir(base + ".mp4", base + "_tempos.json", idioma,
                                           voz=voz if os.path.exists(voz) else None)
            break
        except Exception as e:  # MemoryError incluido: o Whisper e a parte que mais come RAM
            rel = {"ok": False, "erro": str(e)[:200]}
            if t < TENTATIVAS:
                print(f"conferencia caiu ({rel['erro']}), tentativa {t} de {TENTATIVAS}: espero 60 s", flush=True)
                time.sleep(60)
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
    ap.add_argument("--max-partes", type=int, default=0, help="com --proximo: produz no maximo N partes nesta rodada")
    a = ap.parse_args()

    c = ler_canal(a.canal)
    aplicar_ambiente(c)
    if a.fila is None:
        a.fila = int(c["fila"])
    os.makedirs(a.saida, exist_ok=True)
    horas = "h, ".join(str(h) for h in c["horas_locais"]) + "h"
    print(f"canal: {c.get('nome', c['prefixo'])} | codigo {c['prefixo']} | "
          f"{horas} {c['fuso']} | idioma {c['idioma']}", flush=True)

    import yt_upload
    yt_upload.configurar(c["prefixo"], c["idioma"])

    ja = {}
    if a.subir or a.proximo:
        # trava de seguranca: confere de qual canal e o token ANTES de produzir qualquer coisa
        yt_upload.verificar_canal(c.get("canal_titulo"))
        ja = yt_upload.publicados()
        print("ja no canal:", ", ".join(sorted(ja)) or "nada", flush=True)

    historias = list(a.historia)
    if not historias and not a.proximo:
        # sem roteiro indicado e sem --proximo: pega o primeiro de stories/ (uso tipico do --teste).
        # Sem isso o programa nao fazia nada e saia em silencio.
        todos = sorted(glob.glob(os.path.join(c["stories"], "*.json")))
        if not todos:
            sys.exit(f"SEM ROTEIRO: a pasta {c['stories']} esta vazia. "
                     f"Escreva a primeira historia (ver SKILL.md) ou use outro canal.")
        historias = [todos[0]]
        print(f"nenhum roteiro indicado: usando {os.path.basename(historias[0])} "
              f"(para escolher outro, passe o caminho do arquivo; para a serie inteira, use --proximo)",
              flush=True)
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
        if a.max_partes:
            # o Crew da no maximo 1 h por tarefa: produz so as proximas N partes; o resto fica para o dia seguinte
            novas = [f for f in historias if carregar(f)["codigo"] not in ja]
            historias = [f for f in historias if carregar(f)["codigo"] in ja] + novas[:a.max_partes]

    ocupados = {v["publishAt"][:13] for v in ja.values() if v.get("publishAt")}
    ids = {k: v["id"] for k, v in ja.items()}
    pend = [f for f in historias if not (a.subir and carregar(f)["codigo"] in ja)]
    # Produz so as N primeiras partes pendentes. Uma por noite poupa cota de voz do Gemini
    # (plano gratis da ~10 narracoes por dia, somadas a TODOS os canais que usam a mesma chave)
    # e memoria RAM (um render de 20 min em vez de quatro seguidos).
    if a.proximo and c["partes_por_vez"] > 0 and len(pend) > c["partes_por_vez"]:
        faltam = len(pend) - c["partes_por_vez"]
        pend = pend[:c["partes_por_vez"]]
        historias = list(pend)
        print(f"produzindo {len(pend)} parte(s) agora; faltam {faltam} para as proximas execucoes",
              flush=True)
    slots = []
    # Um horario A MAIS do que o numero de partes: a ultima parte produzida precisa saber
    # quando sai a seguinte, para dizer "tomorrow, Thursday" sem errar.
    for i in range(len(pend) + 1):
        slots.append(a.publicar if (i == 0 and a.publicar != "auto") else proximo_horario(c, ocupados))
        ocupados.add(slots[-1][:13])

    for historia in historias:
        if historia not in pend:
            print(f"{carregar(historia)['codigo']} ja esta no canal")
            continue
        k = pend.index(historia)
        historia = preencher(c, historia, slots[k], slots[k + 1], a.saida)
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
