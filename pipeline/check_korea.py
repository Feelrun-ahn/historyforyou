"""한반도 수정 결과 자동 점검 (빌드 후 실행).

실행: python pipeline/check_korea.py
data/build/simplified.geojson(수정·단순화 결과)에서 지점별로 그해 어느 나라에 속하는지 확인하고,
기대와 다르면 알려줘요. 독도·울릉도가 일본 쪽으로 들어가지 않았는지도 확인해요.
"""
import pathlib
import sys

import geopandas as gpd
from shapely.geometry import Point

ROOT = pathlib.Path(__file__).resolve().parents[1]
PTS = {
    "평양": (125.75, 39.03), "서울": (126.98, 37.57), "경주": (129.21, 35.84), "전주": (127.15, 35.82),
    "김해": (128.88, 35.23), "제주": (126.53, 33.38), "영흥": (127.25, 39.55), "의주": (124.53, 40.2),
    "독도": (131.8653, 37.2412), "울릉도": (130.8656, 37.505), "지린": (126.55, 43.84),
}
# (연도, 지점, 기대하는 나라 이름) — 나라 이름은 Cliopatria/수정 데이터 기준
EXPECT = [
    (-1000, "평양", "Gojoseon"), (-108, "평양", "Gojoseon"), (-100, "평양", "Han Dynasty"),
    (-50, "경주", "Silla"), (0, "서울", "Baekje"), (100, "지린", "Buyeo"),
    (500, "김해", "Gaya"), (563, "김해", "Silla"), (668, "평양", "Goguryeo"),
    (670, "평양", "Protectorate General to Pacify the East"), (676, "서울", "Unified Silla"),
    (905, "서울", "Taebong"), (936, "전주", "Hubaekje"), (1000, "의주", "Liao Dynasty"),
    (1110, "제주", "Goryeo"), (1120, "의주", "Goryeo"), (1270, "서울", "Goryeo"), (1275, "제주", "Tamna Prefectures"),
    (1300, "영흥", "Ssangseong Prefecture"), (1360, "영흥", "Goryeo"), (1392, "서울", "Joseon"),
    (1597, "서울", "Joseon"), (1637, "서울", "Joseon"), (1897, "서울", "Korean Empire"),
    (1930, "서울", "Korea under Japanese rule"), (1946, "서울", "US Army Military Government in Korea"),
    (1946, "평양", "Soviet Civil Administration in Korea"), (1955, "서울", "Republic of Korea"),
]
KOREAN_OWNERS = {"Silla", "Unified Silla", "Goryeo", "Joseon", "Korean Empire", "Korea under Japanese rule",
                 "US Army Military Government in Korea", "Republic of Korea"}


def owners(g, y, name):
    p = Point(*PTS[name])
    s = g[(g.f <= y) & (g.t >= y) & ~g.Name.str.startswith("(")]
    return list(s[s.contains(p)].Name)


def main() -> int:
    sys.path.insert(0, str(ROOT / "pipeline"))
    import build_web  # noqa: E402
    g = gpd.read_file(ROOT / "data" / "build" / "simplified.geojson")
    g = build_web.reapply_islands(g)  # 웹 데이터와 같은 처리
    bad = 0
    for y, place, want in EXPECT:
        got = owners(g, y, place)
        ok = want in got
        bad += not ok
        print(f"{'OK ' if ok else '틀림'} {y:>5} {place:4} 기대 {want:40} 실제 {got}")
    for y in (512, 800, 1100, 1500, 1900, 1930, 1946, 2024):
        for isl in ("독도", "울릉도"):
            got = owners(g, y, isl)
            ok = bool(set(got) & KOREAN_OWNERS) and not (set(got) & {"Empire of Japan", "Japan", "Tokugawa Shogunate"})
            bad += not ok
            print(f"{'OK ' if ok else '틀림'} {y:>5} {isl:4} 실제 {got}")
    print("모두 통과" if not bad else f"확인 필요 {bad}건")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
