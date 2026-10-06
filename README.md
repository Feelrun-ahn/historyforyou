# history-map (가칭)

전 세계 나라들의 국경과 전쟁을 시간 순서대로 보여주는 인터랙티브 역사 지도.
연도 슬라이더를 움직이면 국경이 바뀌고, 나라나 전쟁을 누르면 설명이 나와요.

> 지금 상태: **3단계(한반도 국경 고치기) 완료**, 부여 추가는 조사 중

## 진행 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 국경 데이터 선정·검수, 저장소 세팅 | 완료 |
| 2 | 지도 뼈대 (연도 슬라이더, 줌, 클릭 정보) | 완료 |
| — | 1·2단계 검수 | |
| 3 | 한반도·동아시아 국경 보강 | 완료 (부여 조사 중) |
| 4 | 전쟁 데이터 + 정보 패널 | 다음 |
| — | 3·4단계 검수 | |
| 5 | 진격 경로 애니메이션 | |
| 6 | 최적화 & 배포 | |
| — | 5·6단계 검수 | |
| 7~ | 세계사 확장 (유럽, 중동, 세계대전 …) | |

## 폴더 구조

```
web/               실제 사이트 (GitHub Pages 로 배포되는 폴더)
  index.html, app.js, style.css
  data/            만들어진 지도 데이터 (index.json, base.json, c00~c22.json)
  vendor/          MapLibre GL JS 5.24.0, topojson-client 3.1.0
pipeline/          데이터 처리 스크립트 (Python)
  fetch_cliopatria.py       원본 국경 데이터 받기 (v0.2.1 고정)
  fetch_basemap.py          해안선·강·호수 받기 (Natural Earth v5.1.2 고정)
  fetch_wikidata_labels.py  위키데이터 한국어 이름 받기
  build_web.py              web/data 만들기
  patches.py                역사 수정 명령 실행 엔진 (data/patches/*_ops.yaml)
  build_preview.py          HTML 한 파일짜리 미리보기 만들기
  review_region.py          검수용 지도 이미지 만들기
data/
  names_ko.yaml    나라 이름 한국어 표기 (여기를 고치면 지도에 반영돼요)
  patches/         수정 근거(korea.yaml)와 실제 수정 명령(korea_ops.yaml)
  notes_ko.yaml    나라 정보 창의 '알아 두기' 설명
docs/review/       단계별 검수 자료
.github/workflows/ 자동 배포, 데이터 다시 만들기
```

## 깃허브에 올리고 사이트 열기

1. GitHub 에서 새 저장소(public) 만들기, 이름은 `history-map` 추천
2. 이 폴더 내용을 그대로 올리기 (`git push` 또는 웹에서 업로드)
3. 저장소 **Settings → Pages → Source** 를 **GitHub Actions** 로 바꾸기
4. Actions 탭에서 '사이트 배포'가 끝나면 `https://<아이디>.github.io/history-map/` 에서 열려요
5. (선택) Actions 탭 → '데이터 다시 만들기' → Run workflow 를 누르면 위키데이터 한국어 이름까지 넣어서 데이터를 새로 만들어요

## 직접 데이터 만들 때

```bash
pip install -r pipeline/requirements.txt
npm install -g mapshaper
python pipeline/fetch_cliopatria.py
python pipeline/fetch_basemap.py
python pipeline/build_web.py          # 5분 정도, 메모리 4GB 이상 권장
python pipeline/build_preview.py      # dist/history-map-preview.html
```

## 역사 내용 기준

- 한국사: 고등학교 한국사 교과서, 우리역사넷(국사편찬위원회)
- 원본 데이터와 기준이 다르면 `data/patches/` 에 근거와 함께 수정 내용을 기록하고, 검수 후에 적용
- 학설이 갈리는 부분은 지도에 "학설 차이"로 표시
- 독도는 대한민국 영토로 표기, 바다 이름은 동해로 표기

## 데이터 출처

- 국경: [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) v0.2.1 (Seshat Global History Databank), CC BY 4.0. 해안선에 맞춰 자르고 단순화했어요. 수정한 내용은 `data/patches/` 참고
- 해안선·강·호수: [Natural Earth](https://www.naturalearthdata.com/) v5.1.2, 퍼블릭 도메인
- 지도 엔진: [MapLibre GL JS](https://maplibre.org/) (BSD-3-Clause)
- 자세한 라이선스는 [DATA_LICENSE.md](DATA_LICENSE.md)

## 라이선스

- 코드: MIT ([LICENSE](LICENSE))
- 데이터: CC BY 4.0 ([DATA_LICENSE.md](DATA_LICENSE.md))
