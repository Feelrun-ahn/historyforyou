"""지도에 들어간 역사 내용을 검수용 텍스트 파일 하나로 내보내기.

실행: python pipeline/export_review.py [출력경로]
결과: docs/review/역사내용_검수용.txt

- 번호(E001, W01-b03 …)로 틀린 곳을 짚을 수 있게 했어요.
- 번호 → 데이터 id 대응표는 docs/review/검수번호.json 에 같이 저장해요.
"""
from __future__ import annotations

import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
WEB = ROOT / "web" / "data"

REL_TYPE = {"alliance": "동맹·연합", "tribute": "사대·책봉·종속", "occupy": "점령·간섭", "trade": "교류·교역",
            "route": "사절·이동 길", "rivalry": "대립", "treaty": "조약·수교"}


def ytxt(y: int) -> str:
    return f"기원전 {-y}년" if y < 0 else f"{y}년"


def route_date(v, cal: str) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    approx = s.endswith("?")
    s = s.rstrip("?")
    neg = s.startswith("-")
    parts = [int(x) for x in s.lstrip("-").split("-")]
    y = -parts[0] if neg else parts[0]
    out = ytxt(y)
    lunar = "음력 " if cal == "lunar" else ""
    if len(parts) >= 2:
        out += f" {lunar}{parts[1]}월"
    if len(parts) >= 3:
        out += f" {parts[2]}일"
    return out + (" 무렵" if approx else "")


