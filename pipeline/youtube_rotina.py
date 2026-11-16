"""Posta no YouTube Shorts o que estiver na hora (roda nos horários da rotina do YouTube).

1. Reels novos: todo item "postado" no agenda.json a partir de 21/10 que ainda não está em youtube/publicados.json.
2. Fila de antigos: itens de youtube/plano.json com data e hora já vencidas (Brasília) e ainda não postados.
3. Capas: Shorts já publicados sem "capa": true recebem capas/<video>.jpg (thumbnails.set). Enquanto o canal
   não estiver verificado o YouTube recusa; a rotina tenta 1 vez por rodada e para no primeiro 403.
No máximo POR_RODADA (3) envios por rodada; o Reel de 21/10 21h foi para a fila (Pedro pediu só 2 Shorts no primeiro dia). Grava os links em youtube/publicados.json (o commit e o push ficam com quem chama).
Uso: python3 pipeline/youtube_rotina.py [--dry]
"""
import datetime, json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from youtube_publicar import canal_certo, capa_de, por_capa, publicar, token

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INICIO_NOVOS = "2026-10-22"
RODAPE = "\n\nSe inscreve pra acompanhar tudo de GTA 6 até o lançamento 🔔"
POR_RODADA = 3  # 16/11: subiu de 2 para 3 para zerar o atraso de 12/11 a 16/11
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


def main(dry):
    agora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime("%Y-%m-%d %H:%M")
    posts = {p.get("arquivo"): p for p in ler("agenda.json")["posts"] if p.get("arquivo")}
    feitos = ler("youtube/publicados.json")
    fila = []
    for p in posts.values():
        if p["status"] == "postado" and p["data"] >= INICIO_NOVOS and p["arquivo"] not in feitos and p.get("legenda"):
            fila.append((p["arquivo"], titulo_de(p["legenda"]), p["legenda"]))
    for i in ler("youtube/plano.json")["fila"]:
        if f'{i["data"]} {i["hora"]}' <= agora and i["arquivo"] not in feitos:
            leg = posts.get(i["arquivo"], {}).get("legenda", "")
            fila.append((i["arquivo"], i["titulo"], leg))
    if not fila:
        print("nada para postar agora")
    if not dry:
        ok, nomes = canal_certo(token())
        if not ok:
            sys.exit(f"TOKEN DE OUTRO CANAL ({nomes}): não subi nada. Use o token do Radar GTA VI em YT_REFRESH_TOKEN_GTA")
    feitos_agora = 0
    for arq, tit, leg in fila:
        if feitos_agora >= POR_RODADA:
            break
        mp4 = achar_mp4(arq)
        if not mp4:
            print("SEM MP4 no branch (pulei):", arq)
            continue
        feitos_agora += 1
        if dry:
            print("postaria:", arq, "|", tit, "|", os.path.relpath(mp4, RAIZ))
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as d:
            d.write(leg + RODAPE)
        link = publicar(mp4, tit, open(d.name, encoding="utf-8").read(), TAGS)
        feitos[arq] = {"link": link, "titulo": tit, "quando": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
        with open(os.path.join(RAIZ, "youtube/publicados.json"), "w", encoding="utf-8") as f:
            json.dump(feitos, f, ensure_ascii=False, indent=1)
        print("postado:", arq, link)
    if len(fila) > feitos_agora:
        print(f"ficaram até {len(fila) - feitos_agora} para a próxima rodada")
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
        with open(os.path.join(RAIZ, "youtube/publicados.json"), "w", encoding="utf-8") as f:
            json.dump(feitos, f, ensure_ascii=False, indent=1)
        print("capa aplicada:" if ok else "vídeo removido, sem capa:", arq)


if __name__ == "__main__":
    main("--dry" in sys.argv)
