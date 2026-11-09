"""한국사 지도 화면 데이터 만들기 → web/data/korea_map.json

실행: python pipeline/build_korea_map.py

담는 것
- admin: 시대별 지방 행정 구역
    joseon8  조선 8도 (1413~1895) — 오늘날 시·도 경계(Natural Earth)를 합쳐 만든 대략적인 모양
    daehan13 13도 (1896~1945)    — 같은 방법
    points   통일 신라 9주 5소경·고려 5도 양계·조선 감영 같은 중심지 (data/korea/admin/points.yaml)
- themes: 교과서 지도 (data/korea/themes/*.yaml)
- inst: 통치 체제 그림 (data/korea/institutions.yaml)
- terms: 교과서 용어 사전 (data/korea/terms.yaml)
- hanyang: 한양 도성 지도 (data/korea/hanyang.yaml)
- faction: 붕당 지도 (data/korea/faction_map.yaml)
형식: data/korea/themes/README.md

필요한 것: shapely, pyyaml
"""
from __future__ import annotations

import json
import pathlib
import sys

import yaml
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "korea"
OUT = ROOT / "web" / "data" / "korea_map.json"

# 오늘날 시·도(Natural Earth 이름) → 옛 도
JOSEON8 = {
    "경기도": ["경기도", "서울특별시", "인천광역시"],
    "충청도": ["충청북도", "충청남도", "대전광역시", "세종특별자치시"],
    "전라도": ["전라북도", "전라남도", "광주광역시"],
    "경상도": ["경상북도", "경상남도", "부산광역시", "울산광역시", "대구광역시"],
    "강원도": ["강원도"],
    "황해도": ["황해북도", "황해남도"],
    "평안도": ["평안북도", "평안남도", "자강도", "평양직할시"],
    "함경도": ["함경북도", "함경남도", "량강도", "라선특별시"],
}
DAEHAN13 = {
    "경기도": ["경기도", "서울특별시", "인천광역시"],
    "충청북도": ["충청북도"],
    "충청남도": ["충청남도", "대전광역시", "세종특별자치시"],
    "전라북도": ["전라북도"],
    "전라남도": ["전라남도", "광주광역시"],
    "경상북도": ["경상북도", "대구광역시"],
    "경상남도": ["경상남도", "부산광역시", "울산광역시"],
    "강원도": ["강원도"],
    "황해도": ["황해북도", "황해남도"],
    "평안북도": ["평안북도", "자강도"],
    "평안남도": ["평안남도", "평양직할시"],
    "함경북도": ["함경북도", "라선특별시"],
    "함경남도": ["함경남도", "량강도"],
}
# 개성 일대 (오늘날 북한 황해북도) — 조선 때는 경기도
KAESONG = Polygon([(126.30, 37.80), (126.45, 37.72), (126.68, 37.74), (126.86, 37.86), (126.90, 38.02),
                   (126.78, 38.14), (126.55, 38.17), (126.36, 38.06)])
# 오늘날 북한 강원도의 북쪽(원산·안변·문천 일대) — 조선 때는 함경도
WONSAN = Polygon([(126.9, 38.86), (128.2, 38.86), (128.2, 39.6), (126.9, 39.6)])
# 울릉도 (오늘날 경상북도) — 조선 때는 강원도, 1914년부터 경상북도
ULLEUNG_BOX = Polygon([(130.6, 37.3), (131.2, 37.3), (131.2, 37.7), (130.6, 37.7)])
# 제주 — 조선 때는 전라도에 속했지만 교과서 지도처럼 따로 보여 줘요 (do 속성으로 소속을 적음)


def load_provinces():
    gj = json.loads((SRC / "admin" / "ne_korea_provinces.geojson").read_text(encoding="utf-8"))
    out = {}
    for f in gj["features"]:
        out[f["properties"]["name_ko"]] = shape(f["geometry"]).buffer(0)
    # 강원도가 남·북 두 개라 합쳐요
    kw = [shape(f["geometry"]).buffer(0) for f in gj["features"] if f["properties"]["name_ko"] == "강원도"]
    out["강원도"] = unary_union(kw)
    return out


def clean(g, tol=0.008):
    g = g.buffer(0).simplify(tol, preserve_topology=True)
    m = mapping(g)

    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], 3), round(c[1], 3)]
        return [rnd(x) for x in c]
    m["coordinates"] = rnd(m["coordinates"])
    return m


