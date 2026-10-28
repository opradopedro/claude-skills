#!/usr/bin/env python3
"""Receita que o Kiro Crew executa nos horarios marcados. NAO GASTA CREDITO.

Isto e uma tarefa do tipo "script": o Crew so executa o passo a passo escrito aqui, sem
pensar e sem chamar modelo de linguagem nenhum. O custo e zero.

Como registrar no Crew (uma vez cada):

  kirocrew cron add "survival" "" --cron "0 2 * * *" --timezone "America/New_York" ^
    --script %USERPROFILE%\\.kiro\\crew\\crons\\rodar_canal.py:run_survival ^
    --no-persistent-session --minimal-context --timeout-secs 3600

  kirocrew cron add "classics" "" --cron "0 4 * * *" --timezone "America/New_York" ^
    --script %USERPROFILE%\\.kiro\\crew\\crons\\rodar_canal.py:run_classics ^
    --no-persistent-session --minimal-context --timeout-secs 3600

Os horarios acima sao de PRODUCAO, nao de publicacao: o programa produz de madrugada e deixa o
video agendado no YouTube para a hora certa (19h NY no survival, meio-dia NY no classics).

Cada execucao produz UMA parte (ver "partes_por_vez" no canal.json), nao a serie inteira. Sao
uns 20 a 25 minutos, e por isso o prazo de 1 hora basta. Produzir uma parte por noite poupa
duas coisas escassas: a cota de voz do Gemini (o plano gratis da ~10 narracoes por dia, somando
todos os canais que usam a mesma chave) e a memoria RAM do PC (8 GB).

Os dois canais produzem em horarios diferentes (2h e 4h) para nao disputarem memoria.

Antes de registrar, copie este arquivo para a pasta de receitas do Crew:
  copy C:\\claude-skills\\crew\\rodar_canal.py %USERPROFILE%\\.kiro\\crew\\crons\\
"""
import os
import subprocess
import sys
import tempfile

# Onde esta o repositorio no seu computador. Mude aqui, ou defina a variavel CANAIS_REPO.
REPO_PADRAO = r"C:\claude-skills"

# Memoria livre minima para comecar a produzir, em MB.
# O PC do Pedro tem 8 GB. Fazer um video usa Chromium (desenha as cenas), Whisper (confere a
# legenda) e FFmpeg (junta tudo): o pico passa de 2 GB. Sem essa folga, o Windows mata o
# processo no meio e se perdem 20 minutos de trabalho sem nenhuma explicacao util.
# Melhor nao comecar e dizer por que. Mude com a variavel CANAIS_MIN_RAM_MB.
MIN_RAM_MB = int(os.environ.get("CANAIS_MIN_RAM_MB", "2500"))


def memoria_livre_mb():
    """Memoria RAM livre em MB. Nao precisa instalar nada. Devolve -1 se nao souber medir."""
    if os.name == "nt":
        try:
            import ctypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]

            m = MEMORYSTATUSEX()
            m.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return int(m.ullAvailPhys / (1024 * 1024))
        except Exception:
            return -1
    try:
        for linha in open("/proc/meminfo"):
            if linha.startswith("MemAvailable:"):
                return int(linha.split()[1]) // 1024
    except Exception:
        pass
    return -1


def maiores_processos(n=4):
    """Nome e MB dos processos que mais usam memoria, para dizer o que fechar."""
    if os.name != "nt":
        return ""
    try:
        ps = ("Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First %d "
              "Name,@{n='MB';e={[int]($_.WorkingSet/1MB)}} | "
              "ForEach-Object { \"$($_.Name) $($_.MB) MB\" }") % n
        r = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                           capture_output=True, text=True, timeout=30)
        return "; ".join(x.strip() for x in (r.stdout or "").splitlines() if x.strip())
    except Exception:
        return ""


def conferir_memoria():
    """Para antes de comecar se nao houver folga de RAM. Devolve None se estiver tudo bem."""
    livre = memoria_livre_mb()
    if livre < 0 or livre >= MIN_RAM_MB:
        return None
    culpados = maiores_processos()
    msg = (f"NAO RODEI: memoria insuficiente. Livre agora: {livre} MB; "
           f"preciso de pelo menos {MIN_RAM_MB} MB.\n"
           f"Fazer um video usa Chromium, Whisper e FFmpeg ao mesmo tempo. Com menos que isso o "
           f"Windows mata o processo no meio e o trabalho se perde.\n"
           f"O que fazer: feche os navegadores (Opera e Chrome costumam ser os maiores) e rode de novo.")
    if culpados:
        msg += f"\nMaiores agora: {culpados}"
    return msg


