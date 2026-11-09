"""위키데이터에서 전 세계 전투(좌표·연도 있는 것)를 자동으로 모으기 → data/wars_wikidata.json

실행: python pipeline/fetch_wikidata_wars.py   (GitHub Actions '데이터 다시 만들기'에서 자동 실행)
- 위키데이터(CC0)라 자유롭게 쓸 수 있지만 검수 전 데이터예요. 지도에는 '자동 수집'으로 따로 표시돼요.
- 기원전 연도는 위키데이터 표기 방식 때문에 1년 정도 차이가 날 수 있어요.
"""
from __future__ import annotations

import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "wars_wikidata.json"
ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "history-map/0.4 (https://github.com/feelrun-ahn/history-map; educational project)"

QUERY = """
SELECT ?b ?time ?coord ?en ?ko ?kowiki ?war ?warEn ?warKo WHERE {
  VALUES ?type { wd:Q178561 wd:Q188055 }
  ?b wdt:P31 ?type ; wdt:P625 ?coord .
  OPTIONAL { ?b wdt:P585 ?t1 }
  OPTIONAL { ?b wdt:P580 ?t2 }
  BIND(COALESCE(?t1, ?t2) AS ?time)
  FILTER(BOUND(?time))
  OPTIONAL { ?b rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?b rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
  OPTIONAL { ?kw schema:about ?b ; schema:isPartOf <https://ko.wikipedia.org/> ; schema:name ?kowiki }
  OPTIONAL { ?b wdt:P361 ?war .
             OPTIONAL { ?war rdfs:label ?warEn FILTER(LANG(?warEn) = "en") }
             OPTIONAL { ?war rdfs:label ?warKo FILTER(LANG(?warKo) = "ko") } }
}
"""


def run_query() -> dict:
    data = urllib.parse.urlencode({"query": QUERY, "format": "json"}).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as e:
            wait = 10 * (attempt + 1)
            print(f"  다시 시도 ({e}), {wait}초 대기")
            time.sleep(wait)
    raise RuntimeError("위키데이터 질의가 계속 실패했어요")


POINT = re.compile(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)")
YEAR = re.compile(r"^(-?)(\d{1,6})-")


def parse(resp: dict) -> list[dict]:
    seen: dict[str, dict] = {}
    for row in resp.get("results", {}).get("bindings", []):
        v = {k: x["value"] for k, x in row.items()}
        q = v["b"].rsplit("/", 1)[-1]
        m = POINT.search(v.get("coord", ""))
        y = YEAR.match(v.get("time", ""))
        if not m or not y:
            continue
        year = int(y.group(2)) * (-1 if y.group(1) else 1)
        if year == 0:
            year = -1
        item = seen.setdefault(q, {
            "q": q, "y": year, "x": round(float(m.group(1)), 4), "yy": round(float(m.group(2)), 4),
            "en": v.get("en", ""), "ko": v.get("ko", ""), "kowiki": v.get("kowiki"),
            "war_en": v.get("warEn", ""), "war_ko": v.get("warKo", ""),
        })
        if not item["war_ko"] and v.get("warKo"):
            item["war_ko"] = v["warKo"]
    out = [b for b in seen.values() if -3400 <= b["y"] <= 2024]
    out.sort(key=lambda b: (b["y"], b["q"]))
    return out


def main() -> None:
    battles = parse(run_query())
    OUT.write_text(json.dumps(battles, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"완료: 전투 {len(battles)}개 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
