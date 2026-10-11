#!/usr/bin/env python3
"""Monta um Reel 1080x1920 a partir de imagens, narracao e legendas.

Uso: python3 make_reel.py config.json
Config:
{
  "audio": "voz.mp3", "out": "video.mp4", "headline": "GTA 6: PRECO NO BRASIL",
  "source": "Fonte: Rockstar Games e Tecnoblog", "logo": "logo.png", "handle": "@radar.gta6br",
  "font": "fonts/Anton.ttf",
  "scenes": [{"img": "cover.jpg", "start": 0, "end": 4.2, "cx": 0.5}],
  "captions": [{"start": 0, "end": 1.8, "text": "GTA 6 JA TEM PRECO", "hl": false}]
}
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

W, H, FPS = 1080, 1920, 30
PANEL_Y, PANEL_H = 420, 1120
ORANGE, PINK = (255, 150, 0), (255, 46, 136)


def load_cfg(path):
    cfg = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    for k in ("audio", "out", "logo", "font"):
        if k in cfg and not os.path.isabs(cfg[k]):
            cfg[k] = os.path.join(base, cfg[k])
    for s in cfg["scenes"]:
        if not os.path.isabs(s["img"]):
            s["img"] = os.path.join(base, s["img"])
    return cfg


def audio_duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", path])
    return float(out.strip())


def prep_scene(path, cx):
    im = Image.open(path).convert("RGB")
    # fundo: cobre a tela, desfocado e escuro
    s = max(W / im.width, H / im.height)
    bg = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    bx, by = (bg.width - W) // 2, (bg.height - H) // 2
    bg = bg.crop((bx, by, bx + W, by + H)).filter(ImageFilter.GaussianBlur(40))
    bg = ImageEnhance.Brightness(bg).enhance(0.35)
    # painel: altura do painel com 12% de folga para o zoom
    ph = int(PANEL_H * 1.12)
    s2 = ph / im.height
    big = im.resize((int(im.width * s2), ph), Image.LANCZOS)
    pw = int(W * 1.12)
    x0 = int(cx * big.width - pw / 2)
    x0 = max(0, min(big.width - pw, x0))
    big = big.crop((x0, 0, x0 + pw, ph)) if big.width >= pw else big.resize((pw, ph))
    return bg, big


def fit_font(draw, text, font_path, max_w, size):
    while size > 40:
        f = ImageFont.truetype(font_path, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 4
    return ImageFont.truetype(font_path, size)


def wrap(draw, text, font_path, max_w, size, max_lines=2):
    f = ImageFont.truetype(font_path, size)
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    if len(lines) > max_lines:
        return wrap(draw, text, font_path, max_w, size - 6, max_lines)
    return lines, f


def main(cfg_path):
    cfg = load_cfg(cfg_path)
    dur = audio_duration(cfg["audio"]) + 0.4
    font = cfg["font"]
    scenes = [(s, *prep_scene(s["img"], s.get("cx", 0.5))) for s in cfg["scenes"]]
    logo = Image.open(cfg["logo"]).convert("RGBA").resize((120, 120), Image.LANCZOS)
    mask = Image.new("L", (120, 120), 0); ImageDraw.Draw(mask).ellipse((0, 0, 119, 119), fill=255)

    # camada fixa (topo e rodape)
    top = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    top.paste(logo, (60, 60), mask)
    d.text((200, 88), cfg.get("handle", ""), font=ImageFont.truetype(font, 52), fill="white")
    lines, hf = wrap(d, cfg["headline"], font, W - 120, 92)
    y = 210
    for ln in lines:
        tw = d.textlength(ln, font=hf)
        d.text(((W - tw) / 2, y), ln, font=hf, fill="white", stroke_width=6, stroke_fill="black")
        y += hf.size + 6
    sf = ImageFont.truetype(font, 34)
    src = cfg.get("source", "")
    d.text(((W - d.textlength(src, font=sf)) / 2, H - 90), src, font=sf, fill=(220, 220, 220))
    d.rectangle((0, PANEL_Y - 8, W, PANEL_Y - 2), fill=PINK)
    d.rectangle((0, PANEL_Y + PANEL_H + 2, W, PANEL_Y + PANEL_H + 8), fill=ORANGE)

    tmp = os.path.splitext(cfg["out"])[0] + "_frames"
    os.makedirs(tmp, exist_ok=True)
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                             "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", cfg["audio"],
                             "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                             "-c:a", "aac", "-b:a", "192k", "-af", "apad", "-t", f"{dur:.2f}", "-movflags", "+faststart",
                             cfg["out"]], stdin=subprocess.PIPE)
    n = int(dur * FPS)
    cap_cache = {}
    for i in range(n):
        t = i / FPS
        sc = next((x for x in scenes if x[0]["start"] <= t < x[0]["end"]), scenes[-1])
        s, bg, big = sc
        el = t - s["start"]
        p = el / max(0.1, s["end"] - s["start"])
        punch = max(0.0, 1 - el / 0.35)  # entrada com zoom rapido
        z = 1.0 + 0.10 * p + 0.25 * punch * punch
        # leve tremida no gancho
        shx = int(6 * ((i * 7919) % 11 - 5) / 5) if s.get("shake") and el < 0.6 else 0
        cw, ch = int(big.width / z), int(big.height / z)
        ox, oy = (big.width - cw) // 2 + shx, (big.height - ch) // 2
        ox = max(0, min(big.width - cw, ox))
        panel = big.crop((ox, oy, ox + cw, oy + ch)).resize((W, PANEL_H), Image.BILINEAR)
        frame = bg.copy()
        frame.paste(panel, (0, PANEL_Y))
        if el < 0.1 and s["start"] > 0:  # flash branco na troca
            fl = Image.new("RGB", (W, PANEL_H), "white")
            frame.paste(Image.blend(panel, fl, 0.6 * (1 - el / 0.1)), (0, PANEL_Y))
        frame.paste(top, (0, 0), top)
        dfr = ImageDraw.Draw(frame)
        if s.get("badge"):
            bf = ImageFont.truetype(font, 64)
            dfr.ellipse((40, PANEL_Y + 30, 150, PANEL_Y + 140), fill=PINK, outline="white", width=5)
            bw = dfr.textlength(s["badge"], font=bf)
            dfr.text((95 - bw / 2, PANEL_Y + 40), s["badge"], font=bf, fill="white")
        if s.get("stamp"):
            stf = ImageFont.truetype(font, 56)
            tw = dfr.textlength(s["stamp"], font=stf)
            x0 = W - tw - 90
            dfr.rectangle((x0 - 20, PANEL_Y + 40, W - 50, PANEL_Y + 130), fill=(200, 20, 40))
            dfr.text((x0, PANEL_Y + 50), s["stamp"], font=stf, fill="white")
        cap = next((c for c in cfg["captions"] if c["start"] <= t < c["end"]), None)
        if cap:
            key = cap["text"]
            if key not in cap_cache:
                layer = Image.new("RGBA", (W, 380), (0, 0, 0, 0))
                dl = ImageDraw.Draw(layer)
                cl, cf = wrap(dl, cap["text"], font, W - 100, 130 if cap.get("hl") else 104)
                yy = 10
                for ln in cl:
                    tw = dl.textlength(ln, font=cf)
                    dl.text(((W - tw) / 2, yy), ln, font=cf, fill=ORANGE if cap.get("hl") else "white",
                            stroke_width=9, stroke_fill="black")
                    yy += cf.size + 4
                cap_cache[key] = layer
            layer = cap_cache[key]
            age = t - cap["start"]
            if age < 0.12:  # entrada com leve pulo
                sc_ = 0.85 + 0.15 * (age / 0.12)
                lw, lh = int(W * sc_), int(380 * sc_)
                l2 = layer.resize((lw, lh))
                frame.paste(l2, ((W - lw) // 2, 1370 + (380 - lh) // 2), l2)
            else:
                frame.paste(layer, (0, 1370), layer)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close(); proc.wait()
    os.rmdir(tmp)
    print("ok", cfg["out"], round(dur, 1), "s")


if __name__ == "__main__":
    main(sys.argv[1])
