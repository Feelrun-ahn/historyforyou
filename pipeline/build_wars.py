"""전쟁·전투 데이터 만들기 → web/data/wars.json

실행: python pipeline/build_wars.py   (build_web.py 다음에, 또는 build_web.py 가 마지막에 자동 실행)
- data/wars/*.yaml          : 직접 정리한 전쟁 (검수 대상)
- data/wars_wikidata.json   : 위키데이터에서 자동으로 모은 전투 (있을 때만, fetch_wikidata_wars.py)
"""
from __future__ import annotations

import json
import math
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "data" / "wars.json"


DATE_RE = re.compile(r"(기원전\s*)?(\d{1,4})년\s*(?:음력\s*)?(\d{1,2})월(?:\s*(\d{1,2})일)?")


def dn(y: int, m: int = 1, d: int = 1) -> int:
    """날짜 → 정렬·보간용 일련번호 (한 달 31일, 한 해 372일로 단순화)."""
    return y * 372 + (m - 1) * 31 + (d - 1)


def battle_dn(text: str, year: int) -> int:
    m = DATE_RE.search(text)
    if m:
        y = int(m.group(2)) * (-1 if m.group(1) else 1)
        if y == year:
            return dn(year, int(m.group(3)), int(m.group(4) or 1))
    return dn(year)


def parse_point_date(v):
    """'1592-04-14', '1018-12', '1592-05-07?' → (일련번호, 표시할지)."""
    if v is None:
        return None, False
    s = str(v).strip()
    show = not s.endswith("?")
    parts = split_date(s.rstrip("?"))
    return dn(*parts), show and len(parts) >= 2


def split_date(s: str) -> list[int]:
    neg = s.startswith("-")
    parts = [int(x) for x in s.lstrip("-").split("-")]
    if neg:
        parts[0] = -parts[0]
    return parts


def fmt_date(v, cal: str) -> str:
    parts = split_date(str(v).rstrip("?"))
    lunar = "음력 " if cal == "lunar" else ""
    y = f"기원전 {-parts[0]}" if parts[0] < 0 else str(parts[0])
    if len(parts) == 3:
        return f"{y}년 {lunar}{parts[1]}월 {parts[2]}일"
    return f"{y}년 {lunar}{parts[1]}월"


def build_route(r: dict, cal: str) -> dict:
    pts = r["path"]
    xy = [(float(p[0]), float(p[1])) for p in pts]
    dates = [parse_point_date(p[2] if len(p) > 2 else None) for p in pts]
    known = [i for i, (d, _) in enumerate(dates) if d is not None]
    if not known:
        raise ValueError(f"{r['name']}: 날짜가 하나도 없어요")
    cum = [0.0]
    for (x0, y0), (x1, y1) in zip(xy, xy[1:]):
        cum.append(cum[-1] + math.hypot(x1 - x0, y1 - y0))
    vals = [d for d, _ in dates]
    for i in range(len(vals)):
        if vals[i] is not None:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        if prev is None:
            vals[i] = vals[nxt]
        elif nxt is None:
            vals[i] = vals[prev]
        else:
            span = cum[nxt] - cum[prev] or 1
            vals[i] = round(vals[prev] + (vals[nxt] - vals[prev]) * (cum[i] - cum[prev]) / span)
    out = []
    for i, p in enumerate(pts):
        label = p[3] if len(p) > 3 else None
        text = (str(p[4]) if len(p) > 4 and p[4] else fmt_date(p[2], cal)) if dates[i][1] else None
        out.append([xy[i][0], xy[i][1], int(vals[i]), label, text])
    route = {"name": r["name"], "short": r.get("short", r["name"]), "side": int(r.get("side", 1)),
             "note": r.get("note", ""), "pts": out}
    if r.get("label"):  # 편 이름 대신 보여 줄 군대 이름 (예: 청, 일본 — 같은 색 편이지만 다른 나라)
        route["sl"] = str(r["label"])
    return route