def _repo():
    repo = os.environ.get("CANAIS_REPO", REPO_PADRAO)
    if not os.path.isdir(repo):
        raise RuntimeError(
            f"Nao achei o repositorio em {repo}. "
            f"Defina a variavel de ambiente CANAIS_REPO com a pasta certa.")
    if not os.path.isfile(os.path.join(repo, "motor-en", "produce.py")):
        raise RuntimeError(
            f"A pasta {repo} existe, mas nao parece ser o repositorio "
            f"(nao achei motor-en\\produce.py). Se voce baixou um .zip, extraia primeiro.")
    return repo


def _carregar_env(repo):
    """Le o arquivo .env da raiz do repositorio e poe tudo no ambiente.

    Formato: UMA_CHAVE=valor por linha. Linhas que comecam com # sao ignoradas.
    O .env NUNCA deve ir para o GitHub (ja esta no .gitignore).
    """
    caminho = os.environ.get("CANAIS_ENV", os.path.join(repo, ".env"))
    if not os.path.isfile(caminho):
        raise RuntimeError(
            f"Nao achei o arquivo de chaves em {caminho}. "
            f"Copie o .env.example para .env e preencha as chaves (ver MANUAL-PEDRO.md).")
    for linha in open(caminho, encoding="utf-8"):
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ[chave.strip()] = valor.strip().strip('"').strip("'")


def _rodar(canal):
    """Produz e agenda a proxima serie do canal. Devolve um resumo curto em texto."""
    repo = _repo()
    _carregar_env(repo)
    falta_memoria = conferir_memoria()
    if falta_memoria:
        return f"[{canal}] {falta_memoria}"
    saida = os.path.join(tempfile.gettempdir(), "canais", canal)
    os.makedirs(saida, exist_ok=True)
    cmd = [sys.executable, os.path.join(repo, "motor-en", "produce.py"),
           os.path.join(repo, "skills", canal), "--proximo", "--subir", "--saida", saida]
    r = subprocess.run(cmd, cwd=repo, capture_output=True, text=True)
    linhas = (r.stdout or "").strip().splitlines()

    # resumo: so o que interessa no relatorio do Crew
    importantes = [x for x in linhas if any(
        m in x for m in ("AGENDADO", "FILA CHEIA", "SEM ROTEIRO", "CANAL ERRADO", "CODIGO ERRADO",
                         "NAO SUBIU", "LEGENDA FORA DA VOZ", "AUDIO COM PROBLEMA", "VOZ FALHOU",
                         "canal confirmado", "FUSO NAO ENCONTRADO", "FALTA A VARIAVEL"))]
    resumo = "\n".join(importantes) or "\n".join(linhas[-8:]) or "(sem saida)"

    if r.returncode != 0:
        erro = (r.stderr or "").strip().splitlines()
        cauda = "\n".join(erro[-8:])
        # morte por falta de memoria nao deixa mensagem de erro util: avisa o que foi
        agora = memoria_livre_mb()
        pista = ""
        if 0 <= agora < MIN_RAM_MB:
            pista = (f"\nATENCAO: a memoria livre esta em {agora} MB. O processo provavelmente foi "
                     f"morto por falta de memoria. Feche os navegadores e rode de novo.")
        return f"[{canal}] FALHOU (codigo {r.returncode})\n{resumo}\n--- erro ---\n{cauda}{pista}"
    return f"[{canal}] OK (memoria livre: {memoria_livre_mb()} MB)\n{resumo}"


def run_survival(*_args, **_kwargs):
    return _rodar("canal-survival")


def run_classics(*_args, **_kwargs):
    return _rodar("canal-classics")


def run(*_args, **_kwargs):
    """Roda os dois canais, um depois do outro. Use se preferir uma tarefa so."""
    return run_survival() + "\n\n" + run_classics()


if __name__ == "__main__":
    qual = sys.argv[1] if len(sys.argv) > 1 else "ambos"
    print({"survival": run_survival, "classics": run_classics}.get(qual, run)())
