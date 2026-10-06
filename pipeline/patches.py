"""원본 국경 데이터(Cliopatria)에 역사 수정 적용하기.

수정 내용은 data/patches/*_ops.yaml 에 적고, 이 파일은 그걸 실행하는 엔진이에요.
모든 작업은 '해(year) 범위'와 '나라 이름' 단위로 동작하고, 새 영역을 넣을 때는
같은 시기 다른 나라에서 그 영역을 깎아내서(carve) 겹치지 않게 해요.

지원하는 작업(op)
- retime    : 나라의 시작/끝 연도 바꾸기 (늘릴 때는 경계 연도의 영역을 그대로 씀)
- rename    : 특정 기간 이름 바꾸기
- transfer  : 특정 기간 A 나라 영역을 B 나라에 합치기 (A 는 사라짐)
- restore   : 특정 기간 나라 영역을 다른 해의 영역으로 되살리기
- expand    : 특정 기간 나라 영역에 지역(region)을 더하기
- extract   : 특정 기간 여러 나라에서 지역(region)을 떼어 새 나라로 만들기
- erase     : 특정 기간 나라에서 지역 지우기
- delete    : 특정 기간 나라 지우기
- islands   : 섬(원 모양)을 여러 나라의 특정 기간 영역에 붙이기
"""
from __future__ import annotations

import pathlib

import geopandas as gpd
import pandas as pd
import shapely
import yaml
from shapely.geometry import Point, box

META_COLS = ["Name", "f", "t", "Area", "Wikipedia", "Wikidata", "Components", "MemberOf", "patch"]
TINY = 0.004  # 이보다 작은 조각(도² 단위, 약 40km²)은 깎고 남은 찌꺼기로 보고 버림


# ---------------------------------------------------------------- 기본 도구
def _row(df: gpd.GeoDataFrame, **kw) -> dict:
    base = {c: "" for c in META_COLS}
    base.update({"Area": 0.0})
    base.update(kw)
    return base


def split_at(df: gpd.GeoDataFrame, y: int) -> gpd.GeoDataFrame:
    """f < y <= t 인 레코드를 [f, y-1], [y, t] 로 나눔."""
    m = (df.f < y) & (df.t >= y)
    if not m.any():
        return df
    left = df[m].copy()
    right = df[m].copy()
    left["t"] = y - 1
    right["f"] = y
    return pd.concat([df[~m], left, right], ignore_index=True)


def bound(df, a: int, b: int):
    return split_at(split_at(df, a), b + 1)


def is_group(df) -> pd.Series:
    return df.Name.str.startswith("(")


def geom_of(df, name: str, year: int):
    rows = df[(df.Name == name) & (df.f <= year) & (df.t >= year)]
    if rows.empty:
        raise ValueError(f"{name} 가 {year}년에 없어요")
    return shapely.make_valid(shapely.union_all(rows.geometry.values))


def clean(geom, near=None):
    """깎고 남은 작은 조각 정리."""
    if geom is None or geom.is_empty:
        return geom
    geom = shapely.make_valid(geom)
    parts = [p for p in getattr(geom, "geoms", [geom]) if p.geom_type == "Polygon"]
    keep = [p for p in parts if p.area >= TINY or (near is not None and p.distance(near) > 0.05)]
    if not keep:
        return shapely.Polygon()
    return shapely.union_all(keep)


def carve(df, a: int, b: int, geom, keep_names=()):
    """[a, b] 기간 동안 다른 나라들에서 geom 영역을 깎아냄 (제국·연합 경계는 그대로)."""
    df = bound(df, a, b)
    m = (df.f >= a) & (df.t <= b) & ~is_group(df) & ~df.Name.isin(keep_names)
    idx = df.index[m & df.geometry.intersects(geom)]
    for i in idx:
        g = clean(shapely.difference(df.at[i, "geometry"], geom), near=geom)
        df.at[i, "geometry"] = g
    return df[~df.geometry.is_empty].reset_index(drop=True)


def union_into(df, name: str, a: int, b: int, geom, meta: dict | None = None, patch=""):
    """[a, b] 기간 name 영역에 geom 을 합침. 그 기간에 name 이 없으면 새로 만듦."""
    df = bound(df, a, b)
    m = (df.Name == name) & (df.f >= a) & (df.t <= b)
    covered = set()
    for i in df.index[m]:
        df.at[i, "geometry"] = shapely.make_valid(shapely.union(df.at[i, "geometry"], geom))
        df.at[i, "patch"] = (str(df.at[i, "patch"]) + " " + patch).strip()
        covered.update(range(int(df.at[i, "f"]), int(df.at[i, "t"]) + 1))
    gaps = _ranges([y for y in range(a, b + 1) if y not in covered])
    template = meta or _template(df, name)
    new = [_row(df, **{**template, "Name": name, "f": s, "t": e, "patch": patch}) | {"geometry": geom} for s, e in gaps]
    if new:
        df = pd.concat([df, gpd.GeoDataFrame(new, geometry="geometry", crs=df.crs)], ignore_index=True)
    return df


