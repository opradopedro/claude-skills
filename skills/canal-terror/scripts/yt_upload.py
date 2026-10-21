#!/usr/bin/env python3
"""YouTube Data API do canal Hora Muerta: subir video agendado e listar o que ja foi subido.

Uso:
  python3 yt_upload.py subir video.json      # sobe e imprime "id privacidade publishAt"
  python3 yt_upload.py publicados            # JSON com {codigo: {id, titulo, publishAt, privacidade}}
video.json: {"arquivo", "titulo", "descripcion", "tags", "publicar_em" (UTC ISO, opcional), "sintetico"}

Credenciais so nas variaveis de ambiente (nunca no repositorio nem no chat):
YT_CLIENT_ID, YT_CLIENT_SECRET e YT_REFRESH_TOKEN_ES (YT_TOKEN_VAR muda o nome da ultima, ex. YT_REFRESH_TOKEN_EN).
Com o app OAuth em modo "teste" o refresh token vence em 7 dias: erro invalid_grant = gerar outro no Playground.
Upload custa 1.600 unidades da cota diaria (10.000): ate 6 videos por dia.
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request

TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/youtube/v3"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"


def access_token():
    var = os.environ.get("YT_TOKEN_VAR", "YT_REFRESH_TOKEN_ES")
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


def publicados(token=None):
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
    out = {}
    for k in range(0, len(ids), 50):
        for v in get("videos", token, part="snippet,status", id=",".join(ids[k:k + 50])).get("items", []):
            for tag in v["snippet"].get("tags", []):
                if re.fullmatch(r"HM\d{3,}", tag):
                    out[tag] = {"id": v["id"], "titulo": v["snippet"]["title"],
                                "publishAt": v["status"].get("publishAt"), "privacidade": v["status"]["privacyStatus"]}
    return out


def subir(path):
    v = json.load(open(path, encoding="utf-8"))
    arquivo = v["arquivo"]
    if not os.path.isabs(arquivo):
        arquivo = os.path.join(os.path.dirname(os.path.abspath(path)), arquivo)
    status = {"privacyStatus": v.get("privacidad", "private"), "selfDeclaredMadeForKids": False,
              "containsSyntheticMedia": bool(v.get("sintetico", False)), "embeddable": True}
    if v.get("publicar_em"):
        status["privacyStatus"] = "private"; status["publishAt"] = v["publicar_em"]
    corpo = {"snippet": {"title": v["titulo"][:100], "description": v.get("descripcion", "")[:4900],
                         "tags": v.get("tags", []), "categoryId": str(v.get("categoria", "24")),
                         "defaultLanguage": "es", "defaultAudioLanguage": "es"}, "status": status}
    token = access_token()
    tamanho = os.path.getsize(arquivo)
    ini = urllib.request.Request(UPLOAD_URL, json.dumps(corpo).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(tamanho)})
    try:
        with urllib.request.urlopen(ini) as r:
            destino = r.headers["Location"]
        with open(arquivo, "rb") as f:
            envio = urllib.request.Request(destino, f.read(), method="PUT",
                                           headers={"Authorization": f"Bearer {token}", "Content-Type": "video/mp4"})
        with urllib.request.urlopen(envio, timeout=600) as r:
            resp = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"upload falhou: {e.code} {e.read().decode()[:500]}")
    st = resp.get("status", {})
    print(resp["id"], st.get("privacyStatus"), st.get("publishAt", ""))
    return resp


if __name__ == "__main__":
    if sys.argv[1] == "publicados":
        print(json.dumps(publicados(), ensure_ascii=False, indent=1))
    elif sys.argv[1] == "subir":
        subir(sys.argv[2])
    else:
        sys.exit(__doc__)
