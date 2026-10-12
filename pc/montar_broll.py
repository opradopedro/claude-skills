#!/usr/bin/env python3
"""Roda no PC do Pedro (Windows, Mac ou Linux) para montar o banco de b-roll em movimento.

A nuvem nao alcanca o YouTube; o PC alcanca. Este script:
1. instala yt-dlp e um ffmpeg (imageio-ffmpeg) se faltar;
2. baixa os videos OFICIAIS de GTA VI do canal da Rockstar (trailers), em ate 1080p;
3. corta cada video nas trocas de cena, em clipes de 1,5 a 4 s, sem audio;
4. descarta clipes escuros ou de cartela (logo, texto), gera index.json e uma folha de contato;
5. empacota tudo em broll_radar.zip para subir no branch radar-gta6-broll.

Uso: python montar_broll.py [pasta_de_saida]
Nunca use material vazado: so videos publicados pela Rockstar.
"""
import json, os, re, subprocess, sys, zipfile

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "broll_radar")
CANAL = "https://www.youtube.com/@RockstarGames/videos"
FILTRO = re.compile(r"grand theft auto vi\b|gta vi\b|gta 6", re.I)
# garantidos mesmo se a listagem do canal falhar (Trailer 1 e Trailer 2)
FIXOS = ["https://www.youtube.com/watch?v=QdBZY2fkU-0", "https://www.youtube.com/watch?v=VQRLujxTm3c"]
MIN_S, MAX_S = 1.5, 4.0


def pip(*pk):
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--upgrade", *pk], check=True)


def ffmpeg_bin():
    for b in ("ffmpeg",):
        try:
            subprocess.run([b, "-version"], capture_output=True, check=True)
            return b
        except Exception:
            pass
    pip("imageio-ffmpeg")
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)


def listar_videos():
    r = run([sys.executable, "-m", "yt_dlp", "--flat-playlist", "--print", "%(id)s\t%(title)s", CANAL])
    urls = []
    for ln in r.stdout.splitlines():
        vid, _, title = ln.partition("\t")
        if FILTRO.search(title) and "leak" not in title.lower():
            urls.append(f"https://www.youtube.com/watch?v={vid}")
    for u in FIXOS:
        if u not in urls:
            urls.append(u)
    return urls


def baixar(urls, pasta, ff):
    os.makedirs(pasta, exist_ok=True)
    run([sys.executable, "-m", "yt_dlp", "--ffmpeg-location", ff, "-f", "bv*[height<=1080][ext=mp4]/bv*[height<=1080]",
         "-o", os.path.join(pasta, "%(id)s.%(ext)s"), "--no-playlist", "--restrict-filenames", *urls])
    return sorted(os.path.join(pasta, f) for f in os.listdir(pasta) if f.endswith((".mp4", ".webm", ".mkv")))


def duracao(ff, p):
    r = run([ff, "-i", p])
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def cortes(ff, p):
    r = run([ff, "-i", p, "-vf", "select='gt(scene,0.32)',showinfo", "-an", "-f", "null", "-"])
    return [float(x) for x in re.findall(r"pts_time:([\d.]+)", r.stderr)]


def brilho(ff, p, t):
    r = run([ff, "-ss", f"{t:.2f}", "-i", p, "-frames:v", "1", "-vf", "scale=64:36,signalstats,metadata=print",
             "-f", "null", "-"])
    m = re.search(r"YAVG=([\d.]+)", r.stderr)
    return float(m.group(1)) if m else 0.0


def main():
    pip("yt-dlp")
    ff = ffmpeg_bin()
    fontes = baixar(listar_videos(), os.path.join(OUT, "fontes"), ff)
    clips_dir = os.path.join(OUT, "clips"); os.makedirs(clips_dir, exist_ok=True)
    index = []
    for src in fontes:
        base = os.path.splitext(os.path.basename(src))[0]
        dur = duracao(ff, src)
        pts = [0.0] + cortes(ff, src) + [dur]
        n = 0
        for a, b in zip(pts, pts[1:]):
            a, b = a + 0.12, b - 0.12  # evita o quadro da transicao
            while b - a >= MIN_S:
                e = min(b, a + MAX_S)
                mid = (a + e) / 2
                if brilho(ff, src, mid) > 28:  # pula tela preta e cartela escura
                    nome = f"{base}_{n:03d}.mp4"
                    run([ff, "-y", "-ss", f"{a:.2f}", "-i", src, "-t", f"{e - a:.2f}", "-an",
                         "-vf", "scale=-2:1080", "-c:v", "libx264", "-preset", "medium", "-crf", "22",
                         "-pix_fmt", "yuv420p", os.path.join(clips_dir, nome)])
                    run([ff, "-y", "-ss", f"{mid:.2f}", "-i", src, "-frames:v", "1", "-vf", "scale=320:-2",
                         os.path.join(clips_dir, nome.replace(".mp4", ".jpg"))])
                    index.append({"file": f"clips/{nome}", "fonte": base, "t": round(a, 2),
                                  "dur": round(e - a, 2), "tags": []})
                    n += 1
                a = e
        print(base, "->", n, "clipes")
    json.dump(index, open(os.path.join(OUT, "index.json"), "w"), indent=1)
    z = os.path.join(os.path.dirname(OUT), "broll_radar.zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        zf.write(os.path.join(OUT, "index.json"), "index.json")
        for f in os.listdir(clips_dir):
            zf.write(os.path.join(clips_dir, f), f"clips/{f}")
    print("pronto:", len(index), "clipes em", z, round(os.path.getsize(z) / 1e6), "MB")


if __name__ == "__main__":
    main()
