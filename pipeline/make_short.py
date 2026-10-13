#!/usr/bin/env python3
"""Reel no estilo "corte de podcast": b-roll em movimento tela cheia, cortes rapidos
e legenda amarela palavra a palavra no centro. Sem apresentador.

Uso: python3 make_short.py config.json
Config (gerado pelo auto_short.py):
{
  "audio": "voz.mp3", "out": "video.mp4", "font": "../assets/fonts/Anton.ttf",
  "handle": "@radar.gta6br", "headline": "opcional, aparece nos 2 primeiros segundos",
  "scenes": [{"src": "clip.mp4" | "imagem.jpg", "start": 0, "end": 1.6, "ss": 12.0,
              "layout": "full" | "band", "cx": 0.5}],
  "captions": [{"start": 0, "end": 0.8, "text": "O HACKER LA", "hl": false}]
}
Layout "full": cobre a tela inteira. "band": faixa de 1080x1000 no meio com o fundo
desfocado. Fotos deitadas em tela cheia deslizam de lado (cena com "pan": 1 ou -1 para o sentido);
as outras imagens paradas ganham zoom lento (Ken Burns).
Area segura do Reels: texto entre y=170 e y=1690 e longe dos icones (x > 930 a partir de y=1090).
"""
import json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
# Qualidade (Pedro 13/10: os Reels estavam saindo borrados). O clipe 16:9 vira 9:16 ampliado ~1,8x,
# entao: escala lanczos + nitidez leve, intermediarios quase sem perda e saida final com bitrate alto
# (o Instagram recomprime; mandar ~10 Mbps evita o borrao duplo).
NITIDEZ = "unsharp=5:5:0.7:5:5:0.0"
SAIDA_VIDEO = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-maxrate", "14M", "-bufsize", "28M",
               "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p", "-r", "30"]
BAND_Y, BAND_H = 380, 1000
CX, SAFE_W = 540, 760
CAP_Y = 1060  # centro vertical da legenda
PAN_VEL = 230  # px/s do deslize lateral das fotos deitadas (Pedro achou 420 rapido demais)
TRANS = 0.3  # s da transicao "empurrar de lado" (slide com borrao de movimento) entre fotos
YELLOW, WHITE, PURPLE = (255, 221, 0), (255, 255, 255), (190, 120, 255)
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")


def load_cfg(path):
    cfg = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    for k in ("audio", "out", "font"):
        if k in cfg and not os.path.isabs(cfg[k]):
            cfg[k] = os.path.join(base, cfg[k])
    for s in cfg["scenes"]:
        if not os.path.isabs(s["src"]):
            s["src"] = os.path.join(base, s["src"])
    return cfg


def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", path]).strip())


def scene_filter(layout, cx, still, dur):
    """Filtro ffmpeg que leva a entrada [0:v] para 1080x1920 no layout pedido."""
    n = max(1, int(round(dur * FPS)))
    k = 2 if still else 1  # imagem parada: margem para o zoom
    move = (f"zoompan=z='1+0.12*on/{n}':x='(iw-iw/zoom)*{cx}':y='(ih-ih/zoom)/2':d=1:s={{w}}x{{h}}:fps={FPS},"
            if still else "")
    if layout == "full":
        return (f"[0:v]scale={W}*{k}:{H}*{k}:force_original_aspect_ratio=increase:flags=lanczos,"
                f"crop={W}*{k}:{H}*{k}:(iw-{W}*{k})*{cx}:(ih-{H}*{k})/2,"
                + move.format(w=W, h=H) + f"scale={W}:{H}:flags=lanczos,{NITIDEZ},setsar=1,fps={FPS}[v]")
    return (f"[0:v]split[a][b];"
            f"[a]scale={W // 4}:{H // 4}:force_original_aspect_ratio=increase,crop={W // 4}:{H // 4},"
            f"boxblur=12,scale={W}:{H},eq=brightness=-0.3,setsar=1,fps={FPS}[bg];"
            f"[b]scale={W}*{k}:{BAND_H}*{k}:force_original_aspect_ratio=increase,"
            f"crop={W}*{k}:{BAND_H}*{k}:(iw-{W}*{k})*{cx}:(ih-{BAND_H}*{k})/2,"
            + move.format(w=W, h=BAND_H) + f"scale={W}:{BAND_H},setsar=1,fps={FPS}[fg];"
            f"[bg][fg]overlay=0:{BAND_Y}:shortest=1,"
            f"drawbox=x=0:y={BAND_Y - 6}:w={W}:h=6:color=0xFFDD00:t=fill,"
            f"drawbox=x=0:y={BAND_Y + BAND_H}:w={W}:h=6:color=0xFFDD00:t=fill[v]")


