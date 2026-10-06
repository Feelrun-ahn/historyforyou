"""web/ 폴더를 HTML 파일 하나로 묶기 (미리보기·오프라인 공유용).

실행: python pipeline/build_preview.py [출력경로]
결과: dist/history-map-preview.html (데이터까지 전부 들어 있는 단일 파일)

- MapLibre 는 jsDelivr CDN 에서 불러오고, 나머지(CSS, JS, 지도 데이터)는 파일 안에 넣어요.
- 지도 데이터는 gzip + base64 로 넣고, 브라우저의 DecompressionStream 으로 풀어요.
"""
from __future__ import annotations

import base64
import gzip
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
MAPLIBRE_VERSION = "5.24.0"


def block(name: str, html: str, replacement: str) -> str:
    pattern = re.compile(rf"<!--{name}-->.*?<!--/{name}-->", re.S)
    if not pattern.search(html):
        raise SystemExit(f"index.html 에 {name} 표시가 없어요")
    return pattern.sub(lambda _: replacement, html)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = pathlib.Path(args[0]) if args else ROOT / "dist" / "history-map-preview.html"
    html = (WEB / "index.html").read_text(encoding="utf-8")
    embed = {}
    for path in sorted((WEB / "data").glob("*.json")):
        raw = path.read_bytes()
        embed[path.name] = base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode("ascii")

    html = block("MAPLIBRE_CSS", html, "<style>" + (WEB / "vendor" / "maplibre-gl.css").read_text(encoding="utf-8") + "</style>")
    html = block("APP_CSS", html, "<style>" + (WEB / "style.css").read_text(encoding="utf-8") + "</style>")
    html = block("TOPOJSON_JS", html, "<script>" + (WEB / "vendor" / "topojson-client.min.js").read_text(encoding="utf-8") + "</script>")
    if "--inline-maplibre" in sys.argv:  # 인터넷 없이 테스트할 때
        html = block("MAPLIBRE_JS", html, "<script>" + (WEB / "vendor" / "maplibre-gl.js").read_text(encoding="utf-8") + "</script>")
    else:
        html = block("MAPLIBRE_JS", html, f'<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@{MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>')
    html = block("EMBED_DATA", html, "<script>window.__EMBED__=" + json.dumps(embed, separators=(",", ":")) + ";</script>")
    html = block("APP_JS", html, "<script>" + (WEB / "app.js").read_text(encoding="utf-8") + "</script>")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"완료: {out} ({out.stat().st_size / 1e6:.1f}MB)")


if __name__ == "__main__":
    main()
