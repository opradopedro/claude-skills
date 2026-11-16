"""Posta no YouTube Shorts o que estiver na hora (roda nos horários da rotina do YouTube).

1. Reels novos: todo item "postado" no agenda.json a partir de 21/10 que ainda não está em youtube/publicados.json.
2. Fila de antigos: itens de youtube/plano.json com data e hora já vencidas (Brasília) e ainda não postados.
3. Capas: Shorts já publicados sem "capa": true recebem capas/<video>.jpg (thumbnails.set). Enquanto o canal
   não estiver verificado o YouTube recusa; a rotina tenta 1 vez por rodada e para no primeiro 403.
1 envio por rodada, 1 hora entre envios, atrasados por engajamento em horário aleatório (regra de 16/11); o Reel de 21/10 21h foi para a fila (Pedro pediu só 2 Shorts no primeiro dia). Grava os links em youtube/publicados.json (o commit e o push ficam com quem chama).
Uso: python3 pipeline/youtube_rotina.py [--dry]
"""
import datetime, json, os, random, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from youtube_publicar import canal_certo, capa_de, por_capa, publicar, token

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INICIO_NOVOS = "2026-10-22"
# 16/11: o GitHub Actions do canais-dark guarda o controle em canais-dark/gta6/youtube-publicados.json (RADAR_PUBLICADOS)
PUBLICADOS = os.environ.get("RADAR_PUBLICADOS") or os.path.join(RAIZ, "youtube/publicados.json")
RODAPE = "\n\nSe inscreve pra acompanhar tudo de GTA 6 até o lançamento 🔔"
TAGS = ["gta 6", "gta vi", "gta 6 brasil", "gta 6 noticias", "grand theft auto 6"]


def ler(nome):
    with open(os.path.join(RAIZ, nome), encoding="utf-8") as f:
        return json.load(f)


def achar_mp4(arq):
    """Devolve o caminho local do mp4. Em clone parcial (blob:none + sparse sem *.mp4) baixa só esse arquivo do git.
    Procura na raiz e em producao/*/ (desde o v90 alguns ficaram só na pasta do slot). None se não existir no branch."""
    local = os.path.join(RAIZ, arq)
    if os.path.exists(local) and os.path.getsize(local) > 0:
        return local
    try:
        nomes = subprocess.run(["git", "-C", RAIZ, "ls-tree", "-r", "--name-only", "HEAD"], capture_output=True,
                               text=True, check=True).stdout.split("\n")
    except Exception:
        return None
    cands = [n for n in nomes if n == arq] + [n for n in nomes if n.startswith("producao/") and n.endswith("/" + arq)]
    if not cands:
        return None
    destino = os.path.join(RAIZ, cands[0])
    if not (os.path.exists(destino) and os.path.getsize(destino) > 0):
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "wb") as f:
            subprocess.run(["git", "-C", RAIZ, "cat-file", "blob", "HEAD:" + cands[0]], stdout=f, check=True)
    return destino


def titulo_de(legenda):
    t = legenda.split("\n")[0].strip()
    if "gta 6" not in t.lower() and "gta vi" not in t.lower():
        t = "GTA 6: " + t
    return t[:90] + " #Shorts"


BRT = datetime.timezone(datetime.timedelta(hours=-3))
# REGRA do Pedro (16/11): Reel novo do Insta sobe na programação normal (logo depois do horário do Insta);
# os atrasados entram numa fila pelos de MAIOR engajamento no Insta e saem em horários aleatórios.
# Nunca 2 Shorts no mesmo horário: pelo menos 1 hora entre quaisquer dois envios. 1 envio por rodada.
NOVO_HORAS = 6             # Reel do Insta com menos que isso é "novo" (sobe na rodada seguinte ao Insta)
INTERVALO_MIN = 60         # minutos mínimos entre dois envios
ATRASADOS_POR_DIA = 4      # máximo de atrasados por dia (horário de Brasília)
CHANCE_ATRASADO = 0.35     # chance por rodada horária -> horários aleatórios
HORAS_ATRASADOS = range(9, 24)
HORAS_RESERVADAS = {11, 17, 20}  # hora antes dos Reels de 12h, 18h e 21h: deixa a vaga para o novo


def engajamento(p, metricas):
    cod = (p.get("link") or "").rstrip("/").rsplit("/", 1)[-1]
    m = (metricas.get(cod) or {}).get("atual") or {}
    return m.get("playCount", 0) + 20 * (m.get("likeCount", 0) + 2 * m.get("commentCount", 0) + 3 * m.get("shares", 0) + 2 * m.get("saves", 0))


def quando_brt(p):
    try:
        return datetime.datetime.strptime(f'{p["data"]} {p.get("hora_real") or p["hora"]}', "%Y-%m-%d %H:%M").replace(tzinfo=BRT)
    except Exception:
        return None


