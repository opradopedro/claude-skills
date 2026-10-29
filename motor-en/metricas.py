"""Coleta os numeros dos videos dos canais (views, likes, comentarios) e guarda num CSV por canal. NAO GASTA CREDITO.

Roda todo dia pelo Crew (tarefa do tipo script). Cada rodada acrescenta uma linha por video em
metricas/<PREFIXO>.csv, com a data. Assim da para ver como cada video cresce dia a dia e comparar temas.

Uso manual: python motor-en/metricas.py            (os dois canais)
            python motor-en/metricas.py canal-classics
"""
import csv, datetime as dt, importlib.util, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
PASTA = os.path.join(RAIZ, "metricas")
CAMPOS = ["data", "codigo", "id", "titulo", "serie", "publicado_em", "horas_no_ar", "views", "likes", "comentarios"]


def _produce():
    spec = importlib.util.spec_from_file_location("produce_en", os.path.join(AQUI, "produce.py"))
    p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
    return p


def coletar(canal):
    p = _produce()
    c = p.ler_canal(os.path.join(RAIZ, "skills", canal)); p.aplicar_ambiente(c)
    import yt_upload
    yt_upload.configurar(c["prefixo"], c["idioma"])
    token = yt_upload.access_token()
    ja = yt_upload.publicados(token)
    if not ja:
        return f"{canal}: nenhum video ainda"
    ids = {v["id"]: k for k, v in ja.items()}
    agora = dt.datetime.now(dt.timezone.utc)
    os.makedirs(PASTA, exist_ok=True)
    arq = os.path.join(PASTA, c["prefixo"] + ".csv")
    novo = not os.path.exists(arq)
    linhas, total = [], 0
    lista = list(ids)
    for k in range(0, len(lista), 50):
        r = yt_upload.get("videos", token, part="snippet,statistics,status", id=",".join(lista[k:k + 50]))
        for v in r.get("items", []):
            pub = v["status"].get("publishAt") or v["snippet"].get("publishedAt")
            quando = dt.datetime.fromisoformat(pub.replace("Z", "+00:00")) if pub else agora
            if quando > agora:  # ainda agendado, sem numeros
                continue
            st = v.get("statistics", {})
            serie = next((t for t in v["snippet"].get("tags", []) if not t.startswith(c["prefixo"])), "")
            linhas.append({"data": agora.strftime("%Y-%m-%d"), "codigo": ids[v["id"]], "id": v["id"],
                           "titulo": v["snippet"]["title"], "serie": v["snippet"].get("title", "").split("|")[0][:60],
                           "publicado_em": pub, "horas_no_ar": round((agora - quando).total_seconds() / 3600, 1),
                           "views": st.get("viewCount", 0), "likes": st.get("likeCount", 0),
                           "comentarios": st.get("commentCount", 0)})
            total += int(st.get("viewCount", 0))
    with open(arq, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, CAMPOS)
        if novo:
            w.writeheader()
        w.writerows(linhas)
    return f"{canal}: {len(linhas)} videos no ar, {total} views no total"


if __name__ == "__main__":
    for canal in (sys.argv[1:] or ["canal-survival", "canal-classics"]):
        print(coletar(canal))
