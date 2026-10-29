#!/usr/bin/env python3
"""YouTube Data API para os canais em ingles. Copia do yt_upload.py do canal-terror,
com tres coisas a mais: prefixo do codigo configuravel, idioma configuravel e
CONFERENCIA DE CANAL (evita subir no canal errado quando varios canais usam a mesma conta Google).

Uso:
  python3 motor-en/yt_upload.py canal      --canal skills/canal-survival   # de quem e o token?
  python3 motor-en/yt_upload.py publicados --canal skills/canal-survival
  python3 motor-en/yt_upload.py subir video.json --canal skills/canal-survival

Credenciais SO em variavel de ambiente (nunca no repositorio, nunca no chat):
  YT_CLIENT_ID, YT_CLIENT_SECRET e a variavel apontada por YT_TOKEN_VAR (ex. YT_REFRESH_TOKEN_SURVIVAL).
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request

TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/youtube/v3"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"

PREFIXO = "SV"
IDIOMA = "en"


def configurar(prefixo, idioma):
    global PREFIXO, IDIOMA
    PREFIXO, IDIOMA = prefixo, idioma


def access_token():
    var = os.environ.get("YT_TOKEN_VAR", "YT_REFRESH_TOKEN_SURVIVAL")
    for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", var):
        if not os.environ.get(k):
            sys.exit(f"FALTA A VARIAVEL {k}: configure as chaves do canal antes de rodar (ver MANUAL-PEDRO.md)")
    dados = urllib.parse.urlencode({
        "client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
        "refresh_token": os.environ[var], "grant_type": "refresh_token"}).encode()
    try:
        with urllib.request.urlopen(TOKEN_URL, dados) as r:
            return json.load(r)["access_token"]
    except urllib.error.HTTPError as e:
        corpo = e.read().decode()
        if "invalid_grant" in corpo:
            sys.exit(f"{var} vencido ou revogado (app OAuth em modo teste vence em 7 dias): gerar outro no OAuth Playground")
        sys.exit(f"erro no token: {e.code} {corpo[:300]}")


def get(path, token, **q):
    url = f"{API}/{path}?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})) as r:
        return json.load(r)


def de_quem(token=None):
    """Titulo e id do canal a que o token pertence."""
    token = token or access_token()
    it = get("channels", token, part="snippet", mine="true")["items"][0]
    return {"titulo": it["snippet"]["title"], "id": it["id"]}


def verificar_canal(esperado, token=None):
    """TRAVA DE SEGURANCA: para tudo se o token for de outro canal.

    Varios canais na mesma conta Google compartilham o mesmo cliente OAuth: um token trocado
    publicaria no canal errado. Chamado antes de qualquer upload.
    """
    quem = de_quem(token)
    if not esperado:
        print(f"token do canal: {quem['titulo']} (sem conferencia: defina 'canal_titulo' no canal.json)", flush=True)
        return quem
    if quem["titulo"].strip().lower() != str(esperado).strip().lower():
        sys.exit(f"CANAL ERRADO: o token e do canal '{quem['titulo']}', mas o canal.json espera "
                 f"'{esperado}'. Nada foi enviado. Confira a variavel {os.environ.get('YT_TOKEN_VAR')}.")
    print(f"canal confirmado: {quem['titulo']}", flush=True)
    return quem


def _vale_status(st):
    return 2 if st.get("publishAt") else 1 if st.get("privacyStatus") == "public" else 0


def _vale(v):
    return _vale_status({"publishAt": v.get("publishAt"), "privacyStatus": v.get("privacidade")})


def publicados(token=None):
    """{codigo: {id, titulo, publishAt, privacidade}} dos videos do canal, achados pela tag do codigo."""
    token = token or access_token()
    ch = get("channels", token, part="contentDetails", mine="true")["items"][0]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, page = [], None
    while True:
        q = {"part": "contentDetails", "playlistId": uploads, "maxResults": 50}
        if page:
            q["pageToken"] = page
        r = get("playlistItems", token, **q)
        ids += [i["contentDetails"]["videoId"] for i in r.get("items", [])]
        page = r.get("nextPageToken")
        if not page or len(ids) >= 500:
            break
    padrao = re.compile(rf"{re.escape(PREFIXO)}\d{{3,}}")
    out = {}
    for k in range(0, len(ids), 50):
        for v in get("videos", token, part="snippet,status", id=",".join(ids[k:k + 50])).get("items", []):
            for tag in v["snippet"].get("tags", []):
                if padrao.fullmatch(tag):
                    if tag in out and _vale(out[tag]) >= _vale_status(v["status"]):
                        continue
                    out[tag] = {"id": v["id"], "titulo": v["snippet"]["title"],
                                "publishAt": v["status"].get("publishAt"),
                                "privacidade": v["status"]["privacyStatus"]}
    return out


def _post(path, token, corpo, **q):
    url = f"{API}/{path}?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, json.dumps(corpo).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def na_playlist(token, titulo, video_id):
    """Poe o video na playlist da serie (cria se nao existir). Custa 50 unidades por escrita."""
    pid = None
    for pl in get("playlists", token, part="snippet", mine="true", maxResults=50).get("items", []):
        if pl["snippet"]["title"] == titulo:
            pid = pl["id"]
    if not pid:
        pid = _post("playlists", token, {"snippet": {"title": titulo, "defaultLanguage": IDIOMA},
                                         "status": {"privacyStatus": "public"}}, part="snippet,status")["id"]
    _post("playlistItems", token,
          {"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": video_id}}},
          part="snippet")


def miniatura(token, video_id, imagem):
    """Thumbnail personalizada (canal verificado por telefone). JPG ate 2 MB. Custa 50 unidades."""
    url = f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={video_id}"
    req = urllib.request.Request(url, open(imagem, "rb").read(), method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "image/jpeg"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def subir(path, esperado=None):
    v = json.load(open(path, encoding="utf-8"))
    arquivo = v["arquivo"]
    if not os.path.isabs(arquivo):
        arquivo = os.path.join(os.path.dirname(os.path.abspath(path)), arquivo)
    status = {"privacyStatus": v.get("privacidad", "private"), "selfDeclaredMadeForKids": False,
              "containsSyntheticMedia": bool(v.get("sintetico", False)), "embeddable": True}
    if v.get("publicar_em"):
        status["privacyStatus"] = "private"
        status["publishAt"] = v["publicar_em"]
    # o YouTube recusa descricao com < ou > (erro 400 invalidDescription): troca por seta
    descricao = v.get("descripcion", "").replace(">", "▶").replace("<", "◀")
    corpo = {"snippet": {"title": v["titulo"][:100].replace(">", "").replace("<", ""),
                         "description": descricao[:4900],
                         "tags": v.get("tags", []), "categoryId": str(v.get("categoria", "24")),
                         "defaultLanguage": IDIOMA, "defaultAudioLanguage": IDIOMA},
             "status": status}
    token = access_token()
    verificar_canal(esperado, token)
    tamanho = os.path.getsize(arquivo)
    ini = urllib.request.Request(UPLOAD_URL, json.dumps(corpo).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(tamanho)})
    try:
        with urllib.request.urlopen(ini) as r:
            destino = r.headers["Location"]
        with open(arquivo, "rb") as f:
            envio = urllib.request.Request(destino, f.read(), method="PUT",
                                           headers={"Authorization": f"Bearer {token}",
                                                    "Content-Type": "video/mp4"})
        with urllib.request.urlopen(envio, timeout=600) as r:
            resp = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"upload falhou: {e.code} {e.read().decode()[:500]}")
    if v.get("serie_titulo"):
        try:
            na_playlist(token, v["serie_titulo"], resp["id"])
        except Exception as e:
            print("playlist falhou (o video subiu):", e, file=sys.stderr)
    if v.get("miniatura"):
        try:
            miniatura(token, resp["id"], v["miniatura"])
        except urllib.error.HTTPError as e:
            print("miniatura falhou (o video subiu):", e.code, e.read().decode()[:300], file=sys.stderr)
    st = resp.get("status", {})
    print(resp["id"], st.get("privacyStatus"), st.get("publishAt", ""))
    return resp


def _canal_do_argumento():
    """Para uso pela linha de comando: le o canal.json indicado por --canal."""
    if "--canal" not in sys.argv:
        return None
    pasta = sys.argv[sys.argv.index("--canal") + 1]
    c = json.load(open(os.path.join(pasta, "canal.json"), encoding="utf-8"))
    configurar(c["prefixo"], c.get("idioma", "en"))
    os.environ["YT_TOKEN_VAR"] = c["token_var"]
    return c


if __name__ == "__main__":
    c = _canal_do_argumento() or {}
    acao = sys.argv[1] if len(sys.argv) > 1 else ""
    if acao == "canal":
        print(json.dumps(de_quem(), ensure_ascii=False, indent=1))
    elif acao == "publicados":
        print(json.dumps(publicados(), ensure_ascii=False, indent=1))
    elif acao == "subir":
        subir(sys.argv[2], c.get("canal_titulo"))
    else:
        sys.exit(__doc__)