def _template(df, name):
    rows = df[df.Name == name]
    if rows.empty:
        return {}
    r = rows.iloc[0]
    return {c: r[c] for c in ("Wikipedia", "Wikidata", "Components", "MemberOf")}


def _ranges(years):
    out = []
    for y in sorted(years):
        if out and y == out[-1][1] + 1:
            out[-1][1] = y
        else:
            out.append([y, y])
    return [tuple(r) for r in out]


def merge_same(df, name: str):
    """같은 이름·같은 기간 레코드를 하나로 합침."""
    m = df.Name == name
    if m.sum() < 2:
        return df
    sub = df[m]
    for y in sorted(set(sub.f.tolist()) | set((sub.t + 1).tolist())):
        sub = split_at(sub, int(y))
    merged = []
    for (f, t), grp in sub.groupby(["f", "t"]):
        r = grp.iloc[0].to_dict()
        r["geometry"] = shapely.make_valid(shapely.union_all(grp.geometry.values))
        merged.append(r)
    return pd.concat([df[~m], gpd.GeoDataFrame(merged, geometry="geometry", crs=df.crs)], ignore_index=True)


# ---------------------------------------------------------------- 지역
def build_regions(spec: dict, countries: gpd.GeoDataFrame) -> dict:
    regions = {}
    for key, r in (spec or {}).items():
        if r["type"] == "countries":
            own = shapely.union_all(countries[countries.ADM0_A3.isin(r["iso"])].geometry.values)
            others = shapely.union_all(countries[~countries.ADM0_A3.isin(r["iso"])].geometry.values)
            g = shapely.difference(own.buffer(r.get("sea_buffer", 0.5)), others)
            if "clip" in r:
                g = shapely.intersection(g, _geom(r["clip"], regions))
            regions[key] = shapely.make_valid(g)
        else:
            regions[key] = _geom(r, regions)
    return regions


def _geom(spec, regions):
    if isinstance(spec, str):
        return regions[spec]
    t = spec["type"]
    if t == "bbox":
        return box(*spec["bbox"])
    if t == "polygon":
        return shapely.Polygon(spec["coords"])
    if t == "intersect":
        return shapely.intersection(_geom(spec["of"][0], regions), _geom(spec["of"][1], regions))
    if t == "circle":
        x, y, r = spec["circle"]
        return Point(x, y).buffer(r, 24)
    raise ValueError(f"알 수 없는 지역 형식: {t}")


# ---------------------------------------------------------------- 작업 실행
def apply_ops(df: gpd.GeoDataFrame, ops_path: pathlib.Path, countries: gpd.GeoDataFrame, log=print):
    doc = yaml.safe_load(ops_path.read_text(encoding="utf-8"))
    regions = build_regions(doc.get("regions"), countries)
    if "patch" not in df.columns:
        df["patch"] = ""
    for op in doc["ops"]:
        kind = op["op"]
        pid = op.get("id", "")
        try:
            df = _apply(df, op, regions)
        except Exception as e:
            raise RuntimeError(f"{pid} {kind} 실패: {e}") from e
        log(f"   {pid:4} {kind:9} {op.get('name') or op.get('to') or op.get('src') or ''}")
    return df


