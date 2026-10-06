"""배경 지도(Natural Earth: 육지, 강, 호수) 다운로드. 퍼블릭 도메인.

실행: python pipeline/fetch_basemap.py
"""
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/"
FILES = {
    "ne_50m_land.geojson": "ne_50m_land.geojson",
    "ne_50m_rivers.geojson": "ne_50m_rivers_lake_centerlines.geojson",
    "ne_50m_lakes.geojson": "ne_50m_lakes.geojson",
}


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for local, remote in FILES.items():
        path = RAW / local
        if path.exists():
            print(f"이미 있음: {local}")
            continue
        print(f"다운로드: {remote}")
        urllib.request.urlretrieve(BASE + remote, path)


if __name__ == "__main__":
    main()
