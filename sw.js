/* 세계 역사 지도 — 오프라인용 서비스 워커
   - 앱 껍데기(HTML·CSS·JS·라이브러리)와 기본 데이터는 설치할 때 미리 저장
   - 시대별 국경 데이터(c00.json …)는 처음 볼 때 저장해서 다음부터는 바로 열림
   - 버전을 올리면 옛 저장분은 지워져요 */
const VERSION = 'hm-v17';
const SHELL = [
  './', 'index.html', 'style.css?v=17', 'app.js?v=17', 'manifest.webmanifest',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css', 'vendor/topojson-client.min.js',
  'data/index.json', 'data/base.json', 'data/wars.json',
  'data/events.json', 'data/relations.json', 'data/factions.json', 'data/rulers.json', 'data/rivers_ko.json', 'data/korea_map.json',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isData = url.pathname.includes('/data/');
  if (isData) {
    // 데이터: 저장된 게 있으면 바로, 없으면 받아서 저장
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // 앱 껍데기: 새 버전을 먼저 시도하고, 안 되면(오프라인) 저장분
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