def pan_filter(img_w, img_h, dur, sentido):
    """Foto deitada em tela cheia: ocupa a altura toda e desliza de lado, para mostrar mais da imagem.
    Percorre ate 70% da sobra horizontal, no maximo PAN_VEL px/s, com entrada e saida suaves."""
    sw = int(round(img_w * H / img_h / 2)) * 2
    sobra = sw - W
    dist = min(sobra * 0.7, PAN_VEL * dur)
    x0 = (sobra - dist) / 2 if sentido >= 0 else (sobra + dist) / 2
    x1 = x0 + dist * (1 if sentido >= 0 else -1)
    return (f"[0:v]scale={sw}:{H}:flags=lanczos,crop={W}:{H}:'{x0:.1f}+({x1 - x0:.1f})*(0.5-0.5*cos(PI*t/{dur:.3f}))':0,"
            f"setsar=1,fps={FPS}[v]")


def render_scene(s, path, extra=0.0):
    dur = s["end"] - s["start"] + extra  # extra: sobra para a transicao com a cena seguinte
    still = s["src"].lower().endswith(IMG_EXT)
    inp = (["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", s["src"]] if still
           else ["-ss", f"{s.get('ss', 0):.2f}", "-t", f"{dur:.3f}", "-i", s["src"]])
    layout = s.get("layout", "full")
    flt = None
    if still and layout == "full":
        iw, ih = Image.open(s["src"]).size
        if iw * H / ih >= W * 1.25:  # foto deitada: desliza de lado em vez do zoom parado
            flt = pan_filter(iw, ih, dur, s.get("pan", 1))
    flt = flt or scene_filter(layout, s.get("cx", 0.5), still, dur)
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", flt, "-map", "[v]",
                    "-frames:v", str(max(1, int(round(dur * FPS)))), "-an",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-pix_fmt", "yuv420p", path],
                   check=True)


def wrap(draw, text, font_path, max_w, size, max_lines=2):
    f = ImageFont.truetype(font_path, size)
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    if len(lines) > max_lines and size > 50:
        return wrap(draw, text, font_path, max_w, size - 6, max_lines)
    return lines, f


