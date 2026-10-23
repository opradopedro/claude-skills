#!/usr/bin/env python3
"""Monta o documento de um canal para o "Painel dos canais" (https://claude.ai/artifact/2SptRCzSbXHuKHPzct4Tu2).

O painel guarda tudo no banco do artifact: um documento por canal em `canais/<canal>` com a lista de vídeos,
e os vídeos como assets do artifact. Este script lê os dados do canal, compara com o documento atual,
reduz só os vídeos novos ou refeitos e escreve o documento novo.

Uso (veja README.md para o passo a passo completo da rotina):

  python3 painel.py --canal hm  --stories skills/canal-terror/stories     --videos /mnt/project-files/canal-terror/videos     --atual A --saida S
  python3 painel.py --canal yb  --stories skills/canal-engenharia/stories --videos /mnt/project-files/canal-engenharia/videos --atual A --saida S
  python3 painel.py --canal gta --radar <raiz do branch radar-gta6-midia> --atual A --saida S

--atual é o JSON do documento canais/<canal> salvo pelo ArtifactData get (pode não existir na primeira vez).
Saída: S/subir.json (arquivos a enviar como asset; lista vazia se nada mudou) e S/doc.json.
Depois do upload, grave S/urls.json ({"caminho local": "url do asset"}) e rode de novo o mesmo comando com
--urls S/urls.json: doc.json sai completo, pronto para o ArtifactData set.
"""
import argparse, glob, hashlib, json, os, re, subprocess
from datetime import datetime, timezone

POSTADOS_GTA = 1000  # todos os Reels postados (o Pedro quer o histórico inteiro no painel)


