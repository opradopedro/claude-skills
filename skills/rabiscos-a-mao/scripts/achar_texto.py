"""Acha onde está cada palavra numa imagem (print de tela, foto de documento).

Devolve x, y, largura e altura em pixels da imagem original, que é exatamente
o que as marcas do rabiscos.js usam como alvo.

Uso:
    python3 achar_texto.py print.png                 # lista todas as palavras
    python3 achar_texto.py print.png "0,718" MTR     # só as que contêm esses trechos

Precisa do tesseract instalado (apt install tesseract-ocr tesseract-ocr-por).
"""
import subprocess
import sys


def palavras(imagem):
    saida = subprocess.run(
        ["tesseract", imagem, "-", "--psm", "11", "tsv"],
        capture_output=True, text=True, check=True,
    ).stdout
    for linha in saida.splitlines()[1:]:
        c = linha.split("\t")
        if len(c) < 12 or not c[11].strip():
            continue
        yield {"texto": c[11], "x": int(c[6]), "y": int(c[7]), "w": int(c[8]), "h": int(c[9]), "confianca": float(c[10])}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    imagem, filtros = sys.argv[1], [f.lower() for f in sys.argv[2:]]
    for p in palavras(imagem):
        if filtros and not any(f in p["texto"].lower() for f in filtros):
            continue
        print(f'{p["texto"]:<30} {{"x": {p["x"]}, "y": {p["y"]}, "w": {p["w"]}, "h": {p["h"]}}}')
    # Dica: o OCR às vezes erra acento (é vira é/e). Busque por um pedaço sem acento.


if __name__ == "__main__":
    main()
