"""Enquadramento automático do corte 9:16: acha o que importa no quadro (rosto, senão a região com mais detalhe)
e devolve o cx que make_short.py usa no crop, para não cortar rosto nem mão no meio.

cx é a fração da sobra horizontal: crop x = (largura_escalada - 1080) * cx.
Uso: from enquadrar import cx_auto; cx = cx_auto("clip.mp4", ss=12.0, dur=1.5)
"""
import subprocess, functools
import numpy as np
import cv2

W, H = 1080, 1920
_faces = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in
          ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml")]


def _quadro(src, t):
    """Um quadro em escala de cinza, 640 px de largura."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf",
                          "scale=640:-2,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    if not out:
        return None
    h = len(out) // 640
    return np.frombuffer(out[:640 * h], np.uint8).reshape(h, 640)


def _centro(img):
    """Centro horizontal (0..1) do assunto: rostos pesados pela área; sem rosto, o centro de massa do detalhe."""
    h, w = img.shape
    caixas = []
    for i, cc in enumerate(_faces):
        for flip in ((False, True) if i else (False,)):
            g = cv2.flip(img, 1) if flip else img
            for x, y, fw, fh in cc.detectMultiScale(g, 1.1, 6, minSize=(max(24, h // 14),) * 2):
                if flip:
                    x = w - x - fw
                caixas.append((x + fw / 2, fw * fh))
    if caixas:
        tot = sum(a for _, a in caixas)
        return sum(c * a for c, a in caixas) / tot / w, True
    # sem rosto: bordas (mão, máquina, objeto) pesadas, com leve puxão para o centro
    gx = cv2.Sobel(cv2.GaussianBlur(img, (5, 5), 0), cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(cv2.GaussianBlur(img, (5, 5), 0), cv2.CV_32F, 0, 1)
    col = np.sqrt(gx * gx + gy * gy).sum(axis=0)
    col = np.convolve(col, np.ones(w // 8) / (w // 8), mode="same")
    xs = np.arange(w) / w
    peso = col * (1 - 0.6 * np.abs(xs - 0.5))
    janela = max(8, int(h * W / H))  # largura do recorte 9:16 no quadro
    soma = np.convolve(peso, np.ones(janela), mode="valid")  # melhor janela 9:16
    i = int(np.argmax(soma))
    return (i + janela / 2) / w, False


@functools.lru_cache(maxsize=None)
def cx_auto(src, ss=0.0, dur=1.5):
    """cx para o trecho [ss, ss+dur] de src. Usa 3 quadros; rosto em qualquer um deles manda."""
    achados, sem = [], []
    for f in (0.2, 0.5, 0.8):
        img = _quadro(src, ss + dur * f)
        if img is None:
            continue
        c, rosto = _centro(img)
        (achados if rosto else sem).append(c)
        h, w = img.shape
    if not (achados or sem):
        return 0.5
    centro = float(np.median(achados or sem))
    r = (h * W / H) / w  # fração da largura que cabe no 9:16
    if r >= 1:
        return 0.5
    return float(min(1.0, max(0.0, (centro - r / 2) / (1 - r))))
