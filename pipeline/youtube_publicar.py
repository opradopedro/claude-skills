"""Publica um mp4 vertical como YouTube Short (API oficial, upload resumível, só biblioteca padrão).

Lê YT_CLIENT_ID, YT_CLIENT_SECRET e YT_REFRESH_TOKEN do ambiente (nunca do repositório).
Uso: python3 pipeline/youtube_publicar.py video.mp4 "Título #Shorts" descricao.txt [tag1,tag2]
Imprime o link do Short. Se existir capas/<video>.jpg, tenta pôr como thumbnail (só funciona com o canal
verificado em youtube.com/verify; sem isso o YouTube devolve 403 e o Short fica com a capa automática).
"""
import json, os, sys, urllib.error, urllib.parse, urllib.request


def token():
    d = urllib.parse.urlencode({"client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
                                "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", d))["access_token"]


def por_capa(vid, jpg, tk=None):
    """thumbnails.set; devolve True se a capa entrou, False se o canal ainda não pode (403)."""
    with open(jpg, "rb") as f:
        r = urllib.request.Request(f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}",
                                   data=f.read(), method="POST",
                                   headers={"Authorization": f"Bearer {tk or token()}", "Content-Type": "image/jpeg"})
    try:
        urllib.request.urlopen(r, timeout=120)
        return True
    except urllib.error.HTTPError as e:
        if e.code in (400, 403):
            print("capa não aplicada:", e.code, e.read()[:300].decode("utf-8", "ignore"), file=sys.stderr)
            return False
        raise


def capa_de(mp4):
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    jpg = os.path.join(raiz, "capas", os.path.splitext(os.path.basename(mp4))[0] + ".jpg")
    return jpg if os.path.exists(jpg) else None


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
    if capa_de(mp4):
        por_capa(vid, capa_de(mp4), tk)
    return f"https://youtube.com/shorts/{vid}"


if __name__ == "__main__":
    mp4, titulo, desc = sys.argv[1], sys.argv[2], open(sys.argv[3], encoding="utf-8").read()
    tags = sys.argv[4].split(",") if len(sys.argv) > 4 else ["gta 6", "gta vi", "gta 6 brasil"]
    print(publicar(mp4, titulo, desc, tags))
