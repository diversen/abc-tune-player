"""Serve the ABC player and its current local tune library."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from update_tunes import read_songs

ROOT = Path(__file__).resolve().parent


class PlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path != "/api/tunes":
            return super().do_GET()
        try:
            content = json.dumps(read_songs(ROOT / "tunes")).encode()
        except (OSError, UnicodeError):
            self.send_error(500, "Could not read the tune library")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 8765), PlayerHandler) as server:
        print("ABC-afspiller: http://localhost:8765", flush=True)
        server.serve_forever()
