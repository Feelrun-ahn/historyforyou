"""한국사 사건 → web/data/events.json

실행: python pipeline/build_events.py
- data/korea/events/*.yaml : 시대별 사건 (필드 설명은 그 폴더의 README.md)
- 1895년까지 한국 사건은 음력. 양력만 아는 날짜(ds)는 음력으로 바꿔서 정렬해요.
- 출력은 짧은 키를 써요: n 이름, c 분류, y 연도, dn 날짜 일련번호, e 끝 일련번호, x/yy 좌표 …
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "korea" / "events"
OUT = ROOT / "web" / "data" / "events.json"

CATS = ["정치", "외교", "전쟁", "사회", "경제", "문화", "민족운동", "민주화", "통일"]
LUNAR_UNTIL = 1895  # 1896-01-01 부터 양력
SOLAR_SWITCH = (1895, 11, 17)  # 음력 1895-11-17 = 양력 1896-01-01

try:
    from korean_lunar_calendar import KoreanLunarCalendar
except ImportError:  # 없으면 양력 날짜를 그대로 씀 (정렬이 며칠 어긋날 수 있음)
    KoreanLunarCalendar = None


def dn(y: int, m: int = 1, d: int = 1) -> int:
    return y * 372 + (m - 1) * 31 + (d - 1)


def parse(v) -> tuple[int, int | None, int | None]:
    s = str(v).strip()
    neg = s.startswith("-")
    parts = [int(x) for x in s.lstrip("-").split("-") if x]
    y = -parts[0] if neg else parts[0]
    m = parts[1] if len(parts) > 1 else None
    d = parts[2] if len(parts) > 2 else None
    return y, m, d


def solar_to_lunar(y, m, d):
    """양력 → 음력. 날짜(d)가 없으면 그 달 15일로 보고 바꾼 뒤 '월'만 써요."""
    if KoreanLunarCalendar is None or y > LUNAR_UNTIL or m is None:
        return y, m, d, False
    c = KoreanLunarCalendar()
    if not c.setSolarDate(y, m, d or 15):
        return y, m, d, False
    return c.lunarYear, c.lunarMonth, (c.lunarDay if d else None), c.isIntercalation


def lunar_to_solar(y, m, d):
    if KoreanLunarCalendar is None or m is None or d is None:
        return None
    c = KoreanLunarCalendar()
    if not c.setLunarDate(y, m, d, False):
        return None
    return c.solarYear, c.solarMonth, c.solarDay


def ytxt(y: int) -> str:
    return f"기원전 {-y}년" if y < 0 else f"{y}년"


def date_text(y, m, d, lunar: bool, leap=False) -> str:
    s = ytxt(y)
    if m:
        s += f" {'음력 ' if lunar else ''}{'윤' if leap else ''}{m}월"
        if d:
            s += f" {d}일"
    return s


def resolve(ev: dict, key_l: str, key_s: str):
    """(정렬용 음력 y,m,d, 표시 문구, 양력 문구) 를 돌려줘요."""
    if key_s in ev:  # 양력으로 적은 날짜
        sy, sm, sd = parse(ev[key_s])
        if sy <= LUNAR_UNTIL:
            ly, lm, ld, leap = solar_to_lunar(sy, sm, sd)
            if sd and ld:  # 음력으로 바꿔 쓰고 양력을 괄호에 (다른 1895년 이전 사건과 같은 모양)
                txt = date_text(ly, lm, ld, True, leap)
                txt += f" (양력 {sm}월 {sd}일)" if ly == sy else f" (양력 {sy}년 {sm}월 {sd}일)"
            else:
                txt = f"{ytxt(sy)} 양력 {sm}월" if sm else ytxt(sy)
            return (ly, lm, ld), txt, True
        return (sy, sm, sd), date_text(sy, sm, sd, False), False
    if key_l in ev:
        y, m, d = parse(ev[key_l])
        lunar = y <= LUNAR_UNTIL and m is not None
        txt = date_text(y, m, d, lunar)
        if lunar and d and y >= 1876:
            sol = lunar_to_solar(y, m, d)
            if sol:
                txt += f" (양력 {sol[1]}월 {sol[2]}일)" if sol[0] == y else f" (양력 {sol[0]}년 {sol[1]}월 {sol[2]}일)"
        return (y, m, d), txt, False
    return None, None, False


ERA = [  # (시작 dn, 이름) — 연표 목록을 묶는 시대 구분
    (dn(-99999), "선사"),
    (dn(-2333), "고조선과 여러 나라"),
    (dn(-57), "삼국과 가야"),
    (dn(676), "남북국"),
    (dn(918, 6), "고려"),
    (dn(1392, 7), "조선 전기"),
    (dn(1592, 4), "조선 후기"),
    (dn(1863, 12), "근대"),
    (dn(1910, 8, 29), "일제 강점기"),
    (dn(1945, 8, 15), "현대"),
]


def era_of(n: int) -> str:
    name = ERA[0][1]
    for start, label in ERA:
        if n >= start:
            name = label
    return name


def main() -> int:
    problems, out, seen = [], [], set()
    for path in sorted(SRC.glob("*.yaml")):
        for ev in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
            eid = ev.get("id")
            where = f"{path.name}:{eid}"
            if not eid or eid in seen:
                problems.append(f"{where}: id 가 없거나 겹쳐요")
            seen.add(eid)
            for k in ("n", "c", "i", "at", "t"):
                if k not in ev:
                    problems.append(f"{where}: {k} 가 없어요")
            if ev.get("c") not in CATS:
                problems.append(f"{where}: 분류 '{ev.get('c')}' 를 모르겠어요")
            start, txt, from_solar = resolve(ev, "d", "ds")
            if start is None:
                problems.append(f"{where}: 날짜(d 또는 ds)가 없어요")
                continue
            end, etxt, _ = resolve(ev, "e", "es")
            y, m, d = start
            n0 = dn(y, m or 1, d or 1)
            n1 = None
            if end:
                ey, em, ed = end
                n1 = dn(ey, em or 12, ed or 31) if not ed else dn(ey, em, ed)
                if n1 < n0:
                    problems.append(f"{where}: 끝 날짜가 시작보다 빨라요")
            x, yy = float(ev["at"][0]), float(ev["at"][1])
            if not (-180 <= x <= 180 and -60 <= yy <= 75):
                problems.append(f"{where}: 좌표가 이상해요 {ev['at']}")
            if len(str(ev.get("t", ""))) > 260:
                problems.append(f"{where}: 설명이 너무 길어요 ({len(ev['t'])}자)")
            text = ev.get("dt") or (txt + (f" ~ {etxt}" if etxt else ""))
            # 시작 연도: 양력으로 적은 1월 초 사건은 음력으로는 전해일 수 있음 → 표시 연도는 양력 기준
            show_y = parse(ev["ds"])[0] if "ds" in ev else y
            row = {
                "id": eid, "n": str(ev["n"]), "c": ev["c"], "i": int(ev["i"]),
                "y": show_y, "dn": n0 if not from_solar or start[0] == show_y else dn(show_y, 1, 1),
                "m": 1 if m else 0,  # 월까지 아는지 (월 단위 보기에서 씀)
                "x": round(x, 4), "yy": round(yy, 4), "date": text,
                "p": str(ev.get("p", "")), "t": str(ev["t"]).strip(),
                "era": era_of(n0),
            }
            if n1 is not None:
                row["e"] = n1
                row["ey"] = (parse(ev["es"])[0] if "es" in ev else end[0])
            if ev.get("ap"):
                row["ap"] = 1
            if ev.get("nomap"):
                row["nomap"] = 1
            if ev.get("x"):  # 자세한 설명 (배경·전개·결과)
                row["dx"] = str(ev["x"]).strip()  # JSON 의 x 는 경도라서 dx 로 내보내요
                if len(row["dx"]) > 520:
                    problems.append(f"{where}: 자세한 설명이 너무 길어요 ({len(row['dx'])}자)")
            if ev.get("pg"):
                row["pg"] = int(ev["pg"])
            if ev.get("src"):
                row["src"] = list(ev["src"])[:3]
            out.append(row)
    out.sort(key=lambda r: (r["dn"], -r["i"]))
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    by_era: dict = {}
    for r in out:
        by_era[r["era"]] = by_era.get(r["era"], 0) + 1
    print(f"사건 {len(out)}개 → {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    print("  " + ", ".join(f"{k} {v}" for k, v in by_era.items()))
    for p in problems:
        print("  확인 필요:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