def _apply(df, op, regions):
    kind = op["op"]
    pid = op.get("id", "")
    a, b = (op["years"] if "years" in op else (None, None))

    if kind == "retime":
        name = op["name"]
        rows = df[df.Name == name]
        first, last = int(rows.f.min()), int(rows.t.max())
        if "end" in op:
            end = op["end"]
            if end < last:
                df = df[~((df.Name == name) & (df.f > end))].copy()
                df.loc[(df.Name == name) & (df.t > end), "t"] = end
            elif end > last:
                g = geom_of(df, name, last)
                df = carve(df, last + 1, end, g, keep_names=[name])
                df = union_into(df, name, last + 1, end, g, patch=pid)
        if "start" in op:
            start = op["start"]
            if start > first:
                df = df[~((df.Name == name) & (df.t < start))].copy()
                df.loc[(df.Name == name) & (df.f < start), "f"] = start
            elif start < first:
                g = geom_of(df, name, first)
                df = carve(df, start, first - 1, g, keep_names=[name])
                df = union_into(df, name, start, first - 1, g, patch=pid)
        return df.reset_index(drop=True)

    if kind == "rename":
        df = bound(df, a, b)
        m = (df.Name == op["name"]) & (df.f >= a) & (df.t <= b)
        df.loc[m, "Name"] = op["to"]
        df.loc[m, "patch"] = pid
        for col in ("Wikipedia", "Wikidata", "MemberOf"):
            if col in op:
                df.loc[m, col] = op[col]
        return merge_same(df, op["to"])

    if kind == "transfer":
        src, dst = op["src"], op["dst"]
        df = bound(df, a, b)
        cuts = set()
        for n in (src, dst):
            r = df[(df.Name == n) & (df.f >= a) & (df.t <= b)]
            cuts.update(r.f.tolist())
            cuts.update((r.t + 1).tolist())
        for y in sorted(cuts):
            df = split_at(df, int(y))
        srows = df[(df.Name == src) & (df.f >= a) & (df.t <= b)]
        for (f, t), grp in srows.groupby(["f", "t"]):
            g = shapely.union_all(grp.geometry.values)
            df = union_into(df, dst, int(f), int(t), g, patch=pid)
        df = df[~((df.Name == src) & (df.f >= a) & (df.t <= b))]
        return df.reset_index(drop=True)

    if kind == "restore":
        name = op["name"]
        g = geom_of(df, op.get("from_name", name), op["from_year"])
        if "region" in op:
            g = shapely.intersection(g, regions[op["region"]])
        if "plus" in op:
            for extra in op["plus"]:
                g = shapely.union(g, geom_of(df, extra["name"], extra["year"]))
        df = carve(df, a, b, g, keep_names=[name])
        return union_into(df, name, a, b, g, meta=op.get("meta"), patch=pid)

    if kind == "expand":
        g = regions[op["region"]]
        df = carve(df, a, b, g, keep_names=[op["name"]])
        return union_into(df, op["name"], a, b, g, patch=pid)

    if kind == "extract":
        region = regions[op["region"]] if isinstance(op["region"], str) else _geom(op["region"], regions)
        if "within" in op:
            region = shapely.intersection(region, geom_of(df, op["within"]["name"], op["within"]["year"]))
        df = bound(df, a, b)
        m = df.Name.isin(op["names"]) & (df.f >= a) & (df.t <= b) & df.geometry.intersects(region)
        new = []
        for i in df.index[m]:
            g = df.at[i, "geometry"]
            piece = clean(shapely.intersection(g, region))
            rest = clean(shapely.difference(g, region))
            df.at[i, "geometry"] = rest
            if not piece.is_empty:
                meta = op.get("meta", {})
                new.append(_row(df, Name=op["to"], f=int(df.at[i, "f"]), t=int(df.at[i, "t"]), patch=pid,
                                **{k: meta.get(k, "") for k in ("Wikipedia", "Wikidata", "MemberOf")}) | {"geometry": piece})
        df = df[~df.geometry.is_empty]
        if new:
            df = pd.concat([df, gpd.GeoDataFrame(new, geometry="geometry", crs=df.crs)], ignore_index=True)
        return merge_same(df.reset_index(drop=True), op["to"])

    if kind == "erase":
        region = regions[op["region"]]
        df = bound(df, a, b)
        m = (df.Name == op["name"]) & (df.f >= a) & (df.t <= b)
        for i in df.index[m]:
            df.at[i, "geometry"] = clean(shapely.difference(df.at[i, "geometry"], region))
        return df[~df.geometry.is_empty].reset_index(drop=True)

    if kind == "delete":
        df = bound(df, a, b)
        return df[~((df.Name == op["name"]) & (df.f >= a) & (df.t <= b))].reset_index(drop=True)

    if kind == "islands":
        shape = shapely.union_all([_geom(s, regions) for s in op["shapes"]])
        for item in op["owners"]:
            df = carve(df, item["years"][0], item["years"][1], shape, keep_names=[item["name"]])
            df = union_into(df, item["name"], item["years"][0], item["years"][1], shape, patch=pid)
        return df

    raise ValueError(f"알 수 없는 작업: {kind}")


def recompute_area(df: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    m = df.patch.astype(str) != ""
    if m.any():
        df.loc[m, "Area"] = df[m].geometry.to_crs("EPSG:6933").area.values / 1e6
    return df
