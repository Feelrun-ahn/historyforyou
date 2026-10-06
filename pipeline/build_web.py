"""웹 지도용 데이터 만들기.

실행: python pipeline/build_web.py
필요: data/raw/cliopatria.geojson (fetch_cliopatria.py), data/raw/ne_50m_*.geojson (fetch_basemap.py),
      Node.js + mapshaper (npm install -g mapshaper)
결과: web/data/index.json, web/data/base.json, web/data/c*.json

하는 일
1. Cliopatria 국경을 Natural Earth 해안선으로 잘라서 바다로 삐져나온 부분 정리
2. mapshaper 로 국경을 단순화 (이웃 나라 경계가 벌어지지 않게 위상 유지)
3. 시대별로 잘게 나눠서(청크) 필요한 시대만 불러오게 함
4. 한국어 이름, 색깔(이웃끼리 안 겹치게), 검색용 목록, 알려진 오류 안내를 index.json 에 정리
"""
from __future__ import annotations

import json
import math
import pathlib
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict

import geopandas as gpd
import shapely
import yaml
from shapely import STRtree
from shapely.ops import polylabel

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BUILD = ROOT / "data" / "build"
OUT = ROOT / "web" / "data"

SIMPLIFY_INTERVAL_M = 2500  # 단순화 정도 (원본 해상도가 약 7km 라서 2.5km 면 손실 거의 없음)
CHUNK_MAX_ROWS = 700        # 청크 하나에 넣을 최대 레코드 수 (폰에서도 가볍게)
PALETTE = [  # 광물성 안료 느낌의 차분한 색 (이웃 나라끼리 다른 색이 되게 배정)
    "#8DB596", "#8EA4CF", "#D89A7E", "#DDBF7A", "#B49BC4", "#7FB8B1",
    "#D99AA8", "#C9CF7E", "#A3AFC0", "#E0A86A", "#B8B0A2",
]
KOREA_BBOX = (122.0, 32.0, 132.5, 43.5)


def log(*a):
    print(*a, flush=True)


def mapshaper(*args: str) -> None:
    exe = shutil.which("mapshaper")
    cmd = [exe, *args] if exe else ["npx", "--yes", "mapshaper", *args]
    env_cmd = ["node", "--max-old-space-size=3072", exe, *args] if exe else cmd
    subprocess.run(env_cmd, check=True, stdout=subprocess.DEVNULL)


# ---------------------------------------------------------------- names
def load_names():
    manual = yaml.safe_load((ROOT / "data" / "names_ko.yaml").read_text(encoding="utf-8")) or {}
    wd_path = ROOT / "data" / "names_ko_wikidata.json"
    wd = json.loads(wd_path.read_text(encoding="utf-8")) if wd_path.exists() else {}
    return manual, wd


# ---------------------------------------------------------------- geometry
def clip_to_land(gdf: gpd.GeoDataFrame) -> list:
    land = gpd.read_file(RAW / "ne_50m_land.geojson").geometry.values
    land = shapely.make_valid(land)
    tree = STRtree(land)
    out = []
    for geom in gdf.geometry.values:
        idx = tree.query(geom, predicate="intersects")
        if len(idx) == 0:
            out.append(geom)
            continue
        clipped = shapely.union_all([shapely.intersection(geom, land[i]) for i in idx])
        clipped = shapely.make_valid(clipped)
        # 섬처럼 Natural Earth 에 없는 땅이면 잘라내지 않고 원본 유지
        if clipped.is_empty or clipped.area < geom.area * 0.05:
            out.append(geom)
        else:
            out.append(polygons_only(clipped))
    return out


