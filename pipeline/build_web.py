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

import hashlib
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

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import patches  # noqa: E402
import topo_fix  # noqa: E402

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
        for b in tree.query(shapely.buffer(shapely.envelope(geom), 0.8)):
            if b <= a or p[a] == p[b] or p[b] in edges[p[a]]:
                continue
            if not (f[a] <= t[b] and f[b] <= t[a]):
                continue
            if shapely.dwithin(geom, geoms[b], 0.8):  # 좁은 바다 건너 이웃도 다른 색으로
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
        if path.name.endswith("_ops.yaml"):
            continue
        for item in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
            if "years" not in item or str(item.get("status", "")).startswith("적용"):
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


def prepare_clipped(out_path: pathlib.Path) -> None:
    """1~2단계: 원본 읽기, 해안선 자르기. 결과를 캐시(parquet)로 저장."""
    log("1/8 원본 읽는 중")
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
    log("2/8 해안선으로 자르는 중 (1분 정도)")
    gdf["geometry"] = clip_to_land(gdf)
    gdf.to_parquet(out_path)


def patch_files() -> list[pathlib.Path]:
    return sorted((ROOT / "data" / "patches").glob("*_ops.yaml"))


def prepare_geometry(out_path: pathlib.Path) -> None:
    """3~5단계: 역사 수정 적용, 라벨 위치, 단순화."""
    clipped = BUILD / "clipped.parquet"
    if not clipped.exists():
        prepare_clipped(clipped)
    gdf = gpd.read_parquet(clipped)
    gdf["patch"] = ""
    gdf["u"] = 0

    log("3/8 역사 수정 적용 중 (data/patches)")
    countries = gpd.read_file(RAW / "ne_50m_admin_0_countries.geojson")
    for path in patch_files():
        log(f"   {path.name}")
        gdf = patches.apply_ops(gdf, path, countries, log=log)
    gdf = patches.recompute_area(gdf)
    gdf = gdf.sort_values(["Name", "f"]).reset_index(drop=True)
    gdf["i"] = range(len(gdf))

    log("4/8 라벨 위치 계산 중")
    lps = [label_point(g) for g in gdf.geometry.values]
    gdf["lpx"] = [p[0] if p else None for p in lps]
    gdf["lpy"] = [p[1] if p else None for p in lps]

    log("5/8 국경 단순화 중 (mapshaper)")
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        gdf.to_file(tmp / "polys.json", driver="GeoJSON")
        del gdf
        mapshaper("-i", str(tmp / "polys.json"), "-simplify", f"interval={SIMPLIFY_INTERVAL_M}", "keep-shapes",
                  "-o", "precision=0.001", str(out_path))


