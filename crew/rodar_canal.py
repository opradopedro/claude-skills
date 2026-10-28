#!/usr/bin/env python3
"""Receita que o Kiro Crew executa nos horarios marcados. NAO GASTA CREDITO.

Isto e uma tarefa do tipo "script": o Crew so executa o passo a passo escrito aqui, sem
pensar e sem chamar modelo de linguagem nenhum. O custo e zero.

Como registrar no Crew (uma vez cada):

  kirocrew cron add "survival" "" --cron "0 14 * * *" --timezone "America/New_York" ^
    --script %USERPROFILE%\\.kiro\\crew\\crons\\rodar_canal.py:run_survival ^
    --no-persistent-session --minimal-context --timeout-secs 5400

  kirocrew cron add "classics" "" --cron "0 7 * * *" --timezone "America/New_York" ^
    --script %USERPROFILE%\\.kiro\\crew\\crons\\rodar_canal.py:run_classics ^
    --no-persistent-session --minimal-context --timeout-secs 5400

Os horarios acima sao de PRODUCAO (nao de publicacao): o video e produzido algumas horas
antes e entra agendado no YouTube para a hora certa (19h NY e 12h NY). O render leva de 15 a
25 minutos por parte, e uma serie de 4 partes leva mais de uma hora — por isso o prazo
(--timeout-secs) de 90 minutos.

Antes de registrar, copie este arquivo para a pasta de receitas do Crew:
  copy C:\\claude-skills\\crew\\rodar_canal.py %USERPROFILE%\\.kiro\\crew\\crons\\
"""
import os
import subprocess
import sys
import tempfile

# Onde esta o repositorio no seu computador. Mude aqui, ou defina a variavel CANAIS_REPO.
REPO_PADRAO = r"C:\claude-skills"


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
        return f"[{canal}] FALHOU (codigo {r.returncode})\n{resumo}\n--- erro ---\n{cauda}"
    return f"[{canal}] OK\n{resumo}"


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