def quando_utc(q):
    for f in ("%Y-%m-%dT%H:%MZ", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(q, f).replace(tzinfo=datetime.timezone.utc)
        except (ValueError, TypeError):
            pass
    return None


def main(dry):
    agora = datetime.datetime.now(BRT)
    posts = {p.get("arquivo"): p for p in ler("agenda.json")["posts"] if p.get("arquivo")}
    feitos = json.load(open(PUBLICADOS, encoding="utf-8"))
    try:
        metricas = ler("metricas.json")
    except Exception:
        metricas = {}
    envios = sorted(q for q in (quando_utc(i.get("quando")) for i in feitos.values()) if q)
    ultimo = envios[-1] if envios else None
    hoje = agora.date()
    atrasados_hoje = sum(1 for i in feitos.values() if i.get("tipo") == "atrasado" and i.get("quando")
                         and quando_utc(i["quando"]) and quando_utc(i["quando"]).astimezone(BRT).date() == hoje)

    novos, atrasados = [], []
    for p in posts.values():
        if p["status"] != "postado" or p["data"] < INICIO_NOVOS or p["arquivo"] in feitos or not p.get("legenda"):
            continue
        q = quando_brt(p)
        item = (p["arquivo"], titulo_de(p["legenda"]), p["legenda"])
        if q and agora - q <= datetime.timedelta(hours=NOVO_HORAS):
            novos.append((q, item))
        else:
            atrasados.append((engajamento(p, metricas), item))
    vistos = {i[1][0] for i in atrasados}
    for i in ler("youtube/plano.json")["fila"]:
        if f'{i["data"]} {i["hora"]}' <= agora.strftime("%Y-%m-%d %H:%M") and i["arquivo"] not in feitos and i["arquivo"] not in vistos:
            p = posts.get(i["arquivo"], {})
            atrasados.append((engajamento(p, metricas), (i["arquivo"], i["titulo"], p.get("legenda", ""))))
    novos = [it for _, it in sorted(novos)]
    atrasados = [it for _, it in sorted(atrasados, key=lambda x: -x[0])]
    print(f"novos: {len(novos)} | atrasados na fila: {len(atrasados)} (hoje já foram {atrasados_hoje})")

    if ultimo and (agora - ultimo) < datetime.timedelta(minutes=INTERVALO_MIN):
        print(f"último envio há {int((agora - ultimo).total_seconds() // 60)} min: espero dar 1 hora")
        capas(feitos, dry)
        return
    escolha, tipo = None, None
    if novos:
        escolha, tipo = novos, "novo"
    elif atrasados and atrasados_hoje < ATRASADOS_POR_DIA and agora.hour in HORAS_ATRASADOS and agora.hour not in HORAS_RESERVADAS:
        sorteio = random.random()
        if sorteio < CHANCE_ATRASADO or "--agora" in sys.argv:
            escolha, tipo = atrasados, "atrasado"
        else:
            print("atrasado: não sorteado nesta hora (horário aleatório)")
    if not escolha:
        print("nada para postar agora")
        capas(feitos, dry)
        return
    if not dry:
        ok, nomes = canal_certo(token())
        if not ok:
            sys.exit(f"TOKEN DE OUTRO CANAL ({nomes}): não subi nada. Use o token do Radar GTA VI em YT_REFRESH_TOKEN_GTA")
    for arq, tit, leg in escolha:
        mp4 = achar_mp4(arq)
        if not mp4:
            print("SEM MP4 no branch (pulei):", arq)
            continue
        if dry:
            print(f"postaria ({tipo}):", arq, "|", tit, "|", os.path.relpath(mp4, RAIZ))
            break
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as d:
            d.write(leg + RODAPE)
        link = publicar(mp4, tit, open(d.name, encoding="utf-8").read(), TAGS)
        feitos[arq] = {"link": link, "titulo": tit, "tipo": tipo,
                       "quando": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
        with open(PUBLICADOS, "w", encoding="utf-8") as f:
            json.dump(feitos, f, ensure_ascii=False, indent=1)
        print(f"postado ({tipo}):", arq, link)
        break
    capas(feitos, dry)


def capas(feitos, dry):
    pend = [(a, i) for a, i in feitos.items() if "shorts/" in i.get("link", "") and not i.get("capa")
            and capa_de(a)]
    if dry or not pend:
        print(f"capas pendentes no YouTube: {len(pend)}")
        return
    tk = token()
    for arq, info in pend:
        ok = por_capa(info["link"].rsplit("/", 1)[-1], capa_de(arq), tk)
        if ok == "limite":
            print("capas no YouTube: limite atingido, o resto entra nas próximas rodadas")
            return
        if ok is None:
            info["capa"] = "vídeo removido do YouTube"
        elif not ok:
            print("capas no YouTube: canal ainda não liberado (youtube.com/verify)")
            return
        else:
            info["capa"] = True
        with open(PUBLICADOS, "w", encoding="utf-8") as f:
            json.dump(feitos, f, ensure_ascii=False, indent=1)
        print("capa aplicada:" if ok else "vídeo removido, sem capa:", arq)


if __name__ == "__main__":
    main("--dry" in sys.argv)
