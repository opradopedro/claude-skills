"""Publica um mp4 vertical como YouTube Short (API oficial, upload resumível, só biblioteca padrão).

Lê YT_CLIENT_ID, YT_CLIENT_SECRET e YT_REFRESH_TOKEN do ambiente (nunca do repositório).
Uso: python3 pipeline/youtube_publicar.py video.mp4 "Título #Shorts" descricao.txt [tag1,tag2]
Imprime o link do Short.
"""
import json, os, sys, urllib.parse, urllib.request


def token():
    d = urllib.parse.urlencode({"client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
                                "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", d))["access_token"]


def publicar(mp4, titulo, descricao, tags):
    tk = token()
    meta = {"snippet": {"title": titulo[:100], "description": descricao[:5000], "tags": tags, "categoryId": "20",
                        "defaultLanguage": "pt-BR", "defaultAudioLanguage": "pt-BR"},
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False, "containsSyntheticMedia": False}}
    tam = os.path.getsize(mp4)
    ini = urllib.request.Request(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        data=json.dumps(meta).encode(), method="POST",
        headers={"Authorization": f"Bearer {tk}", "Content-Type": "application/json; charset=UTF-8",
                 "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(tam)})
    destino = urllib.request.urlopen(ini).headers["Location"]
    with open(mp4, "rb") as f:
        up = urllib.request.Request(destino, data=f.read(), method="PUT",
                                    headers={"Authorization": f"Bearer {tk}", "Content-Type": "video/mp4"})
    vid = json.load(urllib.request.urlopen(up, timeout=600))["id"]
    return f"https://youtube.com/shorts/{vid}"


if __name__ == "__main__":
    mp4, titulo, desc = sys.argv[1], sys.argv[2], open(sys.argv[3], encoding="utf-8").read()
    tags = sys.argv[4].split(",") if len(sys.argv) > 4 else ["gta 6", "gta vi", "gta 6 brasil"]
    print(publicar(mp4, titulo, desc, tags))
