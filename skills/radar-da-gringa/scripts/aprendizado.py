#!/usr/bin/env python3
"""Aprende com o engajamento dos Reels e sugere formato, tema e gancho dos próximos.

Uso (a partir da raiz do branch):
  python3 pipeline/aprendizado.py coletar insights.json   # resposta crua do vidiq_instagram_owner_insights
  python3 pipeline/aprendizado.py relatorio               # reescreve aprendizado.md
  python3 pipeline/aprendizado.py sugerir 2026-10-13 21:00   # sugestão para um slot "produzir"

Arquivos:
  agenda.json    cada item publicado tem "link" (shortcode do Reel) e "ficha" (formato, tema, gancho, origem)
  metricas.json  por shortcode: publicado, "atual", "h24" e "h72" (fotos das métricas ao passar 24 h e 72 h)
  aprendizado.md ranking por formato, tema, gancho, origem e horário (lido antes de produzir)

Nota de 0 a 100 por Reel, com a foto de 72 h (ou 24 h, ou a atual com 12 h ou mais, marcada provisória):
  35% quem não pulou (100 - skipRate), 25% % assistido, 30% interação por view
  (curtida + 2x comentário + 3x salvamento + 3x compartilhamento, teto em 4%), 10% views contra a mediana.
Views pesam pouco porque com conta nova o alcance oscila muito; retenção e interação dizem o que o público gostou.
"""
import json, os, random, re, statistics, sys
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENDA = os.path.join(RAIZ, "agenda.json")
METRICAS = os.path.join(RAIZ, "metricas.json")
RELATORIO = os.path.join(RAIZ, "aprendizado.md")
CAMPOS = ("playCount", "likeCount", "commentCount", "shares", "saves", "avgWatchTimeMs", "avgWatchedPct",
          "skipRate", "durationSeconds")
DIMENSOES = ("formato", "tema", "gancho", "origem", "slot")
# opções conhecidas; "sugerir" explora as menos testadas
OPCOES = {
    "formato": ["painel", "corte"],
    "tema": ["noticias", "preco_compra", "mito", "console_tecnico", "teoria", "golpe", "gameplay", "vazamento",
             "lancamento"],
    "gancho": ["pergunta", "lista", "mentira_verdade", "alerta", "comparacao", "revelacao"],
}
EXPLORAR = 0.3   # 30% das escolhas testam a opção menos testada
K = 2            # encolhe a média de quem tem poucos posts em direção à média geral
CORTAR_N, CORTAR_DIF = 3, 8   # pausa a opção com 3+ posts e média 8+ pontos abaixo da geral


def ler(p, padrao):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else padrao


def gravar(p, dado):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(dado, f, ensure_ascii=False, indent=1)
        f.write("\n")


def shortcode(link):
    m = re.search(r"/reel/([^/?#]+)", link or "")
    return m.group(1) if m else None


def parse_ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def coletar(caminho):
    resp = ler(caminho, {})
    reels = resp.get("reels") or []
    met = ler(METRICAS, {})
    agora = datetime.now(timezone.utc)
    for r in reels:
        sc = r.get("shortcode") or r.get("reelId")
        if not sc or not r.get("timestamp"):
            continue
        pub = parse_ts(r["timestamp"])
        horas = (agora - pub).total_seconds() / 3600
        foto = {k: r.get(k) for k in CAMPOS}
        foto.update(coletado=agora.strftime("%Y-%m-%dT%H:%MZ"), horas=round(horas, 1))
        m = met.setdefault(sc, {"publicado": r["timestamp"], "legenda": (r.get("caption") or "")[:80]})
        m["atual"] = foto
        for marco, h in (("h24", 24), ("h72", 72)):
            if horas >= h and marco not in m:
                m[marco] = foto
    gravar(METRICAS, met)
    print(len(reels), "reels lidos;", len(met), "no histórico")


def foto_valida(m):
    for marco in ("h72", "h24"):
        if marco in m:
            return m[marco], marco
    a = m.get("atual")
    if a and a.get("horas", 0) >= 12:
        return a, "provisória"
    return None, None


def nota(f, mediana):
    v = f.get("playCount") or 0
    if not v or f.get("skipRate") is None:
        return None
    ret = (100 - f["skipRate"]) / 100
    ass = min(f.get("avgWatchedPct") or 0, 100) / 100
    inter = ((f.get("likeCount") or 0) + 2 * (f.get("commentCount") or 0) + 3 * (f.get("saves") or 0)
             + 3 * (f.get("shares") or 0)) / v
    alc = min(1.0, v / (2 * mediana)) if mediana else 0.5
    return round(100 * (0.35 * ret + 0.25 * ass + 0.30 * min(1.0, inter / 0.04) + 0.10 * alc), 1)


def slot_de(hora):
    h = int((hora or "12:00").split(":")[0])
    return "12h" if h < 15 else "18h" if h < 20 else "21h"


def base_notas():
    """Lista de Reels publicados com ficha e nota."""
    agenda = ler(AGENDA, {"posts": []})
    met = ler(METRICAS, {})
    fotos = {sc: foto_valida(m) for sc, m in met.items()}
    views = [f["playCount"] for f, _ in fotos.values() if f and f.get("playCount")]
    mediana = statistics.median(views) if views else 0
    linhas = []
    for p in agenda["posts"]:
        sc = shortcode(p.get("link"))
        if p.get("status") != "postado" or not sc or sc not in fotos:
            continue
        f, marco = fotos[sc]
        if not f:
            continue
        n = nota(f, mediana)
        if n is None:
            continue
        ficha = dict(p.get("ficha") or {})
        ficha.setdefault("slot", slot_de(p.get("hora")))
        linhas.append({"sc": sc, "data": p.get("data"), "arquivo": p.get("arquivo"), "ficha": ficha, "nota": n,
                       "marco": marco, "foto": f})
    return linhas


