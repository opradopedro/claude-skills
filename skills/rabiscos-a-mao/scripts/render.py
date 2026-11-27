"""Transforma um HTML com rabiscos em PNG, esperando a fonte e os desenhos.

Uso:
    python3 render.py pagina.html saida.png [largura] [altura] [escala]
    python3 render.py post.html post.png 1080 1350 2

Precisa de playwright (pip install playwright && playwright install chromium).
Para usar um Chrome já instalado: CHROME=/caminho/do/chrome python3 render.py ...
Se a página chama Rabiscos.desenharTodos(), o script espera terminar antes da foto.
"""
import asyncio
import os
import pathlib
import sys

from playwright.async_api import async_playwright


async def render(html, png, largura=1080, altura=1350, escala=2):
    async with async_playwright() as p:
        navegador = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--allow-file-access-from-files"])
        pagina = await navegador.new_page(viewport={"width": largura, "height": altura}, device_scale_factor=escala)
        await pagina.goto(pathlib.Path(html).resolve().as_uri())
        await pagina.evaluate("document.fonts.ready")
        await pagina.evaluate("window.Rabiscos && window.Rabiscos.desenharTodos ? window.Rabiscos.desenharTodos() : null")
        await pagina.wait_for_timeout(200)
        fonte_ok = await pagina.evaluate("document.fonts.check('40px Caveat')")
        if not fonte_ok:
            print("Atenção: a fonte Caveat não carregou. Confira o caminho de assets/rabiscos.css.")
        await pagina.screenshot(path=png)
        await navegador.close()
    print("ok:", png)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    a = sys.argv
    asyncio.run(render(a[1], a[2], *(int(x) for x in a[3:6])))
