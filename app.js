/* 세계 역사 지도 — 앱 로직
   데이터: web/data/index.json (나라 목록·청크 목록), base.json (육지·강·호수), cNN.json (시대별 국경) */
(() => {
  'use strict';

  // ---------------------------------------------------------------- 설정
  const YEAR_MIN = -3400;
  const YEAR_MAX = 2024;
  const START_YEAR = 1100;
  const START_VIEW = { center: [118, 36], zoom: 3.1 };
  // 슬라이더 위치(0~1) ↔ 연도. 기록이 적은 고대는 좁게, 근현대는 넓게.
  const KNOTS = [
    [-3400, 0], [-1000, 0.13], [0, 0.27], [1000, 0.5], [1500, 0.65], [1800, 0.8], [1900, 0.885], [2024, 1],
  ];
  const TICKS = [
    { y: -3000, label: '기원전 3000', minor: true }, { y: -1000, label: '기원전 1000' }, { y: 1, label: '1' },
    { y: 500, label: '500', minor: true }, { y: 1000, label: '1000' }, { y: 1500, label: '1500' },
    { y: 1800, label: '1800', minor: true }, { y: 1900, label: '1900' }, { y: 2000, label: '2000', minor: true },
  ];
  const JUMPS = [
    { group: '한국사' },
    { label: '삼국 시대', year: 500, center: [127.5, 39], zoom: 4.6 },
    { label: '남북국 시대', year: 800, center: [127.5, 40.5], zoom: 4.3 },
    { label: '고려', year: 1100, center: [124, 39], zoom: 3.8 },
    { label: '조선', year: 1500, center: [124, 38.5], zoom: 3.8 },
    { label: '일제 강점기', year: 1930, center: [127, 36], zoom: 3.4 },
    { label: '오늘날', year: 2024, center: [127.5, 37.5], zoom: 4.2 },
    { group: '세계사' },
    { label: '로마 최대 영토', year: 117, center: [18, 40], zoom: 2.9 },
    { label: '몽골 제국', year: 1279, center: [80, 42], zoom: 2.1 },
    { label: '대항해 시대', year: 1600, center: [0, 15], zoom: 1.3 },
    { label: '페르시아 전쟁', year: -480, center: [30, 37], zoom: 3.4 },
    { label: '알렉산드로스 원정', year: -331, center: [45, 34], zoom: 2.6 },
    { label: '나폴레옹', year: 1812, center: [18, 51], zoom: 3.2 },
    { label: '제1차 세계 대전', year: 1914, center: [20, 46], zoom: 3.2 },
    { label: '제2차 세계 대전', year: 1942, center: [60, 35], zoom: 1.7 },
  ];
  const SEAS = [
    ['동해', 134.4, 39.6, 2], ['황해', 123.6, 36.4, 2], ['동중국해', 126.0, 29.6, 2], ['남중국해', 114.5, 14.0, 1],
    ['태평양', 165, 22, 0], ['태평양', -140, 10, 0], ['대서양', -38, 28, 0], ['대서양', -18, -20, 0], ['인도양', 78, -18, 0],
    ['북극해', 30, 82, 0], ['지중해', 18.5, 35.0, 1], ['흑해', 34.2, 43.4, 2], ['카스피해', 50.8, 41.6, 2],
    ['홍해', 38.6, 20.6, 2], ['페르시아만', 51.0, 27.3, 2], ['아라비아해', 63, 15, 1], ['벵골만', 88.5, 14.5, 1],
    ['북해', 3.5, 56.5, 2], ['발트해', 19.5, 57.5, 2], ['오호츠크해', 150, 54, 1], ['베링해', -177, 58, 1],
    ['카리브해', -75, 14.5, 1], ['멕시코만', -90, 25.3, 2], ['필리핀해', 132, 18, 1], ['아드리아해', 15.8, 42.8, 3],
    ['에게해', 25.0, 38.6, 3],
  ];
  const ISLANDS = [
    ['독도', 131.8653, 37.2412], ['울릉도', 130.8656, 37.505],
  ];
  const KOREA_AREA = 220000; // 한반도 면적 약 22만 km²
  const ISLAND_INFO = {
    독도: { en: 'Dokdo', text: '경상북도 울릉군에 속한 대한민국의 섬이에요. 512년 신라 이사부가 우산국(울릉도)을 복속한 뒤로 우리 역사 속 영토였고, 이 지도에서도 그 해부터 한반도 왕조의 영역에 넣었어요.' },
    울릉도: { en: 'Ulleungdo', text: '옛 우산국이 있던 섬이에요. 512년 신라 이사부가 복속했어요. 지금은 경상북도 울릉군이에요.' },
  };

  // 한국사 사건 분류 (data/korea/events 의 c) 와 색
  const CATS = ['정치', '외교', '전쟁', '사회', '경제', '문화', '민족운동', '민주화', '통일'];
  const CAT_COLORS = ['#9aa6ff', '#3fc1c9', '#ff6b5b', '#f29e4c', '#7cc36b', '#d58cff', '#ff8fb1', '#ffd166', '#7fd7ff'];
  const CAT_COLOR = ['to-color', ['at', ['get', 'c'], ['literal', CAT_COLORS]]];
  // 국제 관계 종류
  const REL_TYPES = {
    alliance: { label: '동맹·연합', color: '#f2c14e', style: '실선' },
    tribute: { label: '사대·책봉·종속', color: '#c39bf0', style: '긴 점선 (화살표: 섬기거나 지배받는 쪽 → 상대 나라)' },
    trade: { label: '교류·교역', color: '#55d0c0', style: '점선' },
    route: { label: '사절·이동 길', color: '#8fc7ff', style: '실선 + 화살표' },
    rivalry: { label: '대립', color: '#ff7a6b', style: '긴 점선' },
    treaty: { label: '조약·수교', color: '#d4dbe2', style: '가는 실선' },
    occupy: { label: '점령·간섭', color: '#f08fb6', style: '긴 점선 (화살표: 점령·간섭받는 쪽 → 상대 나라)' },
  };
  const REL_ORDER = ['alliance', 'tribute', 'occupy', 'trade', 'route', 'treaty', 'rivalry'];
  const BLOC_COLORS = { '남북 세력': '#f0a35e', '동서 세력': '#6ec6ff', '냉전 자유 진영': '#6ec6ff', '냉전 공산 진영': '#ff8a7a' };
  const REL_COLOR = ['match', ['get', 'type'],
    'alliance', ['match', ['coalesce', ['get', 'bloc'], ''], ...Object.entries(BLOC_COLORS).flat(), REL_TYPES.alliance.color],
    ...['tribute', 'trade', 'route', 'rivalry', 'treaty', 'occupy'].flatMap((t) => [t, REL_TYPES[t].color]), '#cccccc'];
  const REL_WIDTH = ['interpolate', ['linear'], ['zoom'], 2, ['match', ['get', 'type'], 'treaty', 1.2, 'route', 2, 1.8], 7, ['match', ['get', 'type'], 'treaty', 2, 'route', 3.4, 3]];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  // 화면에 그 요소가 없으면(예: 옛 index.html 이 남아 있을 때) 건너뛰어요
  const bind = (id, ev, fn, opt) => { const n = $(id); if (n) n.addEventListener(ev, fn, opt); };

  // ---------------------------------------------------------------- 상태
  const state = {
    year: START_YEAR,
    chunkId: -1,
    selected: null,      // 선택한 나라 번호 (index.polities 의 위치)
    panelMode: null,     // 'polity' | 'notices'
    playing: false,
    layers: { labels: true, groups: true, water: true, seas: true, wars: true, events: true, rels: false, admin: true, heritage: true },
    mode: 'world',       // 'world' 세계 | 'korea' 한국사 지도
    war: null,           // 선택한 전쟁 번호 (wars.wars 의 위치)
    dn: null,            // 날짜까지 정할 때(전투 순서 보기·재생) 그 날짜. dn = 연*372 + (월-1)*31 + (일-1)
    month: null,         // 월 단위로 펼친 해에서 고른 달 (1~12)
    event: null,         // 연 사건 번호 (events 의 위치)
    rel: null,           // 연 국제 관계 번호
    speed: 1,            // 재생 속도 배수
  };
  let wars = { wars: [], auto: [] };
  let events = [];                                   // 한국사 사건 (events.json)
  let relData = { caps: {}, rels: [] };              // 국제 관계 (relations.json)
  let factionEras = [];                              // 세력 흐름 (factions.json)
  let koreaRivers = { type: 'FeatureCollection', features: [] }; // 한반도 주요 강 (rivers_ko.json)
  const tour = { active: false, war: null, list: [], i: 0, playing: false, timer: 0 }; // 전투 순서대로 보기
  let index = null;
  let map = null;
  let chunkFeatures = [];           // 현재 청크의 국경 피처 (패널에서 현재 면적 찾을 때 씀)
  const chunkCache = new Map();     // id → { polities, labels }
  let yearToken = 0;

  // ---------------------------------------------------------------- 연도 유틸
  function clampYear(y) { return Math.max(YEAR_MIN, Math.min(YEAR_MAX, y)); }
  function fixZero(y, dir) { return y === 0 ? (dir < 0 ? -1 : 1) : y; }
  function addYears(y, d) {
    let r = y + d;
    if (y < 0 && r >= 0) r += 1;
    if (y > 0 && r <= 0) r -= 1;
    return fixZero(clampYear(r), d);
  }
  function yearParts(y) { return y < 0 ? { era: '기원전', num: String(-y) } : { era: '', num: String(y) }; }
  function fmtYear(y) { return y < 0 ? `기원전 ${-y}년` : `${y}년`; }
  function fmtShort(y) { return y < 0 ? `BC ${-y}` : `${y}`; }
  function posToYear(p) {
    for (let i = 1; i < KNOTS.length; i++) {
      const [y1, p1] = KNOTS[i];
      const [y0, p0] = KNOTS[i - 1];
      if (p <= p1) return fixZero(Math.round(y0 + ((p - p0) / (p1 - p0)) * (y1 - y0)), 1);
    }
    return YEAR_MAX;
  }
  function yearToPos(y) {
    for (let i = 1; i < KNOTS.length; i++) {
      const [y1, p1] = KNOTS[i];
      const [y0, p0] = KNOTS[i - 1];
      if (y <= y1) return p0 + ((y - y0) / (y1 - y0)) * (p1 - p0);
    }
    return 1;
  }
  function parseYear(text) {
    const s = String(text).replace(/\s+/g, '').replace(/년$/, '');
    let m = s.match(/^(기원전|BC|bc|B\.C\.)(\d{1,4})$/);
    if (m) return fixZero(clampYear(-parseInt(m[2], 10)), -1);
    m = s.match(/^(서기|AD|ad)?(-?\d{1,4})$/);
    if (m) return fixZero(clampYear(parseInt(m[2], 10)), 1);
    return null;
  }
  function fmtArea(km2) {
    if (km2 >= 10000) {
      const man = km2 / 10000;
      return `약 ${man >= 100 ? Math.round(man).toLocaleString('ko-KR') : man.toFixed(man >= 10 ? 0 : 1)}만 km²`;
    }
    return `약 ${Math.round(km2).toLocaleString('ko-KR')} km²`;
  }
  function koreaRatio(km2) {
    const r = km2 / KOREA_AREA;
    if (r >= 1.5) return `한반도의 약 ${r >= 10 ? Math.round(r) : r.toFixed(1)}배`;
    if (r >= 0.67) return '한반도와 비슷한 크기';
    return `한반도의 약 ${Math.max(1, Math.round(r * 100))}%`;
  }

  // ---------------------------------------------------------------- 데이터 불러오기
  async function gunzipBase64(b64) {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (!('DecompressionStream' in window)) throw new Error('이 브라우저는 압축 해제를 지원하지 않아요. 최신 브라우저로 열어 주세요.');
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  async function loadJSON(name) {
    const embed = window.__EMBED__;
    if (embed && embed[name]) return gunzipBase64(embed[name]);
    const res = await fetch(`data/${name}`);
    if (!res.ok) throw new Error(`${name} 를 불러오지 못했어요 (${res.status})`);
    return res.json();
  }
  function topoToGeo(topo, key) {
    // mapshaper 가 레이어를 'polities1', 'polities2' 처럼 나눠 놓아도 모두 읽기 (안 그러면 그 시대가 통째로 빈 지도가 됨)
    const re = new RegExp(`^${key}\\d*$`);
    const features = [];
    Object.keys(topo.objects).filter((k) => re.test(k)).forEach((k) => {
      const fc = topojson.feature(topo, topo.objects[k]);
      (fc.features || [fc]).forEach((f) => {
        const t = f.geometry && f.geometry.type;
        if (key === 'polities' && t !== 'Polygon' && t !== 'MultiPolygon') return; // 선·점 조각은 버림
        features.push(f);
      });
    });
    return { type: 'FeatureCollection', features };
  }
  function chunkForYear(y) {
    return index.chunks.find((c) => y >= c.from && y <= c.to) || index.chunks[index.chunks.length - 1];
  }

  // 국경 청크(TopoJSON)를 GeoJSON 으로 바꾸는 일은 무거워서 백그라운드 워커에서 해요.
  // 워커가 만든 GeoJSON 은 Blob 주소로 지도 엔진에 넘겨서(엔진도 자기 워커에서 읽음) 화면이 멈추지 않게 해요.
  function chunkWorkerMain() {
    /* eslint-disable no-restricted-globals */
    function decodeArcs(topo) {
      const T = topo.transform;
      return topo.arcs.map((arc) => {
        if (!T) return arc.map((p) => [p[0], p[1]]);
        let x = 0; let y = 0;
        return arc.map((p) => { x += p[0]; y += p[1]; return [x * T.scale[0] + T.translate[0], y * T.scale[1] + T.translate[1]]; });
      });
    }
    function toFC(topo, arcs, key, polygonsOnly) {
      const T = topo.transform;
      const pt = (p) => (T ? [p[0] * T.scale[0] + T.translate[0], p[1] * T.scale[1] + T.translate[1]] : [p[0], p[1]]);
      const arcPts = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
      const line = (idx) => {
        const out = [];
        idx.forEach((i, k) => { const ps = arcPts(i); for (let j = k ? 1 : 0; j < ps.length; j++) out.push(ps[j]); });
        return out;
      };
      const ring = (idx) => { const r = line(idx); while (r.length < 4) r.push(r[0]); return r; };
      const geom = (o) => {
        switch (o.type) {
          case 'Polygon': return { type: 'Polygon', coordinates: o.arcs.map(ring) };
          case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: o.arcs.map((p) => p.map(ring)) };
          case 'LineString': return { type: 'LineString', coordinates: line(o.arcs) };
          case 'MultiLineString': return { type: 'MultiLineString', coordinates: o.arcs.map(line) };
          case 'Point': return { type: 'Point', coordinates: pt(o.coordinates) };
          case 'MultiPoint': return { type: 'MultiPoint', coordinates: o.coordinates.map(pt) };
          default: return null;
        }
      };
      const re = new RegExp(`^${key}\\d*$`);
      const features = [];
      Object.keys(topo.objects).filter((k) => re.test(k)).forEach((k) => {
        const obj = topo.objects[k];
        const list = obj.type === 'GeometryCollection' ? obj.geometries : [obj];
        list.forEach((o) => {
          if (polygonsOnly && o.type !== 'Polygon' && o.type !== 'MultiPolygon') return;
          const g = geom(o);
          if (!g) return;
          const f = { type: 'Feature', properties: o.properties || {}, geometry: g };
          if (o.id != null) f.id = o.id;
          features.push(f);
        });
      });
      return { type: 'FeatureCollection', features };
    }
    self.postMessage({ ready: true });
    self.onmessage = async (ev) => {
      const { id, url, b64 } = ev.data;
      try {
        let topo;
        if (b64) {
          const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
          topo = JSON.parse(await new Response(stream).text());
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          topo = await res.json();
        }
        const arcs = decodeArcs(topo);
        const pol = toFC(topo, arcs, 'polities', true);
        const lab = toFC(topo, arcs, 'labels', false);
        const props = pol.features.map((f) => { const p = f.properties; return [p.p, p.f, p.t, p.a, p.u]; });
        self.postMessage({ id, pol: JSON.stringify(pol), lab: JSON.stringify(lab), props });
      } catch (e) {
        self.postMessage({ id, error: String((e && e.message) || e) });
      }
    };
  }
  let chunkWorker = null; // null: 아직 안 만듦, false: 못 씀(예전 방식으로)
  let chunkWorkerReady = null;
  const workerJobs = new Map();
  let workerSeq = 0;
  function dropWorker() {
    if (chunkWorker) { try { chunkWorker.terminate(); } catch (e) { /* 무시 */ } }
    chunkWorker = false;
    workerJobs.forEach((j) => j.reject(new Error('worker')));
    workerJobs.clear();
  }
  function getChunkWorker() {
    if (chunkWorker === false) return null;
    if (chunkWorker) return chunkWorker;
    try {
      const src = `(${chunkWorkerMain.toString()})();`;
      chunkWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      // 보안 설정 때문에 워커가 조용히 안 뜨는 곳도 있어서, 몇 초 안에 신호가 없으면 예전 방식으로
      chunkWorkerReady = new Promise((resolve) => {
        const t = setTimeout(() => { dropWorker(); resolve(false); }, 4000);
        chunkWorker.onmessage = (ev) => {
          if (ev.data && ev.data.ready) { clearTimeout(t); resolve(true); return; }
          const job = workerJobs.get(ev.data.id);
          if (!job) return;
          workerJobs.delete(ev.data.id);
          if (ev.data.error) job.reject(new Error(ev.data.error)); else job.resolve(ev.data);
        };
        chunkWorker.onerror = () => { clearTimeout(t); dropWorker(); resolve(false); };
      });
    } catch (e) {
      chunkWorker = false;
    }
    return chunkWorker || null;
  }
  async function loadChunkInWorker(c) {
    const w = getChunkWorker();
    if (!w || !(await chunkWorkerReady) || !chunkWorker) throw new Error('no worker');
    return new Promise((resolve, reject) => {
      const id = ++workerSeq;
      workerJobs.set(id, { resolve, reject });
      const embed = window.__EMBED__;
      chunkWorker.postMessage(embed && embed[c.file] ? { id, b64: embed[c.file] } : { id, url: new URL(`data/${c.file}`, location.href).href });
    });
  }
  const chunkLoading = new Map(); // id → Promise (같은 청크를 두 번 읽지 않게)
  async function getChunk(c) {
    if (chunkCache.has(c.id)) return chunkCache.get(c.id);
    if (chunkLoading.has(c.id)) return chunkLoading.get(c.id);
    const job = (async () => {
      let data;
      try {
        const r = await loadChunkInWorker(c);
        // 한 파일로 묶은 미리보기에서는 blob 주소를 못 읽는 곳이 있어서 객체로 넘겨요
        data = window.__EMBED__
          ? { pol: JSON.parse(r.pol), lab: JSON.parse(r.lab), props: r.props }
          : {
            pol: URL.createObjectURL(new Blob([r.pol], { type: 'application/json' })),
            lab: URL.createObjectURL(new Blob([r.lab], { type: 'application/json' })),
            props: r.props, blob: true,
          };
      } catch (e) {
        // 워커를 못 쓰는 환경: 예전처럼 여기서 바꿈
        const topo = await loadJSON(c.file);
        const pol = topoToGeo(topo, 'polities');
        data = { pol, lab: topoToGeo(topo, 'labels'), props: pol.features.map((f) => { const p = f.properties; return [p.p, p.f, p.t, p.a, p.u]; }) };
      }
      chunkCache.set(c.id, data);
      // 오래된 청크부터 비우기 (지금 보고 있는 청크는 남김)
      while (chunkCache.size > 6) {
        const old = [...chunkCache.keys()].find((k) => k !== state.chunkId && k !== c.id);
        if (old == null) break;
        const d = chunkCache.get(old);
        if (d.blob) { URL.revokeObjectURL(d.pol); URL.revokeObjectURL(d.lab); }
        chunkCache.delete(old);
      }
      return data;
    })();
    chunkLoading.set(c.id, job);
    try { return await job; } finally { chunkLoading.delete(c.id); }
  }
  function prefetchAround(c) {
    const i = index.chunks.indexOf(c);
    [index.chunks[i + 1], index.chunks[i - 1]].forEach((n) => { if (n) getChunk(n).catch(() => {}); });
  }
  // 지도 엔진이 새 국경 데이터를 다 읽을 때까지 기다림 (그 전에 연도 필터를 바꾸면 잠깐 빈 지도가 보임)
  function waitSourceLoaded(id, timeout = 900) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; map.off('sourcedata', onData); clearTimeout(t); resolve(); };
      const onData = (e) => { if (e.sourceId === id && e.isSourceLoaded) finish(); };
      const t = setTimeout(finish, timeout);
      map.on('sourcedata', onData);
    });
  }

  // ---------------------------------------------------------------- 지도 스타일
  function yearFilter(y, extra) {
    const f = ['all', ['<=', ['get', 'f'], y], ['>=', ['get', 't'], y]];
    if (extra) f.push(extra);
    return f;
  }
  function buildStyle(base) {
    const empty = { type: 'FeatureCollection', features: [] };
    const palette = index.palette;
    const colorExpr = ['to-color', ['at', ['%', ['get', 'c'], palette.length], ['literal', palette]]];
    const labelFont = ['IBM Plex Sans KR'];
    return {
      version: 8,
      sources: {
        land: { type: 'geojson', data: topoToGeo(base, 'land') },
        lakes: { type: 'geojson', data: topoToGeo(base, 'lakes') },
        rivers: { type: 'geojson', data: topoToGeo(base, 'rivers') },
        'korea-rivers': { type: 'geojson', data: koreaRivers },
        capitals: { type: 'geojson', data: empty },
        polities: { type: 'geojson', data: empty, promoteId: 'i' },
        labels: { type: 'geojson', data: empty },
        seas: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: SEAS.map(([n, x, y, r]) => ({ type: 'Feature', properties: { n, r }, geometry: { type: 'Point', coordinates: [x, y] } })) },
        },
        battles: { type: 'geojson', data: battlesGeoJSON() },
        events: { type: 'geojson', data: eventsGeoJSON() },
        rels: { type: 'geojson', data: empty },
        'rel-caps': { type: 'geojson', data: empty },
        routes: { type: 'geojson', data: empty },
        'route-stops': { type: 'geojson', data: empty },
        'route-heads': { type: 'geojson', data: empty },
        islands: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: ISLANDS.map(([n, x, y]) => ({ type: 'Feature', properties: { n }, geometry: { type: 'Point', coordinates: [x, y] } })) },
        },
      },
      layers: [
        { id: 'sea', type: 'background', paint: { 'background-color': '#1c3044' } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#4a5866' } },
        { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#7b8a98', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.3, 6, 0.9], 'line-opacity': 0.55 } },
        {
          id: 'polity-fill', type: 'fill', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 0]),
          paint: {
            'fill-color': colorExpr,
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, ['==', ['get', 'u'], 1], 0.68, 0.9],
          },
        },
        { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': '#22394f' } },
        {
          id: 'rivers', type: 'line', source: 'rivers',
          paint: { 'line-color': '#2b4a68', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 1.2, 9, 2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 5, 0.75] },
        },
        {
          id: 'korea-rivers', type: 'line', source: 'korea-rivers', minzoom: 3.2,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#3f74a3',
            'line-width': ['interpolate', ['linear'], ['zoom'], 3.2, 0.6, 6, 1.6, 9, 2.8],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 3.2, 0.4, 5, 0.9],
          },
        },
        {
          id: 'polity-line', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 0]),
          paint: { 'line-color': '#1e2a36', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 5, 0.9, 8, 1.4] },
        },
        {
          id: 'uncertain-line', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'u'], 1]),
          layout: { 'line-join': 'round' },
          paint: { 'line-color': '#f4f1e6', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 6, 1.6], 'line-dasharray': [2, 2] },
        },
        {
          id: 'group-line', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 1]),
          layout: { 'line-join': 'round' },
          paint: { 'line-color': '#f3e1a0', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 2.2], 'line-dasharray': [2, 1.6] },
        },
        {
          id: 'hover-line', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 0]),
          paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0] },
        },
        {
          id: 'select-glow', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'p'], -1]),
          paint: { 'line-color': '#e9b949', 'line-width': 7, 'line-blur': 5, 'line-opacity': 0.55 },
        },
        {
          id: 'select-line', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'p'], -1]),
          paint: { 'line-color': '#e9b949', 'line-width': 2.4 },
        },
        {
          id: 'war-b-glow', type: 'line', source: 'polities', filter: ['boolean', false],
          paint: { 'line-color': '#5fa8ff', 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.5 },
        },
        {
          id: 'war-b', type: 'line', source: 'polities', filter: ['boolean', false],
          paint: { 'line-color': '#7db8ff', 'line-width': 2.6 },
        },
        {
          id: 'war-a-glow', type: 'line', source: 'polities', filter: ['boolean', false],
          paint: { 'line-color': '#ff6b5b', 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.5 },
        },
        {
          id: 'war-a', type: 'line', source: 'polities', filter: ['boolean', false],
          paint: { 'line-color': '#ff8a7a', 'line-width': 2.6 },
        },
        {
          id: 'sea-labels', type: 'symbol', source: 'seas',
          filter: ['<=', ['get', 'r'], ['step', ['zoom'], 0, 1.8, 1, 2.8, 2, 3.8, 3]],
          layout: {
            'text-field': ['get', 'n'], 'text-font': ['Nanum Myeongjo'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 5, 15], 'text-letter-spacing': 0.35,
            'text-allow-overlap': false,
          },
          paint: { 'text-color': '#8ea6bd', 'text-halo-color': '#1c3044', 'text-halo-width': 1 },
        },
        {
          id: 'korea-river-labels', type: 'symbol', source: 'korea-rivers', minzoom: 5,
          layout: {
            'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': ['get', 'n'], 'text-font': labelFont,
            'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10.5, 8, 13], 'text-max-angle': 35, 'text-letter-spacing': 0.15,
          },
          paint: { 'text-color': '#a9cdee', 'text-halo-color': 'rgba(18,32,48,0.85)', 'text-halo-width': 1.3 },
        },
        {
          id: 'group-labels', type: 'symbol', source: 'labels', maxzoom: 4.5,
          filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 1]),
          layout: {
            'text-field': ['get', 'k'], 'text-font': labelFont, 'text-size': ['interpolate', ['linear'], ['zoom'], 1, 12, 4, 15],
            'text-letter-spacing': 0.18, 'text-max-width': 9, 'symbol-sort-key': ['-', 0, ['get', 'a']],
            'text-offset': [0, -1.4], 'text-padding': 6,
          },
          paint: { 'text-color': '#f6e7b0', 'text-halo-color': 'rgba(20,30,40,0.85)', 'text-halo-width': 1.4, 'text-opacity': 0.9 },
        },
        {
          id: 'labels', type: 'symbol', source: 'labels', filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 0]),
          layout: {
            'text-field': ['case', ['==', ['get', 'u'], 1], ['concat', ['get', 'k'], '\n(추정)'], ['get', 'k']], 'text-font': labelFont,
            'text-size': ['interpolate', ['linear'], ['zoom'],
              1, ['interpolate', ['linear'], ['get', 'a'], 0, 9, 300000, 11, 3000000, 14, 15000000, 16],
              4, ['interpolate', ['linear'], ['get', 'a'], 0, 11, 300000, 14, 3000000, 18],
              7, ['interpolate', ['linear'], ['get', 'a'], 0, 13, 300000, 18]],
            'text-max-width': 7, 'text-padding': 3,
            'symbol-sort-key': ['-', 0, ['get', 'a']],
          },
          paint: { 'text-color': '#15212c', 'text-halo-color': 'rgba(246,244,236,0.92)', 'text-halo-width': 1.5, 'text-halo-blur': 0.3 },
        },
        // 국제 관계 (동맹·사대·교류는 선 모양으로 구분)
        {
          id: 'capitals', type: 'circle', source: 'capitals', minzoom: 3.6,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3.6, 3, 7, 5.5],
            'circle-color': '#1c3044', 'circle-stroke-color': '#f6e7b8', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3.6, 1.6, 7, 2.4],
          },
        },
        {
          id: 'capitals-dot', type: 'circle', source: 'capitals', minzoom: 3.6,
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3.6, 1.2, 7, 2.2], 'circle-color': '#f6e7b8' },
        },
        {
          id: 'capital-labels', type: 'symbol', source: 'capitals', minzoom: 4.4,
          layout: {
            'text-field': ['format', ['get', 'n'], { 'font-scale': 1 }, '\n', {}, ['get', 's'], { 'font-scale': 0.78 }],
            'text-font': labelFont, 'text-size': ['interpolate', ['linear'], ['zoom'], 4.4, 11, 8, 14],
            'text-anchor': 'bottom', 'text-offset': [0, -1.15], 'text-optional': true,
          },
          paint: { 'text-color': '#f6e7b8', 'text-halo-color': 'rgba(18,28,40,0.9)', 'text-halo-width': 1.4 },
        },
        {
          id: 'rel-sel', type: 'line', source: 'rels', filter: ['boolean', false], layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#e9b949', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 7, 7, 11], 'line-blur': 4, 'line-opacity': 0.55 },
        },
        {
          id: 'rel-line-solid', type: 'line', source: 'rels', filter: ['in', ['get', 'type'], ['literal', ['alliance', 'route', 'treaty']]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': REL_COLOR, 'line-width': REL_WIDTH, 'line-opacity': 0.92 },
        },
        {
          id: 'rel-line-dash', type: 'line', source: 'rels', filter: ['in', ['get', 'type'], ['literal', ['tribute', 'rivalry', 'occupy']]],
          layout: { 'line-join': 'round' },
          paint: { 'line-color': REL_COLOR, 'line-width': REL_WIDTH, 'line-opacity': 0.92, 'line-dasharray': [2.4, 1.4] },
        },
        {
          id: 'rel-line-dot', type: 'line', source: 'rels', filter: ['==', ['get', 'type'], 'trade'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': REL_COLOR, 'line-width': REL_WIDTH, 'line-opacity': 0.95, 'line-dasharray': [0.1, 2] },
        },
        {
          id: 'rel-arrows', type: 'symbol', source: 'rels', filter: ['in', ['get', 'type'], ['literal', ['route', 'tribute', 'occupy']]],
          layout: {
            'symbol-placement': 'line', 'symbol-spacing': 90, 'icon-image': 'chev', 'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 7, 0.55],
            'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map',
          },
          paint: { 'icon-color': REL_COLOR, 'icon-opacity': 0.95 },
        },
        {
          id: 'rel-caps', type: 'circle', source: 'rel-caps',
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.6, 7, 4.5], 'circle-color': '#f6f2e6', 'circle-stroke-color': '#1c3044', 'circle-stroke-width': 1.2 },
        },
        {
          id: 'rel-labels', type: 'symbol', source: 'rels', minzoom: 3.2, filter: ['boolean', false],
          layout: {
            'symbol-placement': 'line-center', 'text-field': ['get', 'n'], 'text-font': labelFont,
            'text-size': ['interpolate', ['linear'], ['zoom'], 3.2, 10.5, 7, 12.5], 'text-max-angle': 30, 'text-allow-overlap': false,
            'symbol-sort-key': ['-', 0, ['get', 'imp']],
          },
          paint: { 'text-color': REL_COLOR, 'text-halo-color': 'rgba(12,20,30,0.92)', 'text-halo-width': 1.6 },
        },
        {
          id: 'rel-cap-labels', type: 'symbol', source: 'rel-caps', minzoom: 3.8,
          layout: { 'text-field': ['get', 'n'], 'text-font': labelFont, 'text-size': 11, 'text-offset': [0, 0.85], 'text-anchor': 'top', 'text-optional': true },
          paint: { 'text-color': '#f6f2e6', 'text-halo-color': 'rgba(12,20,30,0.9)', 'text-halo-width': 1.4 },
        },
        {
          id: 'route-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': 'rgba(12,20,30,0.75)', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 5, 8, 9] },
        },
        {
          id: 'route-line', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['case', ['==', ['get', 'side'], 0], '#ff6b5b', '#5fa8ff'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.6, 8, 5],
          },
        },
        {
          id: 'route-arrows', type: 'symbol', source: 'routes',
          layout: {
            'symbol-placement': 'line', 'symbol-spacing': 70, 'icon-image': 'chev', 'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 8, 0.8],
            'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map',
          },
          paint: { 'icon-color': '#ffffff', 'icon-opacity': 0.95 },
        },
        {
          id: 'route-stops', type: 'circle', source: 'route-stops', minzoom: 4.2,
          paint: { 'circle-radius': 3.2, 'circle-color': '#ffffff', 'circle-stroke-width': 1.6, 'circle-stroke-color': ['case', ['==', ['get', 'side'], 0], '#ff6b5b', '#5fa8ff'] },
        },
        {
          id: 'route-stop-labels', type: 'symbol', source: 'route-stops', minzoom: 4.6, filter: ['==', ['get', 'lab'], 1],
          layout: {
            'text-field': ['get', 'n'],
            'text-font': labelFont, 'text-size': 11, 'text-offset': [0.8, 0], 'text-anchor': 'left', 'text-optional': true,
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(12,20,30,0.9)', 'text-halo-width': 1.4 },
        },
        {
          id: 'battle-halo', type: 'circle', source: 'battles', filter: ['boolean', false],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 11, 7, 24],
            'circle-color': '#e9b949', 'circle-opacity': 0.3, 'circle-blur': 0.55,
          },
        },
        {
          id: 'battles', type: 'circle', source: 'battles', filter: battleFilter(START_YEAR),
          layout: { 'circle-sort-key': ['coalesce', ['get', 'o'], 0] }, // 나중 전투가 위에 그려지게
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['+', 2.5, ['*', 1.5, ['get', 'imp']]], 4.5, ['+', 6, ['*', 1.2, ['get', 'imp']]], 7, ['+', 6, ['*', 2, ['get', 'imp']]]],
            'circle-color': ['case', ['==', ['get', 'auto'], 1], '#c9ced4', ['==', ['get', 'win'], 0], '#ff6b5b', ['==', ['get', 'win'], 1], '#5fa8ff', '#e8e2cf'],
            'circle-opacity': ['case', ['>', ['get', 'y'], START_YEAR], 0.35, 1],
            'circle-stroke-color': ['case', ['boolean', ['feature-state', 'sel'], false], '#e9b949', '#ffffff'],
            'circle-stroke-width': ['case', ['boolean', ['feature-state', 'sel'], false], 3, 1.6],
            'circle-stroke-opacity': ['case', ['>', ['get', 'y'], START_YEAR], 0.5, 1],
          },
        },
        {
          // 전쟁 안에서의 순서 번호 (점 안에)
          id: 'battle-order', type: 'symbol', source: 'battles', minzoom: 3.6,
          filter: ['all', battleFilter(START_YEAR), ['==', ['get', 'auto'], 0]],
          layout: {
            'text-field': ['to-string', ['get', 'o']], 'text-font': labelFont,
            'text-size': ['interpolate', ['linear'], ['zoom'], 3.6, 9, 7, 12],
            'text-allow-overlap': true, 'text-ignore-placement': true, 'symbol-sort-key': ['get', 'o'],
          },
          paint: { 'text-color': ['case', ['==', ['get', 'win'], -1], '#1c2733', '#ffffff'] },
        },
        {
          id: 'route-heads', type: 'circle', source: 'route-heads',
          paint: {
            'circle-radius': 7, 'circle-color': ['case', ['==', ['get', 'side'], 0], '#ff6b5b', '#5fa8ff'],
            'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.2,
          },
        },
        {
          id: 'route-head-labels', type: 'symbol', source: 'route-heads',
          layout: { 'text-field': ['get', 'n'], 'text-font': labelFont, 'text-size': 12.5, 'text-offset': [0, -1.5], 'text-anchor': 'bottom', 'text-allow-overlap': true },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(12,20,30,0.95)', 'text-halo-width': 1.8 },
        },
        {
          id: 'battle-labels', type: 'symbol', source: 'battles', minzoom: 4.6, filter: battleFilter(START_YEAR),
          layout: {
            'text-field': ['get', 'n'], 'text-font': labelFont, 'text-size': ['interpolate', ['linear'], ['zoom'], 4.6, 11, 8, 13],
            'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-max-width': 8, 'text-optional': true,
            'symbol-sort-key': ['-', 0, ['get', 'imp']],
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.6 },
        },
        // 한국사 사건 (마름모)
        {
          id: 'event-icons', type: 'symbol', source: 'events', filter: eventFilter(START_YEAR),
          layout: {
            'icon-image': 'evt', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 2, ['+', 0.26, ['*', 0.06, ['get', 'i']]], 7, ['+', 0.44, ['*', 0.1, ['get', 'i']]]],
            'symbol-sort-key': ['get', 'i'],
          },
          paint: {
            'icon-color': CAT_COLOR,
            'icon-halo-color': ['case', ['boolean', ['feature-state', 'sel'], false], '#e9b949', '#ffffff'],
            'icon-halo-width': ['case', ['boolean', ['feature-state', 'sel'], false], 3, 1.3],
          },
        },
        {
          id: 'event-labels', type: 'symbol', source: 'events', minzoom: 4.3, filter: eventFilter(START_YEAR),
          layout: {
            'text-field': ['get', 'n'], 'text-font': labelFont, 'text-size': ['interpolate', ['linear'], ['zoom'], 4.3, 11, 8, 13],
            'text-offset': [0, 1.15], 'text-anchor': 'top', 'text-max-width': 9, 'text-optional': true,
            'symbol-sort-key': ['-', 0, ['get', 'i']],
          },
          paint: { 'text-color': '#fff6dc', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.6 },
        },
        {
          id: 'islands-dot', type: 'circle', source: 'islands', minzoom: 3.5,
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3.5, 1.6, 8, 3.5], 'circle-color': '#d7dee5', 'circle-stroke-color': '#1c3044', 'circle-stroke-width': 0.8 },
        },
        {
          id: 'islands-label', type: 'symbol', source: 'islands', minzoom: 3.8,
          layout: { 'text-field': ['get', 'n'], 'text-font': labelFont, 'text-size': ['interpolate', ['linear'], ['zoom'], 3.8, 10, 7, 13], 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-allow-overlap': true },
          paint: { 'text-color': '#e8edf1', 'text-halo-color': '#1c3044', 'text-halo-width': 1.2 },
        },
      ],
    };
  }

  // 전쟁 안에서 날짜 순서 (같은 날이면 데이터 순서). 결과: battle 번호 → 1부터 시작하는 순서
  const orderCache = new Map();
  function battleOrder(wi) {
    if (orderCache.has(wi)) return orderCache.get(wi);
    const W = wars.wars[wi];
    const sorted = W.battles.map((b, bi) => bi).sort((a, b) => (W.battles[a].dn - W.battles[b].dn) || (a - b));
    const ord = [];
    sorted.forEach((bi, k) => { ord[bi] = k + 1; });
    const res = { sorted, ord };
    orderCache.set(wi, res);
    return res;
  }
  function battlesGeoJSON() {
    const features = [];
    wars.wars.forEach((w, wi) => w.battles.forEach((b, bi) => features.push({
      type: 'Feature', id: wi * 1000 + bi,
      properties: { w: wi, b: bi, y: b.y, dn: b.dn, wf: w.f, wt: w.t, win: b.win == null ? -1 : b.win, imp: b.imp, n: b.name, auto: 0, o: battleOrder(wi).ord[bi], kr: w.region === 'korea' ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [b.x, b.yy] },
    })));
    wars.auto.forEach((b, ai) => features.push({
      type: 'Feature', id: 1000000 + ai,
      properties: { w: -1, b: ai, y: b.y, wf: b.y, wt: b.y, win: -1, imp: 1, n: b.name, auto: 1, kr: 0 },
      geometry: { type: 'Point', coordinates: [b.x, b.yy] },
    }));
    return { type: 'FeatureCollection', features };
  }
  function eventsGeoJSON() {
    const features = [];
    events.forEach((ev, k) => {
      if (ev.nomap) return;
      features.push({
        type: 'Feature', id: k,
        properties: { k, y: ev.y, ey: ev.ey != null ? ev.ey : ev.y, dn: ev.dn, c: Math.max(0, CATS.indexOf(ev.c)), i: ev.i, n: ev.n },
        geometry: { type: 'Point', coordinates: [ev.x, ev.yy] },
      });
    });
    return { type: 'FeatureCollection', features };
  }
  function eventFilter(y) {
    return ['all', ['<=', ['get', 'y'], y], ['>=', ['get', 'ey'], y]];
  }
  function battleFilter(y) {
    const f = ['any',
      ['all', ['==', ['get', 'auto'], 0], ['<=', ['get', 'wf'], y], ['>=', ['get', 'wt'], y]],
      ['all', ['==', ['get', 'auto'], 1], ['<=', ['abs', ['-', ['get', 'y'], y]], 2]]];
    // 한국사 화면에서는 한국사 전쟁의 전투만
    return state.mode === 'korea' ? ['all', f, ['==', ['coalesce', ['get', 'kr'], 0], 1]] : f;
  }
  // 한국사 화면: 한국 나라만 이름·경계를 보여 줘요
  function koreaOnly(extra) {
    if (state.mode !== 'korea' || !index) return extra;
    if (!koreanIdx) koreanIdx = index.polities.map((P, i) => (KOREAN_POLITIES.has(P.n) ? i : -1)).filter((i) => i >= 0);
    return ['all', extra, ['in', ['get', 'p'], ['literal', koreanIdx]]];
  }
  function activeWars(y) {
    return wars.wars.map((w, i) => ({ w, i })).filter(({ w }) => w.f <= y && w.t >= y);
  }

  function applyYearFilters() {
    const y = state.year;
    const sel = state.selected ?? -1;
    map.setFilter('polity-fill', yearFilter(y, ['==', ['get', 'g'], 0]));
    map.setFilter('polity-line', yearFilter(y, koreaOnly(['all', ['==', ['get', 'g'], 0], ['!=', ['get', 'u'], 1]])));
    map.setFilter('uncertain-line', yearFilter(y, koreaOnly(['==', ['get', 'u'], 1])));
    map.setFilter('hover-line', yearFilter(y, koreaOnly(['==', ['get', 'g'], 0])));
    map.setFilter('group-line', yearFilter(y, koreaOnly(['==', ['get', 'g'], 1])));
    map.setFilter('select-line', yearFilter(y, ['==', ['get', 'p'], sel]));
    map.setFilter('select-glow', yearFilter(y, ['==', ['get', 'p'], sel]));
    map.setFilter('labels', yearFilter(y, koreaOnly(['==', ['get', 'g'], 0])));
    map.setFilter('group-labels', yearFilter(y, koreaOnly(['==', ['get', 'g'], 1])));
    // 아직 일어나지 않은 전투: 날짜(dn)가 정해져 있으면 그 날짜 뒤, 아니면 그해 뒤
    const cut = state.dn != null ? state.dn : y * 372 + 371;
    const fut = ['case', ['==', ['get', 'auto'], 1], ['>', ['get', 'y'], y], ['>', ['get', 'dn'], cut]];
    const live = tour.active;
    map.setFilter('battles', battleFilter(y));
    map.setFilter('battle-order', ['all', battleFilter(y), ['==', ['get', 'auto'], 0]]);
    map.setFilter('battle-labels', state.dn != null ? ['all', battleFilter(y), ['!', fut]] : battleFilter(y));
    map.setPaintProperty('battles', 'circle-opacity', ['case', fut, live ? 0.16 : 0.35, 1]);
    map.setPaintProperty('battles', 'circle-stroke-opacity', ['case', fut, live ? 0.3 : 0.5, 1]);
    map.setPaintProperty('battle-order', 'text-opacity', ['case', fut, live ? 0.25 : 0.55, 1]);
    const W = state.war != null ? wars.wars[state.war] : null;
    const on = W && W.f <= y && W.t >= y;
    const sideFilter = (k) => (on && W.sides[k] ? yearFilter(y, ['in', ['get', 'p'], ['literal', W.sides[k].p]]) : ['boolean', false]);
    ['war-a', 'war-a-glow'].forEach((id) => map.setFilter(id, sideFilter(0)));
    ['war-b', 'war-b-glow'].forEach((id) => map.setFilter(id, sideFilter(1)));
    // 사건: 그해(기간 사건은 그 기간) 것만. 날짜가 정해져 있으면 아직 안 일어난 건 흐리게
    const efut = ['>', ['get', 'dn'], cut];
    map.setFilter('event-icons', eventFilter(y));
    map.setFilter('event-labels', state.dn != null ? ['all', eventFilter(y), ['!', efut]] : eventFilter(y));
    map.setPaintProperty('event-icons', 'icon-opacity', state.dn != null ? ['case', efut, 0.28, 1] : 1);
    syncRelations();
    syncCapitals();
    syncKorea();
    renderYearCard();
    syncRoutes();
    drawRuler();
    updateWarMarks();
  }
  // 그해 한국 나라들의 도읍 (지도 위 노란 테두리 점). 강과 함께 보면 한성·한양이 한강 가에 있는 게 보여요
  const CAPITAL_STATES = [
    ['고조선', -2333, -108], ['부여', -200, 494], ['고구려', -37, 668], ['백제', -18, 660], ['신라', -57, 935], ['가야', 42, 562],
    ['발해', 698, 926], ['후백제', 900, 936], ['태봉', 901, 917], ['고려', 918, 1391], ['조선', 1392, 1896], ['대한 제국', 1897, 1910],
    ['임시 정부', 1919, 1945], ['대한민국', 1948, 2024], ['북한', 1948, 2024],
  ];
  let capKey = '';
  function syncCapitals() {
    if (!map || !map.getSource('capitals')) return;
    const y = state.year;
    const list = CAPITAL_STATES.filter(([, f, t]) => y >= f && y <= t).map(([n]) => [n, capAt(n, y)]).filter(([, c]) => c);
    const key = list.map(([n, c]) => `${n}${c[3]}`).join('|');
    if (key === capKey) return;
    capKey = key;
    map.getSource('capitals').setData({
      type: 'FeatureCollection',
      features: list.map(([n, c]) => ({
        type: 'Feature',
        properties: { n: c[3], s: n === '임시 정부' ? '대한민국 임시 정부' : n === '가야' ? '가야 연맹의 중심' : `${n} 도읍` },
        geometry: { type: 'Point', coordinates: [c[1], c[2]] },
      })),
    });
  }
  function applyLayerToggles() {
    const vis = (on) => (on ? 'visible' : 'none');
    map.setLayoutProperty('labels', 'visibility', vis(state.layers.labels));
    map.setLayoutProperty('group-labels', 'visibility', vis(state.layers.labels && state.layers.groups));
    map.setLayoutProperty('group-line', 'visibility', vis(state.layers.groups));
    map.setLayoutProperty('rivers', 'visibility', vis(state.layers.water));
    map.setLayoutProperty('lakes', 'visibility', vis(state.layers.water));
    map.setLayoutProperty('korea-rivers', 'visibility', vis(state.layers.water));
    map.setLayoutProperty('korea-river-labels', 'visibility', vis(state.layers.water));
    map.setLayoutProperty('sea-labels', 'visibility', vis(state.layers.seas));
    ['battles', 'battle-halo', 'battle-order', 'battle-labels', 'war-a', 'war-a-glow', 'war-b', 'war-b-glow', 'route-casing', 'route-line', 'route-arrows', 'route-stops', 'route-stop-labels', 'route-heads', 'route-head-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', vis(warLayerOn())));
    ['event-icons', 'event-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', vis(evLayerOn())));
    relVisOn = null;
    syncRelations();
    syncKorea(true);
    renderYearCard();
    drawRuler();
    updateWarMarks();
  }

  // ---------------------------------------------------------------- 연도 바꾸기
  async function setYear(y, opts = {}) {
    y = fixZero(clampYear(Math.round(y)), 1);
    if (tour.active && !opts.fromTour) endTour({ reopen: false, silent: true });
    state.year = y;
    state.dn = opts.dn != null ? opts.dn : null;
    state.month = opts.month != null && state.dn != null ? opts.month : null;
    renderYear(opts);
    renderYearEvent();
    const token = ++yearToken;
    const c = chunkForYear(y);
    if (c.id !== state.chunkId) {
      const data = await getChunk(c);
      if (token !== yearToken) return;
      state.chunkId = c.id;
      chunkFeatures = data.props;
      const loaded = waitSourceLoaded('polities');
      map.getSource('polities').setData(data.pol);
      map.getSource('labels').setData(data.lab);
      prefetchAround(c);
      await loaded;
      if (token !== yearToken) return;
    } else {
      // 청크 끝에 가까워지면 다음 청크를 미리 준비
      if (y - c.from < 6 || c.to - y < 6) prefetchAround(c);
    }
    if (token !== yearToken) return;
    applyYearFilters();
    renderNotice();
    if (state.panelMode === 'polity') renderPanel();
    if (state.panelMode === 'notices') renderNoticePanel();
    if (state.panelMode === 'war' && state.war != null) renderWarPanel();
    if (state.panelMode === 'world') renderWorldPanel();
    if (state.panelMode === 'chrono') refreshChronoNow();
    if (K && state.panelMode === 'theme') renderThemePanel();
    if (K && state.panelMode === 'themes') renderThemesPanel();
    if (K && state.panelMode === 'hanyang') renderHanyangPanel();
    if (K && state.panelMode === 'bungdang') renderBungdangPanel();
    if (!$('factions').hidden) renderFactions();
    scheduleOnscreen();
    scheduleHash();
  }

  function renderYear(opts = {}) {
    const { era, num } = yearParts(state.year);
    $('year-era').textContent = era;
    $('year-num').textContent = num;
    const mo = $('year-month');
    if (state.month != null) {
      mo.textContent = `${isLunarYear(state.year) ? '음력 ' : ''}${state.month}월`;
      mo.hidden = false;
    } else mo.hidden = true;
    $('year-btn').setAttribute('aria-label', `${fmtYear(state.year)}, 눌러서 연도 직접 입력`);
    const slider = $('slider');
    const pos = yearToPos(state.year);
    if (!opts.fromSlider) slider.value = String(Math.round(pos * 10000));
    slider.setAttribute('aria-valuetext', fmtYear(state.year));
    slider.style.setProperty('--fill', `${pos * 100}%`);
    const R = $('ruler');
    R.setAttribute('aria-valuenow', String(state.year));
    R.setAttribute('aria-valuetext', fmtYear(state.year));
    if (opts.fromRuler) drawRuler(); else rulerFollow();
    updateWarMarks();
  }

  // 날짜가 정해져 있으면 연도 아래에 '음력 4월 28일 · 탄금대 전투' 처럼, 월 단위로 볼 때는 그 달의 일을 보여 줌
  function itemName(it) { return it.kind === 'b' ? wars.wars[it.w].battles[it.b].name : events[it.k].n; }
  function itemDate(it) { return it.kind === 'b' ? wars.wars[it.w].battles[it.b].date : events[it.k].date; }
  function itemsOnDn(y, dn) { return (datedByYear.get(y) || []).filter((it) => it.dn === dn); }
  function itemsInMonth(y, m) {
    const a = y * 372 + (m - 1) * 31;
    return (datedByYear.get(y) || []).filter((it) => it.dn >= a && it.dn <= a + 30);
  }
  function battlesOnDn(dn) {
    const hits = [];
    wars.wars.forEach((W) => W.battles.forEach((b) => { if (b.dn === dn) hits.push(b); }));
    return hits;
  }
  function dateWithoutYear(text) {
    const rest = String(text).replace(/^(기원전\s*)?\d+년\s*/, '');
    return rest || String(text); // 연도만 알려진 전투는 연도를 그대로
  }
  function namesText(list) {
    const names = [...new Set(list.map(itemName))];
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}` : names.join(', ');
  }
  function renderYearEvent() {
    const box = $('year-event');
    const block = box.parentElement;
    let text = '';
    if (state.dn != null) {
      const exact = itemsOnDn(state.year, state.dn).filter((it) => /\d+일/.test(itemDate(it)));
      if (exact.length) text = `${dateWithoutYear(itemDate(exact[0])).replace(/\s*\(양력.*\)$/, '')} · ${namesText(exact)}`;
      else if (state.month != null) {
        const list = itemsInMonth(state.year, state.month);
        text = list.length ? `이달: ${namesText(list)}` : '이달에 기록된 일은 없어요';
      } else {
        const hits = battlesOnDn(state.dn);
        if (hits.length) text = `${dateWithoutYear(hits[0].date)} · ${hits.map((b) => b.name).join(', ')}`;
      }
    }
    box.textContent = text;
    box.hidden = !text;
    block.classList.toggle('has-event', !!text);
  }

  // ---------------------------------------------------------------- 화면 속 나라
  let needOnscreen = false;
  let onscreenTimer = 0;
  // 지도가 멈추면 곧바로(0.15초 뒤) 가운데 나라를 다시 봐요. idle 을 기다리면 느린 기기에서 늦어서
  function scheduleOnscreen() {
    needOnscreen = true;
    clearTimeout(onscreenTimer);
    onscreenTimer = setTimeout(() => { if (needOnscreen && map) { needOnscreen = false; updateOnscreen(); } }, 150);
  }
  let focusRetry = 0;
  function updateOnscreen() {
    if (!map || !index) return;
    const f = computeFocus();
    // 국경이 아직 안 그려졌으면 잠시 뒤 다시
    if (f.p == null && !f.korea && focusRetry < 6) { focusRetry++; setTimeout(scheduleOnscreen, 400); return; }
    focusRetry = 0;
    const changed = f.key !== focus.key;
    Object.assign(focus, f);
    if (changed) { cardMore = false; renderYearCard(); }
  }

  // ---------------------------------------------------------------- 알려진 오류 안내
  function activeNotices() {
    const b = map.getBounds();
    return index.notices.filter((n) => {
      if (state.year < n.from || state.year > n.to) return false;
      const [x0, y0, x1, y1] = n.bbox;
      return !(x1 < b.getWest() || x0 > b.getEast() || y1 < b.getSouth() || y0 > b.getNorth());
    });
  }
  function renderNotice() {
    const list = activeNotices();
    const el = $('notice');
    if (!list.length) { el.hidden = true; return; }
    const high = list.some((n) => n.severity === 'high');
    $('notice-text').textContent = high
      ? `이 시기 한반도 국경에 아직 고치지 못한 오류가 있어요 (${list.length}건)`
      : `이 시기 한반도 데이터에 조사 중인 내용이 있어요 (${list.length}건)`;
    el.hidden = false;
  }

  // ---------------------------------------------------------------- 정보 패널
  function openPolity(p, opts = {}) {
    if (tour.active) endTour({ reopen: false });
    clearSelections();
    state.back = opts.back || null;
    state.war = null;
    state.selected = p;
    state.panelMode = 'polity';
    applyYearFilters();
    resetPanelScroll();
    renderPanel();
    panelShow();
    if (opts.fly) flyToPolity(p);
    scheduleHash();
  }
  function toggleEraMenu(open) {
    const menu = $('era-menu');
    const btn = document.querySelector('.tool[data-tool="era"]');
    const want = open == null ? menu.hidden : open;
    menu.hidden = !want;
    if (btn) btn.setAttribute('aria-expanded', String(want));
  }
  // 지금 열린 창에 맞춰 보기 도구 단추를 눌린 모양으로
  function syncTools() {
    document.querySelectorAll('.tool[data-tool]').forEach((b) => {
      const id = b.dataset.tool;
      const pm = state.panelMode;
      const on = (id === 'chrono' && pm === 'chrono') || (id === 'world' && pm === 'world')
        || (id === 'factions' && !$('factions').hidden)
        || (id === 'themes' && (pm === 'themes' || pm === 'theme')) || (id === 'inst' && pm === 'inst')
        || (id === 'terms' && (pm === 'terms' || pm === 'term')) || (id === 'hanyang' && pm === 'hanyang') || (id === 'bung' && pm === 'bungdang');
      b.classList.toggle('is-on', on);
    });
  }
  function closePanel() {
    stopCampaign(false);
    clearSelections();
    if (kx.popup) { kx.popup.remove(); kx.popup = null; }
    markTerm(null);
    state.back = null;
    state.panelMode = null;
    state.war = null;
    if (map) markBattle(null);
    panelHide();
    if (map) applyYearFilters();
    syncTools();
    scheduleHash();
  }
  function currentRow(p) {
    let best = null;
    for (const [pp, f, t, a, u] of chunkFeatures) {
      if (pp === p && f <= state.year && t >= state.year && (!best || a > best.a)) best = { p: pp, f, t, a, u };
    }
    return best;
  }
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c != null) n.append(c);
    return n;
  }
  function polityIndexByName(name) {
    return index.byName.get(name);
  }
  function renderPanel() {
    const p = state.selected;
    if (p == null) return;
    const P = index.polities[p];
    const color = index.palette[P.c % index.palette.length];
    $('panel-title').replaceChildren(el('span', { class: 'swatch', style: `background:${P.g ? 'transparent' : color};${P.g ? 'border:2px dashed #c9a640' : ''}` }), P.ko);
    $('panel-sub').textContent = P.ko !== P.n.replace(/^\(|\)$/g, '') ? P.n.replace(/^\(|\)$/g, '') : '';

    const body = $('panel-body');
    const tags = el('div', { class: 'tags' });
    if (P.g) tags.append(el('span', { class: 'tag', text: '제국·연합 경계' }));
    const srcLabel = { ko: '한국어 이름: 번역(검수 전)', wd: '한국어 이름: 위키데이터', en: '한국어 이름 준비 중' }[P.src];
    tags.append(el('span', { class: 'tag', text: srcLabel }));
    const related = index.notices.filter((n) => P.f <= n.to && P.t >= n.from && n.bbox && P.x >= n.bbox[0] && P.x <= n.bbox[2] && P.yy >= n.bbox[1] && P.yy <= n.bbox[3]);
    if (P.fixed) tags.append(el('span', { class: 'tag is-ok', text: '한국사 기준으로 고친 데이터' }));
    if (related.length) tags.append(el('span', { class: 'tag is-warn', text: '확인 중인 내용 있음' }));

    // 존속 기간 막대
    const span = el('div', { class: 'span-years', text: `${fmtYear(P.f)} ~ ${fmtYear(P.t)}` });
    const pad = Math.max(20, Math.round((P.t - P.f) * 0.12));
    const lo = clampYear(P.f - pad);
    const hi = clampYear(P.t + pad);
    const toPct = (y) => `${((y - lo) / Math.max(1, hi - lo)) * 100}%`;
    const life = el('div', { class: 'lifespan', role: 'img', 'aria-label': `${fmtYear(P.f)}부터 ${fmtYear(P.t)}까지` }, [
      el('div', { class: 'lifespan-track' }),
      el('div', { class: 'lifespan-bar', style: `left:${toPct(P.f)};width:calc(${toPct(P.t)} - ${toPct(P.f)})` }),
    ]);
    if (state.year >= lo && state.year <= hi) life.append(el('div', { class: 'lifespan-now', style: `left:${toPct(state.year)}` }));
    const scale = el('div', { class: 'lifespan-scale' }, [el('span', { text: fmtShort(lo) }), el('span', { text: fmtShort(hi) })]);

    const row = currentRow(p);
    const status = el('p', { class: 'status-line' });
    if (row && row.u === 1) status.append(el('strong', { text: fmtYear(state.year) }), '의 영역은 기록이 부족해서 추정으로 그렸어요 (점선).');
    else if (row) status.append(el('strong', { text: fmtYear(state.year) }), '에 지도에 있어요.');
    else if (state.year < P.f) status.append(el('strong', { text: fmtYear(state.year) }), '에는 아직 지도에 나타나지 않아요.');
    else if (state.year > P.t) status.append(el('strong', { text: fmtYear(state.year) }), '에는 지도에서 사라졌어요.');
    else status.append(el('strong', { text: fmtYear(state.year) }), '에는 이 데이터에서 영역이 없어요.');

    const facts = el('dl', { class: 'facts' });
    facts.append(el('dt', { text: '가장 넓을 때' }), el('dd', {}, [`${fmtArea(P.a)} `, el('small', { text: `(${fmtYear(P.y)}경, ${koreaRatio(P.a)})` })]));
    if (row) facts.append(el('dt', { text: '지금 영토' }), el('dd', { text: fmtArea(row.a) }));
    facts.append(el('dt', { text: '존속' }), el('dd', { text: `약 ${(P.t - P.f + (P.f < 0 && P.t > 0 ? 0 : 1)).toLocaleString('ko-KR')}년` }));

    const kids = [tags, span, life, scale, status, facts];
    if (P.note) {
      kids.push(el('div', { class: 'section-title', text: '알아 두기' }));
      kids.push(el('p', { class: 'note', text: P.note }));
    }

    if (P.of && P.of.length) {
      kids.push(el('div', { class: 'section-title', text: '속한 큰 단위' }));
      kids.push(el('div', { class: 'chips-inline' }, P.of.map((name) => chipFor(name))));
    }
    if (P.mem && P.mem.length) {
      kids.push(el('div', { class: 'section-title', text: `구성 (${P.mem.length})` }));
      kids.push(el('div', { class: 'chips-inline' }, P.mem.slice(0, 16).map((name) => chipFor(name))));
    }

    kids.push(el('div', { class: 'actions' }, [
      el('button', { class: 'btn', onclick: () => { setYear(P.f); flyToPolity(p); }, text: '처음 등장한 해로' }),
      el('button', { class: 'btn is-primary', onclick: () => { setYear(P.y); flyToPolity(p); }, text: '가장 넓던 해로' }),
    ]));

    const links = el('div', { class: 'links' });
    if (P.kowiki) links.append(extLink(`https://ko.wikipedia.org/wiki/${encodeURIComponent(P.kowiki.replace(/ /g, '_'))}`, '한국어 위키백과', 'ko.wikipedia.org'));
    else if (P.wd && P.wdOk) links.append(extLink(`https://www.wikidata.org/wiki/Special:GoToLinkedPage/kowiki/${P.wd}`, '한국어 위키백과에서 찾기', '문서가 없을 수 있어요'));
    if (P.wiki) links.append(extLink(`https://en.wikipedia.org/wiki/${encodeURIComponent(P.wiki.replace(/ /g, '_'))}`, '영어 위키백과', 'en.wikipedia.org'));
    if (P.wd && P.wdOk) links.append(extLink(`https://www.wikidata.org/wiki/${P.wd}`, '위키데이터', P.wd));
    if (links.childElementCount) {
      kids.push(el('div', { class: 'section-title', text: '더 알아보기' }));
      kids.push(links);
    }
    if (related.length) {
      kids.push(el('div', { class: 'section-title', text: '확인 중인 내용' }));
      related.forEach((n) => kids.push(noticeItem(n)));
    }
    kids.push(el('p', { class: 'footnote', text: '국경과 연도는 Cliopatria 데이터를 바탕으로 한 근사치예요. 근대 이전 국경은 학설에 따라 다를 수 있어요.' }));
    body.replaceChildren(...kids);
  }
  function chipFor(name) {
    const i = polityIndexByName(name);
    const label = i != null ? index.polities[i].ko : name;
    return el('button', { class: 'chip-link', text: label, onclick: () => { if (i != null) openPolity(i, { fly: true }); } });
  }
  function extLink(href, label, hint) {
    return el('a', { href, target: '_blank', rel: 'noopener' }, [el('span', { text: label }), el('span', { text: hint })]);
  }
  function noticeItem(n) {
    return el('div', { class: 'notice-item' }, [
      el('h3', { text: `${fmtYear(n.from)} ~ ${fmtYear(n.to)}` }),
      el('p', { text: n.problem }),
      el('p', { class: 'fix', text: `계획: ${n.fix}` }),
    ]);
  }
  // ---------------------------------------------------------------- 한국사 사건·국제 관계·세력 흐름
  const catColor = (c) => CAT_COLORS[Math.max(0, CATS.indexOf(c))];
  const ERA_STARTS = [ // build_events.py 의 시대 구분과 같음 (dn 기준)
    [-99999 * 372, '선사'], [-2333 * 372, '고조선과 여러 나라'], [-57 * 372, '삼국과 가야'], [676 * 372, '남북국'],
    [918 * 372 + 5 * 31, '고려'], [1392 * 372 + 6 * 31, '조선 전기'], [1592 * 372 + 3 * 31, '조선 후기'],
    [1863 * 372 + 11 * 31, '근대'], [1910 * 372 + 7 * 31 + 28, '일제 강점기'], [1945 * 372 + 7 * 31 + 14, '현대'],
  ];
  function eraOfDn(dn) {
    let name = ERA_STARTS[0][1];
    for (const [s, n] of ERA_STARTS) if (dn >= s) name = n;
    return name;
  }
  function eventsInYear(y) {
    return events.map((ev, k) => ({ ev, k })).filter(({ ev }) => !ev.nomap && ev.y <= y && (ev.ey != null ? ev.ey : ev.y) >= y);
  }
  const BACK_LABELS = { search: '검색 결과', chrono: '연표', world: '그해 국제 정세', factions: '세력 흐름', themes: '교과서 지도 목록', theme: '교과서 지도', inst: '통치 체제', terms: '용어 사전', term: '용어 설명', hanyang: '한양 도성', bungdang: '붕당 지도' };
  // 뒤로 가기 단추는 정보 창 머리(제목 위)에 하나만 둬요. 여기서는 그 단추를 맞춰 주기만 해요
  function backButton() { updateBack(); return null; }
  function updateBack() {
    const b = $('panel-back');
    if (!b) return;
    if (!state.back) { b.hidden = true; return; }
    const label = BACK_LABELS[state.back] || '이전';
    b.replaceChildren(el('span', { class: 'pb-arrow', 'aria-hidden': 'true', text: '‹' }), `${label}${euro(label)} 돌아가기`);
    b.hidden = false;
  }
  // 받침에 따라 '로'/'으로' (ㄹ 받침은 '로')
  function euro(word) {
    const c = String(word).charCodeAt(String(word).length - 1) - 0xac00;
    if (c < 0 || c > 11171) return '로';
    const jong = c % 28;
    return jong === 0 || jong === 8 ? '로' : '으로';
  }
  function goBack() {
    const b = state.back;
    state.back = null;
    if (b === 'search') { closePanel(); if (searchApi) searchApi.reopen(); return; }
    if (koreaGoBack(b)) return;
    if (b === 'chrono') openChrono(null, { restore: true });
    else if (b === 'world') openWorld();
  }
  function showPanel() {
    panelShow();
    syncTools();
  }
  // 정보 창: 데스크톱·태블릿은 오른쪽에서, 휴대폰은 아래에서 스르륵 들어오고 나가요
  let panelHideTimer = 0;
  function panelShow() {
    const P = $('panel');
    clearTimeout(panelHideTimer);
    const wasHidden = P.hidden;
    P.hidden = false;
    if (wasHidden && !prefersReducedMotion) {
      P.classList.add('is-off');
      void P.offsetWidth; // 다음 프레임에 들어오게
    }
    P.classList.remove('is-off');
    document.body.classList.add('panel-open');
    updateBack();
  }
  function panelHide() {
    const P = $('panel');
    document.body.classList.remove('panel-open');
    if (P.hidden) return;
    if (prefersReducedMotion) { P.hidden = true; return; }
    P.classList.add('is-off');
    clearTimeout(panelHideTimer);
    panelHideTimer = setTimeout(() => { if (P.classList.contains('is-off')) P.hidden = true; }, 300);
  }
  function resetPanelScroll() { $('panel-body').scrollTop = 0; }
  function clearSelections() {
    state.selected = null;
    if (state.event != null) markEvent(null);
    state.event = null;
    if (state.rel != null) markRel(null);
    state.rel = null;
  }

  // ---- 그해 한눈에 (왼쪽 위 카드): 지도 가운데 나라를 기준으로 그 나라 이야기만
  let cardFolded = false;
  let cardMore = false; // 사건 목록 전부 보기
  const KOREAN_POLITIES = new Set([
    'Gojoseon', 'Buyeo', 'Goguryeo', 'Baekje', 'Silla', 'Gaya', 'Unified Silla', 'Balhae', 'Hubaekje', 'Taebong',
    'Goryeo', 'Joseon', 'Korean Empire', 'Korea under Japanese rule', 'US Army Military Government in Korea',
    'Soviet Civil Administration in Korea', 'Republic of Korea', "Democratic People's Republic of Korea",
    'Mahan', 'Jinhan', 'Byeonhan', 'Korean Jin', 'Dong-okjeo', 'Dongye', 'Tamna', 'Tamna Prefectures',
    'Ssangseong Prefecture', 'Dongnyeong Prefecture', 'Protectorate General to Pacify the East',
  ]);
  // 지도 위 나라(영문 이름) → 국제 관계 데이터의 나라 이름
  const REL_KEYS = [
    [/^Ming Dynasty$|^Southern Ming$/, ['명']], [/^Qing Dynasty$/, ['청']], [/^Tang Dynasty$/, ['당']], [/^Sui Dynasty$/, ['수']],
    [/^Northern Song$|^Southern Song$/, ['송']], [/^Liao Dynasty$/, ['거란']], [/^Great Jin$/, ['금']], [/^Mongol Empire$/, ['몽골']],
    [/^Yuan Dynasty$/, ['원']], [/^Later Jin Dynasty$/, ['후금']], [/Japan|Shogunate/, ['일본', '왜', '대마도']],
    [/^Ryukyu/, ['류큐']], [/^Ayutthaya/, ['시암']], [/^Majapahit$/, ['자와']], [/^Göktürk Khaganate$|^Turks$/, ['돌궐']],
    [/^Abbasid Caliphate/, ['아라비아']], [/^United States of America$/, ['미국']], [/^Russian Empire$|^Russian Federation$/, ['러시아']],
    [/^Union of Soviet Socialist Republics$/, ['소련']], [/^Kingdom of Great Britain$/, ['영국']], [/France/, ['프랑스']],
    [/^German Empire$|Germany/, ['독일']], [/^Republic of China$/, ['중화민국']], [/^People's Republic of China$/, ['중국']],
    [/^Han Dynasty$/, ['한']], [/^Yan$/, ['연']], [/^Eastern Jin$/, ['동진']], [/^Liu Song Dynasty$|^Southern Qi$|^Liang Dynasty$|^Chen Dynasty$/, ['남조']],
    [/^Former Qin$/, ['전진']], [/^Northern Wei$/, ['북위', '북조']], [/^Eastern Wei$|^Western Wei$|^Northern Qi$|^Northern Zhou$/, ['북조']],
    [/^Republic of Vietnam$/, ['남베트남']],
  ];
  const focus = { p: null, korea: true, key: '' };
  // 한반도 (대략): 압록강·두만강 아래
  function inKoreaBox(lon, lat) {
    if (lat < 33 || lat > 43 || lon < 124.2 || lon > 131) return false;
    const north = lon < 128 ? 40.0 + (lon - 124.3) * 0.46 : 41.7 + (lon - 128) * 0.5;
    return lat <= north;
  }
  function focusPoint() {
    const pad = mapPadding();
    const c = map.getCanvas();
    const w = c.clientWidth;
    const h = c.clientHeight;
    return [pad.left + (w - pad.left - pad.right) / 2, pad.top + (h - pad.top - pad.bottom) / 2];
  }
  // 화면 가운데 근처를 몇 군데 찍어서 가장 많이 걸리는 나라를 고름
  function computeFocus() {
    const [x, y] = focusPoint();
    const ll = map.unproject([x, y]);
    const score = new Map();
    const hit = (px, py, wgt) => {
      const f = smallest(map.queryRenderedFeatures([px, py], { layers: ['polity-fill'] }));
      if (f) score.set(f.properties.p, (score.get(f.properties.p) || 0) + wgt);
    };
    hit(x, y, 4);
    for (const [r, wgt] of [[36, 1], [80, 0.5]]) {
      for (let k = 0; k < 8; k++) hit(x + r * Math.cos((k * Math.PI) / 4), y + r * Math.sin((k * Math.PI) / 4), wgt);
    }
    let p = null;
    let best = 0;
    score.forEach((v, k) => { if (v > best) { best = v; p = k; } });
    // 한국사 화면에서는 지도를 어디로 옮겨도 한국사 기준으로 보여 줘요
    const korea = state.mode === 'korea' || (p != null && KOREAN_POLITIES.has(index.polities[p].n)) || inKoreaBox(ll.lng, ll.lat);
    return { p, korea, key: korea ? 'korea' : `p${p}` };
  }
  function relKeysOf(p) {
    if (p == null) return [];
    const n = index.polities[p].n.replace(/^\((.*)\)$/, '$1');
    const hit = REL_KEYS.find(([re]) => re.test(n));
    return hit ? hit[1] : [];
  }
  let rulerData = { states: [], periods: [] };
  function rulersIn(y) {
    const out = [];
    rulerData.states.forEach((st) => {
      const ks = st.list.filter((k) => (k.sp ? k.sp.some(([a, b]) => y >= a && y <= b) : y >= k.f && y <= k.t));
      if (ks.length) out.push({ st, ks });
    });
    // 조선 고종 → 대한 제국 고종처럼 같은 사람이 이어지면 뒤의 것만
    return out.filter((o, i) => !out.some((q, j) => j > i && q.ks.some((k) => o.ks.some((m) => m.n.split(' ')[0] === k.n.split(' ')[0]))));
  }
  function periodIn(y) {
    const ps = rulerData.periods.filter((x) => y >= x.f && y <= x.t);
    return ps.length ? ps[ps.length - 1] : null;
  }
  // 이 전쟁이 지금 화면 안에서 벌어졌는지
  function warInView(W) {
    const b = map.getBounds();
    return W.battles.some((bt) => b.contains([bt.x, bt.yy]));
  }
  function cardWars(y) {
    if (!state.layers.wars) return [];
    const list = activeWars(y);
    if (focus.korea) return list.filter(({ w }) => w.region === 'korea' || warInView(w));
    return list.filter(({ w }) => (focus.p != null && w.sides.some((sd) => sd.p.includes(focus.p))) || warInView(w));
  }
  function cardRels(y) {
    const act = activeRels(y);
    if (focus.korea) return act;
    const keys = relKeysOf(focus.p);
    return act.filter(({ r }) => keys.includes(r.a) || keys.includes(r.b));
  }
  function renderYearCard() {
    const box = $('year-card');
    if (!box || !map) return;
    const y = state.year;
    const P = focus.p != null ? index.polities[focus.p] : null;
    const warsNow = cardWars(y);
    const relNow = cardRels(y);
    const evNow = focus.korea && state.layers.events ? eventsInYear(y).sort((a, b) => a.ev.dn - b.ev.dn) : [];
    const fac = focus.korea ? factionSummary(y) : null;
    const kings = focus.korea ? rulersIn(y) : [];
    const period = focus.korea && !kings.some(({ st }) => st.id === 'rok' || st.id === 'dprk' || st.id === 'korean-empire' || st.id === 'joseon') ? periodIn(y) : null;

    // 제목: 1592년 · 한국사  /  1446년 · 프랑스 왕국
    const title = el('div', { class: 'yc-title' }, [
      el('span', { class: 'yc-year', text: fmtYear(y) }),
      focus.korea
        ? el('span', { class: 'yc-focus' }, ['한국사', el('small', { text: eraOfDn(state.dn != null ? state.dn : y * 372 + 186) })])
        : el('span', { class: 'yc-focus' }, [P ? P.ko : '바다', P ? el('small', { text: `${fmtShort(P.f)}~${P.t >= 2024 ? '' : fmtShort(P.t)}` }) : null]),
    ]);
    const head = el('div', { class: 'yc-head' }, [
      title,
      focus.korea
        ? el('button', { class: 'yc-link', onclick: () => openChrono(y) }, ['연표', el('span', { 'aria-hidden': 'true', text: ' ›' })])
        : (P ? el('button', { class: 'yc-link', onclick: () => openPolity(focus.p) }, ['자세히', el('span', { 'aria-hidden': 'true', text: ' ›' })]) : null),
      el('button', {
        class: `yc-fold${cardFolded ? ' is-folded' : ''}`, 'aria-label': cardFolded ? '펼치기' : '접기', 'aria-expanded': String(!cardFolded),
        onclick: () => { cardFolded = !cardFolded; try { localStorage.setItem('hm:card', cardFolded ? '1' : '0'); } catch (e) { /* 무시 */ } renderYearCard(); },
      }, [el('span', { 'aria-hidden': 'true', text: '⌃' })]),
    ]);

    const rows = [];
    const row = (label, kids, cls = '') => rows.push(el('div', { class: `yc-row ${cls}` }, [el('span', { class: 'yc-label', text: label }), el('div', { class: 'yc-body' }, kids)]));
    if (kings.length) {
      const title0 = kings.every(({ st }) => st.title === kings[0].st.title) ? kings[0].st.title : '다스린 이';
      row(title0.length > 3 ? '지도자' : title0, kings.map(({ st, ks }) => el('div', { class: 'yc-king' }, [
        el('div', { class: 'yc-king-line' }, [
          kings.length > 1 || st.id === 'dprk' ? el('span', { class: 'yc-state', text: st.n }) : null,
          el('b', { text: ks.map((k) => k.n).join(' → ') }),
          el('small', { text: ks.length === 1 ? (ks[0].t >= 2100 ? `${ks[0].f}~` : ks[0].sp ? ks[0].sp.map(([a, b2]) => (a === b2 ? `${a}` : `${a}~${b2}`)).join(', ') : `${fmtShort(ks[0].f)}~${fmtShort(ks[0].t)}`) : '' }),
        ]),
        ks[ks.length - 1].d ? el('div', { class: 'yc-sub', text: ks[ks.length - 1].d }) : null,
      ])));
    } else if (period) {
      row('통치', [el('div', { class: 'yc-king' }, [el('div', { class: 'yc-king-line' }, [el('b', { text: period.n })]), el('div', { class: 'yc-sub', text: period.d })])]);
    }
    if (warsNow.length) {
      row('전쟁', [el('div', { class: 'yc-chips' }, warsNow.map(({ w, i }) => el('button', {
        class: `war-chip${state.war === i ? ' is-on' : ''}`, onclick: () => openWar(i, { fit: true }),
      }, [el('span', { class: 'war-dot', 'aria-hidden': 'true' }), shortWarName(w)])))]);
    }
    if (evNow.length) {
      const LIMIT = 4;
      const show = cardMore ? evNow : evNow.slice(0, LIMIT);
      const items = show.map(({ ev, k }) => el('button', {
        class: `yc-ev${state.event === k ? ' is-on' : ''}${ev.i >= 3 ? ' is-core' : ''}`, onclick: () => openEvent(k),
      }, [
        el('span', { class: 'ev-dia', style: `background:${catColor(ev.c)}`, 'aria-hidden': 'true' }),
        el('span', { class: 'yc-ev-name', text: ev.n }),
        el('small', { text: cardEventDate(ev, y) }),
      ]));
      if (evNow.length > LIMIT) {
        items.push(el('button', { class: 'yc-more', onclick: () => { cardMore = !cardMore; renderYearCard(); } }, [cardMore ? '접기' : `${evNow.length - LIMIT}개 더 보기`]));
      }
      row('사건', items);
    }
    if (relNow.length) {
      const sorted = relNow.slice().sort((a, b) => b.r.imp - a.r.imp);
      row(focus.korea ? '나라 밖' : '한국과', [el('button', { class: 'yc-btn', onclick: () => openWorld() }, [
        el('span', { class: 'yc-btn-text', text: sorted.map(({ r }) => relShortName(r)).join(' · ') }),
        el('span', { class: 'yc-go', 'aria-hidden': 'true', text: '›' }),
      ])]);
    }
    if (fac) {
      row('세력', [el('button', { class: 'yc-btn', onclick: () => openFactions(fac.era.id) }, [
        el('span', { class: 'fac-ico', 'aria-hidden': 'true' }),
        el('span', { class: 'yc-btn-text', text: fac.text }),
        el('span', { class: 'yc-go', 'aria-hidden': 'true', text: '›' }),
      ])]);
    }
    if (focus.korea || state.mode === 'korea') koreaCardRows(y, row);
    if (!rows.length) {
      rows.push(el('p', { class: 'yc-empty', text: focus.korea ? '이해에 정리된 한국사 내용이 없어요. 연도를 움직여 보세요.' : (P ? `이해 ${P.ko}에 대해 정리된 전쟁·관계가 없어요. 나라를 누르면 자세히 볼 수 있어요.` : '지도를 움직여 나라를 가운데에 놓아 보세요.') }));
    }
    // 접었을 때: 한 줄 요약
    const summary = [];
    if (kings.length) summary.push(kings.map(({ ks }) => ks[ks.length - 1].n.replace(/\s*\(.*\)$/, '')).join('·'));
    if (warsNow.length) summary.push(shortWarName(warsNow[0].w) + (warsNow.length > 1 ? ` 외 ${warsNow.length - 1}` : ''));
    if (evNow.length) summary.push(`사건 ${evNow.length}`);
    const sumLine = el('button', { class: 'yc-summary', onclick: () => { cardFolded = false; try { localStorage.setItem('hm:card', '0'); } catch (e) { /* 무시 */ } renderYearCard(); } }, [summary.join(' · ') || '펼쳐서 보기']);
    box.replaceChildren(head, ...(cardFolded ? [sumLine] : [el('div', { class: 'yc-rows' }, rows)]));
    box.classList.toggle('is-folded', cardFolded);
    box.classList.toggle('is-foreign', !focus.korea);
    box.hidden = false;
  }
  // 카드의 사건 날짜: 여러 해에 걸치면 '1434~1449', 그해 안이면 '음력 9월' / '7월 26일 ~ 29일'
  function cardEventDate(ev, y) {
    if (ev.ey != null && ev.ey !== ev.y) return `${fmtShort(ev.y)}~${fmtShort(ev.ey)}`;
    const t = String(ev.date || '').replace(/\s*\(양력[^)]*\)/g, '').replace(/(기원전\s*)?\d+년\s*/g, '').trim();
    return t.replace(/^(음력 )?(\d+)월 (\d+)일 ~ (음력 )?\2월 (\d+)일$/, '$1$2월 $3~$5일');
  }
  // 관계 이름을 짧게 (예: '조선과 명의 사대 관계' → '명과 사대')
  function relShortName(r) {
    return r.n.replace(/\s*\(.*\)$/, '');
  }

  // ---- 사건
  let selEventId = null;
  function markEvent(k) {
    if (!map) return;
    if (selEventId != null) map.setFeatureState({ source: 'events', id: selEventId }, { sel: false });
    selEventId = k != null && !events[k].nomap ? k : null;
    if (selEventId != null) map.setFeatureState({ source: 'events', id: selEventId }, { sel: true });
  }
  const monthOfDn = (dn, y) => Math.floor((dn - y * 372) / 31) + 1;
  function openEvent(k, opts = {}) {
    if (tour.active) endTour({ reopen: false });
    stopCampaign(false);
    const ev = events[k];
    clearSelections();
    state.back = opts.back || null;
    state.event = k;
    state.panelMode = 'event';
    state.war = null;
    if (ev.m) setYear(ev.y, { dn: ev.dn, month: isDense(ev.y) ? monthOfDn(ev.dn, ev.y) : null });
    else if (state.year < ev.y || state.year > (ev.ey != null ? ev.ey : ev.y)) setYear(ev.y);
    else applyYearFilters();
    markEvent(k);
    resetPanelScroll();
    if (!ev.nomap && opts.fly !== false) move({ center: [ev.x, ev.yy], zoom: Math.max(map.getZoom(), ev.x > 140 || ev.x < 100 ? 4 : 5.2) });
    renderEventPanel();
    showPanel();
    scheduleHash();
  }
  function renderEventPanel() {
    const k = state.event;
    const ev = events[k];
    $('panel-title').textContent = ev.n;
    $('panel-sub').textContent = ev.era; // 분류는 아래 색 태그에 있어요
    const tags = el('div', { class: 'tags' }, [
      el('span', { class: 'tag tag-cat', style: `--c:${catColor(ev.c)}`, text: ev.c }),
      ev.i === 3 ? el('span', { class: 'tag', text: '교과서 연표' }) : null,
      ev.pg ? el('span', { class: 'tag', text: `비상 교과서 ${ev.pg}쪽` }) : null,
      ev.ap ? el('span', { class: 'tag is-warn', text: '위치는 대략적이에요' }) : null,
    ].filter(Boolean));
    const facts = el('dl', { class: 'facts' }, [
      el('dt', { text: '때' }), el('dd', { text: ev.date }),
      el('dt', { text: '곳' }), el('dd', { text: ev.p || '—' }),
    ]);
    // 같은 해의 다른 일 (사건 + 전투)
    const sy = state.year >= ev.y && state.year <= (ev.ey != null ? ev.ey : ev.y) ? state.year : ev.y;
    const same = [];
    events.forEach((o, j) => { if (j !== k && o.y <= sy && (o.ey != null ? o.ey : o.y) >= sy) same.push({ n: o.n, date: o.date, c: o.c, go: () => openEvent(j, { back: state.back }) }); });
    wars.wars.forEach((W, wi) => W.battles.forEach((b, bi) => { if (b.y === sy && W.region === 'korea') same.push({ n: b.name, date: b.date, c: '전쟁', go: () => openBattle(wi, bi) }); }));
    // 앞뒤 사건 (시간 순서)
    const order = events.map((o, j) => j).filter((j) => !events[j].nomap || j === k);
    const pos = order.indexOf(k);
    const prevK = pos > 0 ? order[pos - 1] : null;
    const nextK = pos < order.length - 1 ? order[pos + 1] : null;
    const nav = el('div', { class: 'actions' }, [
      el('button', { class: 'btn', disabled: prevK == null, onclick: () => openEvent(prevK, { back: state.back }) }, ['‹ ', prevK != null ? events[prevK].n : '이전 사건']),
      el('button', { class: 'btn', disabled: nextK == null, onclick: () => openEvent(nextK, { back: state.back }) }, [nextK != null ? events[nextK].n : '다음 사건', ' ›']),
    ]);
    nav.classList.add('nav-ev');
    const links = el('div', { class: 'links' });
    (ev.src || []).forEach((u) => links.append(extLink(u, sourceName(u), u.replace(/^https?:\/\//, '').slice(0, 42))));
    links.append(extLink(`https://ko.wikipedia.org/w/index.php?search=${encodeURIComponent(ev.n.replace(/\s*\(.*\)$/, ''))}`, '한국어 위키백과에서 찾기', 'ko.wikipedia.org'));
    $('panel-body').replaceChildren(...[
      backButton(),
      tags,
      el('p', { class: 'note note-lead', text: ev.t }),
      ev.dx ? el('p', { class: 'note note-more', text: ev.dx }) : null,
      facts,
      same.length ? el('div', { class: 'section-title', text: `${fmtYear(sy)}의 다른 일 (${same.length})` }) : null,
      same.length ? el('ul', { class: 'mini-list' }, same.slice(0, 12).map((s) => el('li', {}, [el('button', { class: 'mini-item', onclick: s.go }, [
        el('span', { class: 'ev-dia', style: `background:${catColor(s.c)}`, 'aria-hidden': 'true' }),
        el('span', { class: 'mini-name', text: s.n }), el('span', { class: 'mini-date', text: dateWithoutYear(s.date) }),
      ])]))) : null,
      nav,
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: '연표에서 보기', onclick: () => openChrono(ev.y) }),
        el('button', { class: 'btn is-primary', text: ev.nomap ? '그해로 가기' : '지도에서 보기', onclick: () => { if (!ev.nomap) move({ center: [ev.x, ev.yy], zoom: 6 }); else setYear(ev.y); } }),
      ]),
      el('div', { class: 'section-title', text: '더 알아보기' }), links,
      el('p', { class: 'footnote', text: '사건은 중학교 역사② 교과서(비상교육) 본문과 연표를 기준으로 골랐어요. 1895년까지의 날짜는 교과서처럼 음력이에요(양력을 함께 적은 곳도 있어요).' }),
    ].filter(Boolean));
  }
  function sourceName(u) {
    if (/encykorea/.test(u)) return '한국민족문화대백과사전';
    if (/history\.go\.kr/.test(u)) return '국사편찬위원회';
    if (/archives\.go\.kr/.test(u)) return '국가기록원';
    if (/wikipedia/.test(u)) return '위키백과';
    return '출처';
  }

  // ---- 연표 (한국사 사건 + 전쟁 + 전투)
  let chronoItems = null;
  const chrono = { cat: '전체', core: false, scroll: 0 };
  function buildChrono() {
    const items = [];
    events.forEach((ev, k) => items.push({ kind: 'e', k, y: ev.y, dn: ev.dn, n: ev.n, c: ev.c, i: ev.i, date: ev.date, era: ev.era }));
    wars.wars.forEach((W, wi) => {
      if (W.region !== 'korea') return;
      const first = W.battles.length ? Math.min(...W.battles.map((b) => b.dn)) : W.f * 372;
      items.push({ kind: 'w', wi, y: W.f, dn: Math.min(first, W.f * 372 + 371) - 0.5, n: W.name, c: '전쟁', i: 3, date: W.period, era: eraOfDn(first) });
      W.battles.forEach((b, bi) => items.push({ kind: 'b', wi, bi, y: b.y, dn: b.dn, n: b.name, c: '전쟁', i: b.imp, date: b.date, era: eraOfDn(b.dn) }));
    });
    items.sort((a, b) => a.dn - b.dn);
    chronoItems = items;
  }
  function openChrono(focusYear, opts = {}) {
    if (tour.active) endTour({ reopen: false });
    if (!chronoItems) buildChrono();
    clearSelections();
    state.back = null;
    state.panelMode = 'chrono';
    $('panel-title').textContent = '한국사 연표';
    $('panel-sub').textContent = `사건 ${events.length}개 · 전쟁·전투 ${chronoItems.length - events.length}개 · 교과서 기준`;
    const cats = ['전체', ...CATS];
    // 분류는 한 줄짜리 고르기 상자로 (화면이 낮은 태블릿에서도 목록이 보이게)
    const sel = el('select', {
      class: 'ch-select', 'aria-label': '분류',
      onchange: (e) => { chrono.cat = e.target.value; chrono.scroll = -1; openChrono(state.year); },
    }, cats.map((c) => el('option', { value: c, text: c === '전체' ? '모든 분류' : c, selected: chrono.cat === c })));
    const filters = el('div', { class: 'ch-filters', role: 'group', 'aria-label': '거르기' }, [
      el('span', { class: 'ch-dot', style: chrono.cat !== '전체' ? `background:${catColor(chrono.cat)}` : '', 'aria-hidden': 'true' }),
      sel,
      el('label', { class: 'ch-core' }, [
        el('input', { type: 'checkbox', checked: chrono.core, onchange: (e) => { chrono.core = e.target.checked; chrono.scroll = -1; openChrono(state.year); } }),
        '교과서 연표만',
      ]),
    ]);
    const list = el('div', { class: 'ch-list' });
    let era = null;
    let lastYear = null;
    const shown = chronoItems.filter((it) => (chrono.cat === '전체' || it.c === chrono.cat) && (!chrono.core || it.i >= 3));
    shown.forEach((it) => {
      if (it.era !== era) {
        era = it.era;
        list.append(el('div', { class: 'ch-era', text: era }));
        lastYear = null;
      }
      const yearTxt = it.y !== lastYear ? fmtShort(it.y) : '';
      lastYear = it.y;
      const shape = it.kind === 'e' ? 'is-dia' : it.kind === 'w' ? 'is-bar' : 'is-dot';
      const row = el('button', {
        class: `ch-row${it.y === state.year ? ' is-now' : ''}${it.kind === 'w' ? ' is-war' : ''}${it.i >= 3 ? ' is-core' : ''}`,
        'data-y': String(it.y),
        onclick: () => {
          chrono.scroll = list.parentElement ? $('panel-body').scrollTop : 0;
          if (it.kind === 'e') openEvent(it.k, { back: 'chrono' });
          else if (it.kind === 'b') openBattle(it.wi, it.bi, { back: 'chrono' });
          else { setYear(wars.wars[it.wi].f); openWar(it.wi, { fit: true, back: 'chrono' }); }
        },
      }, [
        el('span', { class: 'ch-year', text: yearTxt }),
        el('span', { class: `ch-mark ${shape}`, style: `--c:${catColor(it.c)}`, 'aria-hidden': 'true' }),
        el('span', { class: 'ch-main' }, [el('span', { class: 'ch-name', text: it.n }), el('span', { class: 'ch-date', text: it.kind === 'w' ? it.date : dateWithoutYear(it.date) })]),
      ]);
      list.append(row);
    });
    if (!shown.length) list.append(el('p', { class: 'status-line', text: '이 분류에는 항목이 없어요.' }));
    const body = $('panel-body');
    body.scrollTop = 0;
    body.replaceChildren(filters, list,
      el('p', { class: 'footnote', text: '중학교 역사② (비상교육, 2020) 본문과 연표를 기준으로 정리하고 미래엔 교과서와도 대조했어요. ◆ 사건, ● 전투, ▬ 전쟁. 굵은 글씨는 비상 교과서의 연표(부록 연표와 단원 첫머리 연표)에 나오는 사건이에요.' }));
    showPanel();
    // 지금 연도 근처로 스크롤
    // 정보 창이 자리 잡은 뒤에 지금 연도로 스크롤 (시대 제목 바로 아래에 오게)
    const place = () => {
      const padTop = parseFloat(getComputedStyle(body).paddingTop) || 16;
      list.style.setProperty('--ch-top', `${filters.offsetHeight - padTop}px`);
      if (opts.restore && chrono.scroll >= 0) { body.scrollTop = chrono.scroll; return; }
      const fy = focusYear != null ? focusYear : state.year;
      const rows = [...list.querySelectorAll('.ch-row')];
      const target = rows.find((r) => Number(r.dataset.y) >= fy) || rows[rows.length - 1];
      if (!target) return;
      // 같은 해 첫 줄부터 보이게
      const first = rows.find((r) => r.dataset.y === target.dataset.y) || target;
      const era = list.querySelector('.ch-era');
      const eraH = era ? era.offsetHeight : 30;
      const top = first.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      body.scrollTop = Math.max(0, top - (filters.offsetHeight - padTop) - eraH - 14);
    };
    requestAnimationFrame(() => requestAnimationFrame(place));
    setTimeout(place, 260);
  }
  function refreshChronoNow() {
    $('panel-body').querySelectorAll('.ch-row').forEach((r) => r.classList.toggle('is-now', Number(r.dataset.y) === state.year));
  }

  // ---- 국제 관계 (지도 위 연결선)
  const REL_LAYERS = ['rel-sel', 'rel-line-solid', 'rel-line-dash', 'rel-line-dot', 'rel-arrows', 'rel-caps', 'rel-labels', 'rel-cap-labels'];
  function relColor(r) {
    if (r.type === 'alliance' && r.bloc && BLOC_COLORS[r.bloc]) return BLOC_COLORS[r.bloc];
    return REL_TYPES[r.type].color;
  }
  function capAt(name, y) {
    const rows = relData.caps[name];
    if (!rows) return null;
    let r = rows[0];
    for (const row of rows) if (row[0] <= y) r = row;
    return r; // [시작 연도, 경도, 위도, 도읍 이름]
  }
  function activeRels(y) {
    return relData.rels.map((r, i) => ({ r, i })).filter(({ r }) => r.f <= y && r.t >= y);
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
  function unwrap(coords) {
    const out = [];
    let off = 0;
    coords.forEach((c, i) => {
      if (i > 0) {
        const prev = out[i - 1][0];
        let x = c[0] + off;
        while (x - prev > 180) { off -= 360; x -= 360; }
        while (prev - x > 180) { off += 360; x += 360; }
        out.push([x, c[1]]);
      } else out.push([c[0], c[1]]);
    });
    return out;
  }
  function arcCoords(a, b, bend) {
    let [x0, y0] = a;
    let [x1, y1] = b;
    if (x1 - x0 > 180) x1 -= 360; else if (x0 - x1 > 180) x1 += 360;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const cx = (x0 + x1) / 2 - (dy / d) * d * bend;
    const cy = (y0 + y1) / 2 + (dx / d) * d * bend;
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const u = 1 - t;
      pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
    return pts;
  }
  function relLines(r, y) {
    const bend = (hashStr(r.id) % 2 ? 1 : -1) * 0.16;
    if (r.type === 'route') return [unwrap(r.via.map((p) => [p[0], p[1]]))];
    const A = capAt(r.a, y);
    const B = capAt(r.b, y);
    if (!A || !B) return [];
    if (r.fan) return r.fan.map((p) => arcCoords([B[1], B[2]], [p[0], p[1]], bend * 0.6));
    if (r.via) {
      const pts = [[A[1], A[2]], ...r.via.map((p) => [p[0], p[1]]), [B[1], B[2]]]
        .filter((p, i, arr) => i === 0 || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 0.05);
      return [unwrap(pts)];
    }
    if (Math.hypot(A[1] - B[1], A[2] - B[2]) < 0.05) return [];
    return [arcCoords([A[1], A[2]], [B[1], B[2]], bend)];
  }
  let relKey = '';
  // 국제 관계선: '항상 보기'를 켰거나, 국제 정세·관계 정보 창을 볼 때만 지도에 그려요
  let relVisOn = null;
  function relsShown() { return (state.layers.rels && state.mode !== 'korea') || state.panelMode === 'world' || state.panelMode === 'rel'; }
  function syncRelations() {
    if (!map || !map.getSource('rels')) return;
    const on = relsShown();
    if (on !== relVisOn) {
      relVisOn = on;
      REL_LAYERS.forEach((id) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));
    }
    const y = state.year;
    const act = on ? activeRels(y) : [];
    const key = act.map(({ r, i }) => `${i}:${(capAt(r.a, y) || [])[3]}:${(capAt(r.b, y) || [])[3]}`).join('|');
    if (key === relKey) return;
    relKey = key;
    const lines = [];
    const caps = new Map();
    act.forEach(({ r, i }) => {
      relLines(r, y).forEach((coords) => lines.push({
        type: 'Feature', id: i, properties: { i, type: r.type, bloc: r.bloc || '', n: r.n, imp: r.imp },
        geometry: { type: 'LineString', coordinates: coords },
      }));
      if (r.type === 'route') {
        [r.via[0], r.via[r.via.length - 1]].forEach((p) => caps.set(p[2], [p[0], p[1]]));
      } else {
        [capAt(r.a, y), capAt(r.b, y)].forEach((c) => { if (c) caps.set(c[3], [c[1], c[2]]); });
        (r.fan || []).forEach((p) => caps.set(p[2], [p[0], p[1]]));
      }
    });
    map.getSource('rels').setData({ type: 'FeatureCollection', features: lines });
    map.getSource('rel-caps').setData({ type: 'FeatureCollection', features: [...caps.entries()].map(([n, c]) => ({ type: 'Feature', properties: { n }, geometry: { type: 'Point', coordinates: c } })) });
  }
  function markRel(i) {
    if (!map) return;
    map.setFilter('rel-sel', i != null ? ['==', ['get', 'i'], i] : ['boolean', false]);
    // 선 위 이름은 고른 관계에만 붙여서 지도를 덜 복잡하게
    map.setFilter('rel-labels', i != null ? ['==', ['get', 'i'], i] : ['boolean', false]);
  }
  function relTypeChip(r) {
    return el('span', { class: 'rel-type', style: `--c:${relColor(r)}` }, [
      el('span', { class: 'rel-swatch', 'data-type': r.type, style: `--c:${relColor(r)}`, 'aria-hidden': 'true' }), REL_TYPES[r.type].label,
    ]);
  }
  function openRelation(i, opts = {}) {
    if (tour.active) endTour({ reopen: false });
    stopCampaign(false);
    const r = relData.rels[i];
    clearSelections();
    state.back = opts.back || null;
    state.rel = i;
    state.war = null;
    state.panelMode = 'rel';
    if (state.year < r.f || state.year > r.t) setYear(r.f); else applyYearFilters();
    markRel(i);
    resetPanelScroll();
    renderRelationPanel();
    showPanel();
    if (opts.fit !== false) fitRelation(r);
  }
  function fitRelation(r) {
    const pts = relLines(r, Math.max(r.f, Math.min(r.t, state.year))).flat();
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...xs) - 1.2, Math.min(...ys) - 1.2], [Math.max(...xs) + 1.2, Math.max(...ys) + 1.2]], { padding: fitPadding(), maxZoom: 5.6, duration: prefersReducedMotion ? 0 : 1100 });
  }
  function renderRelationPanel() {
    const r = relData.rels[state.rel];
    const y = Math.max(r.f, Math.min(r.t, state.year));
    const A = capAt(r.a, y);
    const B = capAt(r.b, y);
    $('panel-title').textContent = r.n;
    $('panel-sub').textContent = `${fmtYear(r.f)}${r.t !== r.f ? ` ~ ${r.t >= YEAR_MAX ? '오늘날' : fmtYear(r.t)}` : ''}`;
    const facts = el('dl', { class: 'facts' });
    if (r.type === 'route') facts.append(el('dt', { text: '길' }), el('dd', { text: r.via.map((p) => p[2]).join(' → ') }));
    else if (r.fan) { // 여러 나라 대표가 한곳에 모인 회담 (예: 카이로 회담)
      facts.append(el('dt', { text: '모인 곳' }), el('dd', { text: B ? B[3] : r.b }));
      facts.append(el('dt', { text: '참가한 나라' }), el('dd', { text: r.fan.map((p) => p[2]).join(' · ') }));
    } else {
      facts.append(el('dt', { text: r.type === 'tribute' ? '사신을 보낸 쪽' : r.type === 'occupy' ? '점령·간섭받은 쪽' : '한쪽' }), el('dd', { text: `${r.a}${A ? ` (${A[3]})` : ''}` }));
      facts.append(el('dt', { text: r.type === 'tribute' ? '받은 쪽' : r.type === 'occupy' ? '점령·간섭한 쪽' : '다른 쪽' }), el('dd', { text: `${r.b}${B ? ` (${B[3]})` : ''}` }));
    }
    if (r.bloc) facts.append(el('dt', { text: '세력 구도' }), el('dd', { text: r.bloc }));
    $('panel-body').replaceChildren(...[
      backButton(),
      el('div', { class: 'tags' }, [relTypeChip(r), r.pg ? el('span', { class: 'tag', text: `비상 교과서 ${r.pg}쪽` }) : null].filter(Boolean)),
      el('p', { class: 'note note-lead', text: r.d }),
      facts,
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: '그해 국제 정세', onclick: () => openWorld() }),
        el('button', { class: 'btn is-primary', text: '지도에서 보기', onclick: () => fitRelation(r) }),
      ]),
      el('p', { class: 'footnote', text: '연결선은 그 시기 두 나라의 도읍을 이은 거예요. 사절·이동 길은 교과서 지도 수준의 대략적인 길이에요.' }),
    ].filter(Boolean));
  }
  function openWorld() {
    if (tour.active) endTour({ reopen: false });
    clearSelections();
    state.back = null;
    state.war = null;
    state.panelMode = 'world';
    applyYearFilters();
    resetPanelScroll();
    renderWorldPanel();
    showPanel();
    // 관계선이 한눈에 보이게 동아시아 쪽으로 (이미 보고 있으면 그대로)
    if (map) {
      const c = map.getCenter();
      const mobile = window.innerWidth <= 760;
      if (Math.hypot(c.lng - 125, c.lat - 37) > 22 || map.getZoom() > (mobile ? 4.2 : 5.2)) move({ center: [122, 37], zoom: mobile ? 2.4 : 3.3 });
    }
  }
  function renderWorldPanel() {
    const y = state.year;
    const act = activeRels(y);
    $('panel-title').textContent = '그해 국제 정세';
    $('panel-sub').textContent = `${fmtYear(y)} · 한국사와 이어진 국제 관계`;
    const kids = [];
    if (!act.length) {
      kids.push(el('p', { class: 'status-line', text: '이 해에는 정리된 국제 관계가 없어요. 연도를 움직여 보세요.' }));
    } else {
      // 세력 구도 (남북 세력 vs 동서 세력, 냉전 진영 등)
      const blocs = new Map();
      act.forEach(({ r }) => {
        if (!r.bloc) return;
        if (!blocs.has(r.bloc)) blocs.set(r.bloc, new Set());
        [r.a, r.b].forEach((n) => blocs.get(r.bloc).add(n));
      });
      if (blocs.size) {
        kids.push(el('div', { class: 'section-title', text: '세력 구도' }));
        kids.push(el('div', { class: 'blocs' }, [...blocs.entries()].map(([name, set]) => el('div', { class: 'bloc', style: `--c:${BLOC_COLORS[name] || '#f2c14e'}` }, [
          el('span', { class: 'bloc-name', text: name }), el('span', { class: 'bloc-members', text: [...set].join(' · ') }),
        ]))));
      }
      REL_ORDER.forEach((type) => {
        const list = act.filter(({ r }) => r.type === type);
        if (!list.length) return;
        kids.push(el('div', { class: 'section-title' }, [el('span', { class: 'rel-swatch', 'data-type': type, style: `--c:${REL_TYPES[type].color}`, 'aria-hidden': 'true' }), ` ${REL_TYPES[type].label} (${list.length})`]));
        kids.push(el('ul', { class: 'rel-list' }, list.map(({ r, i }) => el('li', {}, [el('button', { class: 'rel-item', onclick: () => openRelation(i, { back: 'world' }) }, [
          el('span', { class: 'rel-item-name', text: r.n }),
          el('span', { class: 'rel-item-sub', text: r.type === 'route' ? `${r.via[0][2]} → ${r.via[r.via.length - 1][2]}` : r.fan ? `${r.fan.map((p) => p[2].replace(/\s*\(.*\)$/, '')).join('·')} → ${r.b}` : `${r.a} ${r.type === 'tribute' || r.type === 'occupy' ? '→' : '↔'} ${r.b}` }),
          el('span', { class: 'rel-item-desc', text: firstSentence(r.d) }),
        ])]))));
      });
    }
    kids.push(el('div', { class: 'section-title', text: '선 모양 읽는 법' }));
    kids.push(el('ul', { class: 'legend' }, REL_ORDER.map((t) => el('li', {}, [
      el('span', { class: 'rel-swatch is-big', 'data-type': t, style: `--c:${REL_TYPES[t].color}`, 'aria-hidden': 'true' }),
      el('span', {}, [el('b', { text: REL_TYPES[t].label }), ` — ${REL_TYPES[t].style}`]),
    ]))));
    kids.push(el('p', { class: 'footnote', text: '중학교 역사② 교과서의 대외 관계 내용(삼국의 교류, 남북 세력과 동서 세력, 나당 동맹, 남북국의 교류, 고려의 대외 관계, 사대교린, 통신사·연행사, 개항 이후 조약 등)을 바탕으로 정리했어요.' }));
    $('panel-body').replaceChildren(...kids);
  }
  function firstSentence(t) {
    const m = String(t).match(/^.*?요\./);
    return m ? m[0] : t;
  }

  // ---- 세력 흐름 (붕당 등)
  function factionEraFor(y) {
    return factionEras.find((e) => y >= e.f && y <= e.t) || null;
  }
  function factionSummary(y) {
    const era = factionEraFor(y);
    if (!era) return null;
    const ruling = era.groups.filter((g) => g.rule.some(([a, b]) => y >= a && y <= b));
    if (ruling.length) return { era, ruling, text: `집권: ${ruling.map((g) => g.n.replace(/\s*\(.*\)$/, '')).join(' · ')}` };
    const alive = era.groups.filter((g) => y >= g.f && y <= g.t);
    if (!alive.length) return null;
    return { era, ruling: [], text: alive.slice(0, 3).map((g) => g.n.replace(/\s*\(.*\)$/, '')).join(' · ') + (alive.length > 3 ? ' …' : '') };
  }
  const FAC_COLORS = ['#e07a5f', '#5fa8ff', '#81b29a', '#f2cc8f', '#b48ead', '#4fc1b5', '#ff8fb1', '#9aa6ff', '#d4a373', '#7fd7ff', '#c9ada7', '#a3c4bc'];
  const MARK_COLORS = { 사화: '#ff6b5b', 환국: '#f29e4c', 예송: '#b48ead', 정변: '#9aa6ff', 분열: '#4fc1b5', 개혁: '#7cc36b', 기타: '#a3b0bc' };
  const fac = { era: null, sel: null };
  function openFactions(eraId) {
    const modal = $('factions');
    fac.era = eraId || (factionEraFor(state.year) || factionEras[1] || factionEras[0]).id;
    fac.sel = null;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    renderFactions(true);
    syncTools();
    modal.querySelector('.fac-card').focus({ preventScroll: true });
  }
  function closeFactions() {
    $('factions').hidden = true;
    document.body.classList.remove('modal-open');
    syncTools();
  }
  function renderFactions(scrollToNow = false) {
    const era = factionEras.find((e) => e.id === fac.era);
    if (!era) return;
    const y = state.year;
    $('fac-title').textContent = era.n;
    $('fac-tabs').replaceChildren(...factionEras.map((e) => el('button', {
      class: `fac-tab${e.id === era.id ? ' is-on' : ''}`, role: 'tab', 'aria-selected': String(e.id === era.id),
      onclick: () => { fac.era = e.id; fac.sel = null; renderFactions(true); },
    }, [e.n, el('small', { text: `${fmtShort(e.f)}~${fmtShort(e.t)}` })])));
    const sum = factionSummary(y);
    const inEra = y >= era.f && y <= era.t;
    $('fac-intro').replaceChildren(
      el('p', { text: era.intro }),
      el('p', { class: 'fac-now' }, inEra
        ? [el('b', { text: fmtYear(y) }), ` — ${sum && sum.era.id === era.id ? sum.text : '기록된 세력 없음'}`]
        : [`지금 연도(${fmtYear(y)})는 이 시대 밖이에요. 아래 그림의 사건을 누르면 그 해로 가요.`]),
    );
    // ---- 그림 (SVG)
    const years = era.t - era.f;
    const padL = 18; const padR = 120;
    const vw = Math.min(window.innerWidth, 1100) - 60;
    const W = Math.max(vw, Math.min(1600, years * (years > 300 ? 3.4 : years > 80 ? 6 : years > 20 ? 34 : 120)));
    const ppy = (W - padL - padR) / Math.max(1, years);
    const xOf = (yr) => padL + (yr - era.f) * ppy;
    const MARK_ROWS = 4; const markRowH = 17; const markTop = 6;
    const axisY = markTop + MARK_ROWS * markRowH + 12;
    const top = axisY + 10; const rowH = 34;
    const H = top + era.groups.length * rowH + 18;
    const NS = 'http://www.w3.org/2000/svg';
    const S = (tag, attrs = {}, kids = []) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => { if (v != null) n.setAttribute(k, v); });
      kids.forEach((c) => n.append(c));
      return n;
    };
    const svg = S('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'fac-svg', role: 'img', 'aria-label': `${era.n} 세력 흐름 그림` });
    // 눈금
    const step = years > 300 ? 50 : years > 80 ? 10 : years > 20 ? 5 : 1;
    for (let t = Math.ceil(era.f / step) * step; t <= era.t; t += step) {
      svg.append(S('line', { x1: xOf(t), x2: xOf(t), y1: axisY - 10, y2: H - 8, class: 'fac-grid' }));
      svg.append(S('text', { x: xOf(t), y: axisY, class: 'fac-tick', 'text-anchor': 'middle' }, [document.createTextNode(fmtShort(t))]));
    }
    // 사건 표시: 글자가 겹치지 않게 네 줄에 나눠 놓고, 자리가 없으면 점만 (마우스를 올리면 이름)
    const rowEnds = Array(MARK_ROWS).fill(-Infinity);
    era.marks.forEach((m) => {
      const x = xOf(m.y);
      const tw = [...m.n].length * 11.5 + 16;
      let row = rowEnds.findIndex((e) => e < x - 4);
      const showText = row >= 0;
      if (!showText) row = rowEnds.indexOf(Math.min(...rowEnds));
      else rowEnds[row] = x + tw;
      const cy = markTop + row * markRowH + 6;
      const g = S('g', { class: 'fac-mark', tabindex: '0', role: 'button', 'aria-label': `${fmtYear(m.y)} ${m.n}, 그 해로 가기` });
      g.append(S('line', { x1: x, x2: x, y1: cy, y2: H - 8, stroke: MARK_COLORS[m.k] || '#aaa', class: 'fac-mark-line' }));
      g.append(S('circle', { cx: x, cy, r: 4, fill: MARK_COLORS[m.k] || '#aaa' }));
      if (showText) g.append(S('text', { x: x + 7, y: cy + 4, class: 'fac-mark-text' }, [document.createTextNode(m.n)]));
      g.append(S('title', {}, [document.createTextNode(`${fmtYear(m.y)} ${m.n} (${m.k})`)]));
      const go = () => { setYear(m.y); renderFactions(); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      svg.append(g);
    });
    // 세력 줄
    const rowOf = new Map(era.groups.map((g, i) => [g.id, i]));
    const yOf = (i) => top + i * rowH + rowH / 2;
    era.groups.forEach((g, i) => {
      const color = FAC_COLORS[i % FAC_COLORS.length];
      const gy = yOf(i);
      // 갈라져 나온 선 (부모 줄 → 이 줄)
      g.par.forEach((pid) => {
        const pi = rowOf.get(pid);
        if (pi == null) return;
        const px = xOf(g.f);
        const py = yOf(pi);
        svg.append(S('path', { d: `M${px - 14},${py} C${px},${py} ${px - 4},${gy} ${px + 10},${gy}`, class: 'fac-branch', stroke: color }));
      });
      const x0 = xOf(g.f);
      const x1 = Math.max(x0 + 4, xOf(g.t));
      const grp = S('g', { class: `fac-group${fac.sel === g.id ? ' is-sel' : ''}`, tabindex: '0', role: 'button', 'aria-label': `${g.n}, ${fmtYear(g.f)}~${fmtYear(g.t)}` });
      grp.append(S('rect', { x: x0, y: gy - rowH / 2 + 3, width: x1 - x0, height: rowH - 6, class: 'fac-hit' }));
      grp.append(S('line', { x1: x0, x2: x1, y1: gy, y2: gy, stroke: color, class: 'fac-life' }));
      g.rule.forEach(([a, b]) => {
        grp.append(S('rect', { x: xOf(a), y: gy - 5, width: Math.max(3, xOf(Math.min(b, era.t)) - xOf(a)), height: 10, rx: 3, fill: color, class: 'fac-rule' }));
      });
      const alive = y >= g.f && y <= g.t;
      const ruling = g.rule.some(([a, b]) => y >= a && y <= b);
      grp.append(S('text', { x: x0 + 4, y: gy - 8, class: `fac-name${ruling ? ' is-ruling' : alive ? ' is-alive' : ''}` }, [document.createTextNode(g.n + (ruling ? ' · 집권' : ''))]));
      grp.append(S('title', {}, [document.createTextNode(g.d)]));
      const pick = () => { fac.sel = g.id; renderFactions(); };
      grp.addEventListener('click', pick);
      grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.append(grp);
    });
    // 지금 연도
    if (inEra) {
      const x = xOf(y);
      svg.append(S('line', { x1: x, x2: x, y1: axisY - 10, y2: H - 4, class: 'fac-now-line' }));
      svg.append(S('text', { x: x + 4, y: H - 8, class: 'fac-now-text' }, [document.createTextNode(fmtShort(y))]));
    }
    const wrap = $('fac-scroll');
    wrap.replaceChildren(svg);
    if (scrollToNow) {
      requestAnimationFrame(() => { wrap.scrollLeft = inEra ? Math.max(0, xOf(y) - wrap.clientWidth * 0.45) : 0; });
    }
    // 고른 세력 설명
    const sel = era.groups.find((g) => g.id === fac.sel);
    $('fac-detail').replaceChildren(...(sel ? [
      el('h3', { text: sel.n }),
      el('p', { class: 'fac-span', text: `${fmtYear(sel.f)} ~ ${fmtYear(sel.t)}${sel.par.length ? ` · ${sel.par.map((p) => era.groups.find((g) => g.id === p).n).join('·')}에서 갈라짐` : ''}${sel.rule.length ? ` · 집권 ${sel.rule.map(([a, b]) => `${fmtShort(a)}~${fmtShort(b)}`).join(', ')}` : ''}` }),
      el('p', { text: sel.d }),
    ] : [el('p', { class: 'fac-hint', text: '세력 이름이나 줄을 누르면 설명이 나와요. 굵은 막대는 정권을 잡았던 기간, 위쪽 점은 세력 관계를 바꾼 사건이에요(누르면 그 해로 가요).' })]));
    $('fac-src').textContent = `비상 교과서 ${era.pg.join('·')}쪽 내용을 바탕으로 정리했어요. 집권 기간은 학자에 따라 조금씩 다르게 보기도 해요.`;
  }
  function setupFactions() {
    const modal = $('factions');
    bind('fac-close', 'click', closeFactions);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFactions(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeFactions(); });
  }

  // ---------------------------------------------------------------- 한국사 지도 (11단계)
  // 맨 위 '세계 | 한국사' 전환. 한국사 화면은 한반도에 맞추고 다른 나라는 흐리게 한 뒤,
  // 그 시대의 지방 행정 구역, 교과서 지도(주제도), 통치 체제, 용어 사전, 한양 도성, 붕당 지도를 보여 줘요.
  // 데이터: data/korea_map.json (pipeline/build_korea_map.py 가 만듦)
  let K = null;
  let kLoading = null;
  const KVIEWS = { korea: [124.0, 33.0, 131.2, 43.2], manchuria: [117.0, 33.0, 134.0, 46.5], eastasia: [100.0, 20.0, 145.0, 50.0] };
  const THEME_COLORS = ['#ff6b5b', '#5fa8ff', '#7cc36b', '#f2c14e', '#d58cff', '#3fc1c9', '#ff8fb1', '#f29e4c', '#9aa6ff', '#c9ada7', '#a3c4bc', '#e07a5f'];
  const ADMIN_COLORS = ['#e9c46a', '#f4a261', '#8ecae6', '#90be6d', '#cdb4db', '#ffafcc', '#a8dadc', '#ddbea9', '#b5e48c', '#ffd6a5', '#bde0fe', '#fec89a', '#d8e2dc'];
  const HY_KIND_COLORS = { 궁궐: '#e9b949', 성문: '#f6f2e6', 제사: '#d58cff', 관청: '#9aa6ff', 교육: '#7cc36b', 시장: '#f29e4c', '사건 장소': '#ff6b5b', '근대 시설': '#3fc1c9', '일제 시설': '#a3b0bc', 기념물: '#ff8fb1' };
  const ADMIN_KIND_STYLE = { 수도: ['#e9b949', 6], 감영: ['#f6e7b8', 4.5], 경: ['#f6e7b8', 4.5], 주: ['#f6e7b8', 4], 소경: ['#8ecae6', 4], 목: ['#cdb4db', 3.5], 부: ['#cdb4db', 3.5] };
  const K_ERAS = ['선사·고조선', '여러 나라', '삼국', '남북국', '고려', '조선 전기', '조선 후기', '근대', '일제 강점기', '현대'];
  const HERITAGE_KINDS = ['문화유산', '유적·유물'];
  const kx = { theme: null, sel: null, inst: null, term: null, termEra: null, termKind: '전체', popup: null, hySel: null, bdSel: null, hidden: new Set(), focus: '', admin: '' };
  let evById = null;
  function eventIndexById(id) {
    if (!evById) evById = new Map(events.map((e, k) => [e.id, k]));
    return evById.get(id);
  }
  function loadKorea() {
    if (K) return Promise.resolve(K);
    if (!kLoading) {
      kLoading = loadJSON('korea_map.json').then((d) => { K = d; prepKorea(); return K; })
        .catch((e) => { kLoading = null; console.warn('한국사 지도 데이터 없음', e); throw e; });
    }
    return kLoading;
  }
  function prepKorea() {
    K.themeById = new Map(K.themes.map((t) => [t.id, t]));
    K.instById = new Map(K.inst.map((x) => [x.id, x]));
    K.termByName = new Map();
    K.terms.forEach((t, i) => {
      t.i = i;
      [t.n, ...(t.a || [])].forEach((n) => { if (!K.termByName.has(n)) K.termByName.set(n, i); });
    });
    K.themes.forEach((t) => {
      t.colorOf = new Map((t.legend || []).map((l, i) => [l.k, l.c || THEME_COLORS[i % THEME_COLORS.length]]));
      const ys = new Set();
      ['points', 'lines', 'areas', 'regions'].forEach((kind) => (t[kind] || []).forEach((it) => { if (it.y != null) ys.add(it.y); }));
      t.stepYears = [...ys].sort((a, b) => a - b);
    });
    if (map && map.getSource('k-heritage')) map.getSource('k-heritage').setData(heritageGeoJSON());
    if (map) syncKorea(true);
  }
  // 1만 년보다 오래된 때는 '약 70만 년 전'처럼
  function fmtAge(y) {
    if (y <= -10000) {
      const man = -y / 10000;
      return `약 ${man >= 10 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, '')}만 년 전`;
    }
    return fmtYear(y);
  }
  function fmtSpan(f, t) {
    if (f == null) return '';
    if (t == null || t === f) return fmtAge(f);
    if (f < 0 && t < 0 && f > -10000) return `기원전 ${-f}~${-t}년`;
    if (f > 0) return `${f}~${t}년`;
    return `${fmtAge(f)} ~ ${fmtAge(t)}`;
  }
  const clampY = (y) => fixZero(clampYear(Math.round(y)), 1);
  const inSpan = (it, y) => (it.y == null || it.y <= y) && (it.t == null || it.t >= y);
  function srcChips(src) {
    return (src || []).map((s) => el('span', { class: `tag${s.b === '비상' ? ' is-book' : ''}`, title: s.fig || '', text: `${s.b} ${s.p}쪽` }));
  }
  function pageTags(t) {
    const out = [];
    if (t.pg && t.pg.length) out.push(el('span', { class: 'tag is-book', text: `비상 ${t.pg.join('·')}쪽` }));
    if (t.mp && t.mp.length) out.push(el('span', { class: 'tag', text: `미래엔 ${t.mp.join('·')}쪽` }));
    return out;
  }
  function eraOfYear(y) {
    const n = eraOfDn(y * 372 + 186);
    return { 선사: '선사·고조선', '고조선과 여러 나라': '여러 나라', '삼국과 가야': '삼국' }[n] || n;
  }
  function kFocus() {
    if (state.mode !== 'korea') return '';
    if (state.panelMode === 'theme' && kx.theme) return 'theme';
    if (state.panelMode === 'hanyang') return 'hanyang';
    if (state.panelMode === 'bungdang') return 'bungdang';
    return '';
  }
  function evLayerOn() { return state.layers.events && !kFocus(); }
  function warLayerOn() { return state.layers.wars && !kFocus(); }

  // ---- 지도 레이어
  const EMPTY_FC = () => ({ type: 'FeatureCollection', features: [] });
  function addKoreaLayers() {
    const font = ['IBM Plex Sans KR'];
    const src = (id) => { if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY_FC() }); };
    ['k-admin', 'k-admin-pts', 'k-heritage', 'k-term', 'theme', 'hy', 'bd'].forEach(src);
    const below = map.getLayer('uncertain-line') ? 'uncertain-line' : undefined;
    const top = map.getLayer('rel-sel') ? 'rel-sel' : undefined;
    const add = (layer, before) => { if (!map.getLayer(layer.id)) map.addLayer(layer, before); };
    // 면 (국경 위, 진격로·사건 아래)
    add({ id: 'k-admin-fill', type: 'fill', source: 'k-admin', filter: ['==', ['geometry-type'], 'Polygon'], layout: { visibility: 'none' }, paint: { 'fill-color': ['to-color', ['at', ['%', ['coalesce', ['get', 'ci'], 0], ADMIN_COLORS.length], ['literal', ADMIN_COLORS]]], 'fill-opacity': 0.32 } }, below);
    add({ id: 'k-admin-line', type: 'line', source: 'k-admin', filter: ['==', ['geometry-type'], 'Polygon'], layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': '#fffaf0', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 2], 'line-dasharray': [3, 1.5] } }, below);
    add({ id: 'bd-fill', type: 'fill', source: 'bd', filter: ['==', ['geometry-type'], 'Polygon'], layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.6 } }, below);
    add({ id: 'theme-fill', type: 'fill', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['case', ['==', ['get', 'ap'], 1], 0.28, 0.42] } }, below);
    add({ id: 'theme-outline', type: 'line', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 1.6, 'line-opacity': 0.95 } }, below);
    // 선·점·글자 (도읍 이름 위)
    add({ id: 'theme-line-casing', type: 'line', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(12,20,30,0.7)', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 9, 8] } }, top);
    add({ id: 'theme-line', type: 'line', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 9, 5] } }, top);
    add({ id: 'theme-line-ap', type: 'line', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 9, 5], 'line-dasharray': [2, 1.3] } }, top);
    add({ id: 'theme-arrows', type: 'symbol', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'symbol-placement': 'line', 'symbol-spacing': 60, 'icon-image': 'chev', 'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.42, 9, 0.75], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' }, paint: { 'icon-color': '#ffffff', 'icon-opacity': 0.95 } }, top);
    add({ id: 'k-admin-line2', type: 'line', source: 'k-admin-pts', filter: ['==', ['geometry-type'], 'LineString'], layout: { visibility: 'none', 'line-cap': 'round' }, paint: { 'line-color': '#f2c14e', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 8, 4], 'line-dasharray': [1.5, 1] } }, top);
    add({ id: 'k-admin-label', type: 'symbol', source: 'k-admin', filter: ['==', ['geometry-type'], 'Point'], layout: { visibility: 'none', 'text-field': ['get', 'n'], 'text-font': ['Nanum Myeongjo'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 12, 7, 17], 'text-letter-spacing': 0.2, 'text-padding': 4 }, paint: { 'text-color': '#fffaf0', 'text-halo-color': 'rgba(18,28,40,0.85)', 'text-halo-width': 1.6 } }, top);
    add({ id: 'k-admin-region', type: 'symbol', source: 'k-admin-pts', filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'r'], 1]], layout: { visibility: 'none', 'text-field': ['get', 'n'], 'text-font': ['Nanum Myeongjo'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 12, 7, 16], 'text-letter-spacing': 0.2 }, paint: { 'text-color': '#fffaf0', 'text-halo-color': 'rgba(18,28,40,0.85)', 'text-halo-width': 1.6 } }, top);
    add({ id: 'k-admin-pt', type: 'circle', source: 'k-admin-pts', filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'r'], 0]], layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4.5, ['*', 0.8, ['get', 'sz']], 8, ['*', 1.3, ['get', 'sz']]], 'circle-color': ['get', 'c'], 'circle-stroke-color': '#1c3044', 'circle-stroke-width': 1.4 } }, top);
    add({ id: 'k-admin-pt-label', type: 'symbol', source: 'k-admin-pts', filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'r'], 0]], minzoom: 5, layout: { visibility: 'none', 'text-field': ['format', ['get', 'n'], {}, '\n', {}, ['get', 'sub'], { 'font-scale': 0.78 }], 'text-font': font, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 8, 13.5], 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#fff6dc', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.5 } }, top);
    add({ id: 'bd-points', type: 'circle', source: 'bd', filter: ['==', ['geometry-type'], 'Point'], layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 12, 8], 'circle-color': ['get', 'c'], 'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#e9b949', '#ffffff'], 'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 3.4, 1.8] } }, top);
    add({ id: 'bd-labels', type: 'symbol', source: 'bd', filter: ['==', ['geometry-type'], 'Point'], layout: { visibility: 'none', 'text-field': ['get', 'n'], 'text-font': font, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11.5, 12, 14], 'text-offset': [0, 1], 'text-anchor': 'top', 'text-max-width': 8, 'text-optional': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.6 } }, top);
    add({ id: 'theme-points', type: 'circle', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'circle-sort-key': ['get', 'o'] }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4.2, 9, 7.5], 'circle-color': ['get', 'c'], 'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#e9b949', '#ffffff'], 'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 3.2, 1.5], 'circle-stroke-opacity': ['case', ['==', ['get', 'ap'], 1], 0.6, 1] } }, top);
    add({ id: 'theme-labels', type: 'symbol', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'text-field': ['get', 'lab'], 'text-font': font, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10.5, 8, 13], 'text-offset': [0, 0.85], 'text-anchor': 'top', 'text-max-width': 9, 'text-optional': true, 'symbol-sort-key': ['get', 'o'], 'text-padding': 2 }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.5 } }, top);
    add({ id: 'theme-texts', type: 'symbol', source: 'theme', filter: ['boolean', false], layout: { visibility: 'none', 'text-field': ['get', 'lab'], 'text-font': ['Nanum Myeongjo'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3.5, 12, 8, 17], 'text-letter-spacing': 0.12, 'text-max-width': 8, 'text-padding': 2 }, paint: { 'text-color': ['case', ['==', ['get', 'kind'], 'wp'], '#e8edf1', '#fff2c8'], 'text-halo-color': 'rgba(16,26,37,0.9)', 'text-halo-width': 1.6 } }, top);
    add({ id: 'k-heritage', type: 'circle', source: 'k-heritage', minzoom: 4.5, layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4.5, 2.8, 9, 6], 'circle-color': '#f6e7b8', 'circle-stroke-color': '#8a6414', 'circle-stroke-width': 1.6 } }, top);
    add({ id: 'k-heritage-label', type: 'symbol', source: 'k-heritage', minzoom: 7, layout: { visibility: 'none', 'text-field': ['get', 'n'], 'text-font': font, 'text-size': 11.5, 'text-offset': [0, 0.8], 'text-anchor': 'top', 'text-max-width': 8, 'text-optional': true }, paint: { 'text-color': '#f6e7b8', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.4 } }, top);
    // 한양 도성
    add({ id: 'hy-water', type: 'line', source: 'hy', filter: ['==', ['get', 'kind'], 'water'], layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#5f9fd8', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['case', ['==', ['get', 'big'], 1], 6, 1.5], 15, ['case', ['==', ['get', 'big'], 1], 26, 5]], 'line-opacity': 0.9 } }, top);
    add({ id: 'hy-wall', type: 'line', source: 'hy', filter: ['==', ['get', 'kind'], 'wall'], layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': '#f3e1a0', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 5], 'line-dasharray': [2.2, 1] } }, top);
    add({ id: 'hy-hill', type: 'symbol', source: 'hy', filter: ['==', ['get', 'kind'], 'hill'], layout: { visibility: 'none', 'text-field': ['concat', '▲ ', ['get', 'n']], 'text-font': ['Nanum Myeongjo'], 'text-size': 13, 'text-allow-overlap': true }, paint: { 'text-color': '#c9e4b4', 'text-halo-color': 'rgba(16,26,37,0.9)', 'text-halo-width': 1.4 } }, top);
    add({ id: 'hy-place', type: 'circle', source: 'hy', filter: ['==', ['get', 'kind'], 'place'], layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4.5, 15, 9], 'circle-color': ['get', 'c'], 'circle-opacity': ['case', ['==', ['get', 'gone'], 1], 0.45, 1], 'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#e9b949', '#1c3044'], 'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 3.4, 1.6] } }, top);
    add({ id: 'hy-label', type: 'symbol', source: 'hy', filter: ['==', ['get', 'kind'], 'place'], layout: { visibility: 'none', 'text-field': ['format', ['get', 'n'], {}, ['get', 'stt'], { 'font-scale': 0.8 }], 'text-font': font, 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 14.5], 'text-offset': [0, 0.95], 'text-anchor': 'top', 'text-max-width': 8, 'text-optional': true, 'symbol-sort-key': ['get', 'o'] }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(16,26,37,0.92)', 'text-halo-width': 1.6 } }, top);
    // 고른 용어 위치
    add({ id: 'k-term-halo', type: 'circle', source: 'k-term', paint: { 'circle-radius': 16, 'circle-color': '#e9b949', 'circle-opacity': 0.3, 'circle-blur': 0.5 } }, top);
    add({ id: 'k-term-dot', type: 'circle', source: 'k-term', paint: { 'circle-radius': 6, 'circle-color': '#e9b949', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } }, top);
    add({ id: 'k-term-label', type: 'symbol', source: 'k-term', layout: { 'text-field': ['get', 'n'], 'text-font': font, 'text-size': 13, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(16,26,37,0.95)', 'text-halo-width': 1.8 } }, top);
    if (K) map.getSource('k-heritage').setData(heritageGeoJSON());
  }
  const K_LAYERS = {
    admin: ['k-admin-fill', 'k-admin-line', 'k-admin-label'],
    adminPts: ['k-admin-line2', 'k-admin-region', 'k-admin-pt', 'k-admin-pt-label'],
    theme: ['theme-fill', 'theme-outline', 'theme-line-casing', 'theme-line', 'theme-line-ap', 'theme-arrows', 'theme-points', 'theme-labels', 'theme-texts'],
    heritage: ['k-heritage', 'k-heritage-label'],
    hy: ['hy-water', 'hy-wall', 'hy-hill', 'hy-place', 'hy-label'],
    bd: ['bd-fill', 'bd-points', 'bd-labels'],
  };
  function setVis(ids, on) {
    ids.forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); });
  }
  // 그해의 지방 행정 구역: 조선 8도(1413~1895) · 13도(1896~1945) 경계, 9주 5소경·5도 양계·감영 같은 중심지
  function adminSetFor(y) {
    if (!K) return '';
    if (y >= K.admin.joseon8.f && y <= K.admin.joseon8.t) return 'joseon8';
    if (y >= K.admin.daehan13.f && y <= K.admin.daehan13.t) return 'daehan13';
    return '';
  }
  function adminPointsFor(y) {
    if (!K) return null;
    return Object.entries(K.points).find(([, v]) => y >= v.f && y <= v.t) || null;
  }
  function adminName(y) {
    const s = adminSetFor(y);
    if (s === 'joseon8') return '조선의 8도';
    if (s === 'daehan13') return '13도';
    const p = adminPointsFor(y);
    return p ? p[1].name : '';
  }
  function syncAdmin(y) {
    const set = adminSetFor(y);
    const pts = adminPointsFor(y);
    const key = `${set}|${pts ? pts[0] : ''}|${set === 'daehan13' ? (y >= 1914 ? 1 : 0) : ''}|${pts ? pts[1].items.filter((it) => inSpanFT(it, y)).length : ''}`;
    if (key === kx.admin) return;
    kx.admin = key;
    const feats = [];
    if (set) {
      K.admin[set].features.forEach((f, i) => {
        const pr = f.properties;
        if ((pr.f != null && y < pr.f) || (pr.t != null && y > pr.t)) return;
        const ci = pr.id === '제주' || pr.id.startsWith('울릉') ? -1 : i;
        feats.push({ type: 'Feature', properties: { n: pr.n, ci: ci < 0 ? 12 : ci }, geometry: f.geometry });
        if (!pr.id.startsWith('울릉')) feats.push({ type: 'Feature', properties: { n: pr.n }, geometry: { type: 'Point', coordinates: [pr.lx, pr.ly] } });
      });
    }
    map.getSource('k-admin').setData({ type: 'FeatureCollection', features: feats });
    const pf = [];
    if (pts) {
      const v = pts[1];
      v.items.forEach((it) => {
        if (!inSpanFT(it, y)) return;
        const region = it.k === '도' || it.k === '계';
        const st = ADMIN_KIND_STYLE[it.k] || ['#f6e7b8', 3.5];
        pf.push({ type: 'Feature', properties: { n: it.n, sub: it.s && it.k !== '수도' ? it.s : it.k, r: region ? 1 : 0, c: st[0], sz: st[1] }, geometry: { type: 'Point', coordinates: it.at } });
      });
      (v.lines || []).forEach((ln) => {
        if (!inSpanFT(ln, y)) return;
        pf.push({ type: 'Feature', properties: { n: ln.n }, geometry: { type: 'LineString', coordinates: ln.path } });
      });
    }
    map.getSource('k-admin-pts').setData({ type: 'FeatureCollection', features: pf });
  }
  function inSpanFT(it, y) { return (it.f == null || it.f <= y) && (it.t == null || it.t >= y); }
  function heritageGeoJSON() {
    const features = [];
    (K ? K.terms : []).forEach((t) => {
      if (!t.at || !HERITAGE_KINDS.includes(t.k)) return;
      features.push({ type: 'Feature', properties: { i: t.i, n: t.n, y: t.y != null ? t.y : -9999999 }, geometry: { type: 'Point', coordinates: t.at } });
    });
    return { type: 'FeatureCollection', features };
  }
  // 한국사 화면에서 한국 나라가 아닌 곳은 흐리게
  let koreanIdx = null;
  function polityOpacityExpr() {
    if (state.mode !== 'korea') return ['case', ['boolean', ['feature-state', 'hover'], false], 1, ['==', ['get', 'u'], 1], 0.68, 0.9];
    if (!koreanIdx) koreanIdx = index.polities.map((P, i) => (KOREAN_POLITIES.has(P.n) ? i : -1)).filter((i) => i >= 0);
    const f = kFocus();
    const ko = f === 'hanyang' ? 0.35 : f ? 0.5 : 0.62;
    return ['case', ['in', ['get', 'p'], ['literal', koreanIdx]], ko, 0.12];
  }
  // 모드·연도·열린 창에 맞춰 한국사 레이어를 켜고 끄기
  function syncKorea(force = false) {
    if (!map || !map.getLayer('k-admin-fill')) return;
    const korea = state.mode === 'korea';
    const y = state.year;
    const f = kFocus();
    if (force || f !== kx.focus) {
      kx.focus = f;
      ['event-icons', 'event-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', evLayerOn() ? 'visible' : 'none'));
      ['battles', 'battle-halo', 'battle-order', 'battle-labels', 'war-a', 'war-a-glow', 'war-b', 'war-b-glow', 'route-casing', 'route-line', 'route-arrows', 'route-stops', 'route-stop-labels', 'route-heads', 'route-head-labels']
        .forEach((id) => map.setLayoutProperty(id, 'visibility', warLayerOn() ? 'visible' : 'none'));
      map.setPaintProperty('polity-fill', 'fill-opacity', polityOpacityExpr());
      ['capitals', 'capitals-dot', 'capital-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', f === 'hanyang' ? 'none' : 'visible'));
      ['korea-rivers', 'korea-river-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', state.layers.water && f !== 'hanyang' ? 'visible' : 'none'));
      if (f !== 'theme' && kx.popup) { kx.popup.remove(); kx.popup = null; }
    }
    if (!K) { Object.values(K_LAYERS).forEach((ids) => setVis(ids, false)); return; }
    // 행정 구역: 한국사 화면에서, 한양을 크게 볼 때는 감춤. 교과서 지도·붕당 지도를 볼 때는 경계선만
    const adminOn = korea && state.layers.admin !== false && f !== 'hanyang';
    if (adminOn) syncAdmin(y);
    setVis(['k-admin-fill'], adminOn && !f);
    setVis(['k-admin-line'], adminOn);
    setVis(['k-admin-label'], adminOn && !f);
    setVis(K_LAYERS.adminPts, adminOn && !f);
    // 문화유산
    const herOn = korea && state.layers.heritage !== false && !f;
    setVis(K_LAYERS.heritage, herOn);
    if (herOn) map.setFilter('k-heritage', ['<=', ['get', 'y'], y]);
    if (herOn) map.setFilter('k-heritage-label', ['<=', ['get', 'y'], y]);
    // 교과서 지도
    setVis(K_LAYERS.theme, f === 'theme');
    if (f === 'theme') applyThemeFilters();
    // 한양
    setVis(K_LAYERS.hy, f === 'hanyang');
    if (f === 'hanyang') syncHanyang();
    // 붕당
    setVis(K_LAYERS.bd, f === 'bungdang');
    if (f === 'bungdang') syncBungdang();
  }

  // ---- 모드 전환
  function setMode(m, opts = {}) {
    if (m === state.mode && !opts.force) return;
    if (tour.active) endTour({ reopen: false, silent: true });
    stopCampaign(false);
    state.mode = m;
    document.body.classList.toggle('mode-korea', m === 'korea');
    document.querySelectorAll('#mode-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    renderTools();
    if (m === 'korea') {
      map.setMaxZoom(16);
      loadKorea().then(() => { if (state.mode === 'korea') { syncKorea(true); renderYearCard(); } }).catch(() => {});
      if (!opts.keepView) fitKoreaView();
    } else {
      if (['theme', 'themes', 'inst', 'terms', 'hanyang', 'bungdang'].includes(state.panelMode)) closePanel();
      if (map.getZoom() > 9) map.easeTo({ zoom: 8.6, duration: prefersReducedMotion ? 0 : 400 });
      setTimeout(() => { if (state.mode === 'world') map.setMaxZoom(9); }, prefersReducedMotion ? 0 : 450);
    }
    relVisOn = null;
    syncKorea(true);
    applyYearFilters();
    focus.key = '';
    updateOnscreen();
    renderYearCard();
    syncTools();
    syncModeSwitch();
    scheduleHash();
    savePrefs();
  }
  // 세계 | 한국사 토글: 고른 쪽 바탕이 미끄러지듯 움직여요
  function syncModeSwitch() {
    const box = $('mode-switch');
    if (!box) return;
    const on = box.querySelector(`button[data-mode="${state.mode}"]`);
    if (!on) return;
    box.style.setProperty('--pill-x', `${on.offsetLeft}px`);
    box.style.setProperty('--pill-w', `${on.offsetWidth}px`);
    box.dataset.mode = state.mode;
  }
  function fitKoreaView(view) {
    const v = view || (state.year < 698 ? 'manchuria' : 'korea');
    const bb = Array.isArray(v) ? v : KVIEWS[v] || KVIEWS.korea;
    map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: fitPadding(), duration: prefersReducedMotion ? 0 : 700, maxZoom: 12 });
  }

  // ---- 교과서 지도 (주제도)
  function themeFeatures(t) {
    const features = [];
    const color = (k) => t.colorOf.get(k) || '#e9b949';
    const base = (it, kind, o) => ({ kind, k: it.k || '', c: color(it.k), n: it.n || '', s: it.s || '', y: it.y != null ? it.y : -9999999, t: it.t != null ? it.t : 9999999, ap: it.ap ? 1 : 0, o });
    let o = 0;
    if (t.regions && K) {
      const feats = new Map(K.admin[t.admin || 'joseon8'].features.map((f) => [f.properties.id, f]));
      t.regions.forEach((r) => {
        const f = feats.get(r.id);
        if (!f) return;
        features.push({ type: 'Feature', properties: { ...base(r, 'fill', o++), n: r.id }, geometry: f.geometry });
        if (!r.id.startsWith('울릉')) features.push({ type: 'Feature', properties: { ...base(r, 'text', o++), lab: r.lab ? `${r.id}\n${r.lab}` : r.id }, geometry: { type: 'Point', coordinates: [f.properties.lx, f.properties.ly] } });
      });
    }
    (t.areas || []).forEach((a) => {
      const ring = a.poly.map((p) => [p[0], p[1]]);
      if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0]);
      features.push({ type: 'Feature', properties: base(a, 'fill', o++), geometry: { type: 'Polygon', coordinates: [ring] } });
      if (a.n) {
        const cx = ring.slice(0, -1).reduce((s, p) => s + p[0], 0) / (ring.length - 1);
        const cy = ring.slice(0, -1).reduce((s, p) => s + p[1], 0) / (ring.length - 1);
        features.push({ type: 'Feature', properties: { ...base(a, 'text', o++), lab: a.n }, geometry: { type: 'Point', coordinates: [cx, cy] } });
      }
    });
    (t.lines || []).forEach((ln) => {
      features.push({ type: 'Feature', properties: { ...base(ln, 'line', o++), arrow: ln.arrow === false ? 0 : 1 }, geometry: { type: 'LineString', coordinates: ln.path.map((p) => [p[0], p[1]]) } });
      ln.path.forEach((p) => {
        if (p.length > 2 && p[2]) features.push({ type: 'Feature', properties: { ...base(ln, 'wp', o++), lab: String(p[2]) }, geometry: { type: 'Point', coordinates: [p[0], p[1]] } });
      });
    });
    (t.points || []).forEach((p, pi) => {
      features.push({ type: 'Feature', id: pi, properties: { ...base(p, 'point', o++), pi, lab: p.n + (p.ap ? '' : ''), sel: kx.sel === pi ? 1 : 0 }, geometry: { type: 'Point', coordinates: p.at } });
    });
    (t.labels || []).forEach((l) => {
      features.push({ type: 'Feature', properties: { ...base(l, 'text', o++), lab: l.n }, geometry: { type: 'Point', coordinates: l.at } });
    });
    return { type: 'FeatureCollection', features };
  }
  function applyThemeFilters() {
    const y = state.year;
    const hidden = [...kx.hidden];
    const when = ['all', ['<=', ['get', 'y'], y], ['>=', ['get', 't'], y], ['!', ['in', ['get', 'k'], ['literal', hidden]]]];
    const is = (kind) => ['==', ['get', 'kind'], kind];
    map.setFilter('theme-fill', ['all', when, is('fill')]);
    map.setFilter('theme-outline', ['all', when, is('fill')]);
    map.setFilter('theme-line-casing', ['all', when, is('line')]);
    map.setFilter('theme-line', ['all', when, is('line'), ['==', ['get', 'ap'], 0]]);
    map.setFilter('theme-line-ap', ['all', when, is('line'), ['==', ['get', 'ap'], 1]]);
    map.setFilter('theme-arrows', ['all', when, is('line'), ['==', ['get', 'arrow'], 1]]);
    map.setFilter('theme-points', ['all', when, is('point')]);
    map.setFilter('theme-labels', ['all', when, is('point')]);
    map.setFilter('theme-texts', ['all', when, ['any', is('text'), is('wp')]]);
  }
  function openThemes(opts = {}) {
    if (state.mode !== 'korea') setMode('korea', { keepView: true });
    clearSelections();
    state.back = null;
    state.war = null;
    state.panelMode = 'themes';
    applyYearFilters();
    if (!opts.restore) resetPanelScroll();
    showPanel();
    loadKorea().then(() => { if (state.panelMode === 'themes') renderThemesPanel(); }).catch(() => renderKoreaError());
    renderThemesPanel();
    scheduleHash();
  }
  function renderKoreaError() {
    $('panel-title').textContent = '한국사 지도';
    $('panel-sub').textContent = '';
    $('panel-body').replaceChildren(el('p', { class: 'status-line', text: '한국사 지도 자료를 불러오지 못했어요. 새로고침해 보세요.' }));
  }
  function renderThemesPanel() {
    $('panel-title').textContent = '교과서 지도';
    $('panel-sub').textContent = `${fmtYear(state.year)} · 교과서에 실린 지도를 옮겨 그렸어요`;
    if (!K) { $('panel-body').replaceChildren(el('p', { class: 'status-line', text: '불러오는 중이에요…' })); return; }
    const y = state.year;
    const now = K.themes.filter((t) => y >= Math.max(YEAR_MIN, t.f) && y <= Math.max(YEAR_MIN, t.t));
    const item = (t) => el('li', {}, [el('button', { class: `th-item${y >= Math.max(YEAR_MIN, t.f) && y <= Math.max(YEAR_MIN, t.t) ? ' is-now' : ''}`, onclick: () => openTheme(t.id, { back: 'themes' }) }, [
      el('span', { class: 'th-name', text: t.n }),
      el('span', { class: 'th-sub', text: `${fmtSpan(t.f, t.t)} · ${(t.src || []).map((s) => `${s.b} ${s.p}쪽`).join(', ')}` }),
    ])]);
    const kids = [];
    if (now.length) {
      kids.push(el('div', { class: 'section-title', text: `지금 연도(${fmtYear(y)})의 지도` }));
      kids.push(el('ul', { class: 'th-list' }, now.map(item)));
    }
    K_ERAS.forEach((era) => {
      const list = K.themes.filter((t) => t.era === era);
      if (!list.length) return;
      kids.push(el('div', { class: 'section-title', text: `${era} (${list.length})` }));
      kids.push(el('ul', { class: 'th-list' }, list.map(item)));
    });
    const other = K.themes.filter((t) => !K_ERAS.includes(t.era));
    if (other.length) kids.push(el('ul', { class: 'th-list' }, other.map(item)));
    kids.push(el('p', { class: 'footnote', text: `비상 교과서의 지도를 바탕으로 미래엔 교과서 지도와 맞춰 보며 옮겨 그렸어요(모두 ${K.themes.length}개). 옛 지명은 오늘날 위치에 찍었고, 경계와 길은 대략적이에요.` }));
    $('panel-body').replaceChildren(...kids);
  }
  function openTheme(id, opts = {}) {
    if (state.mode !== 'korea') setMode('korea', { keepView: true });
    const go = () => {
      const t = K.themeById.get(id);
      if (!t) return;
      clearSelections();
      state.back = opts.back || null;
      state.war = null;
      const changed = kx.theme !== id;
      kx.theme = id;
      kx.sel = null;
      if (changed) kx.hidden = new Set();
      state.panelMode = 'theme';
      map.getSource('theme').setData(themeFeatures(t));
      showPanel();
      if (!opts.restore) {
        resetPanelScroll();
        const want = clampY(t.y != null ? t.y : t.t);
        if (opts.keepYear && state.year >= clampY(t.f) && state.year <= clampY(t.t)) applyYearFilters();
        else setYear(want);
        fitKoreaView(t.view || (t.f < 698 ? 'manchuria' : 'korea'));
      } else applyYearFilters();
      renderThemePanel();
      showPanel();
      scheduleHash();
    };
    if (K) go(); else loadKorea().then(go).catch(() => renderKoreaError());
  }
  function themeStepIndex(t) {
    let k = -1;
    t.stepYears.forEach((sy, i) => { if (sy <= state.year) k = i; });
    return k;
  }
  function renderThemePanel() {
    const t = K && K.themeById.get(kx.theme);
    if (!t) return;
    const y = state.year;
    $('panel-title').textContent = t.n;
    $('panel-sub').textContent = `${t.era || ''} · 교과서 지도 · ${fmtSpan(t.f, t.t)}`;
    const kids = [backButton()];
    kids.push(el('div', { class: 'tags' }, [...srcChips(t.src), t.steps ? el('span', { class: 'tag is-ok', text: '단계별로 보기' }) : null].filter(Boolean)));
    if (t.d) kids.push(el('p', { class: 'note note-lead', text: t.d }));
    const f0 = clampY(t.f);
    const t0 = clampY(t.t);
    if (y < f0 || y > t0) {
      kids.push(el('div', { class: 'k-warn' }, [
        el('span', { text: `지금 연도(${fmtYear(y)})는 이 지도가 다루는 때(${fmtSpan(t.f, t.t)}) 밖이에요.` }),
        el('button', { class: 'btn', text: '지도의 때로 가기', onclick: () => setYear(clampY(t.y != null ? t.y : t.t)) }),
      ]));
    }
    // 단계별로 보기: 항목이 나타난 해를 차례로
    if (t.stepYears.length > 1) {
      const k = themeStepIndex(t);
      const goStep = (i) => { const sy = t.stepYears[Math.max(0, Math.min(t.stepYears.length - 1, i))]; stopPlay(); setYear(clampY(sy)); };
      kids.push(el('div', { class: 'section-title', text: t.steps ? '단계별로 보기' : '연도별로 보기' }));
      kids.push(el('div', { class: 'step-row' }, [
        el('button', { class: 'tour-nav', 'aria-label': '이전 단계', disabled: k <= 0, onclick: () => goStep(k - 1) }, ['‹']),
        el('div', { class: 'step-chips' }, t.stepYears.map((sy, i) => el('button', {
          class: `step-chip${i === k ? ' is-on' : i < k ? ' is-past' : ''}`, onclick: () => goStep(i), text: fmtShort(clampY(sy)),
        }))),
        el('button', { class: 'tour-nav', 'aria-label': '다음 단계', disabled: k >= t.stepYears.length - 1, onclick: () => goStep(k + 1) }, ['›']),
      ]));
    }
    // 범례 (누르면 그 종류를 끄고 켜요)
    if ((t.legend || []).length) {
      kids.push(el('div', { class: 'section-title', text: '범례 (누르면 끄고 켜요)' }));
      kids.push(el('ul', { class: 'k-legend' }, t.legend.map((l) => {
        const off = kx.hidden.has(l.k);
        return el('li', {}, [el('button', {
          class: `k-leg${off ? ' is-off' : ''}`, 'aria-pressed': String(!off),
          onclick: () => { if (off) kx.hidden.delete(l.k); else kx.hidden.add(l.k); applyThemeFilters(); renderThemePanel(); },
        }, [el('span', { class: 'k-sw', style: `--c:${t.colorOf.get(l.k)}`, 'aria-hidden': 'true' }), el('span', { text: l.n })])]);
      })));
    }
    // 항목 목록
    const all = [];
    (t.points || []).forEach((p, pi) => all.push({ it: p, kind: 'point', pi }));
    (t.lines || []).forEach((ln) => all.push({ it: ln, kind: 'line' }));
    (t.areas || []).forEach((a) => all.push({ it: a, kind: 'area' }));
    (t.regions || []).forEach((r) => all.push({ it: { ...r, n: r.lab ? `${r.id} — ${r.lab}` : r.id }, kind: 'region' }));
    if (all.length) {
      const shown = all.filter(({ it }) => inSpan({ y: it.y, t: it.t }, y)).length;
      kids.push(el('div', { class: 'section-title', text: `지도에 그린 것 (${shown}/${all.length})` }));
      const groups = new Map();
      all.forEach((x) => { const k = x.it.k || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
      groups.forEach((list, k) => {
        const leg = (t.legend || []).find((l) => l.k === k);
        if (groups.size > 1 && leg) kids.push(el('div', { class: 'k-subtitle' }, [el('span', { class: 'k-sw', style: `--c:${t.colorOf.get(k)}`, 'aria-hidden': 'true' }), leg.n]));
        kids.push(el('ul', { class: 'mini-list' }, list.map((x) => {
          const on = inSpan({ y: x.it.y, t: x.it.t }, y);
          return el('li', {}, [el('button', { class: `mini-item k-it${on ? '' : ' is-future'}${x.pi != null && kx.sel === x.pi ? ' is-on' : ''}`, onclick: () => focusThemeItem(t, x) }, [
            el('span', { class: `k-mark is-${x.kind}`, style: `--c:${t.colorOf.get(x.it.k) || '#e9b949'}`, 'aria-hidden': 'true' }),
            el('span', { class: 'mini-name', text: x.it.n || '(이름 없음)' }),
            el('span', { class: 'mini-date', text: x.it.y != null ? fmtShort(x.it.y) : '' }),
          ])]);
        })));
      });
    }
    if ((t.notes || []).length) {
      kids.push(el('div', { class: 'section-title', text: '알아 둘 점' }));
      kids.push(el('ul', { class: 'k-notes' }, t.notes.map((n) => el('li', { text: n }))));
    }
    kids.push(el('div', { class: 'actions' }, [
      el('button', { class: 'btn', text: '교과서 지도 목록', onclick: () => openThemes() }),
      el('button', { class: 'btn is-primary', text: '지도 전체 보기', onclick: () => fitKoreaView(t.view || (t.f < 698 ? 'manchuria' : 'korea')) }),
    ]));
    kids.push(el('p', { class: 'footnote', text: '교과서 지도를 옮겨 그린 거예요. 점선은 위치나 길이 대략적인 것이고, 옛 지명은 오늘날 위치에 찍었어요. 점을 누르면 설명이 나와요.' }));
    $('panel-body').replaceChildren(...kids.filter(Boolean));
  }
  function focusThemeItem(t, x) {
    const it = x.it;
    if (it.y != null && it.y > state.year) setYear(clampY(it.y));
    let center = null;
    if (x.kind === 'point') {
      center = it.at;
      kx.sel = x.pi;
      map.getSource('theme').setData(themeFeatures(t));
      move({ center, zoom: Math.max(map.getZoom(), 6) });
    } else {
      const pts = x.kind === 'line' ? it.path : x.kind === 'area' ? it.poly : null;
      if (pts) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: fitPadding(), maxZoom: 8, duration: prefersReducedMotion ? 0 : 600 });
        center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      } else if (x.kind === 'region' && K) {
        const f = K.admin[t.admin || 'joseon8'].features.find((g) => g.properties.id === it.id);
        if (f) { center = [f.properties.lx, f.properties.ly]; move({ center, zoom: Math.max(map.getZoom(), 6) }); }
      }
    }
    if (center) showKPopup(center, it.n, it.s, it.ap);
    renderThemePanel();
  }
  function showKPopup(lngLat, title, text, ap, extra) {
    if (kx.popup) kx.popup.remove();
    const box = el('div', { class: 'k-pop-body' }, [
      el('b', { text: title }),
      text ? el('p', { text }) : null,
      ap ? el('small', { text: '위치는 대략적이에요' }) : null,
      extra || null,
    ]);
    kx.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'k-pop', offset: 12 }).setLngLat(lngLat).setDOMContent(box).addTo(map);
    kx.popup.on('close', () => { kx.popup = null; });
  }

  // ---- 통치 체제
  function openInst(id, opts = {}) {
    clearSelections();
    state.back = opts.back || null;
    state.war = null;
    state.panelMode = 'inst';
    kx.inst = id || null;
    applyYearFilters();
    resetPanelScroll();
    showPanel();
    const go = () => {
      if (!kx.inst) {
        const y = state.year;
        const fit = K.inst.filter((x) => y >= x.f && y <= x.t).sort((a, b) => (a.t - a.f) - (b.t - b.f));
        const central = fit.find((x) => /central|politics|gov|kpg/.test(x.id));
        kx.inst = (central || fit[0] || K.inst[0]).id;
      }
      renderInstPanel();
      scheduleHash();
    };
    if (K) go(); else { $('panel-body').replaceChildren(el('p', { class: 'status-line', text: '불러오는 중이에요…' })); loadKorea().then(go).catch(() => renderKoreaError()); }
  }
  function termButton(name, cls = 'org-term') {
    const ti = K && K.termByName.get(name);
    if (ti == null) return null;
    return el('button', { class: cls, title: '용어 설명 보기', onclick: (e) => { e.stopPropagation(); openTerm(ti, { back: 'inst' }); } }, ['?']);
  }
  function renderInstPanel() {
    const x = K.instById.get(kx.inst);
    if (!x) return;
    $('panel-title').textContent = x.n;
    $('panel-sub').textContent = `${x.era} · 통치 체제 · ${fmtSpan(x.f, x.t)}`;
    const y = state.year;
    const kids = [backButton()];
    // 다른 그림 고르기 (시대 순)
    kids.push(el('div', { class: 'inst-tabs', role: 'tablist', 'aria-label': '통치 체제 그림' }, K.inst.map((o) => el('button', {
      class: `inst-tab${o.id === x.id ? ' is-on' : ''}${y >= o.f && y <= o.t ? ' is-now' : ''}`, role: 'tab', 'aria-selected': String(o.id === x.id),
      onclick: () => { kx.inst = o.id; resetPanelScroll(); renderInstPanel(); scheduleHash(); }, text: o.n.replace(/의 /, ' '),
    }))));
    kids.push(el('div', { class: 'tags' }, srcChips(x.src)));
    if (x.d) kids.push(el('p', { class: 'note note-lead', text: x.d }));
    // 상자 그림 (위에서 아래로)
    const byP = new Map();
    x.nodes.forEach((n) => { const p = n.p || ''; if (!byP.has(p)) byP.set(p, []); byP.get(p).push(n); });
    const kidEl = (kd) => {
      if (typeof kd === 'string') return el('span', { class: 'org-kid' }, [kd, termButton(kd)]);
      return el('div', { class: 'org-kid-row' }, [el('b', {}, [kd.n, termButton(kd.n)]), kd.s ? el('span', { text: kd.s }) : null]);
    };
    const nodeEl = (n, depth) => {
      const children = byP.get(n.id) || [];
      const plain = (n.kids || []).filter((kd) => typeof kd === 'string');
      const rich = (n.kids || []).filter((kd) => typeof kd !== 'string');
      return el('li', { class: `org-li depth-${Math.min(depth, 3)}` }, [
        el('div', { class: `org-box${n.t1 ? ' is-key' : ''}${n.deep ? ' is-deep' : ''}` }, [
          el('div', { class: 'org-name' }, [n.n, termButton(n.n), n.deep ? el('span', { class: 'org-deep', text: '심화' }) : null, n.t1 ? el('span', { class: 'org-key', text: '교과서 강조' }) : null]),
          n.s ? el('div', { class: 'org-role', text: n.s }) : null,
          plain.length ? el('div', { class: 'org-kids' }, plain.map(kidEl)) : null,
          rich.length ? el('div', { class: 'org-rich' }, rich.map(kidEl)) : null,
          n.deep && n.web ? el('div', { class: 'org-web' }, [].concat(n.web).map((u) => extLink(String(u).split(' ')[0], sourceName(String(u)), ''))) : null,
        ]),
        children.length ? el('ul', { class: 'org-ul' }, children.map((c) => nodeEl(c, depth + 1))) : null,
      ]);
    };
    const roots = (byP.get('') || []);
    kids.push(el('ul', { class: 'org-tree' }, roots.map((r) => nodeEl(r, 0))));
    if ((x.notes || []).length) {
      kids.push(el('div', { class: 'section-title', text: '알아 둘 점' }));
      kids.push(el('ul', { class: 'k-notes' }, x.notes.map((n) => el('li', { text: n }))));
    }
    const rel = K.terms.filter((t) => t.inst === x.id);
    if (rel.length) {
      kids.push(el('div', { class: 'section-title', text: `관련 용어 (${rel.length})` }));
      kids.push(el('div', { class: 'chips-inline' }, rel.map((t) => el('button', { class: 'chip-link', text: t.n, onclick: () => openTerm(t.i, { back: 'inst' }) }))));
    }
    kids.push(el('p', { class: 'footnote', text: '교과서의 조직도와 본문을 바탕으로 그렸어요. 노란 테두리는 교과서 그림에서 따로 강조한 기구이고, \'심화\'는 교과서에 없는 내용이에요. ?를 누르면 용어 설명이 나와요.' }));
    $('panel-body').replaceChildren(...kids.filter(Boolean));
  }

  // ---- 용어 사전
  function searchTerms(nq) {
    if (!K || nq.length < 1) return [];
    const out = [];
    K.terms.forEach((t) => {
      const names = [t.n, ...(t.a || [])].map(norm);
      let score = -1;
      names.forEach((n) => {
        if (n === nq) score = Math.max(score, 2.95);
        else if (n.startsWith(nq)) score = Math.max(score, 2.5);
        else if (nq.length >= 2 && n.includes(nq)) score = Math.max(score, 1.4);
      });
      if (score >= 0) out.push({ i: `t${t.i}`, score, a: 1e8 });
    });
    return out;
  }
  function openTerms(opts = {}) {
    clearSelections();
    state.back = null;
    state.war = null;
    state.panelMode = 'terms';
    if (!kx.termEra) kx.termEra = eraOfYear(state.year);
    applyYearFilters();
    if (!opts.restore) resetPanelScroll();
    showPanel();
    const go = () => { renderTermsPanel(); scheduleHash(); };
    if (K) go(); else { $('panel-body').replaceChildren(el('p', { class: 'status-line', text: '불러오는 중이에요…' })); loadKorea().then(go).catch(() => renderKoreaError()); }
  }
  function renderTermsPanel() {
    $('panel-title').textContent = '용어 사전';
    $('panel-sub').textContent = '교과서 찾아보기에 나오는 제도·인물·문화유산·개념';
    const era = kx.termEra;
    const kinds = ['전체', ...new Set(K.terms.filter((t) => t.era === era).map((t) => t.k))];
    if (!kinds.includes(kx.termKind)) kx.termKind = '전체';
    const list = K.terms.filter((t) => t.era === era && (kx.termKind === '전체' || t.k === kx.termKind));
    const kids = [
      el('div', { class: 'term-eras', role: 'tablist', 'aria-label': '시대' }, K_ERAS.map((e) => el('button', {
        class: `inst-tab${e === era ? ' is-on' : ''}`, role: 'tab', 'aria-selected': String(e === era),
        onclick: () => { kx.termEra = e; resetPanelScroll(); renderTermsPanel(); }, text: `${e} ${K.terms.filter((t) => t.era === e).length}`,
      }))),
      el('div', { class: 'chips-inline term-kinds' }, kinds.map((k) => el('button', {
        class: `ch-filter${k === kx.termKind ? ' is-on' : ''}`, text: k, onclick: () => { kx.termKind = k; renderTermsPanel(); },
      }))),
      el('ul', { class: 'term-list' }, list.map((t) => el('li', {}, [el('button', { class: 'term-row', onclick: () => openTerm(t.i, { back: 'terms' }) }, [
        el('span', { class: 'term-name' }, [t.n, t.at ? el('span', { class: 'term-pin', title: '지도에 위치가 있어요', 'aria-label': '지도 위치 있음', text: '◆' }) : null]),
        el('span', { class: 'term-kind', text: t.k }),
        el('span', { class: 'term-desc', text: firstSentence(t.d) }),
      ])]))),
      el('p', { class: 'footnote', text: `두 교과서(비상·미래엔)의 찾아보기에 나오는 용어 가운데 사건·나라·왕·전쟁 이름으로 바로 찾을 수 없는 것 ${K.terms.length}개를 모았어요. 위 검색창에서도 찾을 수 있어요. ◆는 지도에 위치가 있는 것(문화유산 등)이에요.` }),
    ];
    $('panel-body').replaceChildren(...kids);
  }
  function openTerm(i, opts = {}) {
    const go = () => {
      const t = K.terms[i];
      if (!t) return;
      if (tour.active) endTour({ reopen: false });
      stopCampaign(false);
      clearSelections();
      state.back = opts.back || null;
      state.war = null;
      state.panelMode = 'term';
      kx.term = i;
      kx.termEra = t.era;
      if (t.y != null && opts.year !== false) {
        const want = clampY(t.y);
        if (want !== state.year) setYear(want); else applyYearFilters();
      } else applyYearFilters();
      markTerm(t);
      if (t.at && opts.fly !== false) {
        if (state.mode !== 'korea') setMode('korea', { keepView: true });
        move({ center: t.at, zoom: Math.max(map.getZoom(), 7.5) });
      }
      resetPanelScroll();
      renderTermPanel();
      showPanel();
      scheduleHash();
    };
    if (K) go(); else loadKorea().then(go).catch(() => {});
  }
  function markTerm(t) {
    if (!map || !map.getSource('k-term')) return;
    map.getSource('k-term').setData(t && t.at ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { n: t.n }, geometry: { type: 'Point', coordinates: t.at } }] } : EMPTY_FC());
  }
  function renderTermPanel() {
    const t = K.terms[kx.term];
    $('panel-title').textContent = t.n;
    $('panel-sub').textContent = t.era; // 종류는 아래 태그에 있어요
    const kids = [backButton()];
    kids.push(el('div', { class: 'tags' }, [el('span', { class: 'tag tag-cat', style: '--c:#e9b949', text: t.k }), ...pageTags(t), t.ap ? el('span', { class: 'tag is-warn', text: '위치는 대략적이에요' }) : null].filter(Boolean)));
    kids.push(el('p', { class: 'note note-lead', text: t.d }));
    if (t.x) kids.push(el('p', { class: 'note note-more', text: t.x }));
    const facts = [];
    if (t.a && t.a.length) facts.push(el('dt', { text: '다른 이름' }), el('dd', { text: t.a.join(', ') }));
    if (t.y != null || t.f != null) facts.push(el('dt', { text: '때' }), el('dd', { text: t.f != null && t.t != null ? fmtSpan(t.f, t.t) : `${fmtAge(t.y)} 무렵` }));
    if (facts.length) kids.push(el('dl', { class: 'facts' }, facts));
    const evs = (t.ev || []).map((id) => eventIndexById(id)).filter((k) => k != null);
    if (evs.length) {
      kids.push(el('div', { class: 'section-title', text: '관련 사건' }));
      kids.push(el('ul', { class: 'mini-list' }, evs.map((k) => el('li', {}, [el('button', { class: 'mini-item', onclick: () => openEvent(k, { back: 'term' }) }, [
        el('span', { class: 'ev-dia', style: `background:${catColor(events[k].c)}`, 'aria-hidden': 'true' }),
        el('span', { class: 'mini-name', text: events[k].n }), el('span', { class: 'mini-date', text: fmtShort(events[k].y) }),
      ])]))));
    }
    const more = [];
    if (t.inst && K.instById.has(t.inst)) more.push(el('button', { class: 'btn', text: `${K.instById.get(t.inst).n} 그림`, onclick: () => openInst(t.inst, { back: 'term' }) }));
    if (t.fac && t.fac.length) {
      const era = factionEras.find((e) => e.groups.some((g) => t.fac.includes(g.id)));
      if (era) more.push(el('button', { class: 'btn', text: '세력 흐름 그림', onclick: () => openFactions(era.id) }));
      if (era && era.id === 'joseon') more.push(el('button', { class: 'btn', text: '붕당 지도', onclick: () => openBungdang() }));
    }
    if (t.at) more.push(el('button', { class: 'btn is-primary', text: '지도에서 보기', onclick: () => { if (state.mode !== 'korea') setMode('korea', { keepView: true }); markTerm(t); move({ center: t.at, zoom: 9 }); } }));
    if (more.length) kids.push(el('div', { class: 'actions' }, more));
    // 같은 시대·같은 종류의 다른 용어
    const sib = K.terms.filter((o) => o.era === t.era && o.k === t.k && o.i !== t.i).slice(0, 14);
    if (sib.length) {
      kids.push(el('div', { class: 'section-title', text: `${t.era}의 다른 ${t.k}` }));
      kids.push(el('div', { class: 'chips-inline' }, sib.map((o) => el('button', { class: 'chip-link', text: o.n, onclick: () => openTerm(o.i, { back: state.back }) }))));
    }
    const links = el('div', { class: 'links' }, [extLink(`https://encykorea.aks.ac.kr/Article/Search/${encodeURIComponent(t.n.replace(/\s*\(.*\)$/, ''))}`, '한국민족문화대백과사전에서 찾기', 'encykorea.aks.ac.kr'),
      extLink(`https://ko.wikipedia.org/w/index.php?search=${encodeURIComponent(t.n.replace(/\s*\(.*\)$/, ''))}`, '한국어 위키백과에서 찾기', 'ko.wikipedia.org')]);
    kids.push(el('div', { class: 'section-title', text: '더 알아보기' }), links);
    kids.push(el('p', { class: 'footnote', text: '설명은 두 교과서 본문을 바탕으로 쉽게 풀어 썼어요. 쪽수는 그 용어가 나오는 교과서 쪽이에요.' }));
    $('panel-body').replaceChildren(...kids.filter(Boolean));
  }

  // ---- 한양 도성
  function openHanyang(opts = {}) {
    if (state.mode !== 'korea') setMode('korea', { keepView: true });
    const go = () => {
      if (!K.hanyang) return;
      clearSelections();
      state.back = opts.back || null;
      state.war = null;
      state.panelMode = 'hanyang';
      hyKey = '';
      showPanel();
      if (!opts.restore) {
        kx.hySel = null;
        if (state.year < 1394) setYear(1394); else applyYearFilters();
        fitHanyang(900);
        resetPanelScroll();
      } else applyYearFilters();
      renderHanyangPanel();
      showPanel();
      scheduleHash();
    };
    if (K) go(); else loadKorea().then(go).catch(() => renderKoreaError());
  }
  function fitHanyang(ms) {
    const H = K.hanyang;
    const pts = (H.walls || []).flatMap((w) => w.path);
    const bb = pts.length ? [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))] : H.view;
    map.fitBounds([[bb[0] - 0.004, bb[1] - 0.006], [bb[2] + 0.004, bb[3] + 0.003]], { padding: fitPadding(), duration: prefersReducedMotion ? 0 : ms });
  }
  function hyStatus(p, y) {
    if (p.f != null && y < p.f) return { gone: true, text: `${p.f}년에 생겨요` };
    if (p.t != null && y > p.t) return { gone: true, text: `${p.t}년에 없어졌어요` };
    const st = (p.st || []).find((s) => y >= s.f && (s.t == null || y <= s.t));
    return st ? { gone: /터|헐|철거|없/.test(st.n), text: st.n, s: st.s } : { gone: false, text: '' };
  }
  let hyKey = '';
  function syncHanyang() {
    const H = K.hanyang;
    const y = state.year;
    const key = `${y}|${kx.hySel}`;
    if (key === hyKey) return;
    hyKey = key;
    const feats = [];
    (H.walls || []).forEach((w) => { if (w.f == null || w.f <= y) feats.push({ type: 'Feature', properties: { kind: 'wall', n: w.n }, geometry: { type: 'LineString', coordinates: w.path.map((p) => [p[0], p[1]]) } }); });
    (H.waters || []).forEach((w) => feats.push({ type: 'Feature', properties: { kind: 'water', n: w.n, big: /한강/.test(w.n) ? 1 : 0 }, geometry: { type: 'LineString', coordinates: w.path.map((p) => [p[0], p[1]]) } }));
    (H.hills || []).forEach((h) => feats.push({ type: 'Feature', properties: { kind: 'hill', n: h.n }, geometry: { type: 'Point', coordinates: h.at } }));
    H.places.forEach((p, i) => {
      if (p.f != null && y < p.f) return;
      if (p.t != null && y > p.t) return;
      const st = hyStatus(p, y);
      feats.push({ type: 'Feature', properties: { kind: 'place', n: p.n.replace(/\s*\(.*\)$/, ''), stt: st.text ? `\n(${st.text})` : '', c: HY_KIND_COLORS[p.k] || '#f6e7b8', gone: st.gone ? 1 : 0, sel: kx.hySel === i ? 1 : 0, i, o: p.k === '궁궐' ? 0 : 1 }, geometry: { type: 'Point', coordinates: p.at } });
    });
    map.getSource('hy').setData({ type: 'FeatureCollection', features: feats });
  }
  function renderHanyangPanel() {
    const H = K.hanyang;
    const y = state.year;
    $('panel-title').textContent = H.name || '한양 도성';
    $('panel-sub').textContent = `${fmtYear(y)} · ${y < 1394 ? '조선이 도읍을 옮기기 전' : y < 1910 ? '조선의 도읍 한양(한성)' : y < 1945 ? '일제 강점기의 경성' : '서울'}`;
    const kids = [backButton()];
    kids.push(el('div', { class: 'tags' }, srcChips(H.src)));
    // 고른 장소
    if (kx.hySel != null) {
      const p = H.places[kx.hySel];
      const st = hyStatus(p, y);
      const evs = (p.ev || []).map((id) => eventIndexById(id)).filter((k) => k != null);
      kids.push(el('div', { class: 'hy-card' }, [
        el('div', { class: 'hy-card-head' }, [el('span', { class: 'k-sw', style: `--c:${HY_KIND_COLORS[p.k] || '#f6e7b8'}`, 'aria-hidden': 'true' }), el('b', { text: p.n }), el('small', { text: p.k }),
          el('button', { class: 'tour-x', 'aria-label': '장소 닫기', onclick: () => { kx.hySel = null; hyKey = ''; syncHanyang(); renderHanyangPanel(); } }, ['×'])]),
        st.text ? el('p', { class: 'hy-status', text: `${fmtYear(y)}: ${st.text}${st.s ? ` — ${st.s}` : ''}` }) : null,
        el('p', { text: p.s }),
        el('div', { class: 'tags' }, [...pageTags(p), p.deep ? el('span', { class: 'tag is-warn', text: '심화 (교과서 밖 내용)' }) : null, p.ap ? el('span', { class: 'tag is-warn', text: '위치는 대략적이에요' }) : null].filter(Boolean)),
        (p.st || []).length ? el('ul', { class: 'k-notes' }, [p.f != null ? el('li', { text: `${p.f}년 — 지음` }) : null, ...p.st.map((s) => el('li', { text: `${s.f}${s.t ? `~${s.t}` : ''}년 — ${s.n}` })), p.t != null ? el('li', { text: `${p.t}년 — 없어짐` }) : null].filter(Boolean)) : null,
        evs.length ? el('ul', { class: 'mini-list' }, evs.map((k) => el('li', {}, [el('button', { class: 'mini-item', onclick: () => openEvent(k, { back: 'hanyang' }) }, [
          el('span', { class: 'ev-dia', style: `background:${catColor(events[k].c)}`, 'aria-hidden': 'true' }),
          el('span', { class: 'mini-name', text: events[k].n }), el('span', { class: 'mini-date', text: fmtShort(events[k].y) }),
        ])]))) : null,
        p.deep && p.web ? el('div', { class: 'links' }, [].concat(p.web).map((u) => extLink(String(u).split(' ')[0], sourceName(String(u)), ''))) : null,
      ]));
    } else if (H.d) kids.push(el('p', { class: 'note note-lead', text: H.d }));
    if (y < 1394) kids.push(el('div', { class: 'k-warn' }, [el('span', { text: '조선은 1394년에 한양으로 도읍을 옮겼어요. 그 전에는 남경(고려)이었던 곳이에요.' })]));
    // 장소 목록 (종류별)
    const kinds = new Map();
    H.places.forEach((p, i) => { if (!kinds.has(p.k)) kinds.set(p.k, []); kinds.get(p.k).push(i); });
    kinds.forEach((list, k) => {
      kids.push(el('div', { class: 'k-subtitle' }, [el('span', { class: 'k-sw', style: `--c:${HY_KIND_COLORS[k] || '#f6e7b8'}`, 'aria-hidden': 'true' }), k]));
      kids.push(el('ul', { class: 'mini-list' }, list.map((i) => {
        const p = H.places[i];
        const st = hyStatus(p, y);
        const notYet = (p.f != null && y < p.f) || (p.t != null && y > p.t);
        return el('li', {}, [el('button', { class: `mini-item${notYet ? ' is-future' : ''}${kx.hySel === i ? ' is-on' : ''}`, onclick: () => selectHyPlace(i) }, [
          el('span', { class: 'k-mark is-point', style: `--c:${HY_KIND_COLORS[p.k] || '#f6e7b8'}`, 'aria-hidden': 'true' }),
          el('span', { class: 'mini-name', text: p.n }),
          el('span', { class: 'mini-date', text: st.text || (p.f != null ? `${p.f}~` : '') }),
        ])]);
      })));
    });
    if ((H.notes || []).length) {
      kids.push(el('div', { class: 'section-title', text: '알아 둘 점' }));
      kids.push(el('ul', { class: 'k-notes' }, H.notes.map((n) => el('li', { text: n }))));
    }
    kids.push(el('div', { class: 'actions' }, [
      el('button', { class: 'btn', text: '도성 전체 보기', onclick: () => fitHanyang(600) }),
      el('button', { class: 'btn is-primary', text: '붕당 지도', onclick: () => openBungdang() }),
    ]));
    kids.push(el('p', { class: 'footnote', text: '성곽 선은 성문과 산꼭대기를 이어 그린 대략적인 모양이에요. 장소는 오늘날 남아 있거나 터가 확인된 곳에 찍었어요. 연도를 움직이면 궁궐이 불타고 다시 지어지는 모습, 경성 시기의 시설이 바뀌어요.' }));
    $('panel-body').replaceChildren(...kids.filter(Boolean));
  }
  function selectHyPlace(i) {
    const p = K.hanyang.places[i];
    kx.hySel = i;
    if (p.f != null && state.year < p.f) setYear(p.f);
    else if (p.t != null && state.year > p.t) setYear(p.t);
    hyKey = '';
    syncHanyang();
    move({ center: p.at, zoom: Math.max(map.getZoom(), 14.2) });
    resetPanelScroll();
    renderHanyangPanel();
  }

  // ---- 붕당 지도
  function facColorOf(id) {
    for (const era of factionEras) {
      const i = era.groups.findIndex((g) => g.id === id);
      if (i >= 0) return FAC_COLORS[i % FAC_COLORS.length];
    }
    return '#e9b949';
  }
  function facName(id) {
    for (const era of factionEras) {
      const g = era.groups.find((x) => x.id === id);
      if (g) return g.n.replace(/\s*\(.*\)$/, '');
    }
    return id;
  }
  function facChip(id) {
    return el('span', { class: 'fac-chip', style: `--c:${facColorOf(id)}`, text: facName(id) });
  }
  function openBungdang(opts = {}) {
    if (state.mode !== 'korea') setMode('korea', { keepView: true });
    const go = () => {
      if (!K.faction) return;
      clearSelections();
      state.back = opts.back || null;
      state.war = null;
      state.panelMode = 'bungdang';
      bdKey = '';
      showPanel();
      if (!opts.restore) {
        kx.bdSel = null;
        if (state.year < 1470 || state.year > 1863) setYear(1575); else applyYearFilters();
        fitKoreaView('korea');
        resetPanelScroll();
      } else applyYearFilters();
      renderBungdangPanel();
      showPanel();
      scheduleHash();
    };
    if (K) go(); else loadKorea().then(go).catch(() => renderKoreaError());
  }
  let bdKey = '';
  function bdItems() {
    const F = K.faction;
    const out = [];
    ['schools', 'houses', 'places'].forEach((kind) => (F[kind] || []).forEach((it, i) => out.push({ kind, i, it })));
    return out;
  }
  function syncBungdang() {
    const F = K.faction;
    const y = state.year;
    const key = `${y}|${kx.bdSel}`;
    if (key === bdKey) return;
    bdKey = key;
    const feats = [];
    const doFeats = new Map(K.admin.joseon8.features.map((f) => [f.properties.id, f]));
    (F.regions || []).forEach((r) => {
      if (!inSpanFT(r, y)) return;
      (r.do || []).forEach((d) => { const f = doFeats.get(d); if (f) feats.push({ type: 'Feature', properties: { c: facColorOf(r.fac), n: facName(r.fac) }, geometry: f.geometry }); });
    });
    bdItems().forEach(({ kind, i, it }) => {
      const yy = it.f != null ? it.f : it.y;
      if (yy != null && yy > y) return;
      feats.push({ type: 'Feature', properties: { c: facColorOf(it.fac), n: it.n.replace(/\s*\(.*\)$/, ''), key: `${kind}:${i}`, sel: kx.bdSel === `${kind}:${i}` ? 1 : 0 }, geometry: { type: 'Point', coordinates: it.at } });
    });
    map.getSource('bd').setData({ type: 'FeatureCollection', features: feats });
  }
  function renderBungdangPanel() {
    const F = K.faction;
    const y = state.year;
    const sum = factionSummary(y);
    $('panel-title').textContent = F.name || '붕당 지도';
    $('panel-sub').textContent = `${fmtYear(y)} · ${sum ? sum.text : '붕당이 생기기 전이나 뒤예요'}`;
    const kids = [backButton()];
    kids.push(el('div', { class: 'tags' }, srcChips(F.src)));
    // 고른 장소
    if (kx.bdSel) {
      const [kind, i] = kx.bdSel.split(':');
      const it = F[kind][Number(i)];
      kids.push(el('div', { class: 'hy-card' }, [
        el('div', { class: 'hy-card-head' }, [facChip(it.fac), el('b', { text: it.n }), el('button', { class: 'tour-x', 'aria-label': '닫기', onclick: () => { kx.bdSel = null; bdKey = ''; syncBungdang(); renderBungdangPanel(); } }, ['×'])]),
        it.who ? el('p', { class: 'hy-status', text: `학자: ${it.who}` }) : null,
        el('p', { text: it.s }),
        el('div', { class: 'tags' }, [...pageTags(it), it.deep ? el('span', { class: 'tag is-warn', text: '심화 (교과서 밖 내용)' }) : null, it.ap ? el('span', { class: 'tag is-warn', text: '위치는 대략적이에요' }) : null].filter(Boolean)),
        it.deep && it.web ? el('div', { class: 'links' }, [].concat(it.web).map((u) => extLink(String(u).split(' ')[0], sourceName(String(u)), ''))) : null,
      ]));
    } else if (F.d) kids.push(el('p', { class: 'note note-lead', text: F.d }));
    if (sum && sum.ruling.length) {
      kids.push(el('div', { class: 'section-title', text: `${fmtYear(y)}에 정권을 잡은 세력` }));
      kids.push(el('div', { class: 'chips-inline' }, sum.ruling.map((g) => facChip(g.id))));
    }
    // 전환점
    const turns = (F.turns || []).slice().sort((a, b) => a.y - b.y);
    if (turns.length) {
      kids.push(el('div', { class: 'section-title', text: '붕당이 갈라지고 바뀐 때' }));
      let cur = -1;
      turns.forEach((tu, i) => { if (tu.y <= y) cur = i; });
      kids.push(el('ol', { class: 'turn-list' }, turns.map((tu, i) => {
        const evs = (tu.ev || []).map((id) => eventIndexById(id)).filter((k) => k != null);
        return el('li', { class: `turn${i === cur ? ' is-now' : i < cur ? ' is-past' : ''}` }, [
          el('button', { class: 'turn-head', onclick: () => { stopPlay(); setYear(tu.y); } }, [
            el('span', { class: 'turn-year', text: fmtShort(tu.y) }),
            el('span', { class: 'turn-name', text: tu.n }),
          ]),
          el('div', { class: 'turn-flow' }, [...(tu.out || []).map(facChip), (tu.out || []).length && (tu.in || []).length ? el('span', { class: 'turn-arrow', text: '→' }) : null, ...(tu.in || []).map(facChip)].filter(Boolean)),
          i === cur ? el('p', { class: 'turn-s', text: tu.s }) : null,
          i === cur && evs.length ? el('div', { class: 'chips-inline' }, evs.map((k) => el('button', { class: 'chip-link', text: events[k].n, onclick: () => openEvent(k, { back: 'bungdang' }) }))) : null,
        ]);
      })));
    }
    // 장소
    const sect = (title, kind, onlyFly) => {
      const list = F[kind] || [];
      if (!list.length) return;
      kids.push(el('div', { class: 'section-title', text: title }));
      kids.push(el('ul', { class: 'mini-list' }, list.map((it, i) => el('li', {}, [el('button', { class: `mini-item${kx.bdSel === `${kind}:${i}` ? ' is-on' : ''}`, onclick: () => selectBdItem(kind, i, onlyFly) }, [
        el('span', { class: 'k-mark is-point', style: `--c:${facColorOf(it.fac)}`, 'aria-hidden': 'true' }),
        el('span', { class: 'mini-name', text: it.n }),
        el('span', { class: 'mini-date', text: it.who || facName(it.fac) }),
      ])]))));
    };
    sect('학문의 중심이 된 서원', 'schools');
    sect('한양 안의 장소 (동인·서인 이름의 유래)', 'houses', 14);
    sect('그 밖의 장소', 'places');
    if ((F.regions || []).length) {
      kids.push(el('div', { class: 'section-title', text: '지역 기반 (도 색칠)' }));
      kids.push(el('ul', { class: 'k-notes' }, F.regions.map((r) => el('li', {}, [facChip(r.fac), ` ${(r.do || []).join('·')} — ${r.s}`]))));
    }
    if ((F.notes || []).length) {
      kids.push(el('div', { class: 'section-title', text: '알아 둘 점' }));
      kids.push(el('ul', { class: 'k-notes' }, F.notes.map((n) => el('li', { text: n }))));
    }
    kids.push(el('div', { class: 'actions' }, [
      el('button', { class: 'btn', text: '세력 흐름 그림', onclick: () => openFactions('joseon') }),
      el('button', { class: 'btn is-primary', text: '한양 도성', onclick: () => openHanyang({ back: 'bungdang' }) }),
    ]));
    kids.push(el('p', { class: 'footnote', text: '도 색칠은 교과서가 밝힌 지역 기반(동인은 영남, 서인은 경기·충청)만 칠했어요. 남인·북인·노론·소론은 학통의 중심이 된 서원과 학자의 고향으로 보여 줘요. \'심화\'는 교과서에 없는 내용이에요.' }));
    $('panel-body').replaceChildren(...kids.filter(Boolean));
  }
  function selectBdItem(kind, i, zoom) {
    const it = K.faction[kind][i];
    kx.bdSel = `${kind}:${i}`;
    const yy = it.f != null ? it.f : it.y;
    if (yy != null && state.year < yy) setYear(yy);
    bdKey = '';
    syncBungdang();
    move({ center: it.at, zoom: zoom || Math.max(map.getZoom(), 7.5) });
    resetPanelScroll();
    renderBungdangPanel();
  }

  // ---- 지도 누르기 (한국사 화면)
  function koreaClick(e) {
    if (state.mode !== 'korea' || !K) return false;
    const near = [[e.point.x - 9, e.point.y - 9], [e.point.x + 9, e.point.y + 9]];
    const q = (ids) => ids.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    const f = kFocus();
    if (f === 'hanyang') {
      const hit = map.queryRenderedFeatures(near, { layers: q(['hy-place']) });
      if (hit.length) { selectHyPlace(hit[0].properties.i); return true; }
      return false;
    }
    if (f === 'bungdang') {
      const hit = map.queryRenderedFeatures(near, { layers: q(['bd-points']) });
      if (hit.length) { const [kind, i] = hit[0].properties.key.split(':'); selectBdItem(kind, Number(i), map.getZoom()); return true; }
      return false;
    }
    if (f === 'theme') {
      const t = K.themeById.get(kx.theme);
      const hit = map.queryRenderedFeatures(near, { layers: q(['theme-points']) });
      if (hit.length) {
        const pi = hit[0].properties.pi;
        const p = t.points[pi];
        kx.sel = pi;
        map.getSource('theme').setData(themeFeatures(t));
        showKPopup(p.at, p.n, p.s, p.ap);
        renderThemePanel();
        return true;
      }
      const ln = map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: q(['theme-line', 'theme-line-ap']) });
      if (ln.length) { const pr = ln[0].properties; showKPopup(e.lngLat, pr.n, pr.s, pr.ap); return true; }
      const ar = map.queryRenderedFeatures(e.point, { layers: q(['theme-fill']) });
      if (ar.length) { const pr = ar[ar.length - 1].properties; showKPopup(e.lngLat, pr.n, pr.s, pr.ap); return true; }
      return true; // 교과서 지도를 볼 때는 나라를 누르지 않게
    }
    const her = map.queryRenderedFeatures(near, { layers: q(['k-heritage']) });
    if (her.length) { openTerm(her[0].properties.i, { year: false, fly: false }); return true; }
    return false;
  }

  // ---- 한눈에 카드에 붙이는 줄
  function koreaCardRows(y, row) {
    if (state.mode !== 'korea' || !K) return;
    const themes = K.themes.filter((t) => y >= clampY(t.f) && y <= clampY(t.t));
    if (themes.length) {
      row('지도', [el('div', { class: 'yc-chips' }, [
        ...themes.slice(0, 3).map((t) => el('button', { class: `war-chip th-chip${kx.theme === t.id && state.panelMode === 'theme' ? ' is-on' : ''}`, onclick: () => openTheme(t.id, { keepYear: true }) }, [el('span', { class: 'th-dot', 'aria-hidden': 'true' }), t.n])),
        themes.length > 3 ? el('button', { class: 'war-chip', onclick: () => openThemes() }, [`+${themes.length - 3}`]) : null,
      ].filter(Boolean))]);
    }
    const insts = K.inst.filter((x) => y >= x.f && y <= x.t).sort((a, b) => (a.t - a.f) - (b.t - b.f));
    const adm = adminName(y);
    if (insts.length || adm) {
      row('제도', [el('button', { class: 'yc-btn', onclick: () => openInst(null) }, [
        el('span', { class: 'yc-btn-text', text: [adm, insts.length ? `통치 체제 그림 ${insts.length}개` : ''].filter(Boolean).join(' · ') }),
        el('span', { class: 'yc-go', 'aria-hidden': 'true', text: '›' }),
      ])]);
    }
  }

  // ---- 뒤로 가기·주소
  function koreaGoBack(b) {
    if (b === 'themes') { openThemes({ restore: true }); return true; }
    if (b === 'theme' && kx.theme) { openTheme(kx.theme, { restore: true }); return true; }
    if (b === 'inst') { openInst(kx.inst); return true; }
    if (b === 'terms') { openTerms({ restore: true }); return true; }
    if (b === 'term' && kx.term != null) { openTerm(kx.term, { fly: false, year: false }); return true; }
    if (b === 'hanyang') { openHanyang({ restore: true }); return true; }
    if (b === 'bungdang') { openBungdang({ restore: true }); return true; }
    return false;
  }
  function koreaHash(parts) {
    if (state.mode === 'korea') parts.push('m=k');
    if (state.panelMode === 'theme' && kx.theme) parts.push(`th=${encodeURIComponent(kx.theme)}`);
    if (state.panelMode === 'hanyang') parts.push('v=hanyang');
    if (state.panelMode === 'bungdang') parts.push('v=bungdang');
    if (state.panelMode === 'inst' && kx.inst) parts.push(`v=inst:${encodeURIComponent(kx.inst)}`);
    if (state.panelMode === 'term' && kx.term != null && K) parts.push(`v=term:${encodeURIComponent(K.terms[kx.term].n)}`);
  }
  async function koreaFromHash(h) {
    if (h.mode !== 'k' && !h.theme && !h.view) return;
    setMode('korea', { keepView: true, force: true });
    try { await loadKorea(); } catch (e) { return; }
    if (h.theme && K.themeById.has(h.theme)) openTheme(h.theme, { keepYear: true, restore: true });
    else if (h.view === 'hanyang') openHanyang({ restore: true });
    else if (h.view === 'bungdang') openBungdang({ restore: true });
    else if (h.view && h.view.startsWith('inst:')) openInst(h.view.slice(5));
    else if (h.view && h.view.startsWith('term:')) { const i = K.termByName.get(h.view.slice(5)); if (i != null) openTerm(i, { year: false, fly: false }); }
  }

  // ---------------------------------------------------------------- 진격로
  const EMPTY = { type: 'FeatureCollection', features: [] };
  let routesShownFor = null;
  // 진격로 재생: 재생/일시정지, 속도, 위치 막대, 진격로별 켜고 끄기
  const CP_SPEEDS = [0.25, 0.5, 1, 2, 4];
  const campaign = { playing: false, raf: 0, war: null, T: 0, t0: 0, t1: 0, base: 16000, speed: 1, hidden: new Set(), last: 0, lastYear: null, lastPaint: 0 };
  function addChevron() {
    if (map.hasImage('chev')) return;
    const s = 48;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(16, 12); g.moveTo(17, 12); g.lineTo(31, 24); g.lineTo(17, 36); g.stroke();
    map.addImage('chev', g.getImageData(0, 0, s, s), { sdf: true, pixelRatio: 2 });
  }
  function addDiamond() {
    if (map.hasImage('evt')) return;
    const s = 48;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(24, 6); g.lineTo(42, 24); g.lineTo(24, 42); g.lineTo(6, 24); g.closePath(); g.fill();
    map.addImage('evt', g.getImageData(0, 0, s, s), { sdf: true, pixelRatio: 2 });
  }
  function routeData(W, T) {
    const lines = [];
    const stops = [];
    const heads = [];
    // 지명은 간단하게: 출발·도착 지점과 전투가 있던 곳만 점을 찍고,
    // 전투가 있던 곳은 전투 이름이 이미 보이니 지명은 출발·도착에만 붙여요
    const nearBattle = (x, y) => W.battles.some((b) => Math.abs(b.x - x) < 0.15 && Math.abs(b.yy - y) < 0.15);
    (W.routes || []).forEach((r, ri) => {
      if (campaign.war != null && campaign.hidden.has(ri)) return;
      const pts = r.pts;
      const named = pts.map((p, i) => (p[3] ? i : -1)).filter((i) => i >= 0);
      const firstNamed = named[0];
      const lastNamed = named[named.length - 1];
      if (T != null && T < pts[0][2]) return;
      const coords = [];
      let head = null;
      for (let i = 0; i < pts.length; i++) {
        const [x, y, d, n, dt] = pts[i];
        if (T == null || d <= T) {
          coords.push([x, y]);
          const ends = i === firstNamed || i === lastNamed;
          const battle = n && nearBattle(x, y);
          if (n && (ends || battle) && !(i > 0 && pts[i - 1][0] === x && pts[i - 1][1] === y)) {
            stops.push({ type: 'Feature', properties: { n: n.replace(/\s*\(.*\)$/, ''), side: r.side, lab: ends && !battle ? 1 : 0 }, geometry: { type: 'Point', coordinates: [x, y] } });
          }
          head = [x, y];
        } else {
          const [x0, y0, d0] = pts[i - 1];
          const f = d > d0 ? (T - d0) / (d - d0) : 1;
          head = [x0 + (x - x0) * f, y0 + (y - y0) * f];
          coords.push(head);
          break;
        }
      }
      if (coords.length >= 2) lines.push({ type: 'Feature', properties: { side: r.side }, geometry: { type: 'LineString', coordinates: coords } });
      const done = T == null || T >= pts[pts.length - 1][2];
      if (T != null && head && !done) heads.push({ type: 'Feature', properties: { n: r.short, side: r.side }, geometry: { type: 'Point', coordinates: head } });
    });
    return { lines: { type: 'FeatureCollection', features: lines }, stops: { type: 'FeatureCollection', features: stops }, heads: { type: 'FeatureCollection', features: heads } };
  }
  function showRoutes(wi, T = null) {
    const W = wi == null ? null : wars.wars[wi];
    const d = W ? routeData(W, T) : { lines: EMPTY, stops: EMPTY, heads: EMPTY };
    map.getSource('routes').setData(d.lines);
    map.getSource('route-stops').setData(d.stops);
    map.getSource('route-heads').setData(d.heads);
    routesShownFor = W ? wi : null;
  }
  function fmtDn(dn, cal) {
    const y = Math.floor(dn / 372);
    const m = Math.floor((dn - y * 372) / 31) + 1;
    return `${y < 0 ? `기원전 ${-y}` : y}년 ${cal === 'lunar' ? '음력 ' : ''}${m}월`;
  }
  function campaignRange(W) {
    const rs = W.routes.filter((r, ri) => !campaign.hidden.has(ri));
    const use = rs.length ? rs : W.routes;
    const firsts = use.map((r) => r.pts[0][2]);
    const lasts = use.map((r) => r.pts[r.pts.length - 1][2]);
    return [Math.min(...firsts), Math.max(...lasts)];
  }
  function fmtDnFull(dn, cal) {
    const y = Math.floor(dn / 372);
    const m = Math.floor((dn - y * 372) / 31) + 1;
    const d = Math.min(31, Math.floor(dn - y * 372 - (m - 1) * 31) + 1);
    return `${y < 0 ? `기원전 ${-y}` : y}년 ${cal === 'lunar' && y <= 1895 ? '음력 ' : ''}${m}월 ${d}일`;
  }
  function fitCampaign(W) {
    const pts = W.routes.filter((r, ri) => !campaign.hidden.has(ri)).flatMap((r) => r.pts.map((p) => [p[0], p[1]]));
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const m = Math.max(0.5, spread * 0.06);
    map.fitBounds([[Math.min(...xs) - m, Math.min(...ys) - m], [Math.max(...xs) + m, Math.max(...ys) + m]], { padding: fitPadding(), maxZoom: 6.6, duration: prefersReducedMotion ? 0 : 900 });
  }
  function playCampaign(wi) {
    stopCampaign(false);
    stopPlay();
    const W = wars.wars[wi];
    if (!W.routes || !W.routes.length) return;
    campaign.war = wi;
    campaign.hidden = new Set();
    const [t0, t1] = campaignRange(W);
    campaign.t0 = t0;
    campaign.t1 = t1;
    // 1배속 길이: 기간이 길수록 길게 (10~32초)
    campaign.base = Math.max(10000, Math.min(32000, Math.sqrt(Math.max(1, t1 - t0)) * 1500));
    campaign.T = t0;
    campaign.lastYear = null;
    document.body.classList.add('campaign-on');
    const box = $('campaign');
    box.hidden = false;
    $('cp-war').textContent = shortWarName(W);
    $('cp-routes').replaceChildren(...W.routes.map((r, ri) => el('button', {
      class: `cp-route side-${r.side}`, 'aria-pressed': 'true', title: r.name,
      onclick: (e) => {
        if (campaign.hidden.has(ri)) campaign.hidden.delete(ri); else campaign.hidden.add(ri);
        if (campaign.hidden.size >= W.routes.length) campaign.hidden.delete(ri); // 하나는 남김
        [...$('cp-routes').children].forEach((c, k) => c.setAttribute('aria-pressed', String(!campaign.hidden.has(k))));
        const [a, b] = campaignRange(W);
        campaign.t0 = a; campaign.t1 = b;
        campaign.T = Math.max(a, Math.min(b, campaign.T));
        campaignDraw(true);
        e.currentTarget.blur();
      },
    }, [el('span', { class: 'cp-route-dot', 'aria-hidden': 'true' }), r.short || r.name])));
    renderCampaignSpeed();
    fitCampaign(W);
    if (prefersReducedMotion) { campaign.T = t1; campaignDraw(true); campaignSetPlaying(false); return; }
    campaignDraw(true);
    setTimeout(() => { if (campaign.war === wi) campaignSetPlaying(true); }, 700);
  }
  function campaignDraw(force = false) {
    const wi = campaign.war;
    if (wi == null) return;
    const W = wars.wars[wi];
    const T = campaign.T;
    showRoutes(wi, T);
    $('campaign-date').textContent = fmtDnFull(T, W.cal);
    const span = Math.max(1, campaign.t1 - campaign.t0);
    const scrub = $('cp-scrub');
    if (document.activeElement !== scrub || force) scrub.value = String(Math.round(((T - campaign.t0) / span) * 1000));
    scrub.style.setProperty('--fill', `${((T - campaign.t0) / span) * 100}%`);
    const y = Math.floor(T / 372);
    if (y !== campaign.lastYear) { campaign.lastYear = y; if (y !== state.year) setYear(y); }
    if (!ruler.drag) { // 연도 자도 날짜에 맞춰 부드럽게 흐르게
      ruler.center = clampLin(linOf(fixZero(y, 1)) - 0.5 + dnFrac(T, y));
      drawRuler();
    }
    const now = performance.now();
    if (force || now - campaign.lastPaint > 120) {
      campaign.lastPaint = now;
      map.setPaintProperty('battles', 'circle-opacity', ['case', ['==', ['get', 'w'], wi], ['case', ['<=', ['get', 'dn'], T], 1, 0.18], 0.3]);
      map.setPaintProperty('battles', 'circle-stroke-opacity', ['case', ['==', ['get', 'w'], wi], ['case', ['<=', ['get', 'dn'], T], 1, 0.25], 0.4]);
    }
  }
  function campaignFrame(now) {
    if (!campaign.playing) return;
    const dt = Math.min(64, now - campaign.last);
    campaign.last = now;
    const rate = (campaign.t1 - campaign.t0) / campaign.base; // dn/ms (1배속)
    campaign.T = Math.min(campaign.t1, campaign.T + dt * rate * campaign.speed);
    campaignDraw();
    if (campaign.T >= campaign.t1) { campaignSetPlaying(false); return; }
    campaign.raf = requestAnimationFrame(campaignFrame);
  }
  function campaignSetPlaying(on) {
    if (campaign.war == null) return;
    if (on && campaign.T >= campaign.t1) campaign.T = campaign.t0; // 끝났으면 처음부터
    campaign.playing = on;
    cancelAnimationFrame(campaign.raf);
    const btn = $('cp-play');
    btn.setAttribute('aria-label', on ? '일시정지' : campaign.T >= campaign.t1 ? '처음부터 다시 재생' : '이어서 재생');
    $('cp-play-icon').innerHTML = on
      ? '<rect x="7" y="5" width="3.6" height="14" rx="1"/><rect x="13.4" y="5" width="3.6" height="14" rx="1"/>'
      : campaign.T >= campaign.t1 ? '<path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2v3Z"/>' : '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>';
    $('campaign').classList.toggle('is-paused', !on);
    if (on) { campaign.last = performance.now(); campaign.raf = requestAnimationFrame(campaignFrame); }
  }
  function renderCampaignSpeed() {
    [...$('cp-speeds').children].forEach((b) => {
      const on = Number(b.dataset.speed) === campaign.speed;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function setupCampaign() {
    bind('campaign-stop', 'click', () => stopCampaign(true));
    bind('cp-play', 'click', () => campaignSetPlaying(!campaign.playing));
    bind('cp-restart', 'click', () => { campaign.T = campaign.t0; campaignDraw(true); campaignSetPlaying(true); });
    $('cp-speeds').replaceChildren(...CP_SPEEDS.map((v) => el('button', { 'data-speed': String(v), text: `${v}×`, onclick: () => { campaign.speed = v; renderCampaignSpeed(); savePrefs(); } })));
    const scrub = $('cp-scrub');
    let wasPlaying = false;
    scrub.addEventListener('pointerdown', () => { wasPlaying = campaign.playing; campaignSetPlaying(false); });
    scrub.addEventListener('input', () => {
      if (campaign.playing) { wasPlaying = true; campaignSetPlaying(false); }
      campaign.T = campaign.t0 + (Number(scrub.value) / 1000) * (campaign.t1 - campaign.t0);
      campaignDraw(true);
    });
    const resume = () => { if (wasPlaying) { wasPlaying = false; campaignSetPlaying(true); } };
    scrub.addEventListener('pointerup', resume);
    scrub.addEventListener('change', resume);
  }
  function stopCampaign(keepRoutes = true) {
    const wasActive = campaign.war != null;
    campaign.playing = false;
    cancelAnimationFrame(campaign.raf);
    $('campaign').hidden = true;
    document.body.classList.remove('campaign-on');
    const wi = campaign.war;
    campaign.war = null;
    campaign.hidden = new Set();
    if (wasActive && map) {
      applyYearFilters();
      if (keepRoutes && state.war === wi) showRoutes(wi);
      rulerFollow();
    }
  }
  function syncRoutes() {
    if (campaign.war != null) return;
    const W = state.war != null ? wars.wars[state.war] : null;
    const want = W && W.routes && W.routes.length && W.f <= state.year && W.t >= state.year && state.layers.wars && !tour.active ? state.war : null;
    if (want !== routesShownFor) showRoutes(want);
  }

  function sideLabelOf(W, k) { return W.sides[k] ? W.sides[k].label : ''; }
  function winText(W, b) {
    if (b.event && b.win == null) return '사건';
    if (b.win == null) return '승패 없음';
    return `이긴 쪽: ${b.wl || sideLabelOf(W, b.win)}`;
  }
  function openWar(i, opts = {}) {
    if (tour.active) endTour({ reopen: false });
    if (campaign.war != null && campaign.war !== i) stopCampaign(false);
    const W = wars.wars[i];
    clearSelections();
    state.back = opts.back || null;
    state.war = i;
    state.panelMode = 'war';
    state.selected = null;
    if (state.year < W.f || state.year > W.t) setYear(W.f);
    applyYearFilters();
    resetPanelScroll();
    renderWarPanel();
    panelShow();
    if (opts.fit) fitWar(W);
  }
  function fitWar(W) {
    if (!W.battles.length) return;
    const xs = W.battles.map((b) => b.x);
    const ys = W.battles.map((b) => b.yy);
    const bounds = [[Math.min(...xs) - 1, Math.min(...ys) - 1], [Math.max(...xs) + 1, Math.max(...ys) + 1]];
    map.fitBounds(bounds, { padding: fitPadding(), maxZoom: 6.2, duration: prefersReducedMotion ? 0 : 1200 });
  }
  function renderWarPanel() {
    const W = wars.wars[state.war];
    $('panel-title').textContent = W.name;
    $('panel-sub').textContent = W.en;
    const sides = el('div', { class: 'sides' }, W.sides.map((s, k) => {
      const same = s.p.filter((pi) => index.polities[pi].ko === s.label);
      const others = s.p.filter((pi) => index.polities[pi].ko !== s.label);
      return el('div', { class: `side side-${k}` }, [
        same.length
          ? el('button', { class: 'side-label is-link', title: `${s.label} 나라 정보 보기`, onclick: () => openPolity(same[0], { back: null }) }, [s.label, el('span', { class: 'side-go', 'aria-hidden': 'true', text: ' ›' })])
          : el('span', { class: 'side-label', text: s.label }),
        others.length ? el('div', { class: 'chips-inline' }, others.map((pi) => el('button', { class: 'chip-link', text: index.polities[pi].ko, onclick: () => openPolity(pi) }))) : null,
      ].filter(Boolean));
    }));
    const { sorted, ord } = battleOrder(state.war);
    const list = el('ol', { class: 'battle-list' }, sorted.map((bi) => W.battles[bi]).map((b, k) => [b, sorted[k]]).map(([b, bi]) => el('li', {}, [
      el('button', { class: `battle-item${b.y > state.year ? ' is-future' : ''}`, onclick: () => openBattle(state.war, bi) }, [
        el('span', { class: `battle-dot has-num win-${b.win == null ? 'none' : b.win}`, 'aria-hidden': 'true', text: String(ord[bi]) }),
        el('span', { class: 'battle-main' }, [el('span', { class: 'battle-name', text: b.name }), el('span', { class: 'battle-date', text: b.date })]),
        el('span', { class: 'battle-win', text: b.win == null ? '' : (b.wl || sideLabelOf(W, b.win)) }),
      ]),
    ])));
    // 같은 묶음의 다른 차수 (예: 거란의 1·2·3차 침입)
    const siblings = W.group ? wars.wars.map((o, j) => ({ o, j })).filter(({ o }) => o.group === W.group && o.region === W.region) : [];
    const groupNav = siblings.length > 1 ? el('div', { class: 'group-nav' }, [
      el('div', { class: 'group-name', text: W.group }),
      el('div', { class: 'group-chips' }, siblings.map(({ o, j }) => el('button', {
        class: `group-chip${j === state.war ? ' is-on' : ''}`, 'aria-current': j === state.war ? 'true' : null,
        onclick: () => { if (j === state.war) return; setYear(o.f); openWar(j, { fit: true, back: state.back }); },
      }, [el('span', { class: 'gc-name', text: shortWarName(o) }), el('span', { class: 'gc-years', text: o.f === o.t ? fmtShort(o.f) : `${fmtShort(o.f)}~${fmtShort(o.t)}` })]))),
    ]) : null;
    $('panel-body').replaceChildren(...[
      backButton(),
      groupNav,
      el('div', { class: 'tags' }, [el('span', { class: 'tag', text: W.region === 'korea' ? '한국사 · 교과서 대조 검수' : '세계사 · 직접 정리 (검수 전)' })]),
      el('div', { class: 'span-years', text: W.period }),
      el('div', { class: 'section-title', text: '싸운 나라' }), sides,
      el('div', { class: 'section-title', text: '왜 일어났나' }), el('p', { class: 'note', text: W.cause }),
      el('div', { class: 'section-title', text: '결과' }), el('p', { class: 'note', text: W.result }),
      W.dx ? el('div', { class: 'section-title', text: '전쟁의 흐름과 의의' }) : null,
      W.dx ? el('p', { class: 'note note-more', text: W.dx }) : null,
      ...(W.routes && W.routes.length ? [
        el('div', { class: 'section-title', text: `진격로 (${W.routes.length})` }),
        el('button', { class: 'btn is-primary btn-play', onclick: () => playCampaign(state.war) }, [
          el('span', { class: 'play-tri', 'aria-hidden': 'true' }), '진격로 재생',
        ]),
        el('ul', { class: 'route-list' }, W.routes.map((r) => el('li', {}, [
          el('span', { class: `route-swatch side-${r.side}`, 'aria-hidden': 'true' }),
          el('span', {}, [el('span', { class: 'route-name', text: r.sl && !r.name.includes(r.sl) ? `${r.name} · ${r.sl}` : r.name }), el('span', { class: 'route-note', text: r.note })]),
        ]))),
        el('p', { class: 'footnote', text: '진격로는 교과서 지도 수준의 대략적인 길이고, 날짜가 표시된 곳만 기록에 있는 날짜예요.' }),
      ] : []),
      el('div', { class: 'section-title', text: `주요 전투와 사건 (${W.battles.length})` }),
      el('button', { class: 'btn is-primary btn-play', onclick: () => startTour(state.war) }, [
        el('span', { class: 'play-tri', 'aria-hidden': 'true' }), '전투 순서대로 보기',
      ]),
      list,
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: '시작한 해로', onclick: () => { setYear(W.f); fitWar(W); } }),
        el('button', { class: 'btn is-primary', text: '전투 위치 모두 보기', onclick: () => fitWar(W) }),
      ]),
      el('div', { class: 'links' }, [extLink(`https://ko.wikipedia.org/w/index.php?search=${encodeURIComponent(W.name.replace(/\s*\(.*\)$/, ''))}`, '한국어 위키백과에서 찾기', 'ko.wikipedia.org')]),
      el('p', { class: 'footnote', text: W.region === 'korea'
        ? `빨강은 ${sideLabelOf(W, 0)}, 파랑은 ${sideLabelOf(W, 1)} 쪽이에요. 점이 흐린 전투는 지금 날짜보다 뒤에 일어난 거예요. 1895년까지 날짜는 교과서처럼 음력이에요.`
        : `빨강은 ${sideLabelOf(W, 0)}, 파랑은 ${sideLabelOf(W, 1)} 쪽이에요(어느 편이 옳다는 뜻은 아니에요). 점이 흐린 전투는 지금 연도보다 뒤에 일어난 거예요.` }),
    ].filter(Boolean));
  }
  // ---------------------------------------------------------------- 전투 순서대로 보기
  const TOUR_BASE_MS = 2600;
  function tourStepMs(b) { return TOUR_BASE_MS + Math.min(3400, (b.note || '').length * 30); }
  function startTour(wi, startBi = null) {
    stopPlay();
    stopCampaign(false);
    const W = wars.wars[wi];
    if (!W || !W.battles.length) return;
    tour.active = true;
    tour.war = wi;
    tour.list = battleOrder(wi).sorted;
    // 전쟁이 넓게 퍼져 있으면(세계 대전 등) 덜 확대
    const xs = W.battles.map((b) => b.x);
    const ys = W.battles.map((b) => b.yy);
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    tour.zoom = spread > 30 ? 3.9 : spread > 14 ? 4.6 : spread > 6 ? 5.3 : 6;
    state.war = wi;
    state.selected = null;
    state.panelMode = 'tour';
    panelHide();
    document.body.classList.add('tour-on');
    $('tour').hidden = false;
    $('tour-war').textContent = shortWarName(W);
    const ord = battleOrder(wi).ord;
    $('tour-dots').replaceChildren(...tour.list.map((bi, k) => {
      const b = W.battles[bi];
      return el('button', {
        class: `tour-dot win-${b.win == null ? 'none' : b.win}`, title: `${ord[bi]}. ${b.name} (${b.date})`,
        'aria-label': `${ord[bi]}번째: ${b.name}`, onclick: () => { tourSetPlaying(false); tourGo(k); },
      }, [el('span', { text: String(ord[bi]) })]);
    }));
    const start = startBi != null ? Math.max(0, tour.list.indexOf(startBi)) : 0;
    tour.playing = startBi == null; // 처음부터 볼 땐 자동으로 넘김, 특정 전투부터면 멈춘 채로
    tourGo(start);
  }
  function tourGo(k) {
    if (!tour.active) return;
    k = Math.max(0, Math.min(tour.list.length - 1, k));
    tour.i = k;
    const W = wars.wars[tour.war];
    const bi = tour.list[k];
    const b = W.battles[bi];
    setYear(b.y, { dn: b.dn, fromTour: true });
    markBattle(tour.war * 1000 + bi);
    renderTour();
    const target = { center: [b.x, b.yy], zoom: tour.zoom, padding: mapPadding() };
    if (prefersReducedMotion) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 1100, essential: true });
    tourSchedule();
  }
  function renderTour() {
    const W = wars.wars[tour.war];
    const bi = tour.list[tour.i];
    const b = W.battles[bi];
    $('tour-count').textContent = `${tour.i + 1} / ${tour.list.length}`;
    $('tour-date').textContent = b.date;
    $('tour-name').textContent = b.name;
    const win = $('tour-win');
    win.className = `tour-win win-${b.win == null ? 'none' : b.win}`;
    win.textContent = winText(W, b);
    $('tour-note').textContent = b.note || '';
    $('tour-prev').disabled = tour.i === 0;
    $('tour-next').disabled = tour.i === tour.list.length - 1;
    [...$('tour-dots').children].forEach((d, k) => {
      d.classList.toggle('is-current', k === tour.i);
      d.classList.toggle('is-past', k < tour.i);
    });
    const cur = $('tour-dots').children[tour.i];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    tourPlayIcon();
  }
  function tourPlayIcon() {
    const atEnd = tour.i >= tour.list.length - 1;
    $('tour-play').setAttribute('aria-label', tour.playing ? '자동 넘기기 멈춤' : atEnd ? '처음부터 다시 보기' : '자동으로 넘기기');
    $('tour-play-icon').innerHTML = tour.playing
      ? '<rect x="7" y="5" width="3.6" height="14" rx="1"/><rect x="13.4" y="5" width="3.6" height="14" rx="1"/>'
      : atEnd ? '<path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2v3Z"/>' : '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>';
  }
  function tourSchedule() {
    clearTimeout(tour.timer);
    const bar = $('tour-timer-bar');
    bar.style.transition = 'none';
    bar.style.width = '0%';
    if (!tour.active || !tour.playing) { tourPlayIcon(); return; }
    if (tour.i >= tour.list.length - 1) { tour.playing = false; tourPlayIcon(); return; }
    const b = wars.wars[tour.war].battles[tour.list[tour.i]];
    const ms = tourStepMs(b) + (prefersReducedMotion ? 0 : 900);
    void bar.offsetWidth; // 애니메이션 다시 시작
    bar.style.transition = `width ${ms}ms linear`;
    bar.style.width = '100%';
    tour.timer = setTimeout(() => tourGo(tour.i + 1), ms);
  }
  function tourSetPlaying(on) {
    if (on && tour.i >= tour.list.length - 1) { tour.playing = true; tourGo(0); return; }
    tour.playing = on;
    tourSchedule();
  }
  function setupTour() {
    bind('tour-prev', 'click', () => { tourSetPlaying(false); tourGo(tour.i - 1); });
    bind('tour-next', 'click', () => { tourSetPlaying(false); tourGo(tour.i + 1); });
    bind('tour-play', 'click', () => tourSetPlaying(!tour.playing));
    bind('tour-close', 'click', () => endTour());
  }
  function endTour({ reopen = true, silent = false } = {}) {
    if (!tour.active) return;
    clearTimeout(tour.timer);
    const wi = tour.war;
    tour.active = false;
    tour.playing = false;
    $('tour').hidden = true;
    document.body.classList.remove('tour-on');
    markBattle(null);
    state.panelMode = null;
    // 전투 순서 보기에서 준 지도 여백을 거둬요 (남아 있으면 다음 화면 맞추기에서 여백이 겹쳐요)
    const p = map.getPadding();
    if (p.top || p.bottom || p.left || p.right) map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: prefersReducedMotion ? 0 : 400 });
    if (silent) return; // 바로 뒤에 setYear 가 화면을 다시 그림
    state.dn = null;
    renderYearEvent();
    rulerFollow();
    if (reopen) openWar(wi);
    else applyYearFilters();
  }

  let selBattleId = null;
  function markBattle(id) {
    if (selBattleId != null) map.setFeatureState({ source: 'battles', id: selBattleId }, { sel: false });
    selBattleId = id;
    if (id != null) map.setFeatureState({ source: 'battles', id }, { sel: true });
    map.setFilter('battle-halo', id != null ? ['==', ['id'], id] : ['boolean', false]);
  }
  function openBattle(wi, bi, opts = {}) {
    if (tour.active) endTour({ reopen: false });
    stopCampaign(false);
    const W = wars.wars[wi];
    const b = W.battles[bi];
    clearSelections();
    state.back = opts.back || null;
    state.war = wi;
    state.panelMode = 'battle';
    state.selected = null;
    setYear(b.y, { dn: b.dn, month: isDense(b.y) && /\d+월/.test(b.date) ? monthOfDn(b.dn, b.y) : null });
    markBattle(wi * 1000 + bi);
    move({ center: [b.x, b.yy], zoom: Math.max(map.getZoom(), 5.6) });
    $('panel-title').textContent = b.name;
    $('panel-sub').textContent = W.name;
    resetPanelScroll();
    const { sorted } = battleOrder(wi);
    const k = sorted.indexOf(bi);
    const nav = el('div', { class: 'actions' }, [
      el('button', { class: 'btn', text: '이전 전투', disabled: k === 0, onclick: () => openBattle(wi, sorted[k - 1]) }),
      el('button', { class: 'btn', text: '다음 전투', disabled: k === sorted.length - 1, onclick: () => openBattle(wi, sorted[k + 1]) }),
    ]);
    const facts = el('dl', { class: 'facts' }, [
      el('dt', { text: '때' }), el('dd', { text: b.date }),
      el('dt', { text: '결과' }), el('dd', { text: winText(W, b) }),
    ]);
    $('panel-body').replaceChildren(...[
      backButton(),
      el('div', { class: 'tags' }, [el('span', { class: 'tag', text: b.event ? '사건' : '전투' }), b.approx ? el('span', { class: 'tag is-warn', text: '위치는 대략적이에요' }) : null].filter(Boolean)),
      el('p', { class: 'note note-lead', text: b.note }),
      facts, nav,
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: '여기서부터 순서대로', onclick: () => startTour(wi, bi) }),
        el('button', { class: 'btn is-primary', text: '전쟁 전체 보기', onclick: () => openWar(wi, { fit: true, back: state.back }) }),
      ]),
    ].filter(Boolean));
    panelShow();
  }
  function openAutoBattle(ai) {
    if (tour.active) endTour({ reopen: false });
    const b = wars.auto[ai];
    state.panelMode = 'battle';
    state.selected = null;
    markBattle(1000000 + ai);
    $('panel-title').textContent = b.name;
    $('panel-sub').textContent = b.en && b.en !== b.name ? b.en : '';
    const links = el('div', { class: 'links' });
    if (b.kowiki) links.append(extLink(`https://ko.wikipedia.org/wiki/${encodeURIComponent(b.kowiki.replace(/ /g, '_'))}`, '한국어 위키백과', 'ko.wikipedia.org'));
    if (b.q) links.append(extLink(`https://www.wikidata.org/wiki/${b.q}`, '위키데이터', b.q));
    $('panel-body').replaceChildren(
      el('div', { class: 'tags' }, [el('span', { class: 'tag is-warn', text: '위키데이터 자동 수집 (검수 전)' })]),
      el('dl', { class: 'facts' }, [el('dt', { text: '해' }), el('dd', { text: fmtYear(b.y) }), el('dt', { text: '전쟁' }), el('dd', { text: b.war || '정보 없음' })]),
      links,
    );
    panelShow();
  }
  function openIsland(name) {
    if (tour.active) endTour({ reopen: false });
    const info = ISLAND_INFO[name];
    if (!info) return;
    state.panelMode = 'island';
    state.selected = null;
    applyYearFilters();
    $('panel-title').textContent = name;
    $('panel-sub').textContent = info.en;
    $('panel-body').replaceChildren(el('p', { class: 'note', text: info.text }));
    panelShow();
  }
  function openNoticePanel() {
    if (tour.active) endTour({ reopen: false });
    state.panelMode = 'notices';
    state.selected = null;
    applyYearFilters();
    renderNoticePanel();
    panelShow();
  }
  function renderNoticePanel() {
    const list = activeNotices();
    $('panel-title').textContent = '조사 중인 내용';
    $('panel-sub').textContent = `${fmtYear(state.year)}, 지금 화면 기준`;
    const body = $('panel-body');
    if (!list.length) {
      body.replaceChildren(el('p', { class: 'status-line', text: '지금 연도와 화면에는 알려진 오류가 없어요.' }));
      return;
    }
    body.replaceChildren(
      el('p', { class: 'status-line', text: '원본 데이터(Cliopatria)를 교과서·한국사 자료 기준으로 검토하면서 아직 고치지 못한 부분이에요.' }),
      ...list.map(noticeItem),
    );
  }

  // ---------------------------------------------------------------- 지도 이동
  function zoomForArea(a) {
    return Math.max(1.4, Math.min(6.5, 9.5 - 1.05 * Math.log10(Math.max(a, 1000))));
  }
  function flyToPolity(p) {
    const P = index.polities[p];
    if (!P.x && !P.yy) return;
    move({ center: [P.x, P.yy], zoom: zoomForArea(P.a) });
  }
  function move(view) {
    const padding = mapPadding();
    if (prefersReducedMotion) map.jumpTo({ ...view, padding });
    else map.flyTo({ ...view, padding, speed: 1.4, curve: 1.3, essential: true });
  }
  function mapPadding() {
    const mobile = window.innerWidth <= 760;
    const dockH = $('dock').offsetHeight;
    const cpOn = campaign.war != null;
    // 휴대폰에서 진격로 재생 중에는 정보 창이 숨겨져 있어요
    const panelOpen = document.body.classList.contains('panel-open') && !(mobile && (cpOn || tour.active));
    // 왼쪽 위 카드(전투 순서·진격로 재생)가 떠 있으면 그만큼 비켜서 보여 줌
    const card = tour.active ? $('tour') : cpOn ? $('campaign') : null;
    const cardW = card && !mobile ? card.offsetWidth + 24 : 0;
    const cardH = card && mobile ? card.offsetHeight + 16 : 0;
    let top = mobile ? 70 : 80;
    if (mobile && cpOn && card) top = Math.max(top, card.getBoundingClientRect().bottom + 12);
    let bottom = dockH + (mobile && tour.active ? cardH : 0) + (mobile && panelOpen ? Math.min(window.innerHeight * 0.4, 300) : 24);
    // 위아래 여백이 화면보다 커지면 지도를 맞출 수 없으니 줄여요
    const H = map ? map.getCanvas().clientHeight : window.innerHeight;
    const room = H - 180;
    if (top + bottom > room) {
      const k = room / (top + bottom);
      top = Math.floor(top * k);
      bottom = Math.floor(bottom * k);
    }
    const W = map ? map.getCanvas().clientWidth : window.innerWidth;
    const yc = $('year-card');
    const ycW = state.mode === 'korea' && !mobile && !card && yc && !yc.hidden && !yc.classList.contains('is-folded') ? yc.offsetWidth + 24 : 0;
    let left = 20 + cardW + ycW;
    let right = !mobile && panelOpen ? 400 : 20;
    if (left + right > W - 200) { const k = (W - 200) / (left + right); left = Math.floor(left * k); right = Math.floor(right * k); }
    return { top, bottom, left, right };
  }
  // fitBounds 는 지도에 남아 있는 여백(전투 순서 보기 등에서 준 padding)에 더해서 계산하므로, 그만큼 빼서 넘겨요.
  // 안 그러면 휴대폰에서 여백이 두 번 들어가 지도를 맞추지 못해요.
  function fitPadding() {
    const want = mapPadding();
    const cur = map.getPadding ? map.getPadding() : { top: 0, bottom: 0, left: 0, right: 0 };
    return {
      top: Math.max(0, want.top - (cur.top || 0)),
      bottom: Math.max(0, want.bottom - (cur.bottom || 0)),
      left: Math.max(0, want.left - (cur.left || 0)),
      right: Math.max(0, want.right - (cur.right || 0)),
    };
  }

  // ---------------------------------------------------------------- 검색
  function norm(s) { return String(s).toLowerCase().replace(/[\s()·\-'’]/g, ''); }
  const baseName = (s) => norm(String(s).replace(/\s*\([^)]*\)\s*$/, ''));
  // 검색 결과 하나(코드)를 화면에 보일 모양으로
  function describeHit(pi) {
    if (typeof pi === 'string' && pi[0] === 'k') {
      const [si, ki] = pi.slice(1).split(':').map(Number);
      const st = rulerData.states[si];
      const k = st.list[ki];
      return { dot: '#e9b949', name: k.n, sub: `${st.n} ${st.title}${k.d ? ` · ${k.d}` : ''}`, years: k.t >= 2100 ? `${fmtShort(k.f)}~` : `${fmtShort(k.f)}~${fmtShort(k.t)}`, key: `k:${st.id}:${k.n}` };
    }
    if (typeof pi === 'string' && pi[0] === 'e') {
      const ev = events[Number(pi.slice(1))];
      return { dot: catColor(ev.c), name: ev.n, sub: `${ev.c} · ${ev.era}`, years: fmtShort(ev.y), key: `e:${ev.id}` };
    }
    if (typeof pi === 'string' && pi[0] === 't') {
      const t = K.terms[Number(pi.slice(1))];
      return { dot: '#e9b949', name: t.n, sub: `용어 · ${t.k} · ${t.era}`, years: t.y != null ? fmtShort(t.y) : '', key: `t:${t.n}` };
    }
    if (typeof pi === 'string' && pi[0] === 'r') {
      const r = relData.rels[Number(pi.slice(1))];
      return { dot: relColor(r), name: r.n, sub: `국제 관계 · ${REL_TYPES[r.type].label}`, years: `${fmtShort(r.f)}~${r.t >= YEAR_MAX ? '' : fmtShort(r.t)}`, key: `r:${r.id || r.n}` };
    }
    if (typeof pi === 'string') {
      const [wi, bi] = pi.split(':').map(Number);
      const W = wars.wars[wi];
      const b = W.battles[bi];
      return { dot: '#ff6b5b', name: b.name, sub: `전투 · ${shortWarName(W)}`, years: String(b.y), key: `b:${W.id}:${b.name}` };
    }
    if (pi < 0) {
      const W = wars.wars[-1 - pi];
      return { dot: '#e9b949', name: W.name, sub: W.region === 'korea' ? '한국사 전쟁' : '세계사 전쟁', years: W.f === W.t ? fmtShort(W.f) : `${fmtShort(W.f)}~${fmtShort(W.t)}`, key: `w:${W.id}` };
    }
    const P = index.polities[pi];
    return { dot: index.palette[P.c % index.palette.length], name: P.ko, sub: P.ko !== P.n ? P.n.replace(/^\(|\)$/g, '') : '나라', years: `${fmtShort(P.f)} ~ ${fmtShort(P.t)}`, key: `p:${P.n}` };
  }
  // 최근 검색에 저장해 둔 이름 → 지금 데이터의 검색 결과 코드
  function hitFromKey(key) {
    const i = key.indexOf(':');
    const kind = key.slice(0, i);
    const rest = key.slice(i + 1);
    if (kind === 'p') { const pi = index.byName.get(rest); return pi == null ? null : pi; }
    if (kind === 'e') { const k = eventIndexById(rest); return k == null ? null : `e${k}`; }
    if (kind === 't') { if (!K) return null; const ti = K.termByName.get(rest); return ti == null ? null : `t${ti}`; }
    if (kind === 'r') { const ri = relData.rels.findIndex((r) => (r.id || r.n) === rest); return ri < 0 ? null : `r${ri}`; }
    if (kind === 'w') { const wi = wars.wars.findIndex((W) => W.id === rest); return wi < 0 ? null : -1 - wi; }
    if (kind === 'b') {
      const j = rest.indexOf(':');
      const wi = wars.wars.findIndex((W) => W.id === rest.slice(0, j));
      if (wi < 0) return null;
      const bi = wars.wars[wi].battles.findIndex((b) => b.name === rest.slice(j + 1));
      return bi < 0 ? null : `${wi}:${bi}`;
    }
    if (kind === 'k') {
      const j = rest.indexOf(':');
      const si = rulerData.states.findIndex((st) => st.id === rest.slice(0, j));
      if (si < 0) return null;
      const ki = rulerData.states[si].list.findIndex((k) => k.n === rest.slice(j + 1));
      return ki < 0 ? null : `k${si}:${ki}`;
    }
    return null;
  }
  function search(q) {
    const nq = norm(q);
    if (!nq) return [];
    const korea = state.mode === 'korea'; // 한국사 화면에서는 한국사 것만
    const out = [];
    index.polities.forEach((P, i) => {
      if (korea && !KOREAN_POLITIES.has(P.n)) return;
      const ko = norm(P.ko);
      const en = norm(P.n);
      let score = -1;
      if (ko === nq || en === nq) score = 3;
      else if (ko.startsWith(nq) || en.startsWith(nq)) score = 2;
      else if (ko.includes(nq) || en.includes(nq)) score = 1;
      if (score >= 0) out.push({ i, score, a: P.a });
    });
    events.forEach((ev, k) => {
      const n = norm(ev.n);
      if (n.includes(nq)) out.push({ i: `e${k}`, score: n === nq ? 2.9 : n.startsWith(nq) ? 2.45 : 1.45, a: 1e8 + ev.i });
    });
    relData.rels.forEach((r, ri) => {
      const n = norm(r.n);
      if (n.includes(nq)) out.push({ i: `r${ri}`, score: n.startsWith(nq) ? 2.2 : 1.2, a: 1e7 });
    });
    // 왕·지도자 (예: 세종, 광개토)
    rulerData.states.forEach((st, si) => st.list.forEach((k, ki) => {
      const n = norm(k.n);
      if (nq.length >= 2 && n.includes(nq)) out.push({ i: `k${si}:${ki}`, score: n === nq || n.startsWith(nq) ? 2.6 : 1.3, a: 1e8 + (k.d ? 1 : 0) });
    }));
    wars.wars.forEach((W, wi) => {
      if (korea && W.region !== 'korea') return;
      const n = norm(W.name);
      if (n.includes(nq) || norm(W.en).includes(nq)) out.push({ i: -1 - wi, score: n.startsWith(nq) ? 2.5 : 1.5, a: 1e9 });
      W.battles.forEach((b, bi) => { if (norm(b.name).includes(nq)) out.push({ i: `${wi}:${bi}`, score: norm(b.name).startsWith(nq) ? 2.4 : 1.4, a: 1e8 }); });
    });
    out.push(...searchTerms(nq));
    out.sort((x, y) => y.score - x.score || y.a - x.a);
    // 같은 내용이 두 번 나오지 않게: 이름(괄호 속 연도 뺀 것)이 같으면 앞의 것 하나만
    // (예: 전쟁 '이종무의 대마도 토벌 (1419)'과 그 안의 전투 '이종무의 대마도 토벌')
    const seen = new Set();
    const res = [];
    for (const r of out) {
      const d = describeHit(r.i);
      const key = baseName(d.name);
      if (seen.has(key)) continue;
      seen.add(key);
      res.push(r.i);
      if (res.length >= 8) break;
    }
    return res;
  }
  // ---------------------------------------------------------------- 질문으로 찾기 ('예상되는 답변이에요!')
  // AI 가 아니라, 앱에 들어 있는 설명 글(짧은 설명·자세한 설명·왕 목록)에서 질문의 낱말을 찾아 점수를 매겨요.
  // 그래서 앱에 없는 내용은 답하지 못하고, 어떤 낱말로 찾았는지와 근거 글을 함께 보여 줘요.
  const Q_ASK = /[?？]|누구|무엇|뭐|언제|어디|어떤|어느|무슨|왜|어떻게|일까|인가|입니까|쓰시오|고르시오|(?:^|\s)(?:왕|임금|국왕|황제|대통령|인물|사건|나라|제도|기구|단체|조약|책)(?:은|는|이|가|을|를)?(?=\s|$|[?？])/;
  const Q_KING = /(?:^|\s)(?:왕|임금|국왕|군주|황제)(?:은|는|이|가|을|를|의)?(?=\s|$|[?？])|(?:어느|어떤|무슨)\s*왕/;
  const Q_PRES = /대통령(?:은|는|이|가|을|를|의)?(?=\s|$|[?？])/;
  const Q_STOP = new Set(['곳', '누가', '무엇을', '누구', '무엇', '뭐', '뭘', '언제', '어디', '어떤', '어느', '무슨', '왜', '어떻게', '다음', '설명', '옳은', '것', '거', '이름', '쓰시오', '고르시오', '알려줘', '알려', '해줘', '주세요', '인가', '일까', '입니까', '이것', '그것', '당시', '시기', '때', '및', '또는', '그리고', '관련', '대한', '대해', '있는', '있던', '했던', '하는', '되는', '같은', '위해', '통해', '가장', '왕', '임금', '국왕', '군주', '황제', '대통령', '인물', '사람', '사건', '나라']);
  const Q_SUFFIX = ['으로부터', '에서부터', '하였으며', '하였는데', '하였던', '하였고', '하였다', '했으며', '했는데', '이었다', '으로서', '으로써', '에게서', '에서는', '에서', '에게', '으로', '하고', '하여', '해서', '했고', '했다', '했던', '하는', '하던', '하면', '시킨', '시켜', '되었다', '되어', '되고', '되는', '이며', '이고', '이다', '였다', '라는', '이라', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만', '로', '한', '된', '들'];
  // 왕이 다스린 나라 → 그 나라 사건이 붙는 시대 (연도가 없는 용어에 쓰려고)
  const Q_STATE_ERAS = {
    goguryeo: ['고조선과 여러 나라', '삼국', '삼국과 가야'], baekje: ['삼국', '삼국과 가야'], silla: ['삼국', '삼국과 가야', '남북국'],
    balhae: ['남북국'], hubaekje: ['남북국'], taebong: ['남북국'], goryeo: ['고려'], joseon: ['조선 전기', '조선 후기', '근대'],
    'korean-empire': ['근대'], rok: ['현대'], dprk: ['현대'],
  };
  // 같은 뜻의 다른 말도 함께 찾아요 (질문은 '마련한', 설명은 '정비했어요'처럼 다르게 쓰니까)
  const Q_SYN = {
    마련: ['마련', '정비', '갖추', '갖춘'], 완성: ['완성', '확립', '정비', '완비'], 정비: ['정비', '마련', '갖추'],
    설치: ['설치', '두었', '두고', '세웠', '세운', '설립'], 설립: ['설립', '세웠', '세운', '설치'],
    만든: ['만들', '만든', '창제', '편찬', '제작', '펴낸', '펴냈'], 만들: ['만들', '만든', '창제', '편찬', '제작', '펴낸', '펴냈'],
    보낸: ['보내', '보낸', '보냈', '파견'], 보내: ['보내', '보낸', '보냈', '파견'], 파견: ['파견', '보내', '보낸', '보냈'],
    물리친: ['물리', '무찌', '격파', '이겼', '승리'], 무찌른: ['무찌', '물리', '격파', '승리'],
    지킨: ['지키', '지킨', '지켜', '막아', '막았'], 막은: ['막아', '막았', '막은', '지켜'],
    세운: ['세운', '세웠', '세우', '건국', '설립'], 실시: ['실시', '시행', '도입'], 시행: ['시행', '실시'],
    편찬: ['편찬', '펴낸', '펴냈', '엮은', '엮어'], 창제: ['창제', '만들', '만든'],
    체결: ['체결', '맺었', '맺은', '맺고'], 맺은: ['맺었', '맺은', '맺고', '체결'],
    정복: ['정복', '차지', '병합', '복속'], 천도: ['천도', '옮기', '옮겼', '옮긴'], 옮긴: ['옮기', '옮겼', '옮긴', '천도'],
    반포: ['반포', '공포', '펴냈'], 공인: ['공인', '받아들'], 수용: ['수용', '받아들'],
    처음: ['처음', '최초', '첫'], 최초: ['최초', '처음', '첫'], 일으킨: ['일으', '일어'], 주장: ['주장', '내세'],
  };
  // 질문 속 시대·나라 이름은 낱말로 찾지 않고, 그 시기의 것을 앞으로 올리는 데 써요 (긴 것부터)
  const Q_ERA = [
    { re: /고조선/, f: -2333, t: -108, era: '고조선' }, { re: /조선\s*후기/, f: 1608, t: 1897, era: '조선 후기', st: 'joseon' },
    { re: /조선\s*전기/, f: 1392, t: 1608, era: '조선 전기', st: 'joseon' }, { re: /대한\s*제국/, f: 1897, t: 1910, era: '근대', st: 'korean-empire' },
    { re: /일제\s*강점기/, f: 1910, t: 1945, era: '일제 강점기' }, { re: /통일\s*신라|남북국/, f: 676, t: 935, era: '남북국' },
    { re: /조선/, f: 1392, t: 1897, era: '조선', st: 'joseon' }, { re: /고려/, f: 918, t: 1392, era: '고려', st: 'goryeo' },
    { re: /고구려/, f: -37, t: 668, era: '삼국', st: 'goguryeo' }, { re: /백제/, f: -18, t: 660, era: '삼국', st: 'baekje' },
    { re: /신라/, f: -57, t: 935, era: '삼국', st: 'silla' }, { re: /발해/, f: 698, t: 926, era: '남북국', st: 'balhae' },
    { re: /가야/, f: 42, t: 562, era: '가야' }, { re: /삼국/, f: -57, t: 676, era: '삼국' },
    { re: /근대(?!적|화)/, f: 1863, t: 1910, era: '근대' }, { re: /현대|대한민국/, f: 1945, t: 2100, era: '현대' },
  ];
  function qEra(raw) {
    let rest = raw;
    let era = null;
    for (const E of Q_ERA) {
      const m = rest.match(E.re);
      if (!m) continue;
      if (!era) era = E;
      rest = rest.replace(E.re, ' ');
    }
    return { era, rest };
  }
  function qEraFactor(D, E) {
    if (!E) return 1;
    const y0 = D.kind === 'war' ? D.f : D.y;
    if (y0 != null) {
      const y1 = D.kind === 'war' ? D.t : D.y;
      return y1 >= E.f && y0 <= E.t ? 1.25 : 0.3;
    }
    return D.era && (D.era.includes(E.era) || E.era.includes(D.era)) ? 1.1 : 0.6;
  }
  function qStem(w) {
    for (let pass = 0; pass < 2; pass++) {
      const s = Q_SUFFIX.find((x) => w.endsWith(x) && w.length - x.length >= 2);
      if (!s) break;
      w = w.slice(0, -s.length);
    }
    return w;
  }
  function qTokens(q) {
    const words = String(q).toLowerCase().replace(/[?？!.,~·「」『』"“”‘’'()[\]]/g, ' ').split(/\s+/).filter(Boolean);
    const toks = [];
    const seq = []; // 낱말 순서 (붙은 두 낱말을 이어 찾으려고)
    for (const w0 of words) {
      // '왕은', '곳은'처럼 조사를 떼면 한 글자가 되는 질문 말은 빼요
      const loose = w0.replace(/(은|는|이|가|을|를|의|에|로)$/, '');
      if (Q_STOP.has(w0) || Q_STOP.has(loose)) { seq.push(null); continue; }
      const w = qStem(w0);
      if (w.length < 2 || Q_STOP.has(w)) { seq.push(null); continue; }
      seq.push(w);
      if (!toks.some((t) => t.w === w)) toks.push({ w, alts: Q_SYN[w] || [w] });
    }
    // 예: '중앙 집권' → '중앙집권', '통치 제도' → '통치제도' (설명 글에 붙어 나오면 점수를 더 줘요)
    const pairs = [];
    for (let i = 0; i + 1 < seq.length; i++) if (seq[i] && seq[i + 1]) pairs.push(seq[i] + seq[i + 1]);
    return { toks, pairs };
  }
  let QD = null;
  let QD_K;
  const qDf = new Map();
  function qDocs() {
    if (QD && QD_K === K) return QD;
    const docs = [];
    const add = (o) => docs.push({ ...o, nn: norm(o.match || o.name), ns: norm(o.short || ''), nl: norm(o.long || ''), short: o.short || '', long: o.long || '' });
    events.forEach((ev, k) => add({ pi: `e${k}`, name: ev.n, short: ev.t, long: ev.dx, y: ev.y, era: ev.era, kind: 'event' }));
    if (K) K.terms.forEach((t, i) => add({ pi: `t${i}`, name: t.n, match: t.n + (t.a && t.a.length ? ' ' + t.a.join(' ') : ''), short: t.d, long: t.x, y: t.y != null ? t.y : t.f != null ? t.f : null, era: t.era, kind: 'term', tk: t.k }));
    wars.wars.forEach((W, wi) => {
      const korea = W.region === 'korea';
      add({ pi: -1 - wi, name: W.name, short: [W.cause, W.result].filter(Boolean).join(' '), long: W.dx, y: W.f, f: W.f, t: W.t, kind: 'war', korea });
      W.battles.forEach((b, bi) => { if (b.note) add({ pi: `${wi}:${bi}`, name: b.name, short: b.note, y: b.y, kind: 'battle', korea }); });
    });
    rulerData.states.forEach((st, si) => st.list.forEach((k, ki) => add({ pi: `k${si}:${ki}`, name: `${st.n} ${k.n}`, short: k.d, y: k.f, kind: 'king', si, ki })));
    QD = docs;
    QD_K = K;
    qDf.clear();
    QK = null;
    return docs;
  }
  function qIdf(key, alts, docs) {
    let d = qDf.get(key);
    if (d == null) {
      d = 0;
      for (const D of docs) if (alts.some((a) => D.nn.includes(a) || D.ns.includes(a) || D.nl.includes(a))) d++;
      qDf.set(key, d);
    }
    return d ? Math.log(1 + docs.length / d) : 0;
  }
  let QK = null;
  function qKings() {
    if (QK) return QK;
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    QK = [];
    rulerData.states.forEach((st, si) => st.list.forEach((k, ki) => {
      const base = k.n.replace(/\s*\(.*\)\s*$/, '');
      const names = [base];
      if (/\s대왕$/.test(base)) names.push(base.replace(/\s대왕$/, '왕'));
      const m = k.n.match(/\(([^)]+)\)/);
      if (m) m[1].split(/[,·]/).forEach((x) => names.push(x.trim()));
      const alts = names.filter((x) => x.length >= 2).map(esc);
      // 앞 글자가 한글이면 다른 이름의 일부라서 빼요 (예: '문무왕' 속의 '무왕')
      QK.push({ si, ki, st, k, base, re: new RegExp(`(?:^|[^가-힣])(?:${alts.join('|')})`) });
    }));
    return QK;
  }
  function qWhenOK(K0, D) {
    const f = K0.k.f;
    const t = K0.k.t;
    if (D.kind === 'war') return D.f <= t + 1 && D.t >= f - 1;
    if (D.y != null) return D.y >= f - 1 && D.y <= t + 1;
    const eras = Q_STATE_ERAS[K0.st.id];
    return !!(eras && eras.includes(D.era));
  }
  function qScore(D, toks, pairs, idf) {
    let s = 0;
    let hit = 0;
    for (const t of toks) {
      const w = idf.get(t.w);
      if (!w) continue;
      let f = 0;
      for (const a of t.alts) {
        const g = D.nn.includes(a) ? 2.2 : D.ns.includes(a) ? 1.4 : D.nl.includes(a) ? 1 : 0;
        if (g > f) f = g;
      }
      if (f) { s += w * f; hit++; }
    }
    if (!hit) return { s: 0, hit };
    for (const p of pairs) if (D.nn.includes(p) || D.ns.includes(p) || D.nl.includes(p)) s += (idf.get(p) || 1) * 0.6;
    // 질문의 낱말을 많이 담을수록 크게 (한두 낱말만 겹치는 글이 위로 올라오지 않게)
    const cov = hit / toks.length;
    s *= 0.15 + 0.85 * cov * cov;
    return { s, hit };
  }
  // 질문이면 { toks, answers:[{kind, pi, open, ev, K0}], hit:Set } 아니면 null
  function ask(q, nameHits) {
    const raw = String(q).trim();
    const { era, rest } = qEra(raw);
    const { toks, pairs } = qTokens(rest);
    if (!toks.length) return null;
    const question = Q_ASK.test(raw) || toks.length >= 3 || (toks.length >= 2 && !nameHits);
    if (!question) return null;
    const docs = qDocs();
    const korea = state.mode === 'korea';
    const idf = new Map();
    toks.forEach((t) => idf.set(t.w, qIdf(t.w, t.alts, docs)));
    pairs.forEach((p) => idf.set(p, qIdf(p, [p], docs)));
    const wantPres = Q_PRES.test(raw);
    const wantKing = !wantPres && Q_KING.test(raw);
    const wantPerson = /누구|누가|인물|사람|장군/.test(raw);
    const need = toks.length >= 3 ? 2 : 1;
    const scored = [];
    for (const D of docs) {
      if (korea && D.korea === false) continue;
      const r = qScore(D, toks, pairs, idf);
      if (r.s > 0 && r.hit >= need) scored.push({ D, s: r.s * qEraFactor(D, era) });
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.s - a.s);
    let answers = [];
    if (wantKing || wantPres) {
      const leader = (K0) => K0.st.id === 'rok' || K0.st.id === 'dprk';
      const fits = (K0) => leader(K0) === wantPres && (!era || (era.st ? K0.st.id === era.st : true) && K0.k.t >= era.f && K0.k.f <= era.t);
      const ks = new Map();
      // 왕마다 가장 잘 맞는 근거 글 점수 + 나머지 근거는 조금만 (약한 글이 많이 쌓여 1등이 되지 않게)
      const give = (K0, v, D) => {
        const key = `k${K0.si}:${K0.ki}`;
        const o = ks.get(key) || { K0, best: 0, rest: 0, ev: [] };
        if (v > o.best) { o.rest += o.best; o.best = v; } else o.rest += v;
        o.s = o.best + 0.35 * o.rest;
        if (D && !o.ev.includes(D)) { o.ev.push(D); o.ev.sort((x, y) => (y._s || 0) - (x._s || 0)); if (o.ev.length > 2) o.ev.length = 2; }
        ks.set(key, o);
      };
      const kings = qKings();
      scored.slice(0, 30).forEach(({ D, s }) => {
        D._s = s;
        if (D.kind === 'king') {
          const K0 = kings.find((x) => x.si === D.si && x.ki === D.ki);
          if (K0 && fits(K0)) give(K0, s * 1.3, null);
          return;
        }
        const text = `${D.name} ${D.short} ${D.long}`;
        for (const K0 of kings) if (fits(K0) && K0.re.test(text) && qWhenOK(K0, D)) give(K0, s * 0.8, D);
      });
      answers = [...ks.values()].sort((a, b) => b.s - a.s).slice(0, 3)
        .map((o) => ({ kind: 'king', pi: `k${o.K0.si}:${o.K0.ki}`, open: o.ev[0] ? o.ev[0].pi : `k${o.K0.si}:${o.K0.ki}`, s: o.s, K0: o.K0, ev: o.ev }));
    }
    if (!answers.length) {
      const boost = (D) => (wantPerson && (D.tk === '인물' || D.kind === 'king') ? 1.6 : 1);
      const seen = new Set();
      answers = scored.map((x) => ({ D: x.D, s: x.s * boost(x.D) })).sort((a, b) => b.s - a.s)
        .filter((x) => { const k = baseName(x.D.name); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 3).map((x) => ({ kind: 'doc', pi: x.D.pi, open: x.D.pi, s: x.s, ev: [x.D] }));
    }
    if (!answers.length) return null;
    const best = answers[0].s;
    answers = answers.filter((a, i) => i === 0 || a.s >= best * 0.3);
    // 답과 근거 글에서 실제로 찾은 낱말 (형광펜은 같은 뜻의 말까지)
    const hit = new Set();
    const marks = new Set();
    answers.forEach((a) => {
      const texts = a.ev.map((D) => D.nn + D.ns + D.nl);
      if (a.K0) texts.push(norm(`${a.K0.st.n} ${a.K0.k.n} ${a.K0.k.d || ''}`));
      toks.forEach((t) => t.alts.forEach((x) => { if (texts.some((y) => y.includes(x))) { hit.add(t.w); marks.add(x); } }));
    });
    return { toks: toks.map((t) => t.w), era: era ? era.era : '', answers, hit, marks: [...marks] };
  }
  // 근거 글에서 찾은 낱말이 가장 많이 들어 있는 문장 하나
  function qSnippet(D, toks) {
    // 이름에 이미 있는 낱말은 빼고 세요 (예: '3사'를 물으면 3사의 뜻풀이 문장이 나오게). 짧은 설명 문장은 조금 앞으로.
    const own = toks.filter((t) => !D.nn.includes(t));
    const use = own.length ? own : toks;
    const pick = (text, bonus) => (text.match(/[^.!?]+[.!?]?/g) || [text]).map((x) => {
      const n = norm(x);
      return { x, c: use.reduce((a, t) => a + (n.includes(t) ? t.length : 0), 0) + bonus };
    });
    const all = [...pick(D.short || '', 2.5), ...(D.long ? pick(D.long, 0) : [])].filter((o) => o.x.trim());
    let best = all[0] || { x: '' };
    for (const o of all) if (o.c > best.c) best = o;
    return best.x.trim();
  }
  // 글 속 찾은 낱말에 형광펜 (띄어쓰기가 달라도: '중앙집권' ↔ '중앙 집권')
  function qMark(text, toks) {
    const pats = [...toks].sort((a, b) => b.length - a.length)
      .map((t) => [...t].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));
    if (!pats.length) return [text];
    const re = new RegExp(pats.join('|'), 'gi');
    const out = [];
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(el('mark', { text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  // 검색창에 넣은 글 → { ans(질문이면), normal(이름으로 찾은 것) }
  function runQuery(q) {
    let normal = search(q);
    const ans = ask(q, normal.length > 0);
    if (ans) {
      const used = new Set(ans.answers.flatMap((a) => [String(a.open), String(a.pi)]));
      normal = normal.filter((pi) => !used.has(String(pi))).slice(0, 5);
    }
    return { ans, normal };
  }

  // 최근 검색 (이 기기에만 저장)
  const RECENT_KEY = 'hm:recent';
  let recentMem = null; // 저장소를 못 쓰는 곳(미리 보기 등)에서는 이번 방문 동안만 기억
  function loadRecent() {
    try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); if (Array.isArray(a)) return a; } catch (e) { /* 아래로 */ }
    return recentMem || [];
  }
  function saveRecent(list) {
    recentMem = list.slice(0, 8);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentMem)); } catch (e) { /* 저장소를 못 쓰면 메모리에만 */ }
  }
  let searchApi = null;
  function setupSearch() {
    const input = $('search-input');
    const list = $('search-results');
    let items = [];
    let ans = null; // 질문으로 찾은 '예상되는 답변' (items 앞쪽 ans.answers.length 개)
    let active = -1;
    let recentMode = false;
    let lastQuery = '';
    const EXAMPLE_Q = '12목에 지방관을 보낸 왕은?';
    const recentHits = () => loadRecent().map((key) => ({ key, pi: hitFromKey(key) }))
      .filter(({ pi }) => pi != null && !(state.mode === 'korea' && !koreaHit(pi))).map(({ pi }) => pi);
    const row = (pi, k, recent) => {
      const d = describeHit(pi);
      const li = el('li', { class: `result${recent ? ' is-recent' : ''}`, role: 'option', id: `r-${k}`, 'aria-selected': k === active ? 'true' : 'false' }, [
        recent
          ? el('span', { class: 'result-clock', 'aria-hidden': 'true' })
          : el('span', { class: 'result-dot', style: `background:${d.dot}` }),
        el('span', {}, [el('span', { class: 'result-name', text: d.name }), el('span', { class: 'result-en', text: d.sub })]),
        el('span', { class: 'result-years', text: d.years }),
      ]);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(k); });
      return li;
    };
    // '예상되는 답변' 한 줄: 첫째는 크게(근거 문장과 함께), 나머지는 '또는'으로 작게
    const answerRow = (a, k) => {
      const main = k === 0;
      let name; let sub; let years;
      if (a.kind === 'king') {
        const kk = a.K0.k;
        name = `${a.K0.st.n} ${a.K0.base}`;
        sub = kk.d || a.K0.st.title;
        years = kk.t >= 2100 ? `${fmtShort(kk.f)}~` : `${fmtShort(kk.f)}~${fmtShort(kk.t)}`;
      } else {
        const d = describeHit(a.pi);
        name = d.name; sub = d.sub; years = d.years;
      }
      const evD = a.ev[0];
      const snip = evD ? qSnippet(evD, ans.marks) : '';
      const body = [
        el('span', { class: 'answer-name' }, [name, years ? el('span', { class: 'answer-years', text: years }) : null]),
        el('span', { class: 'answer-sub', text: sub }),
      ];
      if (main && snip) {
        body.push(el('span', { class: 'answer-snip' }, qMark(snip, ans.marks)));
        if (a.kind === 'king' && evD) body.push(el('span', { class: 'answer-src', text: `근거: ${evD.name}` }));
      }
      const li = el('li', { class: `result answer${main ? ' is-main' : ''}`, role: 'option', id: `r-${k}`, 'aria-selected': k === active ? 'true' : 'false' }, [
        el('span', { class: 'answer-badge', text: main ? '답' : '또는' }),
        el('span', { class: 'answer-body' }, body),
      ]);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(k); });
      return li;
    };
    const tipRow = () => {
      const li = el('li', { class: 'results-tip', role: 'presentation' }, ['질문으로도 찾을 수 있어요. 예: ', el('b', { text: EXAMPLE_Q })]);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = EXAMPLE_Q; update(); });
      return li;
    };
    const render = () => {
      list.replaceChildren();
      list.classList.toggle('has-answer', !!ans);
      const q = input.value.trim();
      input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
      if (recentMode) {
        if (items.length) {
          list.append(el('li', { class: 'results-head', role: 'presentation' }, [
            el('span', { text: '최근 검색' }),
            el('button', { class: 'results-clear', type: 'button', onmousedown: (e) => { e.preventDefault(); saveRecent([]); items = []; render(); } }, ['지우기']),
          ]));
          items.forEach((pi, k) => list.append(row(pi, k, true)));
        }
        list.append(tipRow());
        return;
      }
      if (!q) return;
      if (!items.length) {
        list.append(el('li', { class: 'results-empty', text: state.mode === 'korea' ? '한국사에서 찾는 것이 없어요. 다른 이름으로 검색하거나, 위에서 \'세계\'로 바꿔 찾아보세요.' : '찾는 것이 없어요. 다른 이름으로 검색해 보세요.' }));
        return;
      }
      const nA = ans ? ans.answers.length : 0;
      if (ans) {
        list.append(el('li', { class: 'answer-head', role: 'presentation' }, [
          el('span', { class: 'answer-spark', 'aria-hidden': 'true' }), el('span', { text: '예상되는 답변이에요!' }),
        ]));
        list.append(el('li', { class: 'answer-keys', role: 'presentation' }, [
          el('span', { class: 'answer-keys-label', text: '찾은 낱말' }),
          ans.era ? el('span', { class: 'answer-key is-era', text: ans.era }) : null,
          ...ans.toks.map((t) => el('span', { class: `answer-key${ans.hit.has(t) ? ' is-hit' : ''}`, text: t })),
        ]));
        ans.answers.forEach((a, k) => list.append(answerRow(a, k)));
        list.append(el('li', { class: 'answer-note', role: 'presentation', text: 'AI가 아니라 앱에 들어 있는 설명에서 낱말이 많이 겹치는 것을 골랐어요. 틀릴 수 있으니 눌러서 확인해 보세요.' }));
        if (items.length > nA) list.append(el('li', { class: 'results-head', role: 'presentation' }, [el('span', { text: '이름으로 찾은 결과' })]));
      }
      items.forEach((pi, k) => { if (k >= nA) list.append(row(pi, k, false)); });
    };
    const update = () => {
      if (!input.value.trim()) { showRecent(); return; }
      recentMode = false;
      const r = runQuery(input.value);
      ans = r.ans;
      items = ans ? [...ans.answers.map((a) => a.open), ...r.normal] : r.normal;
      active = items.length ? 0 : -1;
      render();
    };
    const showRecent = () => { recentMode = true; ans = null; items = recentHits(); active = -1; render(); };
    const pick = (k) => {
      const pi = items[k];
      if (pi == null) return;
      lastQuery = recentMode ? '' : input.value.trim();
      const d = describeHit(pi);
      saveRecent([d.key, ...loadRecent().filter((x) => x !== d.key)]);
      input.value = '';
      items = [];
      ans = null;
      recentMode = false;
      render();
      input.blur();
      const back = { back: 'search' };
      if (typeof pi === 'string' && pi[0] === 'k') {
        const [si, ki] = pi.slice(1).split(':').map(Number);
        const kk = rulerData.states[si].list[ki];
        stopPlay();
        setYear(kk.f === kk.t ? kk.f : Math.min(kk.t, kk.f + 1));
        const P = index.polities[polityIndexByName(rulerData.states[si].pol[0])];
        move({ center: P ? [P.x, P.yy] : [127.5, 37.5], zoom: 4.6 });
        return;
      }
      if (typeof pi === 'string' && pi[0] === 'e') { openEvent(Number(pi.slice(1)), back); return; }
      if (typeof pi === 'string' && pi[0] === 't') { openTerm(Number(pi.slice(1)), back); return; }
      if (typeof pi === 'string' && pi[0] === 'r') { openRelation(Number(pi.slice(1)), back); return; }
      if (typeof pi === 'string') { const [wi, bi] = pi.split(':').map(Number); openBattle(wi, bi, back); return; }
      if (pi < 0) { openWar(-1 - pi, { fit: true, ...back }); return; }
      const P = index.polities[pi];
      setYear(P.y);
      openPolity(pi, { fly: true, ...back });
    };
    input.addEventListener('input', update);
    input.addEventListener('focus', () => { document.body.classList.add('searching'); if (!input.value.trim()) showRecent(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') { pick(active < 0 ? 0 : active); e.preventDefault(); }
      else if (e.key === 'Escape') { input.value = ''; items = []; ans = null; recentMode = false; render(); input.blur(); }
      if (active >= 0) input.setAttribute('aria-activedescendant', `r-${active}`);
    });
    input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement === input) return; document.body.classList.remove('searching'); items = []; ans = null; recentMode = false; render(); }, 150));
    // 정보 창의 '검색 결과로 돌아가기'
    searchApi = {
      reopen() {
        input.value = lastQuery;
        input.focus({ preventScroll: true });
        if (lastQuery) update(); else showRecent();
      },
    };
  }
  function koreaHit(pi) {
    if (typeof pi === 'number' && pi >= 0) return KOREAN_POLITIES.has(index.polities[pi].n);
    if (typeof pi === 'number' && pi < 0) return wars.wars[-1 - pi].region === 'korea';
    if (typeof pi === 'string' && /^\d/.test(pi)) return wars.wars[Number(pi.split(':')[0])].region === 'korea';
    return true;
  }

  // ---------------------------------------------------------------- 연도 자 (1년 단위 눈금자)
  // 기원전 1년 다음 해가 서기 1년(0년 없음)이라, 자 위에서는 빈틈 없는 연속 좌표(lin)로 계산해요.
  // 사건이 많은 해는 12칸(월)으로 넓혀서 보여 줘요. 화면 좌표는 u(펼친 좌표)로 계산하고,
  // 자의 상태(ruler.center)는 lin 좌표로 가져요. year 의 칸은 lin [l-0.5, l+0.5) 이에요.
  function linOf(y) { return y < 0 ? y + 1 : y; }
  function yearOfLin(l) { l = Math.round(l); return l <= 0 ? l - 1 : l; }
  const LIN_MIN = linOf(YEAR_MIN);
  const LIN_MAX = linOf(YEAR_MAX);
  const clampLin = (l) => Math.max(LIN_MIN, Math.min(LIN_MAX, l));
  const MONTH_W = 12;
  let denseLins = [];      // 월 단위로 펼친 해 (lin, 오름차순)
  let denseLo = [];        // 그 해 칸의 왼쪽 끝 (lin)
  let denseStartU = [];    // 그 해가 시작하는 u
  const denseSet = new Set(); // 펼친 해 (연도)
  function isDense(y) { return denseSet.has(y); }
  function lastDenseAt(arr, v) {
    let lo = 0; let hi = arr.length - 1; let k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= v) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    return k;
  }
  function uOf(p) {
    const k = lastDenseAt(denseLo, p);
    if (k < 0) return p;
    const d = denseLins[k];
    if (p < d + 0.5) return denseStartU[k] + (p - (d - 0.5)) * MONTH_W;
    return p + (MONTH_W - 1) * (k + 1);
  }
  function pOf(u) {
    const k = lastDenseAt(denseStartU, u);
    if (k < 0) return u;
    const d = denseLins[k];
    const S = denseStartU[k];
    if (u < S + MONTH_W) return (d - 0.5) + (u - S) / MONTH_W;
    return u - (MONTH_W - 1) * (k + 1);
  }
  // 날짜 일련번호 → 그해 칸 안의 위치(0~1)
  const dnFrac = (dn, y) => Math.max(0, Math.min(0.9999, (dn - y * 372) / 372));
  const monthCut = (y, m) => y * 372 + (m - 1) * 31 + 30; // 그 달 마지막 날까지
  const isLunarYear = (y) => y <= 1895;
  // 한 해 안의 날짜가 있는 일 (전투 + 월까지 아는 한국사 사건)
  let datedByYear = new Map(); // y → [{dn, kind:'b'|'e', ref}]
  function buildDated() {
    datedByYear = new Map();
    const add = (y, item) => { if (!datedByYear.has(y)) datedByYear.set(y, []); datedByYear.get(y).push(item); };
    wars.wars.forEach((W, wi) => W.battles.forEach((b, bi) => { if (/\d+월/.test(b.date)) add(b.y, { dn: b.dn, kind: 'b', w: wi, b: bi }); }));
    events.forEach((ev, k) => { if (ev.m && !ev.nomap) add(ev.y, { dn: ev.dn, kind: 'e', k }); });
    datedByYear.forEach((l) => l.sort((a, b) => a.dn - b.dn));
    // 서로 다른 날짜가 4개 이상이면 월 단위로 펼침
    denseSet.clear();
    datedByYear.forEach((l, y) => { if (new Set(l.map((it) => it.dn)).size >= 4) denseSet.add(y); });
    denseLins = [...denseSet].map(linOf).sort((a, b) => a - b);
    denseLo = denseLins.map((d) => d - 0.5);
    denseStartU = denseLins.map((d, i) => (d - 0.5) + (MONTH_W - 1) * i);
  }

  const RULER_LANE_TOP = 30;
  const RULER_LANE_H = 13;
  const RULER_LANE_GAP = 2;
  const RULER_FADE = 34; // 양 끝 흐려지는 폭(px)
  const ruler = {
    el: null, canvas: null, ctx: null, w: 0, h: 0, dpr: 1, ppy: 10,
    center: linOf(START_YEAR),
    drag: null, mode: null, raf: 0, tween: null, vel: 0, last: 0,
    lanes: [], groups: [], bars: [], colors: {}, font: 'sans-serif',
    wheelTimer: 0, hintTimer: 0,
  };
  const shortWarName = (W) => W.name.replace(/\s*\(.*\)$/, '');

  // 같은 묶음(group)의 전쟁은 자 위에서 한 막대로 그려요 (예: 거란의 1·2·3차 침입 → 고려-거란 전쟁)
  function buildRulerGroups() {
    const R = ruler;
    const byKey = new Map();
    wars.wars.forEach((W, i) => {
      const key = W.group ? `${W.region}|${W.group}` : `war|${i}`;
      if (!byKey.has(key)) byKey.set(key, { key, name: W.group || shortWarName(W), region: W.region, members: [], f: W.f, t: W.t });
      const g = byKey.get(key);
      g.members.push(i);
      g.f = Math.min(g.f, W.f);
      g.t = Math.max(g.t, W.t);
    });
    R.groups = [...byKey.values()];
    R.groups.forEach((g) => { if (g.members.length === 1) g.name = shortWarName(wars.wars[g.members[0]]); });
    // 줄 배치: 위 줄은 한국사, 아래 줄은 세계사. 같은 줄에서 기간이 겹치면 줄을 하나 더 씀
    const rows = [];
    ['korea', 'world'].forEach((region) => {
      const mine = R.groups.filter((g) => (g.region === 'korea') === (region === 'korea')).sort((a, b) => a.f - b.f);
      const ends = [];
      mine.forEach((g) => {
        let k = ends.findIndex((e) => e < g.f);
        if (k < 0) { k = ends.length; ends.push(g.t); } else ends[k] = g.t;
        g.lane = rows.length + k;
      });
      rows.push(...ends.map(() => region));
      if (!ends.length) rows.push(region);
    });
    R.rowCount = rows.length;
  }

  function setupRuler() {
    const R = ruler;
    R.el = $('ruler');
    R.canvas = $('ruler-canvas');
    R.ctx = R.canvas.getContext('2d');
    R.center = linOf(state.year);
    buildRulerGroups();
    readRulerColors();
    sizeRuler();
    new ResizeObserver(sizeRuler).observe(R.el);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { readRulerColors(); drawRuler(); });
    if (document.fonts) document.fonts.addEventListener?.('loadingdone', () => drawRuler());

    R.el.addEventListener('pointerdown', rulerDown);
    R.el.addEventListener('pointermove', rulerMove);
    R.el.addEventListener('pointerup', rulerUp);
    R.el.addEventListener('pointercancel', rulerUp);
    R.el.addEventListener('lostpointercapture', (e) => { if (R.drag && R.drag.id === e.pointerId) rulerUp(e); });
    R.el.addEventListener('wheel', rulerWheel, { passive: false });
    R.el.addEventListener('keydown', (e) => {
      const steps = { PageUp: -10, PageDown: 10 };
      if (e.key in steps) { stopPlay(); setYear(addYears(state.year, steps[e.key])); e.preventDefault(); }
      else if (e.key === 'Home') { stopPlay(); setYear(YEAR_MIN); e.preventDefault(); }
      else if (e.key === 'End') { stopPlay(); setYear(YEAR_MAX); e.preventDefault(); }
    });
    ['ruler-prev', 'ruler-next'].forEach((id) => $(id).addEventListener('click', (e) => {
      const i = Number(e.currentTarget.dataset.war);
      if (!Number.isFinite(i)) return;
      stopPlay();
      stopCampaign(false);
      setYear(wars.wars[i].f);
      openWar(i, { fit: true });
    }));

    // 처음 온 사람에게만 한 번 알려 주기
    let seen = false;
    try { seen = localStorage.getItem('hm-ruler-hint') === '1'; } catch (e) { /* 저장소를 못 써도 괜찮음 */ }
    if (!seen) {
      $('ruler-hint').hidden = false;
      R.el.classList.add('show-hint');
      R.hintTimer = setTimeout(hideRulerHint, 7000);
    }
  }
  function hideRulerHint() {
    const hint = $('ruler-hint');
    if (hint.hidden || hint.classList.contains('is-fading')) return;
    clearTimeout(ruler.hintTimer);
    hint.classList.add('is-fading');
    setTimeout(() => { hint.hidden = true; ruler.el.classList.remove('show-hint'); }, 450);
    try { localStorage.setItem('hm-ruler-hint', '1'); } catch (e) { /* 무시 */ }
  }
  function readRulerColors() {
    const cs = getComputedStyle(ruler.el);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    ruler.colors = {
      ink: v('--ink', '#16202a'), muted: v('--muted', '#5d6a76'), faint: v('--faint', '#8c97a1'),
      gold: v('--gold', '#e9b949'), ko: v('--war-ko', '#c8503f'), world: v('--war-world', '#46689e'),
      band: v('--month-band', 'rgba(233,185,73,0.13)'),
    };
    ruler.font = v('--font-ui', 'sans-serif');
  }
  function sizeRuler() {
    const R = ruler;
    const r = R.el.getBoundingClientRect();
    if (!r.width) return;
    R.dpr = Math.min(window.devicePixelRatio || 1, 3);
    R.w = r.width;
    R.h = r.height;
    R.canvas.width = Math.round(r.width * R.dpr);
    R.canvas.height = Math.round(r.height * R.dpr);
    R.ppy = r.width < 520 ? 9 : 11;
    drawRuler();
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawRuler() {
    const R = ruler;
    if (!R.ctx || !R.w) return;
    const { ctx, w, h, ppy, colors: C } = R;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const uc = uOf(R.center);
    const xOfU = (u) => cx + (u - uc) * ppy;
    const xOf = (p) => xOfU(uOf(p));
    const lFrom = Math.max(LIN_MIN, Math.floor(pOf(uc - cx / ppy)) - 1);
    const lTo = Math.min(LIN_MAX, Math.ceil(pOf(uc + cx / ppy)) + 1);
    const nowLin = linOf(state.year);

    // 기원전 | 기원후 경계
    const xEra = xOf(0.5);
    if (xEra > 0 && xEra < w) {
      ctx.save();
      ctx.strokeStyle = C.faint;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(Math.round(xEra) + 0.5, 0); ctx.lineTo(Math.round(xEra) + 0.5, h); ctx.stroke();
      ctx.restore();
    }

    // 눈금과 연도 글자
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let l = lFrom; l <= lTo; l++) {
      const y = yearOfLin(l);
      if (isDense(y)) {
        // 월 단위로 펼친 해: 금빛 바탕 + 1~12월 눈금
        const xa = xOf(l - 0.5);
        const xb = xOf(l + 0.5);
        if (xb < 0 || xa > w) continue;
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.band;
        ctx.fillRect(xa, 0, xb - xa, h);
        ctx.strokeStyle = C.ink;
        ctx.globalAlpha = 0.7;
        [xa, xb].forEach((x) => { ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, 15); ctx.stroke(); });
        const mw = (xb - xa) / 12;
        for (let m = 1; m < 12; m++) {
          const x = Math.round(xa + m * mw) + 0.5;
          ctx.strokeStyle = C.faint;
          ctx.globalAlpha = 0.6;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 6); ctx.stroke();
        }
        // 연도 이름 (펼친 해의 왼쪽 위)
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.fillStyle = C.ink;
        ctx.font = `700 11px ${R.font}`;
        const ylab = `${fmtShort(y)}${isLunarYear(y) ? ' 음력' : ''}`;
        const lx = Math.min(Math.max(xa + 4, RULER_FADE - 4), xb - ctx.measureText(ylab).width - 4);
        ctx.fillText(ylab, lx, 26);
        // 달 이름
        ctx.textAlign = 'center';
        ctx.font = `500 10px ${R.font}`;
        // 칸이 좁으면 1·4·7·10월만, 아주 좁으면 숫자 없이 눈금만
        const mStep = mw >= 15 ? 1 : mw >= 7 ? 3 : 0;
        for (let m = 0; mStep && m < 12; m += mStep) {
          const x = xa + (m + 0.5) * mw;
          ctx.fillStyle = C.muted;
          ctx.fillText(`${m + 1}`, x, 15);
        }
        continue;
      }
      const x = Math.round(xOf(l)) + 0.5;
      const cent = y % 100 === 0;
      const dec = y % 10 === 0 || y === 1;
      const five = y % 5 === 0;
      const len = cent ? 15 : dec ? 12 : five ? 8 : 5;
      ctx.strokeStyle = dec ? C.ink : C.faint;
      ctx.globalAlpha = dec ? 0.7 : five ? 0.7 : 0.45;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, len); ctx.stroke();
      if (dec) {
        const near = Math.abs(l - nowLin) < 5;
        ctx.globalAlpha = 1;
        ctx.fillStyle = cent || near ? C.ink : C.muted;
        ctx.font = `${cent ? 600 : 500} 11px ${R.font}`;
        ctx.fillText(fmtShort(y), x, 26);
      }
    }
    ctx.globalAlpha = 1;

    // 전쟁 막대 (위: 한국사, 아래: 세계사). 같은 묶음은 한 막대로, 차수마다 진하게
    // 줄 배치는 지금 보이는 막대끼리만 (위: 한국사, 아래: 세계사) → 줄이 적어 막대가 두껍게 보여요
    const visG = R.groups.filter((g) => {
      if (state.mode === 'korea' && g.region !== 'korea') return false;
      g.x0 = xOf(linOf(g.f) - 0.5);
      g.x1 = xOf(linOf(g.t) + 0.5);
      return g.x1 >= -2 && g.x0 <= w + 2;
    });
    let rows = 0;
    ['korea', 'world'].forEach((region) => {
      const ends = [];
      visG.filter((g) => (g.region === 'korea') === (region === 'korea')).sort((a, b) => a.f - b.f).forEach((g) => {
        let k = ends.findIndex((e) => e < g.f);
        if (k < 0) { k = ends.length; ends.push(g.t); } else ends[k] = g.t;
        g.row = rows + k;
      });
      rows += ends.length;
    });
    rows = Math.max(1, rows);
    // 막대 이름(10px)이 잘리지 않게 줄 높이는 13px로 고정하고, 줄이 2개보다 많으면 자를 그만큼 높여요
    const laneH = RULER_LANE_H;
    const wantH = RULER_LANE_TOP + Math.max(2, Math.min(rows, 4)) * (laneH + RULER_LANE_GAP) + 1;
    if (state.layers.wars && Math.abs(wantH - R.h) > 0.5 && R.el.dataset.h !== String(wantH)) {
      R.el.dataset.h = String(wantH);
      R.el.style.height = `${wantH}px`; // ResizeObserver 가 다시 그려요
    }
    R.bars = [];
    if (state.layers.wars) {
      visG.forEach((g) => {
        const gx0 = g.x0;
        const gx1 = g.x1;
        const top = RULER_LANE_TOP + g.row * (laneH + RULER_LANE_GAP);
        const color = g.region === 'korea' ? C.ko : C.world;
        const active = g.f <= state.year && g.t >= state.year;
        if (g.members.length > 1) { // 묶음 전체 (차수 사이 빈 기간은 옅게)
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = color;
          roundRect(ctx, gx0 + 0.5, top + laneH * 0.3, Math.max(3, gx1 - gx0 - 1), laneH * 0.4, 2);
          ctx.fill();
        }
        g.members.forEach((i) => {
          const W = wars.wars[i];
          const x0 = xOf(linOf(W.f) - 0.5);
          const x1 = xOf(linOf(W.t) + 0.5);
          const on = W.f <= state.year && W.t >= state.year;
          const bw = Math.max(3, x1 - x0 - 1);
          ctx.globalAlpha = on ? 1 : 0.75;
          ctx.fillStyle = color;
          roundRect(ctx, x0 + 0.5, top, bw, laneH, 3);
          ctx.fill();
          // 전투가 있었던 때: 막대 아래쪽 작은 눈금 (펼친 해에서는 달 위치에)
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = on ? 0.95 : 0.75;
          const seen = new Set();
          W.battles.forEach((b) => {
            const monthly = isDense(b.y) && /\d+월/.test(b.date);
            const p = monthly ? linOf(b.y) - 0.5 + dnFrac(b.dn, b.y) : linOf(b.y);
            const bx = Math.round(xOf(p));
            if (seen.has(bx) || bx < x0 || bx > x1) return;
            seen.add(bx);
            ctx.fillRect(bx - 1, top + laneH - 3, 2, 3);
          });
          if (state.war === i) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = C.gold;
            ctx.lineWidth = 2;
            roundRect(ctx, x0 + 0.5, top, bw, laneH, 3);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
          R.bars.push({ i, g, x0, x1, top, bottom: top + laneH });
        });
        // 이름: 막대가 화면 밖으로 나가도 보이는 부분 안에 붙어 있게.
        // 진한 막대 위는 흰 글자, 옅은 바탕(차수 사이 빈 기간) 위는 진한 글자로 그려서 어디서나 읽히게 해요
        const vx0 = Math.max(gx0, RULER_FADE - 6);
        const vx1 = Math.min(gx1, w - RULER_FADE + 6);
        if (vx1 - vx0 > 30) {
          const top = RULER_LANE_TOP + g.row * (laneH + RULER_LANE_GAP);
          let label = g.name;
          if (active && g.members.length > 1) {
            const cur = g.members.find((i) => wars.wars[i].f <= state.year && wars.wars[i].t >= state.year);
            if (cur != null) label = shortWarName(wars.wars[cur]);
          }
          ctx.save();
          ctx.font = `600 10px ${R.font}`;
          ctx.textAlign = 'left';
          const text = fitLabel(ctx, label, vx1 - vx0 - 10);
          const tx = vx0 + 5;
          const ty = top + laneH - 3.5;
          ctx.beginPath(); ctx.rect(vx0, top, vx1 - vx0 - 3, laneH); ctx.clip();
          ctx.globalAlpha = 1;
          ctx.fillStyle = C.ink;
          ctx.fillText(text, tx, ty);
          // 진한 막대 부분만 다시 흰 글자로
          ctx.beginPath();
          R.bars.filter((b) => b.g === g).forEach((b) => ctx.rect(b.x0 + 0.5, top, Math.max(3, b.x1 - b.x0 - 1), laneH));
          ctx.clip();
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 2;
          ctx.fillText(text, tx, ty);
          ctx.restore();
        }
      });
    }
    ctx.globalAlpha = 1;
    updateRulerJumps();
    updateRulerWindow();
  }
  // 자리가 모자라면 '임진왜란·정유재란' → '임진왜란', 그래도 안 되면 '…'로 줄임
  function fitLabel(ctx, text, avail) {
    const fits = (t) => ctx.measureText(t).width <= avail;
    if (fits(text)) return text;
    const first = text.split('·')[0];
    if (first !== text && /[가-힣]{2,}/.test(first) && fits(first)) return first;
    for (let n = text.length - 1; n >= 2; n--) {
      const t = `${text.slice(0, n).trimEnd()}…`;
      if (fits(t)) return t;
    }
    return '';
  }
  // 자에 보이는 범위 (lin)
  function rulerVisible(margin = 0) {
    const R = ruler;
    const uc = uOf(R.center);
    const half = (R.w / 2 - margin) / R.ppy;
    return [pOf(uc - half), pOf(uc + half)];
  }
  // 근처에 전쟁 막대가 없으면 양 끝에 가장 가까운 전쟁으로 가는 버튼
  function updateRulerJumps() {
    const R = ruler;
    let prev = null;
    let next = null;
    if (state.layers.wars && R.w) {
      const [visL, visR] = rulerVisible(RULER_FADE);
      wars.wars.forEach((W, i) => {
        if (state.mode === 'korea' && W.region !== 'korea') return;
        if (linOf(W.t) + 0.5 < visL && (prev == null || W.t > wars.wars[prev].t)) prev = i;
        if (linOf(W.f) - 0.5 > visR && (next == null || W.f < wars.wars[next].f)) next = i;
      });
      // 자에 전쟁 막대가 하나라도 보이면 바로가기 단추는 숨겨요 (막대를 가리지 않게)
      if (R.bars.some((b) => b.x1 > RULER_FADE && b.x0 < R.w - RULER_FADE)) { prev = null; next = null; }
    }
    setRulerJump($('ruler-prev'), prev, -1);
    setRulerJump($('ruler-next'), next, 1);
  }
  function setRulerJump(btn, i, dir) {
    const key = i == null ? '' : `${i}`;
    if (btn.dataset.war === key && (i == null) === btn.hidden) return;
    btn.dataset.war = key;
    if (i == null) { btn.hidden = true; return; }
    const W = wars.wars[i];
    const dot = el('span', { class: 'rj-dot', style: `background:var(${W.region === 'korea' ? '--war-ko' : '--war-world'})`, 'aria-hidden': 'true' });
    const parts = [dot, el('span', { class: 'rj-name', text: shortWarName(W) }), el('span', { class: 'rj-year', text: fmtShort(W.f) })];
    const arrow = el('span', { class: 'rj-arrow', text: dir < 0 ? '‹' : '›', 'aria-hidden': 'true' });
    btn.replaceChildren(...(dir < 0 ? [arrow, ...parts] : [...parts, arrow]));
    btn.setAttribute('aria-label', `${dir < 0 ? '앞' : '뒤'}의 가장 가까운 전쟁: ${W.name}, ${fmtYear(W.f)}로 가기`);
    btn.hidden = false;
  }
  // 큰 막대 위에 '지금 연도 자에 보이는 범위'를 금색 테두리로 표시
  let lastWindow = '';
  function updateRulerWindow() {
    const R = ruler;
    const box = $('ruler-window');
    const tl = box.parentElement;
    const tw = tl.clientWidth - 22;
    if (!R.w || tw <= 0) return;
    const [pl, pr] = rulerVisible(0);
    const yl = yearOfLin(clampLin(pl));
    const yr = yearOfLin(clampLin(pr));
    const left = 11 + yearToPos(yl) * tw;
    const width = (yearToPos(yr) - yearToPos(yl)) * tw;
    const key = `${left.toFixed(1)}|${width.toFixed(1)}`;
    if (key === lastWindow) return;
    lastWindow = key;
    box.style.left = `${left}px`;
    box.style.width = `${width}px`;
    box.style.opacity = width < 26 ? '0' : '1';
  }
  function updateWarMarks() {
    const box = $('war-marks');
    if (!box) return;
    box.hidden = !state.layers.wars;
    [...box.children].forEach((m) => {
      const W = wars.wars[Number(m.dataset.i)];
      m.classList.toggle('is-on', W.f <= state.year && W.t >= state.year);
    });
  }

  function stopRulerAnim() {
    cancelAnimationFrame(ruler.raf);
    ruler.raf = 0;
    ruler.mode = null;
  }
  // 자의 위치 → (연도, 달). 펼친 해가 아니면 달은 null
  function rulerYearMonth(p) {
    p = clampLin(p);
    const l = Math.round(p);
    const y = yearOfLin(l);
    if (!isDense(y)) return { y, m: null };
    const m = Math.max(1, Math.min(12, Math.floor((p - (l - 0.5)) * 12) + 1));
    return { y, m };
  }
  let rulerCommitPending = false;
  function commitRuler() {
    if (rulerCommitPending) return;
    rulerCommitPending = true;
    requestAnimationFrame(() => {
      rulerCommitPending = false;
      const { y, m } = rulerYearMonth(ruler.center);
      if (m != null) {
        if (y !== state.year || state.month !== m) setYear(y, { fromRuler: true, dn: monthCut(y, m), month: m });
      } else if (y !== state.year || state.dn != null) setYear(y, { fromRuler: true });
    });
  }
  // 손을 떼면 가장 가까운 해(펼친 해에서는 달)의 가운데에 붙음
  function snapLin(p) {
    p = clampLin(p);
    const l = Math.round(p);
    const y = yearOfLin(l);
    if (!isDense(y)) return l;
    const m = Math.max(0, Math.min(11, Math.floor((p - (l - 0.5)) * 12)));
    return l - 0.5 + (m + 0.5) / 12;
  }
  function rulerTweenTo(target, dur, commit) {
    const R = ruler;
    stopRulerAnim();
    target = clampLin(target);
    if (prefersReducedMotion || dur <= 0) {
      R.center = target;
      drawRuler();
      if (commit) commitRuler();
      return;
    }
    const from = uOf(R.center);
    const to = uOf(target);
    const t0 = performance.now();
    R.mode = 'tween';
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      R.center = p >= 1 ? target : pOf(from + (to - from) * e);
      drawRuler();
      if (commit) commitRuler();
      if (p < 1) R.raf = requestAnimationFrame(step);
      else { R.raf = 0; R.mode = null; }
    };
    R.raf = requestAnimationFrame(step);
  }
  function rulerSettle() { rulerTweenTo(snapLin(ruler.center), 150, true); }
  function rulerCoast(v) { // v: u/ms
    const R = ruler;
    stopRulerAnim();
    R.mode = 'coast';
    R.vel = v;
    R.last = performance.now();
    let u = uOf(R.center);
    const step = (now) => {
      const dt = Math.min(48, now - R.last);
      R.last = now;
      u += R.vel * dt;
      R.vel *= Math.exp(-dt / 330);
      R.center = pOf(u);
      let stop = false;
      if (R.center <= LIN_MIN || R.center >= LIN_MAX) { R.center = clampLin(R.center); stop = true; }
      drawRuler();
      commitRuler();
      if (stop || Math.abs(R.vel * R.ppy) < 0.04) { R.raf = 0; R.mode = null; rulerSettle(); return; }
      R.raf = requestAnimationFrame(step);
    };
    R.raf = requestAnimationFrame(step);
  }
  // 날짜까지 정해져 있으면(전투 순서 보기·월 단위) 그해 안에서 날짜만큼 바늘을 옮김
  function rulerTarget() {
    const base = linOf(state.year);
    if (state.month != null && isDense(state.year)) return base - 0.5 + (state.month - 0.5) / 12;
    if (state.dn == null) return base;
    return base - 0.5 + dnFrac(state.dn, state.year);
  }
  // 연도가 다른 곳(버튼, 재생, 큰 막대)에서 바뀌면 자가 따라감
  function rulerFollow() {
    const R = ruler;
    if (!R.el || R.drag || R.mode === 'coast' || campaign.playing) { drawRuler(); return; }
    const target = rulerTarget();
    const du = Math.abs(uOf(target) - uOf(R.center));
    if (du < 0.001) { stopRulerAnim(); drawRuler(); return; }
    if (du > 90) { stopRulerAnim(); R.center = target; drawRuler(); return; }
    rulerTweenTo(target, 170, false);
  }
  function rulerDown(e) {
    if ((e.button != null && e.button > 0) || e.target.closest('.ruler-jump')) return;
    const R = ruler;
    stopRulerAnim();
    try { R.el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    R.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, u0: uOf(R.center), moved: false, samples: [[e.timeStamp, e.clientX]] };
    R.el.classList.add('is-dragging');
  }
  function rulerMove(e) {
    const R = ruler;
    const d = R.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 4) return;
      d.moved = true;
      d.x0 = e.clientX; // 문턱만큼 튀지 않게
      d.u0 = uOf(R.center);
      stopPlay();
      stopCampaign();
      hideRulerHint();
    }
    R.center = clampLin(pOf(d.u0 - (e.clientX - d.x0) / R.ppy));
    d.samples.push([e.timeStamp, e.clientX]);
    while (d.samples.length > 2 && e.timeStamp - d.samples[0][0] > 120) d.samples.shift();
    drawRuler();
    commitRuler();
  }
  function rulerUp(e) {
    const R = ruler;
    const d = R.drag;
    if (!d || e.pointerId !== d.id) return;
    R.drag = null;
    R.el.classList.remove('is-dragging');
    if (!d.moved) {
      if (e.type === 'pointerup') rulerTap(e);
      else rulerSettle();
      return;
    }
    const recent = d.samples.filter(([t]) => e.timeStamp - t < 100);
    let v = 0;
    if (recent.length >= 2) {
      const [t0, x0] = recent[0];
      const [t1, x1] = recent[recent.length - 1];
      if (t1 > t0) v = (x1 - x0) / (t1 - t0); // px/ms
    }
    if (Math.abs(v) > 0.35 && !prefersReducedMotion) rulerCoast(-v / R.ppy);
    else rulerSettle();
  }
  function rulerTap(e) {
    const R = ruler;
    const rect = R.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const yy = e.clientY - rect.top;
    const p = snapLin(pOf(uOf(R.center) + (x - R.w / 2) / R.ppy));
    hideRulerHint();
    if (yy >= RULER_LANE_TOP - 6) {
      const hits = R.bars.filter((b) => x >= b.x0 - 8 && x <= b.x1 + 8);
      if (hits.length) {
        // 누른 곳과 가장 가까운 막대 (같은 줄이면 누른 해를 품은 차수)
        const dist = (b) => Math.abs((b.top + b.bottom) / 2 - yy) * 4 + (x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0);
        const bar = hits.reduce((m, b) => (dist(b) < dist(m) ? b : m), hits[0]);
        const W = wars.wars[bar.i];
        const y = Math.max(W.f, Math.min(W.t, yearOfLin(Math.round(p))));
        stopPlay();
        stopCampaign(false);
        setYear(y);
        openWar(bar.i, { fit: true });
        return;
      }
    }
    stopPlay();
    stopCampaign();
    rulerTweenTo(p, 220, true);
  }
  function rulerWheel(e) {
    const R = ruler;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? d * 16 : e.deltaMode === 2 ? d * R.w : d;
    stopRulerAnim();
    stopPlay();
    stopCampaign();
    hideRulerHint();
    R.center = clampLin(pOf(uOf(R.center) + px / R.ppy));
    drawRuler();
    commitRuler();
    clearTimeout(R.wheelTimer);
    R.wheelTimer = setTimeout(rulerSettle, 160);
  }

  // 큰 막대를 손으로 끌 때 전쟁 근처에 가면 그 전쟁 연도에 붙기
  function snapToWar(p) {
    const tw = $('slider').getBoundingClientRect().width - 22;
    if (!state.layers.wars || tw <= 0) return null;
    const radius = (window.matchMedia('(pointer: coarse)').matches ? 5 : 3) / tw;
    let best = null;
    for (const W of wars.wars) {
      if (state.mode === 'korea' && W.region !== 'korea') continue;
      const a = yearToPos(W.f);
      const b = yearToPos(W.t);
      if (p >= a - 0.5 / tw && p <= b + 0.5 / tw) return null; // 이미 전쟁 기간 안
      const dist = p < a ? a - p : p - b;
      if (dist <= radius && (!best || dist < best.dist)) best = { dist, y: p < a ? W.f : W.t };
    }
    return best ? best.y : null;
  }

  // ---------------------------------------------------------------- 도크 (시간 막대)
  function setupDock() {
    const slider = $('slider');
    let sliderPointer = false;
    let lastSnap = null;
    slider.addEventListener('pointerdown', () => { sliderPointer = true; lastSnap = null; hideRulerHint(); });
    const release = () => { sliderPointer = false; };
    slider.addEventListener('pointerup', release);
    slider.addEventListener('pointercancel', release);
    slider.addEventListener('change', release);
    slider.addEventListener('input', () => {
      stopPlay();
      stopCampaign();
      const p = slider.value / 10000;
      const snap = sliderPointer ? snapToWar(p) : null;
      if (snap != null) {
        slider.value = String(Math.round(yearToPos(snap) * 10000));
        if (snap !== lastSnap && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* 무시 */ } }
        lastSnap = snap;
        if (snap !== state.year) setYear(snap, { fromSlider: true });
        return;
      }
      lastSnap = null;
      setYear(posToYear(p), { fromSlider: true });
    });

    document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      stopPlay();
      setYear(addYears(state.year, parseInt(b.dataset.step, 10)));
    }));
    bind('play-btn', 'click', () => (state.playing ? stopPlay() : startPlay()));
    bind('speed-btn', 'click', () => {
      state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];
      renderSpeed();
      savePrefs();
    });
    renderSpeed();

    // 연도 직접 입력
    const btn = $('year-btn');
    const input = $('year-input');
    btn.addEventListener('click', () => {
      stopPlay();
      btn.hidden = true;
      input.hidden = false;
      input.value = state.year < 0 ? `기원전 ${-state.year}` : String(state.year);
      input.focus();
      input.select();
    });
    const finish = (commit) => {
      if (input.hidden) return;
      if (commit) {
        const y = parseYear(input.value);
        if (y != null) setYear(y);
      }
      input.hidden = true;
      btn.hidden = false;
    };
    input.addEventListener('keydown', (e) => {
      // preventDefault: 같은 Enter 가 연도 버튼을 다시 눌러 입력창이 또 열리는 것 막기
      if (e.key === 'Enter') { e.preventDefault(); finish(true); btn.focus(); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); btn.focus(); }
    });
    input.addEventListener('blur', () => finish(true));

    // 눈금
    const ticks = $('ticks');
    TICKS.forEach((t) => ticks.append(el('span', { class: `tick${t.minor ? ' is-minor' : ''}`, style: `left:${yearToPos(t.y) * 100}%`, text: t.label })));
    // 기원전/기원후 구간 표시
    const bands = $('era-bands');
    bands.append(el('div', { class: 'era-band', style: `left:0;width:${yearToPos(1) * 100}%;background:rgba(46,78,143,0.12)` }));
    // 전쟁이 있었던 때를 큰 막대 위에 색으로 표시
    const marks = $('war-marks');
    wars.wars.forEach((W, i) => {
      const a = yearToPos(W.f);
      const b = yearToPos(W.t);
      marks.append(el('div', {
        class: `war-mark${W.region === 'korea' ? '' : ' is-world'}`,
        'data-i': String(i),
        style: `left:calc(${a * 100}% - 1px);width:calc(${(b - a) * 100}% + 2px)`,
        title: `${W.name} (${W.period || `${fmtYear(W.f)}~${fmtYear(W.t)}`})`,
      }));
    });
    setupRuler();

    // 보기 도구: 세계 화면은 연표 · 국제 정세 · 세력 흐름 · 시대, 한국사 화면은 교과서 지도 · 제도 · 용어 · 한양 · 붕당 · 연표
    const menu = $('era-menu');
    renderTools();
    let group = null;
    JUMPS.forEach((j) => {
      if (j.group) { group = el('div', { class: 'em-group' }, [el('div', { class: 'em-title', text: j.group })]); menu.append(group); return; }
      group.append(el('button', {
        class: 'em-item',
        onclick: () => { toggleEraMenu(false); stopPlay(); setYear(j.year); move({ center: j.center, zoom: j.zoom }); },
      }, [el('span', { text: j.label }), el('small', { text: fmtYear(j.year) })]));
    });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) toggleEraMenu(false); });

    const ro = new ResizeObserver(() => {
      fitDock();
      document.documentElement.style.setProperty('--dock-h', `${$('dock').offsetHeight}px`);
    });
    ro.observe($('dock'));
    ro.observe($('year-block-wrap') || document.querySelector('.year-block'));
  }

  // 도크 안에 단추가 다 들어가는지 재서 맞춰요 (태블릿에서 정보 창이 열리면 도크가 좁아져요)
  let fitting = false;
  function fitDock() {
    const dock = $('dock');
    const row = dock && dock.querySelector('.dock-row');
    if (!row || fitting) return;
    fitting = true;
    const over = () => row.scrollWidth > row.clientWidth + 1 || [...row.children].some((c) => c.getBoundingClientRect().right > row.getBoundingClientRect().right + 1);
    dock.classList.remove('is-compact', 'is-stacked');
    if (over()) {
      dock.classList.add('is-compact');
      if (over()) dock.classList.add('is-stacked');
    }
    fitting = false;
  }
  // 보기 도구 단추 (세계 / 한국사 화면에 따라 다르게)
  function renderTools() {
    const tools = $('tools');
    const menu = $('era-menu');
    if (!tools || !menu) return;
    const svg = (d) => {
      const ns = 'http://www.w3.org/2000/svg';
      const sv = document.createElementNS(ns, 'svg');
      sv.setAttribute('width', '16'); sv.setAttribute('height', '16'); sv.setAttribute('viewBox', '0 0 24 24');
      sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '2');
      sv.setAttribute('stroke-linecap', 'round'); sv.setAttribute('aria-hidden', 'true');
      d.split('|').forEach((pd) => { const pa = document.createElementNS(ns, 'path'); pa.setAttribute('d', pd); sv.append(pa); });
      return sv;
    };
    const toggle = (mode, open) => () => (state.panelMode === mode ? closePanel() : open());
    const CHRONO = { id: 'chrono', label: '연표', long: '한국사 연표', ico: 'M5 6h14|M5 12h14|M5 18h9', go: () => (state.panelMode === 'chrono' ? closePanel() : openChrono(state.year)) };
    const WORLD = [
      CHRONO,
      { id: 'world', label: '국제', long: '국제 정세', ico: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18|M3.5 9h17|M3.5 15h17|M12 3c-3 3-3 15 0 18|M12 3c3 3 3 15 0 18', go: toggle('world', openWorld) },
      { id: 'factions', label: '세력', long: '세력 흐름', ico: 'M6 3v18|M6 9c0 4 12 2 12 8v4|M18 3v6', go: () => openFactions() },
      { id: 'era', label: '시대', long: '시대 바로가기', ico: 'M7 3h10v18l-5-4-5 4z', go: (e) => { e.stopPropagation(); toggleEraMenu(); } },
    ];
    const KOREA = [
      { id: 'themes', label: '지도', long: '교과서 지도', ico: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z|M9 3v15|M15 6v15', go: () => (state.panelMode === 'themes' || state.panelMode === 'theme' ? closePanel() : openThemes()) },
      { id: 'inst', label: '제도', long: '통치 체제', ico: 'M9 3h6v5H9z|M12 8v4|M5 12h14|M5 12v4|M19 12v4|M12 12v4|M3 16h4v5H3z|M10 16h4v5h-4z|M17 16h4v5h-4z', go: toggle('inst', () => openInst(null)) },
      { id: 'terms', label: '용어', long: '용어 사전', ico: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z|M18 7h2v13|M8 9h6|M8 13h6', go: () => (state.panelMode === 'terms' || state.panelMode === 'term' ? closePanel() : openTerms()) },
      { id: 'hanyang', label: '한양', long: '한양 도성', ico: 'M3 21h18|M5 21V10l7-5 7 5v11|M10 21v-5h4v5', go: toggle('hanyang', () => openHanyang()) },
      { id: 'bung', label: '붕당', long: '붕당 지도', ico: 'M12 3v6|M12 9l-6 5v7|M12 9l6 5v7|M6 14h0|M18 14h0', go: toggle('bungdang', () => openBungdang()) },
      CHRONO,
    ];
    tools.querySelectorAll('.tool').forEach((b) => b.remove());
    toggleEraMenu(false);
    (state.mode === 'korea' ? KOREA : WORLD).forEach((t, k) => tools.insertBefore(el('button', {
      class: 'tool tool-in', style: `animation-delay:${k * 35}ms`, 'data-tool': t.id, onclick: t.go, title: t.long, 'aria-label': t.long,
      ...(t.id === 'era' ? { 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'era-menu' } : {}),
    }, [svg(t.ico), el('span', { class: 'tool-label', text: t.label }), el('span', { class: 'tool-long', text: t.id === 'era' ? '시대' : t.long })]), menu));
    syncTools();
    fitDock();
  }

  let playTimer = 0;
  function playStep(y) {
    if (y >= 1800) return 1;
    if (y >= 1000) return 2;
    if (y >= 0) return 5;
    return 10;
  }
  const SPEEDS = [0.5, 1, 2, 4];
  const spd = (ms) => ms / (state.speed || 1);
  function renderSpeed() {
    const b = $('speed-btn');
    if (!b) return;
    b.textContent = `${state.speed}×`;
    b.setAttribute('aria-label', `재생 속도 ${state.speed}배 (누르면 바꿔요)`);
  }
  function startPlay() {
    if (state.year >= YEAR_MAX) setYear(YEAR_MIN);
    state.playing = true;
    $('play-btn').setAttribute('aria-label', '멈춤');
    $('play-icon').innerHTML = '<rect x="7" y="5" width="3.6" height="14" rx="1"/><rect x="13.4" y="5" width="3.6" height="14" rx="1"/>';
    const dwell = async (ms) => { await sleep(spd(ms)); return state.playing; };
    const tick = async () => {
      if (!state.playing) return;
      const next = nextPlayYear(state.year);
      const dated = datedByYear.get(next) || [];
      const want = dated.filter((it) => (it.kind === 'b' ? state.layers.wars : state.layers.events));
      if (isDense(next) && want.length) {
        // 일이 많은 해: 한 달씩 넘기며 그 달의 일을 보여 줌
        for (let m = 1; m <= 12; m++) {
          const n = itemsInMonth(next, m).filter((it) => want.includes(it)).length;
          await setYear(next, { dn: monthCut(next, m), month: m });
          if (!(await dwell(n ? 700 + n * 420 : 260))) return;
        }
      } else if (want.length) {
        // 날짜가 있는 일이 몇 개 있는 해: 날짜 순서대로 하나씩
        for (const dn of [...new Set(want.map((it) => it.dn))]) {
          await setYear(next, { dn });
          if (!(await dwell(PLAY_BATTLE_MS))) return;
        }
      }
      await setYear(next);
      if (next >= YEAR_MAX) { stopPlay(); return; }
      const evYear = state.layers.events && eventsInYear(next).length;
      playTimer = setTimeout(tick, spd(want.length ? 500 : evYear ? 420 : 160));
    };
    playTimer = setTimeout(tick, 60);
  }
  const PLAY_BATTLE_MS = 850;
  const sleep = (ms) => new Promise((r) => { playTimer = setTimeout(r, ms); });
  let playYears = null;
  // 몇 년씩 건너뛰며 재생할 때도 전투·사건이 있던 해는 건너뛰지 않음
  function nextPlayYear(y) {
    const cand = addYears(y, playStep(y));
    if (!playYears) {
      const set = new Set();
      wars.wars.forEach((W) => W.battles.forEach((b) => set.add(b.y)));
      events.forEach((ev) => { if (!ev.nomap) set.add(ev.y); });
      playYears = [...set].sort((a, b) => a - b);
    }
    const hit = playYears.find((b) => b > y && b < cand);
    return hit != null ? hit : cand;
  }
  function stopPlay() {
    if (!state.playing) return;
    state.playing = false;
    clearTimeout(playTimer);
    $('play-btn').setAttribute('aria-label', '재생');
    $('play-icon').innerHTML = '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>';
  }

  // ---------------------------------------------------------------- 주소(공유 링크)
  let hashTimer = 0;
  function scheduleHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(writeHash, 400);
  }
  function writeHash() {
    if (!map) return;
    const c = map.getCenter();
    const parts = [`y=${state.year}`, `c=${c.lng.toFixed(2)},${c.lat.toFixed(2)}`, `z=${map.getZoom().toFixed(2)}`];
    if (state.selected != null) parts.push(`p=${encodeURIComponent(index.polities[state.selected].n)}`);
    if (state.war != null) parts.push(`w=${encodeURIComponent(wars.wars[state.war].id)}`);
    if (state.event != null) parts.push(`e=${encodeURIComponent(events[state.event].id)}`);
    koreaHash(parts);
    const h = `#${parts.join('&')}`;
    try { history.replaceState(null, '', h); } catch (e) { /* 미리보기 등에서는 무시 */ }
    try { localStorage.setItem('hm:last', h); } catch (e) { /* 저장소를 못 쓰면 무시 */ }
  }
  function readHash() {
    let h = location.hash;
    if (!h || h.length < 3) {
      try { h = localStorage.getItem('hm:last') || ''; } catch (e) { h = ''; }
    }
    const out = {};
    h.replace(/^#/, '').split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      if (!v) return;
      if (k === 'y') out.year = parseInt(v, 10);
      if (k === 'z') out.zoom = parseFloat(v);
      if (k === 'c') { const [x, y] = v.split(',').map(Number); if (Number.isFinite(x) && Number.isFinite(y)) out.center = [x, y]; }
      if (k === 'p') out.polity = decodeURIComponent(v);
      if (k === 'w') out.war = decodeURIComponent(v);
      if (k === 'e') out.event = decodeURIComponent(v);
      if (k === 'm') out.mode = v;
      if (k === 'th') out.theme = decodeURIComponent(v);
      if (k === 'v') out.view = decodeURIComponent(v);
    });
    return out;
  }

  // ---------------------------------------------------------------- 설정 저장
  function loadPrefs() {
    try {
      const s = JSON.parse(localStorage.getItem('hm:layers') || 'null');
      if (s) Object.assign(state.layers, s);
      const sp = Number(localStorage.getItem('hm:speed'));
      if (SPEEDS.includes(sp)) state.speed = sp;
      const cs = Number(localStorage.getItem('hm:cpspeed'));
      if (CP_SPEEDS.includes(cs)) campaign.speed = cs;
      const cf = localStorage.getItem('hm:card');
      cardFolded = cf == null ? window.innerWidth <= 760 : cf === '1';
      // 국제 관계선은 기본으로 꺼 두고 '국제 정세'를 열 때만 보여요 (예전에 저장된 설정도 한 번 끔)
      if (!localStorage.getItem('hm:relsoff')) { state.layers.rels = false; localStorage.setItem('hm:relsoff', '1'); }
    } catch (e) { /* 무시 */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem('hm:layers', JSON.stringify(state.layers));
      localStorage.setItem('hm:speed', String(state.speed));
      localStorage.setItem('hm:cpspeed', String(campaign.speed));
    } catch (e) { /* 무시 */ }
  }
  function setupLayersPopover() {
    const btn = $('layers-btn');
    const pop = $('layers-pop');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    pop.querySelectorAll('input[data-layer]').forEach((inp) => {
      inp.checked = !!state.layers[inp.dataset.layer];
      inp.addEventListener('change', () => {
        state.layers[inp.dataset.layer] = inp.checked;
        applyLayerToggles();
        savePrefs();
      });
    });
  }
  function setupAbout() {
    const modal = $('about');
    const card = modal.querySelector('.modal-card');
    card.setAttribute('tabindex', '-1');
    const open = () => { modal.hidden = false; card.scrollTop = 0; card.focus({ preventScroll: true }); };
    const close = () => { modal.hidden = true; $('about-btn').focus(); };
    bind('about-btn', 'click', open);
    bind('about-close', 'click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }

  // ---------------------------------------------------------------- 지도 이벤트
  function setupMapEvents() {
    const tip = $('tip');
    let hoverId = null;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const clearHover = () => {
      if (hoverId != null) map.setFeatureState({ source: 'polities', id: hoverId }, { hover: false });
      hoverId = null;
      tip.hidden = true;
      map.getCanvas().style.cursor = '';
    };
    if (canHover) {
      map.on('mousemove', 'polity-fill', (e) => {
        const f = smallest(state.mode === 'korea' ? e.features.filter((x) => KOREAN_POLITIES.has(index.polities[x.properties.p].n)) : e.features);
        if (!f) { clearHover(); return; }
        if (hoverId !== f.id) {
          if (hoverId != null) map.setFeatureState({ source: 'polities', id: hoverId }, { hover: false });
          hoverId = f.id;
          map.setFeatureState({ source: 'polities', id: hoverId }, { hover: true });
        }
        map.getCanvas().style.cursor = 'pointer';
        const P = index.polities[f.properties.p];
        tip.replaceChildren(P.ko, el('small', { text: `${fmtShort(P.f)}~${fmtShort(P.t)}` }));
        tip.style.left = `${e.originalEvent.clientX}px`;
        tip.style.top = `${e.originalEvent.clientY}px`;
        tip.hidden = false;
      });
      map.on('mouseleave', 'polity-fill', clearHover);
      map.on('mousemove', 'battles', (e) => {
        const pr = e.features[0].properties;
        const sub = pr.auto === 1 ? `${fmtYear(pr.y)}, 자동 수집` : wars.wars[pr.w].battles[pr.b].date;
        tip.replaceChildren(pr.n, el('small', { text: sub }));
        tip.style.left = `${e.originalEvent.clientX}px`;
        tip.style.top = `${e.originalEvent.clientY}px`;
        tip.hidden = false;
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'battles', () => { tip.hidden = true; map.getCanvas().style.cursor = ''; });
      const showTip = (e, title, sub) => {
        tip.replaceChildren(title, el('small', { text: sub }));
        tip.style.left = `${e.originalEvent.clientX}px`;
        tip.style.top = `${e.originalEvent.clientY}px`;
        tip.hidden = false;
        map.getCanvas().style.cursor = 'pointer';
      };
      const hideTip = () => { tip.hidden = true; map.getCanvas().style.cursor = ''; };
      map.on('mousemove', 'event-icons', (e) => {
        const ev = events[e.features[0].properties.k];
        showTip(e, ev.n, `${ev.c} · ${dateWithoutYear(ev.date).replace(/\s*\(양력.*\)$/, '')}`);
      });
      map.on('mouseleave', 'event-icons', hideTip);
      ['rel-line-solid', 'rel-line-dash', 'rel-line-dot'].forEach((id) => {
        map.on('mousemove', id, (e) => {
          const r = relData.rels[e.features[0].properties.i];
          showTip(e, r.n, REL_TYPES[r.type].label);
        });
        map.on('mouseleave', id, hideTip);
      });
      map.on('movestart', () => { tip.hidden = true; });
    }
    map.on('click', (e) => {
      const near = [[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]];
      const isl = map.getLayer('islands-dot') ? map.queryRenderedFeatures(near, { layers: ['islands-dot'] }) : [];
      if (isl.length) { openIsland(isl[0].properties.n); return; }
      if (koreaClick(e)) return;
      // 전투(점)와 사건(마름모) 가운데 누른 곳에 더 가까운 것
      const cand = [];
      if (warLayerOn()) map.queryRenderedFeatures(near, { layers: ['battles'] }).forEach((f) => cand.push({ f, kind: 'b' }));
      if (evLayerOn()) map.queryRenderedFeatures(near, { layers: ['event-icons'] }).forEach((f) => cand.push({ f, kind: 'e' }));
      if (cand.length) {
        const dist = ({ f }) => { const p = map.project(f.geometry.coordinates); return Math.hypot(p.x - e.point.x, p.y - e.point.y) - (f.properties.imp || f.properties.i || 1); };
        const best = cand.reduce((m, c) => (dist(c) < dist(m) ? c : m), cand[0]);
        const pr = best.f.properties;
        if (best.kind === 'e') openEvent(pr.k, { fly: false });
        else if (pr.auto === 1) openAutoBattle(pr.b); else openBattle(pr.w, pr.b);
        return;
      }
      if (relsShown()) {
        const nearR = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];
        const rl = map.queryRenderedFeatures(nearR, { layers: ['rel-line-solid', 'rel-line-dash', 'rel-line-dot'] });
        if (rl.length) { openRelation(rl[0].properties.i, { fit: false }); return; }
      }
      const feats = map.queryRenderedFeatures(e.point, { layers: ['polity-fill'] });
      // 한국사 화면에서는 한국 나라만 누를 수 있어요
      const f = smallest(state.mode === 'korea' ? feats.filter((x) => KOREAN_POLITIES.has(index.polities[x.properties.p].n)) : feats);
      if (f) openPolity(f.properties.p);
      else if (['polity', 'island', 'battle', 'war', 'event', 'rel', 'term'].includes(state.panelMode)) closePanel();
    });
    map.on('moveend', () => { scheduleOnscreen(); scheduleHash(); renderNotice(); });
    map.on('idle', () => { if (needOnscreen) { needOnscreen = false; updateOnscreen(); } });
    map.on('sourcedata', (e) => { if (e.sourceId === 'polities' && e.isSourceLoaded) scheduleOnscreen(); });
    window.__focus = focus;
  }
  function smallest(feats) {
    if (!feats || !feats.length) return null;
    return feats.reduce((m, f) => (f.properties.a < m.properties.a ? f : m), feats[0]);
  }

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!$('about').hidden || !$('factions').hidden) return;
      if (tour.active && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Escape')) {
        if (t && t.tagName === 'BUTTON' && e.key === ' ') return;
        if (e.key === 'Escape') endTour();
        else if (e.key === ' ') tourSetPlaying(!tour.playing);
        else { tourSetPlaying(false); tourGo(tour.i + (e.key === 'ArrowLeft' ? -1 : 1)); }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (t && t.id === 'slider') return; // 슬라이더 자체 동작 사용
        stopPlay();
        setYear(addYears(state.year, (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1)));
        e.preventDefault();
      } else if (e.key === ' ') {
        if (t && t.tagName === 'BUTTON') return;
        state.playing ? stopPlay() : startPlay();
        e.preventDefault();
      } else if (e.key === '/') {
        $('search-input').focus();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        if (!$('panel').hidden) closePanel();
      }
    });
  }

  // ---------------------------------------------------------------- 글꼴 미리 불러오기
  async function preloadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const chars = new Set();
    index.polities.forEach((P) => { for (const ch of P.ko) chars.add(ch); });
    SEAS.forEach(([n]) => { for (const ch of n) chars.add(ch); });
    ISLANDS.forEach(([n]) => { for (const ch of n) chars.add(ch); });
    const text = [...chars].join('');
    const timeout = new Promise((r) => setTimeout(r, 5000));
    await Promise.race([
      Promise.all([
        document.fonts.load('400 24px "IBM Plex Sans KR"', text),
        document.fonts.load('400 24px "Nanum Myeongjo"', SEAS.map((s) => s[0]).join('')),
        document.fonts.load('800 42px "Nanum Myeongjo"', '0123456789기원전년'),
      ]).catch(() => {}),
      timeout,
    ]);
  }

  // ---------------------------------------------------------------- 시작
  async function init() {
    loadPrefs();
    try {
      const [idx, base] = await Promise.all([loadJSON('index.json'), loadJSON('base.json')]);
      index = idx;
      index.byName = new Map(index.polities.map((P, i) => [P.n, i]));
      const [w, ev, rl, fc, ru, rv] = await Promise.all([
        loadJSON('wars.json').catch((e) => { console.warn('전쟁 데이터 없음', e); return null; }),
        loadJSON('events.json').catch((e) => { console.warn('사건 데이터 없음', e); return null; }),
        loadJSON('relations.json').catch((e) => { console.warn('국제 관계 데이터 없음', e); return null; }),
        loadJSON('factions.json').catch((e) => { console.warn('세력 흐름 데이터 없음', e); return null; }),
        loadJSON('rulers.json').catch((e) => { console.warn('왕 목록 데이터 없음', e); return null; }),
        loadJSON('rivers_ko.json').catch((e) => { console.warn('한반도 강 데이터 없음', e); return null; }),
      ]);
      if (w) wars = w;
      if (ev) events = ev;
      if (rl) relData = rl;
      if (fc) factionEras = fc;
      if (ru) rulerData = ru;
      if (rv) koreaRivers = rv;
      buildDated();
      $('loading-text').textContent = '글꼴과 국경을 불러오고 있어요';
      await preloadFonts();

      const fromHash = readHash();
      if (Number.isFinite(fromHash.year)) state.year = fixZero(clampYear(fromHash.year), 1);

      map = new maplibregl.Map({
        container: 'map',
        style: buildStyle(base),
        center: fromHash.center || START_VIEW.center,
        zoom: Number.isFinite(fromHash.zoom) ? fromHash.zoom : START_VIEW.zoom,
        minZoom: 0.8,
        maxZoom: fromHash.mode === 'k' || fromHash.view || fromHash.theme ? 16 : 9, // 한국사 화면(한양 도성)은 더 크게
        renderWorldCopies: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        fadeDuration: 150,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: '<a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noopener">Cliopatria</a> (CC BY 4.0), <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>',
      }), 'bottom-left');

      setupDock();
      setupSearch();
      setupLayersPopover();
      setupAbout();
      setupKeyboard();
      setupTour();
      setupFactions();
      document.querySelectorAll('#mode-switch button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
      bind('panel-close', 'click', closePanel);
      bind('panel-back', 'click', goBack);
      syncModeSwitch();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { syncModeSwitch(); fitDock(); });
      window.addEventListener('resize', () => { syncModeSwitch(); fitDock(); });
      bind('year-event', 'click', () => openChrono(state.year));
      bind('notice-more', 'click', openNoticePanel);
      renderYear();

      map.on('styleimagemissing', (e) => { if (e.id === 'chev') addChevron(); if (e.id === 'evt') addDiamond(); });
      map.on('load', async () => {
        addChevron();
        addDiamond();
        addKoreaLayers();
        setupCampaign();
        applyLayerToggles();
        setupMapEvents();
        await setYear(state.year);
        if (fromHash.polity && index.byName.has(fromHash.polity)) openPolity(index.byName.get(fromHash.polity));
        const wi = fromHash.war ? wars.wars.findIndex((W) => W.id === fromHash.war || (W.aka || []).includes(fromHash.war)) : -1;
        if (wi >= 0) openWar(wi);
        const ek = fromHash.event ? events.findIndex((x) => x.id === fromHash.event) : -1;
        if (ek >= 0 && wi < 0) openEvent(ek, { fly: false });
        $('loading').classList.add('is-done');
        await koreaFromHash(fromHash);
        // 용어 검색이 되도록 한국사 자료를 뒤에서 불러 둬요
        loadKorea().then(() => { if (state.mode === 'korea') { syncKorea(true); renderYearCard(); } }).catch(() => {});
      });
      map.on('error', (e) => console.warn('지도 오류', e && e.error));
    } catch (err) {
      console.error(err);
      $('loading-text').textContent = '지도를 불러오지 못했어요';
      const box = $('loading-error');
      box.hidden = false;
      box.textContent = `${err.message || err} 새로고침해 보고, 계속 안 되면 다른 브라우저로 열어 주세요.`;
    }
  }

  // 앱처럼 쓰기(PWA): 깃허브 페이지처럼 실제 서버에서 열었을 때만 서비스 워커 등록
  if ('serviceWorker' in navigator && !window.__EMBED__ && /^https?:$/.test(location.protocol) && location.hostname !== 'localhost') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  init();
})();
