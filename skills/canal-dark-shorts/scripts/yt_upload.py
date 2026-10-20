#!/usr/bin/env python3
"""Sobe um Short para o YouTube pela YouTube Data API (videos.insert, upload retomavel).

Uso: python3 yt_upload.py video.json
video.json:
{
  "arquivo": "video.mp4", "titulo": "Por que nenhum aviao passa por cima do Tibete?",
  "descricao": "...", "tags": ["curiosidades"], "categoria": "27",
  "privacidade": "private", "publicar_em": "2026-10-21T15:00:00Z",
  "sintetico": false
}
"publicar_em" (UTC) so vale com "privacidade": "private"; o YouTube publica sozinho na hora.
"sintetico": true marca o video como conteudo alterado ou sintetico realista.

Credenciais nas variaveis de ambiente YT_CLIENT_ID, YT_CLIENT_SECRET e YT_REFRESH_TOKEN
(OAuth de um projeto do Google Cloud com a YouTube Data API ativada, escopo youtube.upload).
Projeto nao auditado pelo Google so consegue subir como privado: o video fica travado em
privado ate a auditoria, mesmo pedindo "public" ou "publicar_em".
Upload custa 1.600 unidades da cota diaria da API (padrao 10.000, cerca de 6 videos por dia).
Imprime o id do video no fim.
"""
import json, os, sys, urllib.parse, urllib.request

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = ("https://www.googleapis.com/upload/youtube/v3/videos"
              "?uploadType=resumable&part=snippet,status")


def access_token():
    dados = urllib.parse.urlencode({
        "client_id": os.environ["YT_CLIENT_ID"],
        "client_secret": os.environ["YT_CLIENT_SECRET"],
        "refresh_token": os.environ["YT_REFRESH_TOKEN"],
        "grant_type": "refresh_token",
    }).encode()
    with urllib.request.urlopen(TOKEN_URL, dados) as r:
        return json.load(r)["access_token"]


def corpo(v):
    status = {"privacyStatus": v.get("privacidade", "private"),
              "selfDeclaredMadeForKids": False,
              "containsSyntheticMedia": bool(v.get("sintetico", False))}
    if v.get("publicar_em"):
        status["privacyStatus"] = "private"
        status["publishAt"] = v["publicar_em"]
    return {"snippet": {"title": v["titulo"][:100], "description": v.get("descricao", ""),
                        "tags": v.get("tags", []), "categoryId": str(v.get("categoria", "24")),
                        "defaultLanguage": "pt-BR", "defaultAudioLanguage": "pt-BR"},
            "status": status}


def main(path):
    v = json.load(open(path, encoding="utf-8"))
    arquivo = v["arquivo"]
    if not os.path.isabs(arquivo):
        arquivo = os.path.join(os.path.dirname(os.path.abspath(path)), arquivo)
    tamanho = os.path.getsize(arquivo)
    token = access_token()

    inicio = urllib.request.Request(UPLOAD_URL, json.dumps(corpo(v)).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": str(tamanho),
    })
    with urllib.request.urlopen(inicio) as r:
        destino = r.headers["Location"]

    with open(arquivo, "rb") as f:
        envio = urllib.request.Request(destino, f.read(), method="PUT", headers={
            "Authorization": f"Bearer {token}", "Content-Type": "video/mp4"})
    with urllib.request.urlopen(envio) as r:
        resposta = json.load(r)
    print(resposta["id"], resposta["status"].get("privacyStatus"), resposta["status"].get("publishAt", ""))


if __name__ == "__main__":
    main(sys.argv[1])
