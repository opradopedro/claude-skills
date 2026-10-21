"""Posta no YouTube Shorts o que estiver na hora (roda nos horários da rotina do YouTube).

1. Reels novos: todo item "postado" no agenda.json a partir de 21/10 que ainda não está em youtube/publicados.json.
2. Fila de antigos: itens de youtube/plano.json com data e hora já vencidas (Brasília) e ainda não postados.
No máximo 2 envios por rodada. Grava os links em youtube/publicados.json (o commit e o push ficam com quem chama).
Uso: python3 pipeline/youtube_rotina.py [--dry]
"""
import datetime, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from youtube_publicar import publicar

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INICIO_NOVOS = "2026-10-21"
RODAPE = "\n\nSe inscreve pra acompanhar tudo de GTA 6 até o lançamento 🔔"
TAGS = ["gta 6", "gta vi", "gta 6 brasil", "gta 6 noticias", "grand theft auto 6"]


def ler(nome):
    with open(os.path.join(RAIZ, nome), encoding="utf-8") as f:
        return json.load(f)


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
    for arq, tit, leg in fila[:2]:
        if dry:
            print("postaria:", arq, "|", tit)
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as d:
            d.write(leg + RODAPE)
        link = publicar(os.path.join(RAIZ, arq), tit, open(d.name, encoding="utf-8").read(), TAGS)
        feitos[arq] = {"link": link, "titulo": tit, "quando": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
        with open(os.path.join(RAIZ, "youtube/publicados.json"), "w", encoding="utf-8") as f:
            json.dump(feitos, f, ensure_ascii=False, indent=1)
        print("postado:", arq, link)
    if len(fila) > 2:
        print(f"ficaram {len(fila) - 2} para a próxima rodada")


if __name__ == "__main__":
    main("--dry" in sys.argv)
