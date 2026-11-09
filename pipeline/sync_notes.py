"""data/notes_ko.yaml 의 '알아 두기' 설명만 web/data/index.json 에 다시 넣기 (전체 빌드 없이).

실행: python pipeline/sync_notes.py
"""
from __future__ import annotations

import json
import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main() -> None:
    notes = yaml.safe_load((ROOT / "data" / "notes_ko.yaml").read_text(encoding="utf-8")) or {}
    path = ROOT / "web" / "data" / "index.json"
    raw = path.read_text(encoding="utf-8")
    idx = json.loads(raw)
    changed = 0
    for p in idx["polities"]:
        new = str(notes[p["n"]]).strip() if p["n"] in notes else None
        if new and p.get("note") != new:
            p["note"] = new
            changed += 1
    compact = "\n" not in raw.strip()
    path.write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(idx, ensure_ascii=False),
                    encoding="utf-8")
    print(f"설명 {changed}개 바꿈 → web/data/index.json")


if __name__ == "__main__":
    main()