def ranking(linhas):
    geral = statistics.mean(l["nota"] for l in linhas) if linhas else 50.0
    rk = {}
    for d in DIMENSOES:
        grupos = {}
        for l in linhas:
            v = l["ficha"].get(d)
            if v:
                grupos.setdefault(v, []).append(l["nota"])
        rk[d] = {}
        for v, ns in grupos.items():
            media = statistics.mean(ns)
            rk[d][v] = {"n": len(ns), "media": round(media, 1),
                        "ajustada": round((sum(ns) + K * geral) / (len(ns) + K), 1),
                        "pausado": len(ns) >= CORTAR_N and media < geral - CORTAR_DIF}
    return geral, rk


def sugerir(data, hora):
    linhas = base_notas()
    geral, rk = ranking(linhas)
    rnd = random.Random(f"{data} {hora}")
    out = {"slot": slot_de(hora), "base": f"{len(linhas)} reels com nota, média geral {geral:.1f}"}
    for d, opcoes in OPCOES.items():
        st = rk.get(d, {})
        vivas = [o for o in opcoes if not st.get(o, {}).get("pausado")]
        if rnd.random() < EXPLORAR or not st:
            menor = min(st.get(o, {}).get("n", 0) for o in vivas)
            escolha = rnd.choice([o for o in vivas if st.get(o, {}).get("n", 0) == menor])
            modo = "testar"
        else:
            escolha = max(vivas, key=lambda o: st.get(o, {}).get("ajustada", geral))
            modo = "melhor"
        out[d] = {"escolha": escolha, "modo": modo, "ordem": sorted(
            vivas, key=lambda o: -st.get(o, {}).get("ajustada", geral))}
    print(json.dumps(out, ensure_ascii=False, indent=1))


def relatorio():
    linhas = base_notas()
    geral, rk = ranking(linhas)
    hoje = datetime.now(timezone(timedelta(hours=-3))).strftime("%d/%m/%Y %H:%M")
    md = [f"# O que está funcionando no @radar.gta6br", "",
          f"Atualizado em {hoje} (Brasília) com {len(linhas)} Reels com nota. Média geral: {geral:.1f}/100.",
          "Gerado por `pipeline/aprendizado.py relatorio`; não editar à mão.", "",
          "Nota = 35% quem não pulou + 25% % assistido + 30% interação por view + 10% alcance.",
          "\"Ajustada\" puxa para a média geral quem tem poucos posts, para um post sortudo não decidir sozinho.", ""]
    nomes = {"formato": "Formato", "tema": "Tema", "gancho": "Gancho", "origem": "Origem", "slot": "Horário"}
    for d in DIMENSOES:
        st = rk.get(d) or {}
        if not st:
            continue
        md += [f"## {nomes[d]}", "", "| Opção | Posts | Média | Ajustada | |", "|---|---|---|---|---|"]
        for v, s in sorted(st.items(), key=lambda kv: -kv[1]["ajustada"]):
            md.append(f"| {v} | {s['n']} | {s['media']} | {s['ajustada']} | {'pausado' if s['pausado'] else ''} |")
        md.append("")
    md += ["## Reels", "", "| Data | Reel | Formato | Tema | Gancho | Views | Pularam | Assistido | Curt. | Coment. | Salv. | Comp. | Nota |",
           "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for l in sorted(linhas, key=lambda l: -l["nota"]):
        f, fi = l["foto"], l["ficha"]
        md.append(f"| {l['data']} | [{l['sc']}](https://www.instagram.com/reel/{l['sc']}/) | {fi.get('formato', '')} | "
                  f"{fi.get('tema', '')} | {fi.get('gancho', '')} | {f.get('playCount')} | {f.get('skipRate')}% | "
                  f"{round(f.get('avgWatchedPct') or 0)}% | {f.get('likeCount')} | {f.get('commentCount')} | "
                  f"{f.get('saves')} | {f.get('shares')} | {l['nota']} ({l['marco']}) |")
    md.append("")
    novos = [(sc, m["atual"]) for sc, m in ler(METRICAS, {}).items()
             if m.get("atual") and foto_valida(m)[0] is None]
    if novos:
        md += ["## Recentes (menos de 12 h, ainda sem nota)", ""]
        for sc, f in novos:
            md.append(f"- [{sc}](https://www.instagram.com/reel/{sc}/): {f.get('horas')} h no ar, {f.get('playCount')} views, "
                      f"{f.get('skipRate')}% pularam, {round(f.get('avgWatchedPct') or 0)}% assistido, {f.get('likeCount')} curtidas")
        md.append("")
    with open(RELATORIO, "w", encoding="utf-8") as fh:
        fh.write("\n".join(md))
    print("\n".join(md))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "relatorio"
    if cmd == "coletar":
        coletar(sys.argv[2]); relatorio()
    elif cmd == "sugerir":
        sugerir(sys.argv[2], sys.argv[3])
    else:
        relatorio()