def reapply_islands(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """단순화 과정에서 아주 작은 섬(독도 등)이 사라지지 않게, islands 작업의 섬 모양을 다시 붙임."""
    countries = gpd.read_file(RAW / "ne_50m_admin_0_countries.geojson")
    for path in patch_files():
        doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        ops = [op for op in doc.get("ops", []) if op.get("op") == "islands"]
        if not ops:
            continue
        regions = patches.build_regions(doc.get("regions"), countries)
        for op in ops:
            shape = shapely.union_all([patches._geom(s, regions) for s in op["shapes"]])
            for item in op["owners"]:
                a, b = item["years"]
                m = (gdf.Name == item["name"]) & (gdf.f <= b) & (gdf.t >= a)
                gdf.loc[m, "geometry"] = [shapely.union(shapely.make_valid(g), shape) for g in gdf.loc[m, "geometry"]]
    return gdf


def polygonal(geom):
    """GeometryCollection 등에서 면(Polygon) 부분만 꺼냄."""
    if geom is None or geom.is_empty:
        return geom
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    parts = [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]
    polys = []
    for g in parts:
        polys.extend(g.geoms if g.geom_type == "MultiPolygon" else [g])
    return shapely.MultiPolygon(polys) if polys else shapely.Polygon()


def inputs_hash() -> str:
    h = hashlib.sha256()
    for path in patch_files() + [pathlib.Path(patches.__file__)]:
        h.update(path.read_bytes())
    h.update(str(SIMPLIFY_INTERVAL_M).encode())
    return h.hexdigest()[:16]


# ---------------------------------------------------------------- main
def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("c*.json"):
        old.unlink()

    simplified = BUILD / "simplified.geojson"
    stamp = BUILD / "simplified.hash"
    digest = inputs_hash()
    if simplified.exists() and stamp.exists() and stamp.read_text() == digest:
        log("1~5/8 이전에 만든 결과 재사용 (수정 파일이 바뀌면 자동으로 다시 만듦)")
    else:
        prepare_geometry(simplified)
        stamp.write_text(digest)
    gdf = gpd.read_file(simplified)
    for col in ("Wikipedia", "Wikidata", "Components", "MemberOf", "patch"):
        gdf[col] = gdf[col].fillna("").astype(str)
    gdf = gdf.sort_values("i").reset_index(drop=True)
    gdf = reapply_islands(gdf)
    # 고치기 작업(union·make_valid)에서 생긴 선·점 조각은 버리고 면만 남김
    gdf["geometry"] = [polygonal(g) for g in gdf.geometry]
    gdf["f"] = gdf.f.astype(int)
    gdf["t"] = gdf.t.astype(int)
    gdf["super"] = gdf.Name.str.startswith("(")
    gdf["u"] = gdf["u"].fillna(0).astype(int) if "u" in gdf.columns else 0
    gdf["lp"] = [(x, y) if x == x and y == y else None for x, y in zip(gdf.lpx, gdf.lpy)]
    names = sorted(gdf.Name.unique())
    name_index = {n: i for i, n in enumerate(names)}
    gdf["p"] = gdf.Name.map(name_index)
    with tempfile.TemporaryDirectory() as td:
        build_base(pathlib.Path(td))

    log("6/8 색 배정 중")
    color = assign_colors(gdf, name_index)

    log("7/8 이름·메타데이터 정리 중")
    manual, wd = load_names()
    notes = yaml.safe_load((ROOT / "data" / "notes_ko.yaml").read_text(encoding="utf-8")) or {}
    wd_fix = {}
    for path in patch_files():
        wd_fix.update((yaml.safe_load(path.read_text(encoding="utf-8")) or {}).get("wikidata_fix") or {})
    qid_names = gdf.groupby("Wikidata").Name.nunique().to_dict()
    polities = []
    for n in names:
        rows = gdf[gdf.Name == n]
        best = rows.loc[rows.Area.idxmax()]
        qid = wd_fix.get(n, (best.Wikidata or "").strip())
        unique_qid = bool(qid) and (n in wd_fix or qid_names.get(qid, 0) == 1)
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
            "note": notes.get(n),
            "fixed": bool(rows.patch.astype(str).str.len().gt(0).any()),
        })

    log("8/8 시대별 청크 만드는 중")
    chunks = make_chunks(gdf.f.tolist(), gdf.t.tolist())
    chunk_meta = []
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        for ci, (a, b) in enumerate(chunks):
            sel = gdf[(gdf.f <= b) & (gdf.t >= a)]
            polys = gpd.GeoDataFrame({
                "i": sel.index.values, "p": sel.p.values, "f": sel.f.values, "t": sel.t.values,
                "a": sel.Area.round().astype(int).values, "c": [color[k] for k in sel.p.values],
                "g": sel.super.astype(int).values, "u": sel.u.astype(int).values,
            }, geometry=sel.geometry.values, crs="EPSG:4326")
            pts_rows = [(r.Index, r.p, r.f, r.t, int(round(r.Area)), r.lp, int(r.u)) for r in sel.itertuples() if r.lp]
            pts = gpd.GeoDataFrame({
                "i": [r[0] for r in pts_rows], "p": [r[1] for r in pts_rows], "f": [r[2] for r in pts_rows],
                "t": [r[3] for r in pts_rows], "a": [r[4] for r in pts_rows],
                "k": [polities[r[1]]["ko"] for r in pts_rows],
                "g": [polities[r[1]]["g"] for r in pts_rows],
                "u": [r[6] for r in pts_rows],
            }, geometry=gpd.points_from_xy([r[5][0] for r in pts_rows], [r[5][1] for r in pts_rows]), crs="EPSG:4326")
            polys.to_file(tmp / "polities.json", driver="GeoJSON")
            pts.to_file(tmp / "labels.json", driver="GeoJSON")
            fname = f"c{ci:02d}.json"
            mapshaper("-i", str(tmp / "polities.json"), str(tmp / "labels.json"), "combine-files",
                      "-o", "format=topojson", "quantization=200000", str(OUT / fname))
            # 면·선이 섞이면 mapshaper 가 레이어를 polities1/2 로 나눠서 앱이 그 시대를 통째로 못 그림 → 하나로 합치기
            if topo_fix.normalize_file(OUT / fname):
                log(f"   청크 {ci:02d}: 나뉜 레이어를 'polities' 하나로 합침")
            problems = topo_fix.check_topology(json.loads((OUT / fname).read_text(encoding="utf-8")))
            if problems:
                raise SystemExit(f"청크 {fname} 이상: {problems}")
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
    import build_wars  # noqa: E402  (전쟁 데이터는 나라 번호가 필요해서 마지막에 만듦)
    build_wars.main()
    import build_events  # noqa: E402
    build_events.main()
    import build_korea_extra  # noqa: E402
    build_korea_extra.main()
    import build_korea_map  # noqa: E402  (한국사 지도 화면: 행정 구역·교과서 지도·통치 체제·용어·한양·붕당)
    build_korea_map.main()


if __name__ == "__main__":
    sys.exit(main())