def build_layer(groups: dict, prov: dict, era: str):
    geoms = {}
    for do, parts in groups.items():
        geoms[do] = unary_union([prov[p] for p in parts])
    # 개성은 경기로
    kae = unary_union([geoms["황해도"].intersection(KAESONG)])
    geoms["황해도"] = geoms["황해도"].difference(KAESONG)
    geoms["경기도"] = unary_union([geoms["경기도"], kae])
    # 원산 일대는 함경(남)도로
    ham = "함경도" if era == "joseon8" else "함경남도"
    w = geoms["강원도"].intersection(WONSAN)
    geoms["강원도"] = geoms["강원도"].difference(WONSAN)
    geoms[ham] = unary_union([geoms[ham], w])
    # 울릉도는 따로
    gb = "경상도" if era == "joseon8" else "경상북도"
    ull = geoms[gb].intersection(ULLEUNG_BOX)
    geoms[gb] = geoms[gb].difference(ULLEUNG_BOX)
    feats = []
    for do, g in geoms.items():
        feats.append({"type": "Feature", "properties": {"id": do, "n": do, "do": do}, "geometry": clean(g)})
    jeju = prov["제주특별자치도"]
    feats.append({"type": "Feature", "properties": {"id": "제주", "n": "제주", "do": "전라도" if era == "joseon8" else "전라남도"}, "geometry": clean(jeju)})
    if era == "joseon8":
        feats.append({"type": "Feature", "properties": {"id": "울릉도", "n": "울릉도", "do": "강원도"}, "geometry": clean(ull, 0.002)})
    else:
        feats.append({"type": "Feature", "properties": {"id": "울릉도", "n": "울릉도", "do": "강원도", "t": 1913}, "geometry": clean(ull, 0.002)})
        feats.append({"type": "Feature", "properties": {"id": "울릉도(경북)", "n": "울릉도", "do": "경상북도", "f": 1914}, "geometry": clean(ull, 0.002)})
    # 이름표 자리 (도 안쪽의 대표 점)
    for f in feats:
        g = shape(f["geometry"])
        p = g.representative_point()
        f["properties"]["lx"], f["properties"]["ly"] = round(p.x, 3), round(p.y, 3)
    return feats


def load_yaml_dir(d: pathlib.Path):
    out = []
    if not d.exists():
        return out
    for p in sorted(d.glob("*.yaml")):
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or []
        if isinstance(data, dict):
            data = [data]
        for t in data:
            t["_file"] = p.name
            out.append(t)
    return out


def check_theme(t, problems):
    for k in ("id", "n", "f", "t"):
        if k not in t:
            problems.append(f"{t.get('_file')}: '{t.get('id')}' 에 {k} 가 없어요")
    for kind in ("points", "lines", "regions", "areas", "labels"):
        for it in t.get(kind, []) or []:
            if kind in ("points", "labels") and not (isinstance(it.get("at"), list) and len(it["at"]) == 2):
                problems.append(f"{t['id']}: {kind} '{it.get('n')}' 좌표가 이상해요")
            if kind == "lines" and len(it.get("path", [])) < 2:
                problems.append(f"{t['id']}: 선 '{it.get('n')}' 점이 모자라요")
            if kind == "areas" and len(it.get("poly", [])) < 3:
                problems.append(f"{t['id']}: 구역 '{it.get('n')}' 점이 모자라요")


ERAS = ["선사·고조선", "여러 나라", "삼국", "남북국", "고려", "조선 전기", "조선 후기", "근대", "일제 강점기", "현대"]
TERM_KINDS = {"제도", "사회", "경제", "문화유산", "유적·유물", "책·기록", "예술", "사상·종교", "인물", "사건", "장소", "개념"}