def sha(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()[:16]


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def previa(origem, destino, alta):
    """Cópia leve para o painel (asset até 20 MB). alta=True mantém 1080p para o Pedro baixar e repostar."""
    if alta:
        ff("-i", origem, "-vf", "scale=1080:-2:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "22",
           "-maxrate", "2800k", "-bufsize", "5600k", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", destino)
    else:
        ff("-i", origem, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast",
           "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", destino)


def quadro(origem, destino):
    ff("-ss", "1.5", "-i", origem, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "5", destino)


def de_stories(canal, stories, videos):
    """Hora Muerta e So You Built It: roteiros em stories/*.json e, por código, <cod>.mp4/.jpg/.json em --videos."""
    itens = []
    for f in sorted(glob.glob(os.path.join(stories, "*.json"))):
        h = json.load(open(f, encoding="utf-8"))
        c = h["codigo"]
        linhas = [l["texto"] if isinstance(l, dict) else l for l in h.get("lineas", [])]
        it = {"codigo": c, "titulo": h["titulo"], "roteiro": linhas, "estado": "roteiro"}
        if h.get("partes", 1) > 1:
            it.update({"serie": h.get("serie", c), "serie_titulo": re.sub(r"\s*\|.*$", "", h.get("serie_titulo", h["titulo"])),
                       "parte": h.get("parte", 1), "partes": h["partes"]})
        if h.get("formato"):
            it["formato"] = h["formato"]
        meta = os.path.join(videos, c + ".json")
        if os.path.exists(meta):
            m = json.load(open(meta, encoding="utf-8"))
            if m.get("titulo"):
                it["titulo"] = m["titulo"]
            if m.get("url"):
                it["links"] = [{"nome": "YouTube", "url": m["url"]}]
            if m.get("publishAt"):
                it["quando"] = m["publishAt"]
            it["estado"] = "agendado" if m.get("url") else "pronto"
        mp4, jpg = os.path.join(videos, c + ".mp4"), os.path.join(videos, c + ".jpg")
        if os.path.exists(mp4):
            it["_mp4"] = mp4
            it["_jpg"] = jpg if os.path.exists(jpg) else None
            if it["estado"] == "roteiro":
                it["estado"] = "pronto"
        itens.append(it)
    return itens


def titulo_legenda(leg):
    linha = (leg or "").strip().split("\n")[0]
    return re.sub(r"[^\w\s?!,.:%$()/'\"-]", "", linha).strip() or "Reel"


def de_radar(raiz):
    """Radar GTA VI: agenda.json (Reels), metricas.json (números do Insta) e youtube/publicados.json (Shorts)."""
    agenda = json.load(open(os.path.join(raiz, "agenda.json"), encoding="utf-8"))["posts"]
    def ler(p):
        try:
            return json.load(open(os.path.join(raiz, p), encoding="utf-8"))
        except FileNotFoundError:
            return {}
    metricas, yt = ler("metricas.json"), ler("youtube/publicados.json")
    post = sorted([p for p in agenda if p.get("status") == "postado" and p.get("arquivo")], key=lambda p: p["data"] + p["hora"])[-POSTADOS_GTA:]
    fila = [p for p in agenda if p.get("status") == "pendente" and p.get("arquivo")]
    itens = []
    for p in post + fila:
        cod = re.sub(r"[^a-z0-9]+", "_", os.path.splitext(p["arquivo"].lower())[0]).strip("_")
        it = {"codigo": cod, "titulo": titulo_legenda(p.get("legenda")), "legenda": p.get("legenda") or "",
              "quando": f"{p['data']}T{p['hora']}:00-03:00", "estado": "postado" if p["status"] == "postado" else "pronto", "links": []}
        if p.get("link"):
            it["links"].append({"nome": "Instagram", "url": p["link"]})
        y = (yt.get(p["arquivo"]) or {}).get("link") or ""
        if y.startswith("http"):
            it["links"].append({"nome": "Shorts", "url": y})
        code = (p.get("link") or "").rstrip("/").split("/")[-1]
        m = (metricas.get(code) or {}).get("atual")
        if m:
            it["numeros"] = {"views": m.get("playCount") or 0, "curtidas": m.get("likeCount") or 0, "pulos": round(m.get("skipRate") or 0)}
        mp4 = os.path.join(raiz, p["arquivo"])
        if os.path.exists(mp4):
            it["_mp4"], it["_jpg"] = mp4, None
        itens.append(it)
    return itens


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--canal", required=True, choices=["hm", "gta", "yb"])
    ap.add_argument("--stories"); ap.add_argument("--videos"); ap.add_argument("--radar")
    ap.add_argument("--atual", help="JSON atual de canais/<canal> (ArtifactData get)")
    ap.add_argument("--saida", required=True)
    ap.add_argument("--urls", help="JSON {caminho local: url do asset} depois do upload")
    a = ap.parse_args()
    os.makedirs(a.saida, exist_ok=True)

    itens = de_radar(a.radar) if a.canal == "gta" else de_stories(a.canal, a.stories, a.videos)
    atual = {}
    if a.atual and os.path.exists(a.atual):
        d = json.load(open(a.atual, encoding="utf-8"))
        d = d.get("data", d)  # aceita o arquivo do ArtifactData com ou sem envelope
        atual = {i["codigo"]: i for i in d.get("itens", [])}
    urls = json.load(open(a.urls)) if a.urls else {}

    subir = []
    for it in itens:
        mp4, jpg = it.pop("_mp4", None), it.pop("_jpg", None)
        velho = atual.get(it["codigo"], {})
        if not mp4:
            for k in ("video", "capa", "video_sha"):
                if velho.get(k):
                    it[k] = velho[k]
            continue
        s = sha(mp4)
        if velho.get("video") and velho.get("video_sha", s) == s:
            it.update({k: velho[k] for k in ("video", "capa") if velho.get(k)})
            it["video_sha"] = s
            continue
        pv = os.path.join(a.saida, f"{it['codigo']}.mp4")
        pc = os.path.join(a.saida, f"{it['codigo']}.jpg")
        if not os.path.exists(pv):
            previa(mp4, pv, alta=a.canal == "gta")
        if not os.path.exists(pc):
            if jpg:
                ff("-i", jpg, "-vf", "scale=360:-2", "-q:v", "5", pc)
            else:
                quadro(mp4, pc)
        if pv in urls:
            it["video"], it["video_sha"] = urls[pv], s
            if pc in urls:
                it["capa"] = urls[pc]
        else:
            subir += [pv, pc]

    doc = {"canal": a.canal, "atualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "itens": itens}
    json.dump(doc, open(os.path.join(a.saida, "doc.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(subir, open(os.path.join(a.saida, "subir.json"), "w"), indent=1)
    if subir:
        print(f"SUBIR {len(subir)} arquivos (lista em {a.saida}/subir.json). Envie como asset, grave urls.json e rode de novo com --urls.")
    else:
        print(f"PRONTO {len(itens)} vídeos em {a.saida}/doc.json")


if __name__ == "__main__":
    main()
