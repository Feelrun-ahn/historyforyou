"""국제 관계·세력 흐름 → web/data/relations.json, web/data/factions.json

실행: python pipeline/build_korea_extra.py
- data/korea/capitals.yaml  : 나라별 도읍 (연결선 양 끝)
- data/korea/relations.yaml : 동맹·사대·교류·사절 길·대립·조약
- data/korea/factions.yaml  : 시대별 정치 세력의 갈라짐과 집권
- data/korea/rulers.yaml    : 왕·지도자 목록 ('한눈에' 카드)
- data/korea/rivers.geojson : 한반도 주요 강 (Natural Earth + 대략 그린 선)
"""
from __future__ import annotations

import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "korea"
OUT = ROOT / "web" / "data"
TYPES = ["alliance", "tribute", "trade", "route", "rivalry", "treaty", "occupy"]
MARK_KINDS = ["사화", "환국", "예송", "정변", "분열", "개혁", "기타"]


def pt(p):
    return [round(float(p[0]), 4), round(float(p[1]), 4), str(p[2]) if len(p) > 2 else ""]


def main() -> int:
    problems: list[str] = []
    caps_raw = yaml.safe_load((SRC / "capitals.yaml").read_text(encoding="utf-8"))
    caps = {}
    for name, rows in caps_raw.items():
        rows = sorted(rows, key=lambda r: r[0])
        caps[name] = [[int(r[0]), round(float(r[1]), 4), round(float(r[2]), 4), str(r[3])] for r in rows]

    rels, seen = [], set()
    for r in yaml.safe_load((SRC / "relations.yaml").read_text(encoding="utf-8")):
        rid = r.get("id")
        if rid in seen:
            problems.append(f"관계 id 겹침: {rid}")
        seen.add(rid)
        if r.get("type") not in TYPES:
            problems.append(f"{rid}: 종류 '{r.get('type')}' 를 모르겠어요")
        for k in ("a", "b"):
            if r.get(k) not in caps:
                problems.append(f"{rid}: 도읍 목록에 '{r.get(k)}' 가 없어요")
        if int(r["to"]) < int(r["from"]):
            problems.append(f"{rid}: 끝 연도가 시작보다 빨라요")
        if r["type"] == "route" and not r.get("via"):
            problems.append(f"{rid}: 사절·이동 길(route)에는 via 가 필요해요")
        row = {"id": rid, "n": r["name"], "type": r["type"], "f": int(r["from"]), "t": int(r["to"]),
               "a": r["a"], "b": r["b"], "imp": int(r.get("imp", 2)), "d": str(r["desc"]).strip()}
        if r.get("via"):
            row["via"] = [pt(p) for p in r["via"]]
        if r.get("fan"):
            row["fan"] = [pt(p) for p in r["fan"]]
        if r.get("bloc"):
            row["bloc"] = r["bloc"]
        if r.get("pg"):
            row["pg"] = int(r["pg"])
        rels.append(row)
    rels.sort(key=lambda r: (r["f"], -r["imp"]))
    (OUT / "relations.json").write_text(json.dumps({"caps": caps, "rels": rels}, ensure_ascii=False, separators=(",", ":")),
                                        encoding="utf-8")

    eras = []
    for e in yaml.safe_load((SRC / "factions.yaml").read_text(encoding="utf-8")):
        ids = {g["id"] for g in e["groups"]}
        groups = []
        for g in e["groups"]:
            parents = list(g.get("parents") or ([g["parent"]] if g.get("parent") else []))
            for p in parents:
                if p not in ids:
                    problems.append(f"{e['era']}/{g['id']}: 부모 '{p}' 가 없어요")
            for a, b in g.get("rule", []):
                if not (g["from"] <= a <= b <= g["to"] + 1):
                    problems.append(f"{e['era']}/{g['id']}: 집권 기간 {a}~{b} 가 세력 기간 밖이에요")
            groups.append({"id": g["id"], "n": g["n"], "f": int(g["from"]), "t": int(g["to"]),
                           "par": parents, "rule": [[int(a), int(b)] for a, b in g.get("rule", [])],
                           "d": str(g["desc"]).strip()})
        marks = []
        for m in e.get("marks", []):
            if m.get("kind") not in MARK_KINDS:
                problems.append(f"{e['era']}: 사건 종류 '{m.get('kind')}' 를 모르겠어요")
            marks.append({"y": int(m["y"]), "n": m["n"], "k": m["kind"]})
        eras.append({"id": e["era"], "n": e["name"], "f": int(e["from"]), "t": int(e["to"]),
                     "intro": str(e.get("intro", "")).strip(), "pg": e.get("pg", []), "groups": groups, "marks": marks})
    (OUT / "factions.json").write_text(json.dumps(eras, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    rul = yaml.safe_load((SRC / "rulers.yaml").read_text(encoding="utf-8"))
    states = []
    for st in rul["states"]:
        rows = []
        for k in st["list"]:
            f, t = int(k["f"]), int(k["t"])
            if t < f:
                problems.append(f"{st['id']}/{k['n']}: 끝 연도가 시작보다 빨라요")
            row = {"n": k["n"], "f": f, "t": t}
            if k.get("spans"):
                row["sp"] = [[int(a), int(b)] for a, b in k["spans"]]
                if any(a < f or b > t for a, b in row["sp"]):
                    problems.append(f"{st['id']}/{k['n']}: spans 가 재위 기간 밖이에요")
            if k.get("d"):
                row["d"] = str(k["d"]).strip()
            if k.get("pg"):
                row["pg"] = int(k["pg"])
            rows.append(row)
        states.append({"id": st["id"], "n": st["n"], "title": st.get("title", "왕"), "pol": list(st.get("pol", [])),
                       "note": st.get("note", ""), "list": rows})
    periods = [{"f": int(x["f"]), "t": int(x["t"]), "n": x["n"], "d": str(x.get("d", "")).strip(), "pg": x.get("pg")}
               for x in rul.get("periods", [])]
    (OUT / "rulers.json").write_text(json.dumps({"states": states, "periods": periods}, ensure_ascii=False, separators=(",", ":")),
                                     encoding="utf-8")
    print(f"왕·지도자 {sum(len(s['list']) for s in states)}명 ({len(states)}개 나라) → web/data/rulers.json")
    rv = json.loads((SRC / "rivers.geojson").read_text(encoding="utf-8"))
    (OUT / "rivers_ko.json").write_text(json.dumps({"type": "FeatureCollection", "features": rv["features"]}, ensure_ascii=False, separators=(",", ":")),
                                        encoding="utf-8")
    print(f"한반도 강 {len(rv['features'])}줄기 → web/data/rivers_ko.json")
    print(f"국제 관계 {len(rels)}개 (도읍 {len(caps)}곳), 세력 흐름 {len(eras)}개 시대 "
          f"({sum(len(e['groups']) for e in eras)}개 세력) → web/data/relations.json, factions.json")
    for p in problems:
        print("  확인 필요:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
