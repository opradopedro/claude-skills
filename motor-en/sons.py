"""Banco de sons GRAVADOS (Freesound, so licenca CC0 = livre para uso comercial, sem credito obrigatorio).

Cada som e baixado UMA vez para C:\\claude-skills\\sons\\<nome>.mp3 e reaproveitado para sempre (custo zero).
Precisa de FREESOUND_API_KEY no .env so na primeira vez de cada som.
O arquivo sons/creditos.json guarda de onde veio cada som (id, autor, link), por seguranca.

Para trocar um som que ficou ruim: apague sons/<nome>.mp3 e ponha o id do som certo em FIXOS,
ou mude a busca em BIBLIOTECA. Rodar: python motor-en/sons.py (baixa todos os que faltam).
"""
import json, math, os, subprocess, sys, urllib.parse, urllib.request

import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.environ.get("CANAIS_SONS") or os.path.join(RAIZ, "sons")
CREDITOS = os.path.join(PASTA, "creditos.json")

# nome -> (busca, duracao minima, duracao maxima)
BIBLIOTECA = {
    # Old Tales (calmo)
    "musica_calma": ("lute", 30, 600),
    "passaros": ("birds morning countryside ambience", 20, 300),
    "fogo": ("fireplace crackling fire", 20, 300),
    "sino": ("church bells ringing village", 4, 40),
    "vila": ("medieval fair crowd", 20, 400),
    "galo": ("rooster crowing", 1, 8),
    "porta_madeira": ("old wooden door creak open", 1, 8),
    # Signal Lost (terror)
    "golpe": ("door knock", 0.3, 5),
    "golpe_metal": ("metal knock", 0.2, 5),
    "choro": ("woman crying sobbing", 3, 25),
    "susto": ("horror impact hit", 0.5, 5),
    "elevador": ("elevator interior hum ambience", 15, 300),
    "zumbido": ("fluorescent light buzz hum", 10, 300),
    "relogio": ("clock ticking", 10, 200),
    "apagao": ("power down", 0.5, 10),
    "celular": ("phone vibrate", 0.5, 6),
}
FIXOS = {"vila": 703643}  # nome -> id do Freesound, quando a busca automatica escolher mal

# cena (comp) -> som de ambiente que toca de fundo enquanto ela aparece
AMBIENTE = {"vila": "passaros", "casa": "fogo", "mercado": "vila", "elevator": "elevador",
            "reloj": "relogio", "pasillo": "zumbido", "quarto": "relogio", "olho": "relogio"}
# evento do roteiro -> som pontual
EVENTO = {"sino": "sino", "golpe": "golpe", "grito": "choro", "susto": "susto", "apagon": "apagao", "vibra": "celular",
          "galo": "galo", "porta": "porta_madeira"}


def _chave():
    k = os.environ.get("FREESOUND_API_KEY")
    if k:
        return k
    env = os.path.join(RAIZ, ".env")
    if os.path.exists(env):
        for linha in open(env, encoding="utf-8"):
            if linha.strip().startswith("FREESOUND_API_KEY="):
                return linha.split("=", 1)[1].strip()
    return None


def _api(caminho, **q):
    q["token"] = _chave()
    url = "https://freesound.org/apiv2/" + caminho + "?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def _escolher(nome):
    campos = "id,name,duration,license,previews,username,avg_rating,num_ratings,num_downloads,url"
    if nome in FIXOS:
        return _api(f"sounds/{FIXOS[nome]}/", fields=campos)
    busca, dmin, dmax = BIBLIOTECA[nome]
    r = _api("search/text/", query=busca, page_size=30, fields=campos, sort="score",
             filter=f'license:"Creative Commons 0" duration:[{dmin} TO {dmax}]')
    bons = [s for s in r.get("results", []) if s.get("previews")]
    if not bons:
        raise RuntimeError(f"nenhum som CC0 para '{busca}'")
    # bem avaliado e muito baixado = som bom e limpo; a ordem da busca desempata
    return max(enumerate(bons), key=lambda e: (e[1].get("avg_rating") or 0) * math.log(2 + (e[1].get("num_ratings") or 0))
               + 0.3 * math.log(1 + (e[1].get("num_downloads") or 0)) - 0.05 * e[0])[1]


def obter(nome):
    """Caminho do mp3 do som; baixa se faltar. None se nao der (o video sai sem esse som, nao trava)."""
    arq = os.path.join(PASTA, nome + ".mp3")
    if os.path.exists(arq):
        return arq
    if nome not in BIBLIOTECA and nome not in FIXOS:
        return None
    if not _chave():
        print(f"som '{nome}': falta FREESOUND_API_KEY no .env; sai sem ele", flush=True)
        return None
    try:
        os.makedirs(PASTA, exist_ok=True)
        s = _escolher(nome)
        tmp = arq + ".tmp"
        urllib.request.urlretrieve(s["previews"]["preview-hq-mp3"], tmp)
        os.replace(tmp, arq)
        cred = json.load(open(CREDITOS, encoding="utf-8")) if os.path.exists(CREDITOS) else {}
        cred[nome] = {"id": s["id"], "nome": s["name"], "autor": s.get("username"), "licenca": s.get("license"),
                      "link": s.get("url"), "duracao": s.get("duration")}
        json.dump(cred, open(CREDITOS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"som '{nome}' baixado: {s['name']} ({s.get('duration', 0):.1f}s, CC0)", flush=True)
        return arq
    except Exception as e:
        print(f"som '{nome}' falhou ({str(e)[:120]}); sai sem ele", flush=True)
        return None


def ler(arq, sr):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", arq, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


if __name__ == "__main__":
    for n in (sys.argv[1:] or BIBLIOTECA):
        print(n, "->", obter(n))




