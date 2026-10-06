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

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- 상태
  const state = {
    year: START_YEAR,
    chunkId: -1,
    selected: null,      // 선택한 나라 번호 (index.polities 의 위치)
    panelMode: null,     // 'polity' | 'notices'
    playing: false,
    layers: { labels: true, groups: true, water: true, seas: true },
  };
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
    const obj = topo.objects[key];
    return obj ? topojson.feature(topo, obj) : { type: 'FeatureCollection', features: [] };
  }
  function chunkForYear(y) {
    return index.chunks.find((c) => y >= c.from && y <= c.to) || index.chunks[index.chunks.length - 1];
  }
  async function getChunk(c) {
    if (chunkCache.has(c.id)) return chunkCache.get(c.id);
    const topo = await loadJSON(c.file);
    const data = { polities: topoToGeo(topo, 'polities'), labels: topoToGeo(topo, 'labels') };
    chunkCache.set(c.id, data);
    if (chunkCache.size > 5) chunkCache.delete(chunkCache.keys().next().value);
    return data;
  }
  function prefetchAround(c) {
    const i = index.chunks.indexOf(c);
    [index.chunks[i - 1], index.chunks[i + 1]].forEach((n) => { if (n) getChunk(n).catch(() => {}); });
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
        polities: { type: 'geojson', data: empty, promoteId: 'i' },
        labels: { type: 'geojson', data: empty },
        seas: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: SEAS.map(([n, x, y, r]) => ({ type: 'Feature', properties: { n, r }, geometry: { type: 'Point', coordinates: [x, y] } })) },
        },
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
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.9],
          },
        },
        { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': '#22394f' } },
        {
          id: 'rivers', type: 'line', source: 'rivers',
          paint: { 'line-color': '#2b4a68', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 1.2, 9, 2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 5, 0.75] },
        },
        {
          id: 'polity-line', type: 'line', source: 'polities', filter: yearFilter(START_YEAR, ['==', ['get', 'g'], 0]),
          paint: { 'line-color': '#1e2a36', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 5, 0.9, 8, 1.4] },
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
            'text-field': ['get', 'k'], 'text-font': labelFont,
            'text-size': ['interpolate', ['linear'], ['zoom'],
              1, ['interpolate', ['linear'], ['get', 'a'], 0, 9, 300000, 11, 3000000, 14, 15000000, 16],
              4, ['interpolate', ['linear'], ['get', 'a'], 0, 11, 300000, 14, 3000000, 18],
              7, ['interpolate', ['linear'], ['get', 'a'], 0, 13, 300000, 18]],
            'text-max-width': 7, 'text-padding': 3,
            'symbol-sort-key': ['-', 0, ['get', 'a']],
          },
          paint: { 'text-color': '#15212c', 'text-halo-color': 'rgba(246,244,236,0.92)', 'text-halo-width': 1.5, 'text-halo-blur': 0.3 },
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

  function applyYearFilters() {
    const y = state.year;
    const sel = state.selected ?? -1;
    map.setFilter('polity-fill', yearFilter(y, ['==', ['get', 'g'], 0]));
    map.setFilter('polity-line', yearFilter(y, ['==', ['get', 'g'], 0]));
    map.setFilter('hover-line', yearFilter(y, ['==', ['get', 'g'], 0]));
    map.setFilter('group-line', yearFilter(y, ['==', ['get', 'g'], 1]));
    map.setFilter('select-line', yearFilter(y, ['==', ['get', 'p'], sel]));
    map.setFilter('select-glow', yearFilter(y, ['==', ['get', 'p'], sel]));
    map.setFilter('labels', yearFilter(y, ['==', ['get', 'g'], 0]));
    map.setFilter('group-labels', yearFilter(y, ['==', ['get', 'g'], 1]));
  }
  function applyLayerToggles() {
    const vis = (on) => (on ? 'visible' : 'none');
    map.setLayoutProperty('labels', 'visibility', vis(state.layers.labels));
    map.setLayoutProperty('group-labels', 'visibility', vis(state.layers.labels && state.layers.groups));
    map.setLayoutProperty('group-line', 'visibility', vis(state.layers.groups));
    map.setLayoutProperty('rivers', 'visibility', vis(state.layers.water));
    map.setLayoutProperty('lakes', 'visibility', vis(state.layers.water));
    map.setLayoutProperty('sea-labels', 'visibility', vis(state.layers.seas));
  }

  // ---------------------------------------------------------------- 연도 바꾸기
  async function setYear(y, opts = {}) {
    y = fixZero(clampYear(Math.round(y)), 1);
    state.year = y;
    renderYear(opts.fromSlider);
    const token = ++yearToken;
    const c = chunkForYear(y);
    if (c.id !== state.chunkId) {
      const data = await getChunk(c);
      if (token !== yearToken) return;
      state.chunkId = c.id;
      chunkFeatures = data.polities.features;
      map.getSource('polities').setData(data.polities);
      map.getSource('labels').setData(data.labels);
      prefetchAround(c);
    }
    if (token !== yearToken) return;
    applyYearFilters();
    renderNotice();
    if (state.panelMode === 'polity') renderPanel();
    if (state.panelMode === 'notices') renderNoticePanel();
    scheduleOnscreen();
    scheduleHash();
  }

  function renderYear(fromSlider) {
    const { era, num } = yearParts(state.year);
    $('year-era').textContent = era;
    $('year-num').textContent = num;
    $('year-btn').setAttribute('aria-label', `${fmtYear(state.year)}, 눌러서 연도 직접 입력`);
    const slider = $('slider');
    const pos = yearToPos(state.year);
    if (!fromSlider) slider.value = String(Math.round(pos * 10000));
    slider.setAttribute('aria-valuetext', fmtYear(state.year));
    slider.style.setProperty('--fill', `${pos * 100}%`);
  }

  // ---------------------------------------------------------------- 화면 속 나라
  let needOnscreen = false;
  function scheduleOnscreen() { needOnscreen = true; if (map) map.triggerRepaint(); }
  function updateOnscreen() {
    if (!map) return;
    // 화면을 격자로 찍어서 실제로 많이 보이는 나라 순서로 고름
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight - $('dock').offsetHeight;
    const counts = new Map();
    const cols = 12;
    const rows = 7;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const pt = [((i + 0.5) / cols) * w, ((j + 0.5) / rows) * h];
        const f = smallest(map.queryRenderedFeatures(pt, { layers: ['polity-fill'] }));
        if (f) counts.set(f.properties.p, (counts.get(f.properties.p) || 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => index.polities[p].ko);
    $('onscreen').textContent = top.length ? `화면 속 나라: ${top.join(', ')}` : '이 시기 이 지역은 기록된 나라가 없어요';
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
    state.selected = p;
    state.panelMode = 'polity';
    applyYearFilters();
    renderPanel();
    $('panel').hidden = false;
    document.body.classList.add('panel-open');
    if (opts.fly) flyToPolity(p);
    scheduleHash();
  }
  function closePanel() {
    state.selected = null;
    state.panelMode = null;
    $('panel').hidden = true;
    document.body.classList.remove('panel-open');
    if (map) applyYearFilters();
    scheduleHash();
  }
  function currentRow(p) {
    let best = null;
    for (const f of chunkFeatures) {
      const pr = f.properties;
      if (pr.p === p && pr.f <= state.year && pr.t >= state.year && (!best || pr.a > best.a)) best = pr;
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
    if (row) status.append(el('strong', { text: fmtYear(state.year) }), '에 지도에 있어요.');
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
  function openIsland(name) {
    const info = ISLAND_INFO[name];
    if (!info) return;
    state.panelMode = 'island';
    state.selected = null;
    applyYearFilters();
    $('panel-title').textContent = name;
    $('panel-sub').textContent = info.en;
    $('panel-body').replaceChildren(el('p', { class: 'note', text: info.text }));
    $('panel').hidden = false;
    document.body.classList.add('panel-open');
  }
  function openNoticePanel() {
    state.panelMode = 'notices';
    state.selected = null;
    applyYearFilters();
    renderNoticePanel();
    $('panel').hidden = false;
    document.body.classList.add('panel-open');
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
    const panelOpen = !$('panel').hidden;
    return {
      top: mobile ? 70 : 80,
      bottom: dockH + (mobile && panelOpen ? Math.min(window.innerHeight * 0.4, 300) : 24),
      left: 20,
      right: !mobile && panelOpen ? 400 : 20,
    };
  }

  // ---------------------------------------------------------------- 검색
  function norm(s) { return String(s).toLowerCase().replace(/[\s()·\-'’]/g, ''); }
  function search(q) {
    const nq = norm(q);
    if (!nq) return [];
    const out = [];
    index.polities.forEach((P, i) => {
      const ko = norm(P.ko);
      const en = norm(P.n);
      let score = -1;
      if (ko === nq || en === nq) score = 3;
      else if (ko.startsWith(nq) || en.startsWith(nq)) score = 2;
      else if (ko.includes(nq) || en.includes(nq)) score = 1;
      if (score >= 0) out.push({ i, score, a: P.a });
    });
    out.sort((x, y) => y.score - x.score || y.a - x.a);
    return out.slice(0, 8).map((r) => r.i);
  }
  function setupSearch() {
    const input = $('search-input');
    const list = $('search-results');
    let items = [];
    let active = -1;
    const render = () => {
      list.replaceChildren();
      input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
      if (!input.value.trim()) return;
      if (!items.length) {
        list.append(el('li', { class: 'results-empty', text: '찾는 나라가 없어요. 다른 이름으로 검색해 보세요.' }));
        return;
      }
      items.forEach((pi, k) => {
        const P = index.polities[pi];
        const li = el('li', { class: 'result', role: 'option', id: `r-${k}`, 'aria-selected': k === active ? 'true' : 'false' }, [
          el('span', { class: 'result-dot', style: `background:${index.palette[P.c % index.palette.length]}` }),
          el('span', {}, [el('span', { class: 'result-name', text: P.ko }), el('span', { class: 'result-en', text: P.ko !== P.n ? P.n.replace(/^\(|\)$/g, '') : '' })]),
          el('span', { class: 'result-years', text: `${fmtShort(P.f)} ~ ${fmtShort(P.t)}` }),
        ]);
        li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(k); });
        list.append(li);
      });
    };
    const pick = (k) => {
      const pi = items[k];
      if (pi == null) return;
      input.value = '';
      items = [];
      render();
      input.blur();
      const P = index.polities[pi];
      setYear(P.y);
      openPolity(pi, { fly: true });
    };
    input.addEventListener('input', () => { items = search(input.value); active = items.length ? 0 : -1; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') { pick(active < 0 ? 0 : active); e.preventDefault(); }
      else if (e.key === 'Escape') { input.value = ''; items = []; render(); input.blur(); }
      if (active >= 0) input.setAttribute('aria-activedescendant', `r-${active}`);
    });
    input.addEventListener('blur', () => setTimeout(() => { items = []; render(); }, 120));
  }

  // ---------------------------------------------------------------- 도크 (시간 막대)
  function setupDock() {
    const slider = $('slider');
    slider.addEventListener('input', () => { stopPlay(); setYear(posToYear(slider.value / 10000), { fromSlider: true }); });

    document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      stopPlay();
      setYear(addYears(state.year, parseInt(b.dataset.step, 10)));
    }));
    $('play-btn').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));

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
      if (e.key === 'Enter') { finish(true); btn.focus(); }
      if (e.key === 'Escape') { finish(false); btn.focus(); }
    });
    input.addEventListener('blur', () => finish(true));

    // 눈금
    const ticks = $('ticks');
    TICKS.forEach((t) => ticks.append(el('span', { class: `tick${t.minor ? ' is-minor' : ''}`, style: `left:${yearToPos(t.y) * 100}%`, text: t.label })));
    // 기원전/기원후 구간 표시
    const bands = $('era-bands');
    bands.append(el('div', { class: 'era-band', style: `left:0;width:${yearToPos(1) * 100}%;background:rgba(46,78,143,0.12)` }));

    // 바로가기
    const jumps = $('jumps');
    JUMPS.forEach((j) => {
      if (j.group) { jumps.append(el('span', { class: 'jump-group', text: j.group })); return; }
      jumps.append(el('button', {
        class: 'jump',
        onclick: () => { stopPlay(); setYear(j.year); move({ center: j.center, zoom: j.zoom }); },
      }, [el('span', { text: j.label }), el('small', { text: fmtYear(j.year) })]));
    });

    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--dock-h', `${$('dock').offsetHeight}px`);
    });
    ro.observe($('dock'));
  }

  let playTimer = 0;
  function playStep(y) {
    if (y >= 1800) return 1;
    if (y >= 1000) return 2;
    if (y >= 0) return 5;
    return 10;
  }
  function startPlay() {
    if (state.year >= YEAR_MAX) setYear(YEAR_MIN);
    state.playing = true;
    $('play-btn').setAttribute('aria-label', '멈춤');
    $('play-icon').innerHTML = '<rect x="7" y="5" width="3.6" height="14" rx="1"/><rect x="13.4" y="5" width="3.6" height="14" rx="1"/>';
    const tick = async () => {
      if (!state.playing) return;
      const next = addYears(state.year, playStep(state.year));
      await setYear(next);
      if (next >= YEAR_MAX) { stopPlay(); return; }
      playTimer = setTimeout(tick, 160);
    };
    playTimer = setTimeout(tick, 60);
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
    });
    return out;
  }

  // ---------------------------------------------------------------- 설정 저장
  function loadPrefs() {
    try {
      const s = JSON.parse(localStorage.getItem('hm:layers') || 'null');
      if (s) Object.assign(state.layers, s);
    } catch (e) { /* 무시 */ }
  }
  function savePrefs() {
    try { localStorage.setItem('hm:layers', JSON.stringify(state.layers)); } catch (e) { /* 무시 */ }
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
    $('about-btn').addEventListener('click', open);
    $('about-close').addEventListener('click', close);
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
        const f = smallest(e.features);
        if (!f) return;
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
      map.on('movestart', () => { tip.hidden = true; });
    }
    map.on('click', (e) => {
      const near = [[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]];
      const isl = map.getLayer('islands-dot') ? map.queryRenderedFeatures(near, { layers: ['islands-dot'] }) : [];
      if (isl.length) { openIsland(isl[0].properties.n); return; }
      const feats = map.queryRenderedFeatures(e.point, { layers: ['polity-fill'] });
      const f = smallest(feats);
      if (f) openPolity(f.properties.p);
      else if (state.panelMode === 'polity' || state.panelMode === 'island') closePanel();
    });
    map.on('moveend', () => { scheduleOnscreen(); scheduleHash(); renderNotice(); });
    map.on('idle', () => { if (needOnscreen) { needOnscreen = false; updateOnscreen(); } });
  }
  function smallest(feats) {
    if (!feats || !feats.length) return null;
    return feats.reduce((m, f) => (f.properties.a < m.properties.a ? f : m), feats[0]);
  }

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!$('about').hidden) return;
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
        maxZoom: 9,
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
      $('panel-close').addEventListener('click', closePanel);
      $('notice-more').addEventListener('click', openNoticePanel);
      renderYear();

      map.on('load', async () => {
        applyLayerToggles();
        setupMapEvents();
        await setYear(state.year);
        if (fromHash.polity && index.byName.has(fromHash.polity)) openPolity(index.byName.get(fromHash.polity));
        $('loading').classList.add('is-done');
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

  init();
})();
