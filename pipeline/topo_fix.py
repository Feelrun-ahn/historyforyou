"""시대별 청크(TopoJSON) 레이어 이름 바로잡기.

mapshaper 는 한 레이어 안에 면(Polygon)과 선(LineString)이 섞여 있으면 레이어를
'polities1', 'polities2' 처럼 나눠 버려요. 앱은 'polities' 만 읽기 때문에, 그러면
그 시대 전체의 나라 색칠과 국경이 통째로 안 보이게 돼요(901~936년, 1216~1355년에 실제로 생겼던 문제).

이 모듈은
  - 'polities', 'polities1', 'polities2' … 를 하나의 'polities' 로 합치고
  - 면이 아닌 도형(선·점 조각)은 버려요.

쓰는 법: python3 pipeline/topo_fix.py web/data/c*.json   (고친 파일 이름을 출력)
build_web.py 도 청크를 만들 때마다 이 함수를 불러요.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

AREA_TYPES = {"Polygon", "MultiPolygon"}
PART = re.compile(r"^polities\d*$")


def normalize_topology(topo: dict) -> bool:
    """topo 를 그 자리에서 고침. 바뀐 게 있으면 True."""
    objs = topo.get("objects", {})
    keys = [k for k in objs if PART.match(k)]
    geoms = []
    dropped = 0
    for k in sorted(keys, key=lambda s: (len(s), s)):
        for g in objs[k].get("geometries", []):
            if g.get("type") in AREA_TYPES:
                geoms.append(g)
            else:
                dropped += 1
    changed = keys != ["polities"] or dropped > 0
    if not changed:
        return False
    for k in keys:
        del objs[k]
    objs["polities"] = {"type": "GeometryCollection", "geometries": geoms}
    # labels 가 polities 뒤에 오던 원래 순서 유지
    if "labels" in objs:
        objs["labels"] = objs.pop("labels")
    return True


def check_topology(topo: dict) -> list[str]:
    """문제 목록을 돌려줌(비어 있으면 정상)."""
    problems = []
    objs = topo.get("objects", {})
    if set(objs) != {"polities", "labels"}:
        problems.append(f"레이어 이름이 이상함: {sorted(objs)}")
    for g in objs.get("polities", {}).get("geometries", []):
        if g.get("type") not in AREA_TYPES:
            problems.append(f"면이 아닌 도형: {g.get('type')} {g.get('properties')}")
            break
    return problems


def normalize_file(path: pathlib.Path) -> bool:
    topo = json.loads(path.read_text(encoding="utf-8"))
    if not normalize_topology(topo):
        return False
    path.write_text(json.dumps(topo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return True


if __name__ == "__main__":
    bad = 0
    for arg in sys.argv[1:]:
        p = pathlib.Path(arg)
        if normalize_file(p):
            print(f"고침: {p}")
        problems = check_topology(json.loads(p.read_text(encoding="utf-8")))
        if problems:
            bad += 1
            print(f"문제 남음: {p}: {problems}")
    sys.exit(1 if bad else 0)