def polygons_only(geom):
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    parts = [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else geom


def label_point(geom):
    if geom.is_empty:
        return None
    polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    big = max(polys, key=lambda p: p.area)
    try:
        p = polylabel(big.simplify(0.05), tolerance=0.05)
        if not big.contains(p):
            p = big.representative_point()
    except Exception:
        p = big.representative_point()
    return round(p.x, 3), round(p.y, 3)


# ---------------------------------------------------------------- colors
def assign_colors(gdf: gpd.GeoDataFrame, name_index: dict[str, int]) -> dict[int, int]:
    """이웃하거나 겹치는 나라끼리 다른 색이 되도록 이름 단위로 색칠 (탐욕 그래프 색칠)."""
    base = gdf[~gdf.super]
    geoms = shapely.simplify(base.geometry.values, 0.1)
    tree = STRtree(geoms)
    edges: dict[int, set[int]] = defaultdict(set)
    f = base.f.values
    t = base.t.values
    p = base.p.values
    for a, geom in enumerate(geoms):
        for b in tree.query(shapely.buffer(shapely.envelope(geom), 0.15)):
            if b <= a or p[a] == p[b] or p[b] in edges[p[a]]:
                continue
            if not (f[a] <= t[b] and f[b] <= t[a]):
                continue
            if shapely.dwithin(geom, geoms[b], 0.15):
                edges[p[a]].add(p[b])
                edges[p[b]].add(p[a])
    order = sorted(set(p), key=lambda k: -len(edges[k]))
    color: dict[int, int] = {}
    usage = [0] * len(PALETTE)
    for k in order:
        taken = {color[n] for n in edges[k] if n in color}
        free = [c for c in range(len(PALETTE)) if c not in taken]
        pick = min(free, key=lambda c: usage[c]) if free else min(range(len(PALETTE)), key=lambda c: usage[c])
        color[k] = pick
        usage[pick] += 1
    for k in name_index.values():
        color.setdefault(k, k % len(PALETTE))
    return color


# ---------------------------------------------------------------- chunks
def make_chunks(f, t) -> list[tuple[int, int]]:
    """레코드 수가 CHUNK_MAX_ROWS 를 넘지 않게 시간 구간을 나눔."""
    years = sorted(set(f) | {max(t) + 1})
    chunks = []
    start = years[0]
    i = 1
    while i < len(years):
        end_excl = years[i]
        n = sum(1 for a, b in zip(f, t) if a < end_excl and b >= start)
        if n > CHUNK_MAX_ROWS and end_excl - 1 > start and years[i - 1] > start:
            chunks.append((start, years[i - 1] - 1))
            start = years[i - 1]
            continue
        i += 1
    chunks.append((start, max(t)))
    return chunks


# ---------------------------------------------------------------- notices
def load_notices():
    out = []
    for path in sorted((ROOT / "data" / "patches").glob("*.yaml")):
        for item in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
            if "years" not in item:
                continue
            out.append({
                "id": item["id"],
                "from": item["years"][0],
                "to": item["years"][1],
                "severity": item.get("severity", "low"),
                "problem": str(item.get("problem", "")).strip(),
                "fix": str(item.get("fix", "")).strip(),
                "status": item.get("status", ""),
                "bbox": KOREA_BBOX,
            })
    return out


# ---------------------------------------------------------------- basemap
def build_base(tmp: pathlib.Path) -> None:
    rivers = gpd.read_file(RAW / "ne_50m_rivers.geojson")
    rivers = rivers[rivers.scalerank <= 6][["scalerank", "geometry"]].rename(columns={"scalerank": "r"})
    lakes = gpd.read_file(RAW / "ne_50m_lakes.geojson")
    lakes = lakes[lakes.scalerank <= 4][["scalerank", "geometry"]].rename(columns={"scalerank": "r"})
    rivers.to_file(tmp / "rivers.json", driver="GeoJSON")
    lakes.to_file(tmp / "lakes.json", driver="GeoJSON")
    shutil.copy(RAW / "ne_50m_land.geojson", tmp / "land.json")
    mapshaper("-i", str(tmp / "land.json"), str(tmp / "lakes.json"), str(tmp / "rivers.json"), "combine-files",
              "-simplify", "interval=3000", "keep-shapes",
              "-o", "format=topojson", "quantization=100000", str(OUT / "base.json"))


def prepare_geometry(out_path: pathlib.Path) -> None:
    """1~4단계: 원본 읽기, 해안선 자르기, 라벨 위치, 단순화. 결과를 캐시 파일로 저장."""
    log("1/7 원본 읽는 중")
    raw = gpd.read_file(RAW / "cliopatria.geojson")
    gdf = raw[raw.Type == "POLITY"].reset_index(drop=True).copy()
    del raw
    keep = ["Name", "FromYear", "ToYear", "Area", "Wikipedia", "Wikidata", "Components", "MemberOf", "geometry"]
    gdf = gdf[keep]
    for col in ("Wikipedia", "Wikidata", "Components", "MemberOf"):
        gdf[col] = gdf[col].fillna("").astype(str)
    gdf["geometry"] = shapely.make_valid(gdf.geometry.values)
    gdf = gdf[~gdf.geometry.is_empty].reset_index(drop=True)
    gdf = gdf.rename(columns={"FromYear": "f", "ToYear": "t"})
    gdf["f"] = gdf.f.astype(int)
    gdf["t"] = gdf.t.astype(int)
    gdf["i"] = range(len(gdf))

    log("2/7 해안선으로 자르는 중 (1분 정도)")
    gdf["geometry"] = clip_to_land(gdf)

    log("3/7 라벨 위치 계산 중")
    lps = [label_point(g) for g in gdf.geometry.values]
    gdf["lpx"] = [p[0] if p else None for p in lps]
    gdf["lpy"] = [p[1] if p else None for p in lps]

    log("4/7 국경 단순화 중 (mapshaper)")
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        gdf.to_file(tmp / "polys.json", driver="GeoJSON")
        del gdf
        mapshaper("-i", str(tmp / "polys.json"), "-simplify", f"interval={SIMPLIFY_INTERVAL_M}", "keep-shapes",
                  "-o", "precision=0.001", str(out_path))


# ---------------------------------------------------------------- main
def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("c*.json"):
        old.unlink()

    simplified = BUILD / "simplified.geojson"
    if not simplified.exists():
        prepare_geometry(simplified)
    else:
        log("1~4/7 이전에 만든 단순화 결과 재사용 (data/build/simplified.geojson 지우면 다시 만듦)")
    gdf = gpd.read_file(simplified)
    for col in ("Wikipedia", "Wikidata", "Components", "MemberOf"):
        gdf[col] = gdf[col].fillna("").astype(str)
    gdf = gdf.sort_values("i").reset_index(drop=True)
    gdf["f"] = gdf.f.astype(int)
    gdf["t"] = gdf.t.astype(int)
    gdf["super"] = gdf.Name.str.startswith("(")
    gdf["lp"] = [(x, y) if x == x and y == y else None for x, y in zip(gdf.lpx, gdf.lpy)]
    names = sorted(gdf.Name.unique())
    name_index = {n: i for i, n in enumerate(names)}
    gdf["p"] = gdf.Name.map(name_index)
    with tempfile.TemporaryDirectory() as td:
        build_base(pathlib.Path(td))

    log("5/7 색 배정 중")
    color = assign_colors(gdf, name_index)

    log("6/7 이름·메타데이터 정리 중")
    manual, wd = load_names()
    qid_names = gdf.groupby("Wikidata").Name.nunique().to_dict()
    polities = []
    for n in names:
        rows = gdf[gdf.Name == n]
        best = rows.loc[rows.Area.idxmax()]
        qid = (best.Wikidata or "").strip()
        unique_qid = bool(qid) and qid_names.get(qid, 0) == 1
        wdi = wd.get(qid, {}) if unique_qid else {}
        if n in manual:
            ko, src = manual[n], "ko"
        elif wdi.get("ko"):
            ko, src = wdi["ko"], "wd"
        else:
            ko, src = n.strip("()"), "en"
        members = (best.Components or "").split(";") if best.Components else []
        member_of = (best.MemberOf or "").split(";") if best.MemberOf else []
        lp = best.lp or (0, 0)
        polities.append({
            "n": n, "ko": ko, "src": src,
            "f": int(rows.f.min()), "t": int(rows.t.max()),
            "a": int(rows.Area.max()), "y": int(best.f),
            "x": lp[0], "yy": lp[1],
            "c": color[name_index[n]],
            "g": 1 if n.startswith("(") else 0,
            "wiki": (best.Wikipedia or "").strip() or None,
            "wd": qid or None,
            "wdOk": unique_qid,
            "kowiki": wdi.get("kowiki"),
            "mem": [m for m in members if m],
            "of": [m for m in member_of if m],
        })

    log("7/7 시대별 청크 만드는 중")
    chunks = make_chunks(gdf.f.tolist(), gdf.t.tolist())
    chunk_meta = []
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        for ci, (a, b) in enumerate(chunks):
            sel = gdf[(gdf.f <= b) & (gdf.t >= a)]
            polys = gpd.GeoDataFrame({
                "i": sel.index.values, "p": sel.p.values, "f": sel.f.values, "t": sel.t.values,
                "a": sel.Area.round().astype(int).values, "c": [color[k] for k in sel.p.values],
                "g": sel.super.astype(int).values,
            }, geometry=sel.geometry.values, crs="EPSG:4326")
            pts_rows = [(r.Index, r.p, r.f, r.t, int(round(r.Area)), r.lp) for r in sel.itertuples() if r.lp]
            pts = gpd.GeoDataFrame({
                "i": [r[0] for r in pts_rows], "p": [r[1] for r in pts_rows], "f": [r[2] for r in pts_rows],
                "t": [r[3] for r in pts_rows], "a": [r[4] for r in pts_rows],
                "k": [polities[r[1]]["ko"] for r in pts_rows],
                "g": [polities[r[1]]["g"] for r in pts_rows],
            }, geometry=gpd.points_from_xy([r[5][0] for r in pts_rows], [r[5][1] for r in pts_rows]), crs="EPSG:4326")
            polys.to_file(tmp / "polities.json", driver="GeoJSON")
            pts.to_file(tmp / "labels.json", driver="GeoJSON")
            fname = f"c{ci:02d}.json"
            mapshaper("-i", str(tmp / "polities.json"), str(tmp / "labels.json"), "combine-files",
                      "-o", "format=topojson", "quantization=200000", str(OUT / fname))
            size = (OUT / fname).stat().st_size
            chunk_meta.append({"id": ci, "from": int(a), "to": int(b), "file": fname, "rows": int(len(sel)), "bytes": size})
            log(f"   청크 {ci:02d}: {a}~{b}년, {len(sel)}개, {size/1e6:.2f}MB")

    index = {
        "version": 1,
        "source": {"name": "Cliopatria", "version": "v0.2.1", "license": "CC BY 4.0",
                   "url": "https://github.com/Seshat-Global-History-Databank/cliopatria"},
        "yearMin": int(gdf.f.min()), "yearMax": int(gdf.t.max()),
        "palette": PALETTE,
        "chunks": chunk_meta,
        "polities": polities,
        "notices": load_notices(),
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(c["bytes"] for c in chunk_meta)
    log(f"완료: 청크 {len(chunk_meta)}개, 합계 {total/1e6:.1f}MB, 나라 {len(polities)}개")
    ko_src = defaultdict(int)
    for p in polities:
        ko_src[p["src"]] += 1
    log(f"   이름 출처: {dict(ko_src)}")


if __name__ == "__main__":
    sys.exit(main())