def main() -> int:
    index = json.loads((ROOT / "web" / "data" / "index.json").read_text(encoding="utf-8"))
    by_name = {p["n"]: i for i, p in enumerate(index["polities"])}
    wars, problems = [], []
    seen_ids, used_routes = set(), set()
    routes_by_war: dict = {}
    for path in sorted((ROOT / "data" / "wars").glob("*_routes.yaml")):
        routes_by_war.update(yaml.safe_load(path.read_text(encoding="utf-8")) or {})
    for path in sorted((ROOT / "data" / "wars").glob("*.yaml")):
        if path.name.endswith("_routes.yaml"):
            continue
        for w in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
            sides = []
            for s in w["sides"]:
                idx = []
                for n in s.get("polities", []):
                    if n in by_name:
                        idx.append(by_name[n])
                    else:
                        problems.append(f"{w['id']}: 지도에 없는 나라 이름 '{n}'")
                sides.append({"label": s["label"], "p": idx})
            battles = []
            for b in w.get("battles", []):
                y = int(b["year"])
                if not (w["years"][0] <= y <= w["years"][1]):
                    problems.append(f"{w['id']}: '{b['name']}' 연도 {y} 가 전쟁 기간 밖")
                battles.append({
                    "name": b["name"], "date": str(b["date"]), "y": y,
                    "x": float(b["at"][0]), "yy": float(b["at"][1]),
                    "win": b.get("winner"), "imp": int(b.get("imp", 1)),
                    "approx": bool(b.get("approx")), "event": bool(b.get("event")),
                    "note": str(b.get("note", "")),
                    "dn": dn(*split_date(str(b["sort"]))) if b.get("sort") else battle_dn(str(b["date"]), y),
                    **({"wl": str(b["winlabel"])} if b.get("winlabel") else {}),  # 편 이름 대신 실제로 싸운 쪽 (예: 조선만 싸움)
                })
            battles.sort(key=lambda b: b["dn"])
            if w["id"] in seen_ids:
                problems.append(f"{w['id']}: 전쟁 id 가 겹쳐요")
            seen_ids.add(w["id"])
            rinfo = routes_by_war.get(w["id"], {})
            used_routes.add(w["id"])
            routes = []
            for r in rinfo.get("routes", []):
                try:
                    routes.append(build_route(r, rinfo.get("cal", "lunar")))
                except Exception as e:  # 경로 하나가 틀려도 나머지는 만들기
                    problems.append(f"{w['id']}: 진격로 '{r.get('name')}' 문제 - {e}")
            wars.append({
                "id": w["id"], "name": w["name"], "en": w.get("en", ""),
                "f": int(w["years"][0]), "t": int(w["years"][1]), "period": str(w.get("period", "")),
                "sides": sides, "cause": w.get("cause", ""), "result": w.get("result", ""), **({"dx": str(w["x"]).strip()} if w.get("x") else {}),
                "src": "curated", "battles": battles, "routes": routes, "cal": rinfo.get("cal", w.get("cal", "lunar")),
                "region": w.get("region", "korea"),
                "group": w.get("group", ""), "aka": list(w.get("aka", [])),
            })

    for k in routes_by_war:
        if k not in used_routes:
            problems.append(f"진격로 키 '{k}' 에 맞는 전쟁이 없어요")

    auto_path = ROOT / "data" / "wars_wikidata.json"
    auto = []
    if auto_path.exists():
        curated_names = {b["name"] for w in wars for b in w["battles"]}
        for b in json.loads(auto_path.read_text(encoding="utf-8")):
            name = b.get("ko") or b.get("en")
            if not name or name in curated_names:
                continue
            auto.append({"name": name, "en": b.get("en", ""), "y": int(b["y"]), "x": b["x"], "yy": b["yy"],
                         "war": b.get("war_ko") or b.get("war_en") or "", "kowiki": b.get("kowiki"), "q": b.get("q")})

    OUT.write_text(json.dumps({"wars": wars, "auto": auto}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"전쟁 {len(wars)}개, 전투 {sum(len(w['battles']) for w in wars)}개, 진격로 {sum(len(w['routes']) for w in wars)}개, "
          f"자동 수집 전투 {len(auto)}개 → {OUT.relative_to(ROOT)}")
    for p in problems:
        print("  확인 필요:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
