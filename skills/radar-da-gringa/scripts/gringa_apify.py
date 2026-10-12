#!/usr/bin/env python3
"""Pesquisa de virais de GTA 6 na gringa pelo Apify (substitui a busca de outliers do vidIQ).

Uso (a partir da raiz do branch):
  python3 pipeline/gringa_apify.py checar                 # testa o acesso (imprime OK ou o código do erro)
  python3 pipeline/gringa_apify.py virais [AAAA-MM-DD]    # TikTok + Instagram dos últimos 3 dias -> pesquisa/AAAA-MM-DD.json
  python3 pipeline/gringa_apify.py concorrentes @a @b ... # Reels recentes dessas páginas -> pesquisa/concorrentes-AAAA-MM-DD.json

Chave: variável APIFY_TOKEN ou, sem ela, o segredo de rede do ambiente (injetado para api.apify.com).
Nunca imprimir nem gravar a chave.
Custo: os atores são cobrados por resultado; os limites abaixo mantêm cada execução pequena (umas 50 linhas).
Regra de mídia: daqui sai só o ASSUNTO (texto, números, link para checar). Vídeo e imagem de outras páginas
nunca são baixados nem republicados; o visual continua sendo só material oficial da Rockstar.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.apify.com/v2"
UA = "apify-agent-skills/apify-ultimate-scraper"
HASHTAGS = ["gta6", "gtavi", "gta6news"]
MIN_VIEWS = 50_000
DIAS = 3


def chamar(metodo, caminho, corpo=None, timeout=300):
    hdr = {"Content-Type": "application/json", "User-Agent": UA}
    tok = os.environ.get("APIFY_TOKEN", "")
    if tok:
        hdr["Authorization"] = f"Bearer {tok}"
    req = urllib.request.Request(API + caminho, json.dumps(corpo).encode() if corpo is not None else None, hdr,
                                 method=metodo)
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def ator(actor_id, entrada, timeout=300):
    """Roda o ator e devolve os itens do dataset (run-sync, até 5 min)."""
    caminho = f"/acts/{actor_id.replace('/', '~')}/run-sync-get-dataset-items?timeout={timeout - 20}"
    for tent in range(3):
        try:
            return chamar("POST", caminho, entrada, timeout)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and tent < 2:
                time.sleep(15 * (tent + 1)); continue
            raise


def checar():
    try:
        chamar("GET", "/users/me", timeout=30)
        print("Apify: OK")
    except urllib.error.HTTPError as e:
        print(f"Apify: FALHOU (HTTP {e.code})"); sys.exit(1)
    except Exception as e:  # rede bloqueada etc.
        print(f"Apify: FALHOU ({type(e).__name__})"); sys.exit(1)


def num(*v):
    for x in v:
        if isinstance(x, (int, float)):
            return int(x)
    return 0


def tiktok(desde):
    itens = ator("clockworks/tiktok-scraper", {
        "hashtags": HASHTAGS, "resultsPerPage": 15, "shouldDownloadVideos": False,
        "shouldDownloadCovers": False, "shouldDownloadSubtitles": False, "proxyCountryCode": "US"})
    out = []
    for i in itens:
        quando = i.get("createTimeISO") or ""
        if quando and quando < desde:
            continue
        out.append({"plataforma": "tiktok", "url": i.get("webVideoUrl"), "autor": (i.get("authorMeta") or {}).get("name"),
                    "texto": (i.get("text") or "")[:400], "views": num(i.get("playCount")),
                    "curtidas": num(i.get("diggCount")), "comentarios": num(i.get("commentCount")),
                    "compart": num(i.get("shareCount")), "salvos": num(i.get("collectCount")), "data": quando})
    return out


def instagram(desde):
    itens = ator("apify/instagram-hashtag-scraper", {"hashtags": HASHTAGS[:2], "resultsLimit": 15,
                                                      "resultsType": "reels"})
    out = []
    for i in itens:
        quando = i.get("timestamp") or ""
        if quando and quando < desde:
            continue
        out.append({"plataforma": "instagram", "url": i.get("url"), "autor": i.get("ownerUsername"),
                    "texto": (i.get("caption") or "")[:400], "views": num(i.get("videoPlayCount"), i.get("videoViewCount")),
                    "curtidas": num(i.get("likesCount")), "comentarios": num(i.get("commentsCount")),
                    "compart": 0, "salvos": 0, "data": quando})
    return out


def virais(dia):
    desde = (datetime.now(timezone.utc) - timedelta(days=DIAS)).strftime("%Y-%m-%dT%H:%M")
    todos, erros = [], []
    for fonte in (tiktok, instagram):
        try:
            todos += fonte(desde)
        except Exception as e:
            erros.append(f"{fonte.__name__}: {type(e).__name__} {getattr(e, 'code', '')}".strip())
    vistos, lista = set(), []
    for p in sorted(todos, key=lambda p: -p["views"]):
        if p["url"] and p["url"] not in vistos and p["views"] >= MIN_VIEWS:
            vistos.add(p["url"]); lista.append(p)
    os.makedirs(os.path.join(RAIZ, "pesquisa"), exist_ok=True)
    caminho = os.path.join(RAIZ, "pesquisa", f"{dia}.json")
    json.dump({"fonte": "apify", "gerado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
               "criterio": f"#{', #'.join(HASHTAGS)}, últimos {DIAS} dias, {MIN_VIEWS}+ views", "erros": erros,
               "posts": lista}, open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(lista), "virais em", os.path.relpath(caminho, RAIZ), "| erros:", erros or "nenhum")
    if not lista and erros:
        sys.exit(1)


def concorrentes(handles, dia):
    itens = ator("apify/instagram-reel-scraper", {"username": [h.lstrip("@") for h in handles], "resultsLimit": 10})
    lista = [{"autor": i.get("ownerUsername"), "url": i.get("url"), "texto": (i.get("caption") or "")[:300],
              "views": num(i.get("videoPlayCount"), i.get("videoViewCount")), "curtidas": num(i.get("likesCount")),
              "comentarios": num(i.get("commentsCount")), "duracao": i.get("videoDuration"), "data": i.get("timestamp")}
             for i in itens]
    lista.sort(key=lambda p: -p["views"])
    caminho = os.path.join(RAIZ, "pesquisa", f"concorrentes-{dia}.json")
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    json.dump({"fonte": "apify", "paginas": handles, "posts": lista}, open(caminho, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(len(lista), "reels em", os.path.relpath(caminho, RAIZ))


if __name__ == "__main__":
    hoje = datetime.now(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "checar"
    if cmd == "checar":
        checar()
    elif cmd == "virais":
        virais(sys.argv[2] if len(sys.argv) > 2 else hoje)
    elif cmd == "concorrentes":
        concorrentes(sys.argv[2:], hoje)
