"""Agenda um video ja produzido e aprovado: confere o canal, calcula o horario e sobe como privado agendado."""
import importlib.util, json, os, sys

RAIZ = r"C:\claude-skills"
canal_dir, upload_json = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("produce_en", os.path.join(RAIZ, "motor-en", "produce.py"))
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
c = p.ler_canal(canal_dir); p.aplicar_ambiente(c)
import yt_upload
yt_upload.configurar(c["prefixo"], c["idioma"])
yt_upload.verificar_canal(c.get("canal_titulo"))
ja = yt_upload.publicados()
v = json.load(open(upload_json, encoding="utf-8"))
cod = [t for t in v["tags"] if t.startswith(c["prefixo"])][-1]
if cod in ja:
    sys.exit(f"{cod} ja esta no canal: nada a fazer")
ocupados = {x["publishAt"][:13] for x in ja.values() if x.get("publishAt")}
slot = sys.argv[3] if len(sys.argv) > 3 else p.proximo_horario(c, ocupados)
if slot == "agora":  # publica na hora, publico (sem agendamento)
    v["privacidad"] = "public"; v.pop("publicar_em", None)
    json.dump(v, open(upload_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    r = yt_upload.subir(upload_json, c.get("canal_titulo"))
    sys.exit(print(f"PUBLICADO {cod} https://youtu.be/{r['id']}") or 0)
print("publica em", slot, "UTC =", p.hora_local_de(c, slot), flush=True)
v["publicar_em"] = slot
json.dump(v, open(upload_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
r = yt_upload.subir(upload_json, c.get("canal_titulo"))
print(f"AGENDADO {cod} https://youtu.be/{r['id']}")
