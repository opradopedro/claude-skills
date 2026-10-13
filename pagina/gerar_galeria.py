#!/usr/bin/env python3
"""Gera a página "Vídeos do Radar GTA" (artifact) a partir de agenda.json e metricas.json.

Uso (da raiz do branch): python3 pagina/gerar_galeria.py SAIDA
Escreve SAIDA/index.html e as prévias leves SAIDA/v/<id>.mp4 e .jpg (540 px, ~2 MB), só as que faltarem.
Depois publique com o Artifact tool: file_path SAIDA/index.html, files {"v/<id>.mp4": ..., "v/<id>.jpg": ...}
e o mesmo url do artifact (ver memória radar-gta6-rotina-nova). As notas do Pedro ficam no db do artifact,
coleção "avaliacoes", um documento por id.
"""
import json, os, re, subprocess, sys
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOSTRAR_POSTADOS = 12  # os mais recentes


def vid_id(arquivo):
    return re.sub(r"[^a-z0-9]+", "_", os.path.splitext(arquivo.lower())[0]).strip("_")


def titulo(legenda):
    linha = (legenda or "").strip().split("\n")[0]
    return re.sub(r"[^\w\s?!,.:%$()/'\"-]", "", linha).strip() or "Reel"


def previa(origem, dest_mp4, dest_jpg):
    if not os.path.exists(dest_mp4):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", origem, "-vf", "scale=720:-2:flags=lanczos", "-c:v", "libx264",
                        "-preset", "medium", "-crf", "24", "-c:a", "aac", "-b:a", "80k", "-movflags", "+faststart",
                        dest_mp4], check=True)
    if not os.path.exists(dest_jpg):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.5", "-i", origem, "-frames:v", "1", "-vf",
                        "scale=270:-2", "-q:v", "5", dest_jpg], check=True)


def main(saida):
    os.makedirs(os.path.join(saida, "v"), exist_ok=True)
    agenda = json.load(open(os.path.join(RAIZ, "agenda.json"), encoding="utf-8"))["posts"]
    try:
        metricas = json.load(open(os.path.join(RAIZ, "metricas.json"), encoding="utf-8"))
    except FileNotFoundError:
        metricas = {}
    postados = [p for p in agenda if p.get("status") == "postado" and p.get("arquivo")]
    postados = sorted(postados, key=lambda p: p["data"] + p["hora"])[-MOSTRAR_POSTADOS:]
    fila = [p for p in agenda if p.get("status") == "pendente" and p.get("arquivo")]
    itens, arquivos = [], []
    for p in postados + fila:
        origem = os.path.join(RAIZ, p["arquivo"])
        if not os.path.exists(origem):
            print("sem arquivo, pulei:", p["arquivo"]); continue
        i = vid_id(p["arquivo"])
        previa(origem, os.path.join(saida, "v", i + ".mp4"), os.path.join(saida, "v", i + ".jpg"))
        item = {"id": i, "data": p["data"], "hora": p["hora"], "status": p["status"], "link": p.get("link"),
                "legenda": p.get("legenda") or "", "titulo": titulo(p.get("legenda"))}
        code = (p.get("link") or "").rstrip("/").split("/")[-1]
        m = (metricas.get(code) or {}).get("atual")
        if m:
            item["numeros"] = {"views": m.get("playCount") or 0, "curtidas": m.get("likeCount") or 0,
                               "pulos": round(m.get("skipRate") or 0)}
        itens.append(item); arquivos += [f"v/{i}.mp4", f"v/{i}.jpg"]
    agora = datetime.now(timezone(timedelta(hours=-3))).strftime("%d/%m às %Hh%M")
    tpl = open(os.path.join(RAIZ, "pagina", "galeria.tpl.html"), encoding="utf-8").read()
    html = tpl.replace("/*ATUALIZADO*/\"\"", json.dumps(agora)).replace(
        "/*ITENS*/[]", json.dumps(itens, ensure_ascii=False).replace("</", "<\\/"))
    open(os.path.join(saida, "index.html"), "w", encoding="utf-8").write(html)
    json.dump({p: os.path.join(saida, p) for p in arquivos}, open(os.path.join(saida, "files.json"), "w"), indent=1)
    print(len(itens), "vídeos na página;", "mapa de arquivos em", os.path.join(saida, "files.json"))


if __name__ == "__main__":
    main(sys.argv[1])