def main() -> None:
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "review" / "역사내용_검수용.txt"
    ids: dict[str, str] = {}
    L: list[str] = []
    w = L.append

    events = json.loads((WEB / "events.json").read_text(encoding="utf-8"))
    wars_all = json.loads((WEB / "wars.json").read_text(encoding="utf-8"))["wars"]
    rel = json.loads((WEB / "relations.json").read_text(encoding="utf-8"))
    facs = json.loads((WEB / "factions.json").read_text(encoding="utf-8"))
    rulers_path = WEB / "rulers.json"
    rulers = json.loads(rulers_path.read_text(encoding="utf-8")) if rulers_path.exists() else None

    routes_src = {}
    for f in ("korea_routes.yaml", "korea_modern_routes.yaml", "world_routes.yaml"):
        p = DATA / "wars" / f
        if p.exists():
            routes_src.update(yaml.safe_load(p.read_text(encoding="utf-8")) or {})

    w("세계 역사 지도 — 들어간 역사 내용 전체 (검수용)")
    w("=" * 60)
    w("기준 교과서: 중학교 역사② (비상교육, 2020). 날짜·세부는 한국민족문화대백과사전, 우리역사넷으로 확인.")
    w("날짜: 한국사는 1895년까지 음력, 1896년 1월 1일부터 양력. 세계사는 양력.")
    w("틀린 곳은 앞의 번호(예: E123, W05-b02, R17)로 알려 주면 바로 찾아 고칠 수 있어요.")
    w("'p.' 는 교과서 쪽수, '[위치 대략]' 은 지도 위치가 대략적이라는 뜻이에요.")
    w("")

    # ---------------------------------------------------------------- 1. 사건
    w("")
    w("1. 한국사 사건 (연표·지도의 마름모)")
    w("-" * 60)
    era = None
    for k, ev in enumerate(events, 1):
        if ev.get("era") != era:
            era = ev.get("era")
            w("")
            w(f"■ {era}")
        code = f"E{k:03d}"
        ids[code] = f"event:{ev['id']}"
        core = " ★교과서 연표" if ev.get("i", 0) >= 3 else ""
        date = ev.get("date", "")
        if ev.get("ey") and ev.get("e"):
            pass
        head = f"{code}  {date} | {ev['n']} [{ev.get('c', '')}]{core}"
        w(head)
        meta = []
        if ev.get("p"):
            meta.append(f"장소: {ev['p']}" + (" [위치 대략]" if ev.get("ap") else ""))
        if ev.get("pg"):
            meta.append(f"p.{ev['pg']}")
        if meta:
            w("      " + " · ".join(meta))
        w("      " + ev.get("t", ""))
        if ev.get("dx"):
            w("      [자세히] " + ev["dx"])

    # ---------------------------------------------------------------- 2. 한국사 전쟁
    def dump_wars(region: str, title: str, prefix: str) -> None:
        w("")
        w("")
        w(title)
        w("-" * 60)
        group = None
        n = 0
        for W in wars_all:
            if W.get("region") != region:
                continue
            n += 1
            code = f"{prefix}{n:02d}"
            ids[code] = f"war:{W['id']}"
            if W.get("group") and W["group"] != group:
                group = W["group"]
                w("")
                w(f"■ {group}")
            elif not W.get("group"):
                w("")
            w(f"{code}  {W['name']}")
            w(f"      기간: {W.get('period', '')}")
            sides = " / ".join(s["label"] for s in W.get("sides", []))
            w(f"      싸운 편: {sides}")
            if W.get("cause"):
                w(f"      원인: {W['cause']}")
            if W.get("result"):
                w(f"      결과: {W['result']}")
            if W.get("dx"):
                w(f"      흐름과 의의: {W['dx']}")
            for bi, b in enumerate(W.get("battles", []), 1):
                bcode = f"{code}-b{bi:02d}"
                ids[bcode] = f"battle:{W['id']}:{b['name']}"
                win = b.get("win")
                if win is None:
                    wtxt = "승패 없음(사건)"
                else:
                    try:
                        wtxt = "이긴 쪽: " + (b.get("wl") or W["sides"][int(win)]["label"])
                    except (IndexError, ValueError, TypeError):
                        wtxt = ""
                flag = " [날짜·위치 대략]" if b.get("approx") else ""
                w(f"   {bcode}  {b['date']} | {b['name']} ({wtxt}){flag}")
                if b.get("note"):
                    w(f"            {b['note']}")
            src = routes_src.get(W["id"]) or {}
            cal = src.get("cal", W.get("cal", "solar"))
            for ri, r in enumerate(src.get("routes", []), 1):
                rcode = f"{code}-r{ri:02d}"
                ids[rcode] = f"route:{W['id']}:{r.get('name')}"
                try:
                    side = r.get("label") or W["sides"][int(r.get("side", 0))]["label"]
                except (IndexError, ValueError, TypeError):
                    side = ""
                w(f"   {rcode}  진격로: {r.get('name')} ({side})")
                pts = []
                for p in r.get("path", []):
                    d = route_date(p[2] if len(p) > 2 else None, cal)
                    nm = str(p[3]) if len(p) > 3 and p[3] else ""
                    if nm or d:
                        pts.append(f"{nm}" + (f"({d})" if d else ""))
                if pts:
                    w("            " + " → ".join(pts))
                if r.get("note"):
                    w(f"            {r['note']}")

    dump_wars("korea", "2. 한국사 전쟁·전투·진격로", "W")
    dump_wars("world", "3. 세계사 전쟁·전투·진격로", "G")

    # ---------------------------------------------------------------- 4. 국제 관계
    w("")
    w("")
    w("4. 국제 관계 (지도 위 연결선, '국제 정세')")
    w("-" * 60)
    for k, r in enumerate(rel["rels"], 1):
        code = f"R{k:02d}"
        ids[code] = f"rel:{r['id']}"
        span = ytxt(r["f"]) if r["f"] == r["t"] else f"{ytxt(r['f'])} ~ {ytxt(r['t'])}"
        if r["t"] >= 2024:
            span = f"{ytxt(r['f'])} ~ 지금"
        bloc = f" · 세력 구도: {r['bloc']}" if r.get("bloc") else ""
        pg = f" · p.{r['pg']}" if r.get("pg") else ""
        w(f"{code}  {span} | {r['n']} [{REL_TYPE.get(r['type'], r['type'])}] {r['a']} – {r['b']}{bloc}{pg}")
        if r.get("via"):
            w("      길: " + " → ".join(p[2] for p in r["via"] if p[2]))
        w("      " + r["d"])

    # ---------------------------------------------------------------- 5. 세력 흐름
    w("")
    w("")
    w("5. 세력 흐름 (나라 안 정치 세력)")
    w("-" * 60)
    for ei, e in enumerate(facs, 1):
        code = f"F{ei}"
        ids[code] = f"faction-era:{e['id']}"
        w("")
        w(f"{code}  {e['n']} ({ytxt(e['f'])} ~ {ytxt(e['t'])})")
        w("      " + e["intro"])
        for gi, g in enumerate(e["groups"], 1):
            gcode = f"{code}-{gi:02d}"
            ids[gcode] = f"faction:{e['id']}:{g['id']}"
            rule = ", ".join(f"{a}~{b}" for a, b in g["rule"]) if g["rule"] else "없음"
            w(f"   {gcode}  {g['n']} ({g['f']}~{g['t']}) · 집권: {rule}")
            w(f"            {g['d']}")
        if e["marks"]:
            w("   주요 사건: " + ", ".join(f"{m['n']}({m['y']})" for m in e["marks"]))

    # ---------------------------------------------------------------- 6. 왕
    if rulers:
        w("")
        w("")
        w("6. 왕·지도자 ('한눈에' 카드)")
        w("-" * 60)
        for si, st in enumerate(rulers["states"], 1):
            w("")
            w(f"■ {st['n']}" + (f" — {st['note']}" if st.get("note") else ""))
            for ki, k in enumerate(st["list"], 1):
                code = f"K{si:02d}-{ki:02d}"
                ids[code] = f"ruler:{st['id']}:{k['n']}"
                span = f"{ytxt(k['f'])} ~ {ytxt(k['t'])}" if k["t"] != k["f"] else ytxt(k["f"])
                if k.get("sp"):
                    span = ", ".join(f"{a}~{b}년" if a != b else f"{a}년" for a, b in k["sp"])
                if k["t"] >= 2100:
                    span = f"{ytxt(k['f'])} ~ "
                pg = f" · p.{k['pg']}" if k.get("pg") else ""
                w(f"{code}  {k['n']} ({span}){pg}")
                if k.get("d"):
                    w(f"         {k['d']}")

    if rulers and rulers.get("periods"):
        w("")
        w("■ 왕이 없던 시기의 통치 ('한눈에' 카드)")
        for k, x in enumerate(rulers["periods"], 1):
            code = f"P{k:02d}"
            ids[code] = f"period:{x['f']}"
            pg = f" · p.{x['pg']}" if x.get("pg") else ""
            w(f"{code}  {x['n']} ({x['f']}~{x['t']}){pg}")
            w(f"         {x['d']}")

    # ---------------------------------------------------------------- 7. 나라 설명
    notes = yaml.safe_load((DATA / "notes_ko.yaml").read_text(encoding="utf-8")) or {}
    idx = json.loads((WEB / "index.json").read_text(encoding="utf-8"))
    ko = {p["n"]: p.get("ko", p["n"]) for p in idx.get("polities", [])}
    w("")
    w("")
    w("7. 나라 정보 창의 '알아 두기' 설명")
    w("-" * 60)
    for k, (en, txt) in enumerate(notes.items(), 1):
        code = f"N{k:02d}"
        ids[code] = f"note:{en}"
        w(f"{code}  {ko.get(en, en)}")
        w("      " + str(txt).strip())

    # ---------------------------------------------------------------- 8~9. 한국사 지도 (11단계)
    km_path = WEB / "korea_map.json"
    if km_path.exists():
        km = json.loads(km_path.read_text(encoding="utf-8"))
        ev_name = {e["id"]: e["n"] for e in events}

        def src_txt(src):
            return ", ".join(f"{x['b']} {x['p']}쪽" + (f" {x['fig']}" if x.get("fig") else "") for x in (src or []))

        def span(it):
            y0, y1 = it.get("y"), it.get("t")
            if y0 is None and y1 is None:
                return ""
            return f" ({'' if y0 is None else ytxt(y0)}{'' if y1 is None else ' ~ ' + ytxt(y1)})"

        w("")
        w("")
        w("8. 한국사 지도 — 교과서 지도 (한국사 화면의 '지도')")
        w("-" * 60)
        w("교과서에 실린 지도를 옮겨 그린 것. 항목 옆 괄호는 지도에 나타나는 해(~ 사라지는 해).")
        for ti, t in enumerate(km["themes"], 1):
            code = f"T{ti:02d}"
            ids[code] = f"theme:{t['id']}"
            w("")
            w(f"{code}  {t['n']} [{t.get('era', '')}] {ytxt(t['f'])} ~ {ytxt(t['t'])} · {src_txt(t.get('src'))}")
            if t.get("d"):
                w(f"     {t['d']}")
            leg = {l["k"]: l["n"] for l in t.get("legend", [])}
            k = 0
            for kind, label in (("regions", "도"), ("areas", "구역"), ("lines", "선"), ("points", "점")):
                for it in t.get(kind) or []:
                    k += 1
                    ic = f"{code}-{k:02d}"
                    ids[ic] = f"theme:{t['id']}:{kind}:{it.get('n') or it.get('id')}"
                    name = it.get("n") or it.get("id")
                    lab = f" — {it['lab']}" if it.get("lab") else ""
                    ap = " [위치 대략]" if it.get("ap") else ""
                    sx = f" · {it['s']}" if it.get("s") else ""
                    w(f"   {ic}  [{label}·{leg.get(it.get('k'), it.get('k', ''))}] {name}{lab}{span(it)}{ap}{sx}")
            for n in t.get("notes") or []:
                w(f"     ※ {n}")

        w("")
        w("")
        w("9. 한국사 지도 — 통치 체제·용어 사전·한양 도성·붕당 지도")
        w("-" * 60)
        w("")
        w("■ 통치 체제 그림 ('제도')")
        for xi, x in enumerate(km["inst"], 1):
            code = f"I{xi:02d}"
            ids[code] = f"inst:{x['id']}"
            w("")
            w(f"{code}  {x['n']} [{x['era']}] {ytxt(x['f'])} ~ {ytxt(x['t'])} · {src_txt(x.get('src'))}")
            w(f"     {x['d']}")
            depth = {}
            for n in x["nodes"]:
                depth[n.get("id")] = depth.get(n.get("p"), -1) + 1
                kids = []
                for kd in n.get("kids") or []:
                    kids.append(kd if isinstance(kd, str) else f"{kd['n']}({kd.get('s', '')})")
                flag = (" [교과서 강조]" if n.get("t1") else "") + (" [심화]" if n.get("deep") else "")
                w(f"     {'  ' * depth[n.get('id')]}- {n['n']}{flag}{': ' + n['s'] if n.get('s') else ''}{' / 칸: ' + ', '.join(kids) if kids else ''}")
            for n in x.get("notes") or []:
                w(f"     ※ {n}")
        w("")
        w("■ 용어 사전 ('용어'와 검색창)")
        era = None
        for vi, t in enumerate(km["terms"], 1):
            if t["era"] != era:
                era = t["era"]
                w("")
                w(f"  [{era}]")
            code = f"V{vi:03d}"
            ids[code] = f"term:{t['n']}"
            pg = (f" · 비상 {'·'.join(map(str, t['pg']))}쪽" if t.get("pg") else "") + (f" · 미래엔 {'·'.join(map(str, t['mp']))}쪽" if t.get("mp") else "")
            yy = f" · {ytxt(t['y'])}" if t.get("y") is not None else ""
            aka = f" (={', '.join(t['a'])})" if t.get("a") else ""
            rel = f" · 관련 사건: {', '.join(ev_name.get(e, e) for e in t['ev'])}" if t.get("ev") else ""
            w(f"{code}  {t['n']}{aka} [{t['k']}]{yy}{pg}{' [지도 위치' + (' 대략' if t.get('ap') else '') + ']' if t.get('at') else ''}")
            w(f"      {t['d']}{rel}")
            if t.get("x"):
                w(f"      [자세히] {t['x']}")
        H = km.get("hanyang")
        if H:
            w("")
            w("■ 한양 도성 지도 ('한양')")
            w(f"  {H.get('d', '')}")
            for hi, pl in enumerate(H["places"], 1):
                code = f"H{hi:02d}"
                ids[code] = f"hanyang:{pl['id']}"
                life = f"{pl.get('f', '')}~{pl.get('t', '')}" if (pl.get("f") or pl.get("t")) else ""
                st = "; ".join(f"{x['f']}~{x.get('t', '')} {x['n']}" for x in pl.get("st") or [])
                evs = ", ".join(ev_name.get(e, e) for e in pl.get("ev") or [])
                w(f"{code}  {pl['n']} [{pl['k']}] {life}{' [위치 대략]' if pl.get('ap') else ''}{' [심화]' if pl.get('deep') else ''}")
                w(f"      {pl['s']}{' · 바뀐 모습: ' + st if st else ''}{' · 사건: ' + evs if evs else ''}")
            for n in H.get("notes") or []:
                w(f"  ※ {n}")
        F = km.get("faction")
        if F:
            w("")
            w("■ 붕당 지도 ('붕당')")
            w(f"  {F.get('d', '')}")
            k = 0
            for kind, label in (("regions", "지역 기반"), ("schools", "서원"), ("houses", "한양의 집"), ("places", "장소")):
                for it in F.get(kind) or []:
                    k += 1
                    code = f"B{k:02d}"
                    ids[code] = f"bungdang:{kind}:{it.get('n') or it.get('fac')}"
                    name = it.get("n") or "·".join(it.get("do", []))
                    w(f"{code}  [{label}] {name} ({it.get('fac', '')}, {it.get('f', it.get('y', ''))}){' [위치 대략]' if it.get('ap') else ''}{' [심화]' if it.get('deep') else ''}")
                    w(f"      {it.get('s', '')}")
            for ti, tu in enumerate(F.get("turns") or [], 1):
                code = f"BT{ti:02d}"
                ids[code] = f"bungdang:turn:{tu['n']}"
                w(f"{code}  {tu['y']} {tu['n']}: {', '.join(tu.get('out') or [])} → {', '.join(tu.get('in') or [])}")
                w(f"      {tu.get('s', '')}")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    (out.parent / "검수번호.json").write_text(json.dumps(ids, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"완료: {out} ({len(L)}줄, 번호 {len(ids)}개)")


if __name__ == "__main__":
    main()
