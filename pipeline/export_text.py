"""지도에 들어간 역사 내용을 사람이 읽고 검수할 수 있는 텍스트 파일로 뽑기.

실행: python pipeline/export_text.py [출력경로]
결과: docs/역사내용_검수용.txt

web/data 의 완성된 데이터(사건·전쟁·진격로·국제 관계·세력 흐름)와
data/notes_ko.yaml(나라 설명)을 그대로 옮겨요. 화면에 나오는 문장과 똑같아요.
각 항목 앞의 번호(E001, W01-3 …)로 고칠 곳을 알려 주면 돼요.
"""
from __future__ import annotations

import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "data"

REL_TYPES = {"alliance": "동맹·연합", "tribute": "사대·책봉·종속", "trade": "교류·교역",
             "route": "사절·이동 길", "rivalry": "대립", "treaty": "조약·수교"}
MARK_KINDS = {"사화": "사화", "환국": "환국", "예송": "예송", "정변": "정변", "분열": "분열", "개혁": "개혁", "기타": "기타"}
LINE = "=" * 72
SUB = "-" * 72


def fy(y: int) -> str:
    return f"기원전 {-y}" if y < 0 else str(y)


def main() -> None:
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "역사내용_검수용.txt"
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    pol_names = [p.get("ko") or p.get("n") for p in index["polities"]]
    events = json.loads((DATA / "events.json").read_text(encoding="utf-8"))
    W = json.loads((DATA / "wars.json").read_text(encoding="utf-8"))
    wars = [w for w in (W["wars"] if isinstance(W, dict) else W) if isinstance(w, dict)]
    rel = json.loads((DATA / "relations.json").read_text(encoding="utf-8"))
    facs = json.loads((DATA / "factions.json").read_text(encoding="utf-8"))
    notes = yaml.safe_load((ROOT / "data" / "notes_ko.yaml").read_text(encoding="utf-8"))
    names_ko = yaml.safe_load((ROOT / "data" / "names_ko.yaml").read_text(encoding="utf-8")) or {}

    L: list[str] = []
    w = L.append
    ko_wars = [x for x in wars if x.get("region") == "korea"]
    world_wars = [x for x in wars if x.get("region") != "korea"]
    w("세계 역사 지도 — 들어간 역사 내용 전체 (검수용)")
    w(LINE)
    w("이 파일은 지도에 실제로 나오는 문장을 그대로 모은 거예요.")
    w("고칠 곳이 있으면 항목 앞 번호(예: E123, W05-2, W05-R1, R12, F2-3)와 함께 알려 주세요.")
    w("")
    w("· 기준 교과서: 중학교 역사② (비상교육, 2020). [p.○] 는 교과서 쪽수예요.")
    w("· 날짜: 1895년까지는 음력, 1896년 1월 1일(조선의 양력 채택)부터는 양력이에요.")
    w("· [위치 대략] 은 지도에 찍은 점의 위치가 대략적이라는 뜻이에요.")
    w("· [핵심] 은 교과서 부록 연표에 나오는 사건이에요(연표의 '핵심만' 보기).")
    w("")
    w("차례")
    w(f"  1부. 한국사 사건 ({len(events)}개)")
    w(f"  2부. 한국사 전쟁·전투·진격로 (전쟁 {len(ko_wars)}개, 전투·사건 {sum(len(x['battles']) for x in ko_wars)}개, "
      f"진격로 {sum(len(x.get('routes', [])) for x in ko_wars)}개)")
    w(f"  3부. 국제 관계 ({len(rel['rels'])}개)")
    w(f"  4부. 세력 흐름 ({len(facs)}개 시대)")
    w(f"  5부. 나라 설명 (나라를 누르면 나오는 글, {len(notes)}개)")
    w(f"  6부. 세계사 전쟁 ({len(world_wars)}개)")
    w("")

    # 1부 사건
    w(LINE)
    w(f"1부. 한국사 사건 ({len(events)}개)")
    w(LINE)
    era = None
    for k, ev in enumerate(events, 1):
        if ev.get("era") != era:
            era = ev.get("era")
            w("")
            w(f"■ {era}")
            w(SUB)
        tags = []
        if ev.get("i", 0) >= 3:
            tags.append("핵심")
        if ev.get("ap"):
            tags.append("위치 대략")
        if ev.get("nomap"):
            tags.append("지도에 점 없음")
        head = f"E{k:03d}. {ev['date']} | {ev['n']} | {ev['c']}"
        if ev.get("pg"):
            head += f" | p.{ev['pg']}"
        if tags:
            head += " | " + ", ".join(f"[{t}]" for t in tags)
        w(head)
        if ev.get("p"):
            w(f"      장소: {ev['p']}")
        w(f"      {ev['t']}")
    w("")

    # 2부 전쟁
    w(LINE)
    w("2부. 한국사 전쟁·전투·진격로")
    w(LINE)
    w("· '이긴 쪽' 은 지도 위 점의 색이에요. 승패가 없는 사건은 '승패 없음'.")
    w("· 진격로의 지점 날짜가 '-' 인 곳은 기록이 없어 앞뒤 날짜로 이어 그린 곳이에요.")
    group = None
    for k, x in enumerate(ko_wars, 1):
        if x.get("group") and x["group"] != group:
            group = x["group"]
            w("")
            w(f"■ {group}")
            w(SUB)
        sides = [s["label"] for s in x["sides"]]
        w("")
        w(f"W{k:02d}. {x['name']}")
        w(f"      기간: {x['period']}")
        for si, s in enumerate(x["sides"]):
            nm = ", ".join(pol_names[p] for p in s.get("p", []) if p is not None and p < len(pol_names))
            w(f"      편 {si + 1}: {s['label']}" + (f" (지도 속 나라: {nm})" if nm else ""))
        w(f"      원인: {x['cause']}")
        w(f"      결과: {x['result']}")
        for bi, b in enumerate(x["battles"], 1):
            win = "승패 없음" if b.get("win") is None else f"이긴 쪽 {sides[b['win']]}"
            tag = " [위치·날짜 대략]" if b.get("approx") else ""
            w(f"   W{k:02d}-{bi}. {b['date']} | {b['name']} | {win}{tag}")
            if b.get("note"):
                w(f"         {b['note']}")
        for ri, r in enumerate(x.get("routes", []), 1):
            side = sides[r["side"]] if r.get("side") is not None and r["side"] < len(sides) else ""
            w(f"   W{k:02d}-R{ri}. 진격로: {r['name']}" + (f" ({side})" if side else ""))
            if r.get("note"):
                w(f"         {r['note']}")
            pts = " → ".join(f"{p[3]}({p[4] if p[4] else '-'})" for p in r["pts"] if len(p) > 3 and p[3])
            w(f"         지점: {pts}")
    w("")

    # 3부 국제 관계
    w(LINE)
    w(f"3부. 국제 관계 ({len(rel['rels'])}개) — '국제 정세' 를 켜면 지도에 선으로 나와요")
    w(LINE)
    w("· 사대·책봉·종속 관계의 화살표는 '섬기거나 지배받는 쪽 → 상대 나라' 방향이에요.")
    caps = rel["caps"]
    for k, r in enumerate(rel["rels"], 1):
        arrow = "→" if r["type"] == "tribute" else "↔"
        span = f"{fy(r['f'])}~{fy(r['t'])}" if r["t"] < 2024 else f"{fy(r['f'])}~현재"
        head = f"R{k:02d}. {span} | {r['n']} | {REL_TYPES[r['type']]} | {r['a']} {arrow} {r['b']}"
        if r.get("bloc"):
            head += f" | 세력 구도: {r['bloc']}"
        if r.get("pg"):
            head += f" | p.{r['pg']}"
        w(head)
        w(f"      {r['d']}")
        if r.get("via"):
            w("      길: " + " → ".join(p[2] for p in r["via"] if p[2]))
    w("")
    w("· 선의 양 끝(도읍) 목록 — 연도는 그해부터 그 도읍을 쓴다는 뜻이에요(선을 그리는 용도라 좌표는 대략적).")
    for name, rows in caps.items():
        w(f"  {name}: " + ", ".join(f"{fy(r[0])}~ {r[3]}" for r in rows))
    w("")

    # 4부 세력 흐름
    w(LINE)
    w(f"4부. 세력 흐름 ({len(facs)}개 시대)")
    w(LINE)
    for ei, e in enumerate(facs, 1):
        w("")
        w(f"F{ei}. {e['n']} ({fy(e['f'])}~{fy(e['t'])})" + (f" | p.{', '.join(map(str, e['pg']))}" if e.get("pg") else ""))
        w(f"      {e['intro']}")
        for gi, g in enumerate(e["groups"], 1):
            ids = {x["id"]: x["n"] for x in e["groups"]}
            par = ", ".join(ids.get(p, p) for p in g["par"])
            rule = ", ".join(f"{a}~{b}" for a, b in g["rule"]) or "없음"
            w(f"   F{ei}-{gi}. {g['n']} ({fy(g['f'])}~{fy(g['t'])})" + (f" | 갈라져 나온 곳: {par}" if par else "") + f" | 집권: {rule}")
            w(f"         {g['d']}")
        if e.get("marks"):
            w("   주요 사건: " + ", ".join(f"{m['y']} {m['n']}({MARK_KINDS.get(m['k'], m['k'])})" for m in e["marks"]))
    w("")

    # 5부 나라 설명
    w(LINE)
    w(f"5부. 나라 설명 ({len(notes)}개)")
    w(LINE)
    for k, (en, txt) in enumerate(notes.items(), 1):
        ko = names_ko.get(en) if isinstance(names_ko, dict) else None
        if isinstance(ko, dict):
            ko = ko.get("ko") or ko.get("name")
        w(f"N{k:02d}. {ko or en} ({en})")
        w(f"      {txt}")
    w("")

    # 6부 세계사
    w(LINE)
    w(f"6부. 세계사 전쟁 ({len(world_wars)}개)")
    w(LINE)
    for k, x in enumerate(world_wars, 1):
        sides = [s["label"] for s in x["sides"]]
        w("")
        w(f"G{k:02d}. {x['name']}")
        w(f"      기간: {x['period']}")
        w(f"      편: {' / '.join(sides)}")
        w(f"      원인: {x['cause']}")
        w(f"      결과: {x['result']}")
        for bi, b in enumerate(x["battles"], 1):
            win = "승패 없음" if b.get("win") is None else f"이긴 쪽 {sides[b['win']]}"
            w(f"   G{k:02d}-{bi}. {b['date']} | {b['name']} | {win}")
            if b.get("note"):
                w(f"         {b['note']}")
        for ri, r in enumerate(x.get("routes", []), 1):
            w(f"   G{k:02d}-R{ri}. 진격로: {r['name']}")
            if r.get("note"):
                w(f"         {r['note']}")
    w("")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"완료: {out} ({len(L)}줄)")


if __name__ == "__main__":
    main()