def caption_layer(text, font, hl):
    layer = Image.new("RGBA", (W, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lines, f = wrap(d, text, font, SAFE_W, 96 if hl else 86)
    y = (300 - len(lines) * (f.size + 6)) // 2
    for ln in lines:
        tw = d.textlength(ln, font=f)
        d.text((CX - tw / 2, y), ln, font=f, fill=PURPLE if hl else YELLOW, stroke_width=8, stroke_fill="black")
        y += f.size + 6
    return layer


def borrao_lateral(img, k):
    """Borrao so na horizontal (k px), o rastro de movimento de um deslize rapido."""
    a = np.asarray(img, dtype=np.float32)
    c = np.cumsum(np.pad(a, ((0, 0), (k // 2 + 1, k - k // 2), (0, 0)), mode="edge"), axis=1)
    return Image.fromarray(((c[:, k:k + W] - c[:, :W]) / k).clip(0, 255).astype(np.uint8))


def main(path):
    cfg = load_cfg(path)
    font = cfg["font"]
    dur = duration(cfg["audio"]) + 0.4
    cfg["scenes"][-1]["end"] = max(cfg["scenes"][-1]["end"], dur)
    tmp = os.path.splitext(cfg["out"])[0] + "_cenas"
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    sc = cfg["scenes"]
    trans = cfg.get("transicao") == "deslize" and len(sc) > 1
    parts = []
    for i, s in enumerate(sc):
        p = os.path.join(tmp, f"{i:03d}.mp4")
        render_scene(s, p, TRANS if trans and i + 1 < len(sc) else 0.0)
        parts.append(p)
    base = os.path.join(tmp, "base.mp4")
    janelas = []  # trechos com transicao, para o borrao de movimento
    if trans:
        # cada foto empurra a anterior para o lado (no sentido do deslize dela), como nos edits gringos
        ins = sum((["-i", p] for p in parts), [])
        flt, ult = [], "[0:v]"
        for k in range(1, len(sc)):
            t0 = sc[k]["start"] - sc[0]["start"]
            lado = "slideleft" if sc[k].get("pan", 1) >= 0 else "slideright"
            flt.append(f"{ult}[{k}:v]xfade=transition={lado}:duration={TRANS}:offset={t0:.3f}[x{k}]")
            ult = f"[x{k}]"
            janelas.append((t0, t0 + TRANS))
        subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(flt), "-map", ult,
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-pix_fmt", "yuv420p", base],
                       check=True)
    else:
        lst = os.path.join(tmp, "lista.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", base],
                       check=True)

    # camada fixa: @ da pagina embaixo, como marca d'agua
    top = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    hf = ImageFont.truetype(font, 40)
    hd = cfg.get("handle", "").upper()
    d.text((CX - d.textlength(hd, font=hf) / 2, 1585), hd, font=hf, fill=(255, 255, 255, 230),
           stroke_width=4, stroke_fill="black")
    head = None
    if cfg.get("headline"):
        head = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dh = ImageDraw.Draw(head)
        lines, f = wrap(dh, cfg["headline"], font, 880, 76)
        y = 200
        for ln in lines:
            dh.text((CX - dh.textlength(ln, font=f) / 2, y), ln, font=f, fill=WHITE, stroke_width=6,
                    stroke_fill="black")
            y += f.size + 8

    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", base, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", cfg["audio"],
                            *SAIDA_VIDEO,
                            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-af", "apad", "-t", f"{dur:.2f}",
                            "-movflags", "+faststart", cfg["out"]], stdin=subprocess.PIPE)
    cache, i, fs = {}, 0, W * H * 3
    while True:
        raw = dec.stdout.read(fs)
        if len(raw) < fs:
            break
        t = i / FPS
        frame = Image.frombytes("RGB", (W, H), raw)
        jan = next(((a, b) for a, b in janelas if a <= t < b), None)
        if jan:  # borrao de movimento horizontal durante o empurrao, mais forte no meio
            meio = 1 - abs((t - jan[0]) / (jan[1] - jan[0]) * 2 - 1)
            frame = borrao_lateral(frame, int(8 + 70 * meio))
        frame.paste(top, (0, 0), top)
        if head is not None and t < 2.2:
            frame.paste(head, (0, 0), head)
        cap = next((c for c in cfg["captions"] if c["start"] <= t < c["end"]), None)
        if cap:
            k = (cap["text"], bool(cap.get("hl")))
            if k not in cache:
                cache[k] = caption_layer(cap["text"], font, cap.get("hl"))
            layer = cache[k]
            age = t - cap["start"]
            y0 = CAP_Y - 150
            if age < 0.1:  # pulo de entrada
                sc = 0.8 + 0.2 * age / 0.1
                l2 = layer.resize((int(W * sc), int(300 * sc)))
                frame.paste(l2, (int(CX - CX * sc), int(y0 + 150 - 150 * sc)), l2)
            else:
                frame.paste(layer, (0, y0), layer)
        enc.stdin.write(frame.tobytes())
        i += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    shutil.rmtree(tmp)
    print("ok", cfg["out"], round(dur, 1), "s")


if __name__ == "__main__":
    main(sys.argv[1])
