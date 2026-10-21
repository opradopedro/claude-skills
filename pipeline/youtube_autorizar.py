"""Autoriza o canal do YouTube uma vez só, no PC do Pedro, e mostra o YT_REFRESH_TOKEN.

Uso (no PC, com o navegador logado no canal):
  set YT_CLIENT_ID=...   e   set YT_CLIENT_SECRET=...   (do cliente OAuth "App para computador")
  python pipeline/youtube_autorizar.py
O token aparece só no terminal: cole direto nas variáveis do ambiente na nuvem, nunca no chat.
"""
import http.server, json, os, urllib.parse, urllib.request, webbrowser

CID, SEC = os.environ["YT_CLIENT_ID"], os.environ["YT_CLIENT_SECRET"]
PORTA = 8765
REDIR = f"http://127.0.0.1:{PORTA}"
url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
    "client_id": CID, "redirect_uri": REDIR, "response_type": "code", "access_type": "offline", "prompt": "consent",
    "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"})
codigo = {}


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        codigo["c"] = q.get("code", [""])[0]
        self.send_response(200); self.end_headers()
        self.wfile.write("Pronto, pode fechar esta aba e voltar ao terminal.".encode())

    def log_message(self, *a):
        pass


print("Abrindo o navegador. Se não abrir, cole este link:\n" + url)
webbrowser.open(url)
http.server.HTTPServer(("127.0.0.1", PORTA), H).handle_request()
dados = urllib.parse.urlencode({"code": codigo["c"], "client_id": CID, "client_secret": SEC,
                                "redirect_uri": REDIR, "grant_type": "authorization_code"}).encode()
r = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", dados))
print("\nYT_REFRESH_TOKEN=" + r["refresh_token"])
