"""Rebuild the offline song selector from the ABC files in tunes/."""
import json
from pathlib import Path


def read_songs(directory):
    songs = {}
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix.lower() == ".abc":
            songs[path.relative_to(directory).as_posix()] = path.read_text(encoding="utf-8-sig")
    return songs


def main():
    root = Path(__file__).resolve().parent
    songs = read_songs(root / "tunes")
    catalog = root / "tunes-library.js"
    data = "const tuneLibrary = " + json.dumps(songs, ensure_ascii=False, indent=2) + ";\n"
    catalog.write_text(data, encoding="utf-8")
    print(f"{len(songs)} ABC-filer i melodivælgeren.")


if __name__ == "__main__":
    main()
