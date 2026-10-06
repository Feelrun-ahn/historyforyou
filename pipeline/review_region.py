"""지역·연도별 국경 검수용 이미지 만들기.

실행 예: python pipeline/review_region.py --region east_asia --years -150 100 500 670 1270 1597
결과: docs/review/<region>_<첫연도>-<끝연도>.png
"""
import argparse
import colorsys
import hashlib
import pathlib

import geopandas as gpd
import matplotlib
import yaml

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager as fm  # noqa: E402
from shapely.geometry import box  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "cliopatria.geojson"
REGIONS = {  # 경도 최소, 위도 최소, 경도 최대, 위도 최대
    "east_asia": (112, 28, 146, 50),
    "korea": (122, 32, 133, 44),
    "europe": (-12, 34, 42, 62),
    "middle_east": (24, 12, 64, 44),
}
FONT_HINTS = ["Malgun Gothic", "AppleGothic", "Apple SD Gothic Neo", "NanumGothic", "Noto Sans CJK", "Noto Sans KR"]


def pick_font() -> None:
    """한글 폰트 자동 선택 (윈도우: 맑은 고딕, 맥: 애플고딕, 리눅스: Noto CJK)."""
    names = sorted({f.name for f in fm.fontManager.ttflist})
    for hint in FONT_HINTS:
        for n in names:
            if n.startswith(hint):
                plt.rcParams["font.family"] = n
                return
    print("경고: 한글 폰트를 못 찾아서 글자가 깨질 수 있음")


def color(name: str):
    h = int(hashlib.md5(name.encode()).hexdigest()[:6], 16)
    return colorsys.hls_to_rgb((h % 360) / 360, 0.72, 0.45)


def label_year(y: int) -> str:
    return f"기원전 {-y}년" if y < 0 else f"{y}년"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default="east_asia", choices=REGIONS)
    ap.add_argument("--years", type=int, nargs="+", required=True)
    ap.add_argument("--source", default=str(RAW), help="원본 geojson 또는 수정 적용된 parquet (data/build/patched.parquet)")
    ap.add_argument("--title", default="")
    args = ap.parse_args()

    pick_font()
    ko = yaml.safe_load((ROOT / "data" / "names_ko.yaml").read_text(encoding="utf-8")) or {}
    win = box(*REGIONS[args.region])
    src = pathlib.Path(args.source)
    gdf = gpd.read_parquet(src) if src.suffix == ".parquet" else gpd.read_file(src)
    if "Type" in gdf.columns:
        gdf = gdf[gdf.Type == "POLITY"]
    if "FromYear" in gdf.columns:
        gdf = gdf.rename(columns={"FromYear": "f", "ToYear": "t"})
    gdf = gdf[~gdf.Name.str.startswith("(") & gdf.intersects(win)]

    n = len(args.years)
    cols = min(4, n)
    rows = -(-n // cols)
    fig, axes = plt.subplots(rows, cols, figsize=(4 * cols, 3.6 * rows), dpi=110, squeeze=False)
    for ax in axes.flat[n:]:
        ax.axis("off")
    for ax, y in zip(axes.flat, args.years):
        sub = gdf[(gdf.f <= y) & (gdf.t >= y)].copy()
        sub["geometry"] = sub.geometry.intersection(win)
        sub = sub[~sub.geometry.is_empty]
        for _, r in sub.iterrows():
            gpd.GeoSeries([r.geometry]).plot(ax=ax, color=color(r.Name), edgecolor="#444", linewidth=0.5)
        for _, r in sub.iterrows():
            if r.geometry.area < 0.3:
                continue
            p = r.geometry.representative_point()
            ax.text(p.x, p.y, ko.get(r.Name, r.Name), fontsize=7, ha="center", va="center")
        xmin, ymin, xmax, ymax = REGIONS[args.region]
        ax.set_xlim(xmin, xmax)
        ax.set_ylim(ymin, ymax)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_xlabel("")
        ax.set_ylabel("")
        ax.set_title(label_year(y), fontsize=10, loc="left")
    if args.title:
        fig.suptitle(args.title, fontsize=14, x=0.01, ha="left")
    plt.tight_layout()
    tag = "_patched" if src.suffix == ".parquet" else ""
    out = ROOT / "docs" / "review" / f"{args.region}_{args.years[0]}-{args.years[-1]}{tag}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out)
    print(f"저장: {out}")


if __name__ == "__main__":
    main()
