"""Cliopatria 원본 데이터 다운로드 (버전 고정).

실행: python pipeline/fetch_cliopatria.py
결과: data/raw/cliopatria.geojson
"""
import io
import pathlib
import sys
import urllib.request
import zipfile

VERSION = "v0.2.1"  # 바꿀 땐 data/patches 의 수정사항이 여전히 맞는지 다시 검수할 것
URL = f"https://github.com/Seshat-Global-History-Databank/cliopatria/raw/{VERSION}/cliopatria.geojson.zip"
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "cliopatria.geojson"


def main() -> None:
    if OUT.exists():
        print(f"이미 있음: {OUT}")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"다운로드 중: Cliopatria {VERSION} (약 46MB)")
    with urllib.request.urlopen(URL) as r:
        data = r.read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [n for n in z.namelist() if n.endswith(".geojson")]
        if len(names) != 1:
            sys.exit(f"zip 안에 geojson 이 1개가 아님: {names}")
        OUT.write_bytes(z.read(names[0]))
    print(f"완료: {OUT} ({OUT.stat().st_size / 1e6:.0f}MB)")


if __name__ == "__main__":
    main()
