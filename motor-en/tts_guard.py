"""Narracao com BANCO: a voz do Gemini e gravada UMA vez por roteiro e reaproveitada para sempre.

Por que existe: a chave do Gemini da so 10 narracoes por dia, e os canais antigos (GTA, engenharia,
terror) ja usam 6. Sobram 4 para estes canais. Sem o banco, cada teste, cada ajuste de imagem e
cada nova tentativa depois de um erro gastava mais uma.

Como funciona:
  - O audio bruto do Gemini e guardado em narracoes/<CODIGO>_<chave>.wav (fora do GitHub).
  - A <chave> depende SO do texto falado, da voz, do modelo e do estilo. Mudar imagem, cena, capa,
    legenda (visual), musica ou horario NAO muda a chave: a narracao e reaproveitada, de graca.
  - Mudar o texto de uma fala gera chave nova = narracao nova (e o certo: a voz precisa dizer o novo).
  - Corte, pausas, tempos da legenda e mixagem sao refeitos a partir do audio guardado: sem custo.
  - Conta as narracoes NOVAS do dia (dia do Google, fuso da California). Passou do limite, recusa
    e o tts.py segue o caminho normal de falha (VOZ FALHOU ao publicar). Nada e publicado com voz errada.

Para regravar a voz de um roteiro (ficou ruim), apague o arquivo dele em narracoes/.

Variaveis (opcionais):
  CANAIS_NARRACOES_DIA  limite de narracoes novas por dia para estes canais (padrao 4)
  CANAIS_NARRACOES      pasta do banco (padrao: <repositorio>/narracoes)

Uso: igual ao tts.py do motor, que este arquivo apenas embrulha (o motor nao e alterado):
  python motor-en/tts_guard.py historia.json voz.wav tempos.json [--motor gemini|kokoro]
"""
import datetime as dt, hashlib, json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
MOTOR = os.path.join(RAIZ, "skills", "canal-terror", "scripts")  # motor testado, nunca alterado
sys.path.insert(0, MOTOR)
sys.path.insert(0, AQUI)
import tts  # noqa: E402  (tts.py do motor)
from comum import carregar  # noqa: E402

BANCO = os.environ.get("CANAIS_NARRACOES") or os.path.join(RAIZ, "narracoes")
LIMITE = int(os.environ.get("CANAIS_NARRACOES_DIA", "4"))
CONTADOR = os.path.join(BANCO, "contador.json")
_gemini_real = tts.gemini
_codigo = "SEMCODIGO"


def chave(linhas):
    """Impressao digital da narracao: so o que muda o som da voz entra aqui."""
    base = {"linhas": list(linhas),
            "voz": os.environ.get("GEMINI_TTS_VOICE", "Algenib"),
            "modelo": os.environ.get("GEMINI_TTS_MODEL", ""),
            "estilo": tts.ESTILO}
    return hashlib.sha256(json.dumps(base, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def dia_google():
    """A cota gratis do Gemini zera a meia-noite da California."""
    from zoneinfo import ZoneInfo
    return dt.datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")


def usadas_hoje(somar=0):
    """Le (e opcionalmente soma) o contador de narracoes novas do dia."""
    os.makedirs(BANCO, exist_ok=True)
    try:
        dados = json.load(open(CONTADOR, encoding="utf-8"))
    except Exception:
        dados = {}
    hoje = dia_google()
    dados[hoje] = int(dados.get(hoje, 0)) + somar
    if somar:
        dados = {k: dados[k] for k in sorted(dados)[-14:]}  # guarda so as ultimas 2 semanas
        tmp = CONTADOR + ".tmp"
        json.dump(dados, open(tmp, "w", encoding="utf-8"), indent=1)
        os.replace(tmp, CONTADOR)
    return dados[hoje]


def arquivo_do_banco(linhas):
    return os.path.join(BANCO, f"{_codigo}_{chave(linhas)}.wav")


def limpar_fim(audio, sr):
    """Corta o estalo de estatica que o Gemini as vezes deixa NO FIM da narracao.

    Visto no SV001 (28/10): depois da ultima palavra vem um silencio curto e, colado no fim do arquivo,
    0,2 s de chiado alto (mais forte que a propria voz). Regra: procura, no ultimo 1,5 s, o ultimo trecho
    de silencio de 0,1 s ou mais; se o que vem depois dele e curto (ate 0,45 s) e vai ate o fim do arquivo,
    e lixo, nao fala: corta tudo dali em diante. Fala de verdade nao termina colada no fim do arquivo
    depois de um silencio (o tts.py ainda poe 1,2 s de silencio no final).
    """
    import numpy as np
    a = np.asarray(audio, dtype="float32")
    if a.ndim > 1:
        a = a.mean(axis=1)
    q = max(1, int(sr * 0.02))
    n = len(a) // q
    if n < 10:
        return audio
    rms = np.sqrt((a[: n * q].reshape(n, q) ** 2).mean(axis=1))
    mudo = rms < 0.003
    janela = int(1.5 / 0.02)
    ini = max(0, n - janela)
    corte = None
    k = n - 1
    while k >= ini:
        if mudo[k]:
            j = k
            while j - 1 >= ini and mudo[j - 1]:
                j -= 1
            if (k - j + 1) * 0.02 >= 0.1:
                depois = (n - 1 - k) * 0.02
                if 0 < depois <= 0.45:
                    corte = (k + 1) * q
                break
            k = j - 1
        else:
            k -= 1
    if corte is None:
        return audio
    print(f"narracao: cortei {len(a) / sr - corte / sr:.2f} s de estatica no fim da voz", flush=True)
    return audio[:corte]


def gemini_com_banco(linhas, key):
    arq = arquivo_do_banco(linhas)
    if os.path.exists(arq):
        print(f"narracao: reaproveitando {os.path.basename(arq)} (nao gasta cota)", flush=True)
        return limpar_fim(tts.sf.read(arq, dtype="float32")[0], tts.SR)
    n = usadas_hoje()
    if n >= LIMITE:
        raise RuntimeError(f"LIMITE DE NARRACOES: {n} de {LIMITE} ja usadas hoje (dia do Google {dia_google()}); "
                           f"tente depois da meia-noite da California (5h no Brasil)")
    usadas_hoje(1)  # conta ANTES de chamar: se cair no meio, melhor sobrar do que estourar
    audio = _gemini_real(linhas, key)
    tmp = arq + ".tmp.wav"
    tts.sf.write(tmp, audio, tts.SR)
    os.replace(tmp, arq)  # so aparece no banco quando estiver inteiro
    print(f"narracao NOVA gravada no banco: {os.path.basename(arq)} ({n + 1} de {LIMITE} hoje)", flush=True)
    return limpar_fim(audio, tts.SR)


def main():
    global _codigo
    historia, wav = sys.argv[1], sys.argv[2]
    _codigo = carregar(historia).get("codigo", "SEMCODIGO")
    # o tts.py reaproveita um "_bruto.wav" pelo NOME, sem olhar se o texto mudou. Apagando, toda
    # narracao passa pelo banco, que confere o texto.
    bruto = os.path.splitext(wav)[0] + "_bruto.wav"
    if os.path.exists(bruto):
        os.remove(bruto)
    tts.gemini = gemini_com_banco
    sys.argv = [tts.__file__] + sys.argv[1:]
    tts.main()


if __name__ == "__main__":
    main()
