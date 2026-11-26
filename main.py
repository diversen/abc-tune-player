"""Serve the ABC player and its current local tune library."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


def tune_index():
    directory = ROOT / "tunes"
    entries = []
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix.lower() == ".abc":
            file = path.relative_to(directory).as_posix()
            with path.open(encoding="utf-8-sig") as tune:
                title = next((line[2:].strip() for line in tune if line.startswith("T:")), "")
            entries.append({"file": file, "title": title or file})
    return entries


class PlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path != "/api/tunes":
            return super().do_GET()
        try:
            content = json.dumps(tune_index()).encode()
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
