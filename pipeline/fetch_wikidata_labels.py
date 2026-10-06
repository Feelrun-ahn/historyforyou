"""위키데이터에서 나라들의 한국어 이름과 한국어 위키백과 문서 제목 가져오기.

실행: python pipeline/fetch_wikidata_labels.py
결과: data/names_ko_wikidata.json  ({"Q123": {"ko": "...", "kowiki": "..."}})

- data/names_ko.yaml 에 없는 나라만 이 이름을 써요 (build_web.py 참고)
- 여러 나라가 같은 위키데이터 ID 를 쓰는 경우(원본 오류)는 build_web.py 에서 걸러요
"""
from __future__ import annotations

import json
import pathlib
import time
import urllib.parse
import urllib.request

import geopandas as gpd

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "names_ko_wikidata.json"
API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "history-map/0.2 (https://github.com/feelrun-ahn/history-map; educational project)"
BATCH = 50


def fetch_batch(ids: list[str]) -> dict:
    params = {
        "action": "wbgetentities", "ids": "|".join(ids), "props": "labels|sitelinks",
        "languages": "ko", "sitefilter": "kowiki", "format": "json",
    }
    req = urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # 잠깐 막히면 조금 쉬었다 다시
            wait = 2 ** attempt
            print(f"  다시 시도 ({e}), {wait}초 대기")
            time.sleep(wait)
    raise RuntimeError("위키데이터 요청이 계속 실패했어요")


def parse(resp: dict) -> dict:
    out = {}
    for qid, ent in (resp.get("entities") or {}).items():
        if "missing" in ent:
            continue
        ko = ((ent.get("labels") or {}).get("ko") or {}).get("value")
        kowiki = ((ent.get("sitelinks") or {}).get("kowiki") or {}).get("title")
        if ko or kowiki:
            out[qid] = {k: v for k, v in (("ko", ko), ("kowiki", kowiki)) if v}
    return out


def main() -> None:
    gdf = gpd.read_file(ROOT / "data" / "raw" / "cliopatria.geojson", columns=["Wikidata"], ignore_geometry=True)
    qids = sorted({q.strip() for q in gdf.Wikidata.dropna() if str(q).strip().startswith("Q")})
    print(f"위키데이터 ID {len(qids)}개 조회")
    result: dict = {}
    for i in range(0, len(qids), BATCH):
        result.update(parse(fetch_batch(qids[i:i + BATCH])))
        time.sleep(0.5)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    print(f"완료: 한국어 정보가 있는 항목 {len(result)}개 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