def check_links(themes, inst, terms, hanyang, faction, problems):
    """사건 id·통치 체제 id·세력 id 가 실제로 있는지 확인해요."""
    ev_ids = set()
    for p in (SRC / "events").glob("*.yaml"):
        for ev in yaml.safe_load(p.read_text(encoding="utf-8")) or []:
            ev_ids.add(ev.get("id"))
    fac_ids = set()
    for era in yaml.safe_load((SRC / "factions.yaml").read_text(encoding="utf-8")) or []:
        for g in era.get("groups", []):
            fac_ids.add(g["id"])
    inst_ids = {x["id"] for x in inst}
    if len(inst_ids) != len(inst):
        problems.append("통치 체제 id 가 겹쳐요")
    for x in inst:
        ids = {n.get("id") for n in x.get("nodes", [])}
        for n in x.get("nodes", []):
            if n.get("p") and n["p"] not in ids:
                problems.append(f"통치 체제 {x['id']}: '{n.get('n')}' 의 윗 상자 {n['p']} 가 없어요")
    names = set()
    for t in terms:
        if t["n"] in names:
            problems.append(f"용어가 겹쳐요: {t['n']}")
        names.add(t["n"])
        if t.get("era") not in ERAS:
            problems.append(f"용어 {t['n']}: 시대 '{t.get('era')}' 를 모르겠어요")
        if t.get("k") not in TERM_KINDS:
            problems.append(f"용어 {t['n']}: 종류 '{t.get('k')}' 를 모르겠어요")
        for e in t.get("ev", []) or []:
            if e not in ev_ids:
                problems.append(f"용어 {t['n']}: 사건 id {e} 가 없어요")
        if t.get("inst") and t["inst"] not in inst_ids:
            problems.append(f"용어 {t['n']}: 통치 체제 id {t['inst']} 가 없어요")
        for f in t.get("fac", []) or []:
            if f not in fac_ids:
                problems.append(f"용어 {t['n']}: 세력 id {f} 가 없어요")
    for pl in (hanyang or {}).get("places", []):
        for e in pl.get("ev", []) or []:
            if e not in ev_ids:
                problems.append(f"한양 {pl['n']}: 사건 id {e} 가 없어요")
    for kind in ("regions", "schools", "houses", "places"):
        for it in (faction or {}).get(kind, []) or []:
            if it.get("fac") and it["fac"] not in fac_ids:
                problems.append(f"붕당 지도 {it.get('n') or it.get('fac')}: 세력 id {it['fac']} 가 없어요")
    for tu in (faction or {}).get("turns", []) or []:
        for f in (tu.get("out") or []) + (tu.get("in") or []):
            if f not in fac_ids:
                problems.append(f"붕당 전환점 {tu['n']}: 세력 id {f} 가 없어요")
        for e in tu.get("ev", []) or []:
            if e not in ev_ids:
                problems.append(f"붕당 전환점 {tu['n']}: 사건 id {e} 가 없어요")


def main() -> int:
    prov = load_provinces()
    problems: list[str] = []
    admin = {
        "joseon8": {"f": 1413, "t": 1895, "features": build_layer(JOSEON8, prov, "joseon8")},
        "daehan13": {"f": 1896, "t": 1945, "features": build_layer(DAEHAN13, prov, "daehan13")},
    }
    points = yaml.safe_load((SRC / "admin" / "points.yaml").read_text(encoding="utf-8"))
    themes = load_yaml_dir(SRC / "themes")
    seen = set()
    for t in themes:
        check_theme(t, problems)
        if t.get("id") in seen:
            problems.append(f"주제 id 가 겹쳐요: {t.get('id')}")
        seen.add(t.get("id"))
        t.pop("_file", None)
    themes.sort(key=lambda t: (t.get("f", 0), t.get("t", 0)))
    hanyang = yaml.safe_load((SRC / "hanyang.yaml").read_text(encoding="utf-8")) if (SRC / "hanyang.yaml").exists() else None
    faction = yaml.safe_load((SRC / "faction_map.yaml").read_text(encoding="utf-8")) if (SRC / "faction_map.yaml").exists() else None
    inst = yaml.safe_load((SRC / "institutions.yaml").read_text(encoding="utf-8")) or []
    terms = yaml.safe_load((SRC / "terms.yaml").read_text(encoding="utf-8")) or []
    check_links(themes, inst, terms, hanyang, faction, problems)
    for t in terms:
        t.pop("note", None)
    out = {"admin": admin, "points": points, "themes": themes, "inst": inst, "terms": terms, "hanyang": hanyang, "faction": faction}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"행정 구역 8도·13도, 중심지 {sum(len(v['items']) for v in points.values())}곳, 교과서 지도 {len(themes)}개, "
          f"통치 체제 {len(inst)}개, 용어 {len(terms)}개"
          f"{', 한양 장소 ' + str(len(hanyang.get('places', []))) + '곳' if hanyang else ''} → {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    for p in problems:
        print("  문제:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
