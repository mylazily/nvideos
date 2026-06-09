// Service Worker - 极致性能缓存策略 v20
// PWA完善：离线回退、预缓存、API缓存优化、极致速度、永不失联、多域名故障转移
const CACHE_NAME = 'nvideos-v20';
const IMAGE_CACHE = 'nvideos-img-v12';
const API_CACHE = 'nvideos-api-v12';
const PRECACHE = 'nvideos-pre-v9';

// 预缓存关键静态资源（安装时缓存）- 只缓存纯静态文件，不缓存SSR页面
const PRECACHE_URLS = [
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// 图片缓存限制
const MAX_IMAGE_CACHE = 300;

// ========== 多域名故障转移配置 ==========
// 从 /api/config 动态获取，支持 wrangler.toml 统一管理
let DOMAIN_POOL = {};
const CONFIG_CACHE_KEY = 'sw-domain-pool';
const domainHealth = new Map();
const DOMAIN_TIMEOUT = 5000;      // 域名探测超时
const DOMAIN_RETRY_AFTER = 60000; // 失败域名60秒后重试

// 加载域名池配置（优先缓存，其次网络）
async function loadDomainPool() {
  try {
    // 1. 尝试从缓存读取
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match('/api/config');
    if (cached) {
      const json = await cached.json();
      if (json.success && json.data && json.data.domainPool) {
        DOMAIN_POOL = json.data.domainPool;
      }
    }
  } catch {}

  try {
    // 2. 网络更新
    const resp = await fetch('/api/config', { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json();
      if (json.success && json.data && json.data.domainPool) {
        DOMAIN_POOL = json.data.domainPool;
        // 缓存配置
        const cache = await caches.open(API_CACHE);
        cache.put('/api/config', resp.clone());
      }
    }
  } catch {}
}

// SW 安装时加载配置
self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS)).catch(() => {}),
      loadDomainPool(),
    ])
  );
  self.skipWaiting();
});

// SW 激活时重新加载配置
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k.startsWith('nvideos-') && ![CACHE_NAME, IMAGE_CACHE, API_CACHE, PRECACHE].includes(k))
            .map(k => caches.delete(k))
        )
      ),
      loadDomainPool(),
    ])
  );
  self.clients.claim();
});

// 通知客户端SW已更新
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ========== 域名健康探测 ==========
async function probeDomain(domain) {
  const now = Date.now();
  const status = domainHealth.get(domain);
  if (status && !status.healthy && (now - status.lastCheck) < DOMAIN_RETRY_AFTER) {
    return false; // 还在冷却期
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOMAIN_TIMEOUT);
    // 探测 /favicon.png 或根路径（轻量级请求）
    const resp = await fetch(`https://${domain}/favicon.png`, {
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);
    domainHealth.set(domain, { healthy: true, lastCheck: now });
    return true;
  } catch {
    domainHealth.set(domain, { healthy: false, lastCheck: now });
    return false;
  }
}

// 获取域名池中的可用域名（优先主域名）
async function getWorkingDomain(originalHost) {
  const pool = DOMAIN_POOL[originalHost];
  if (!pool || pool.length <= 1) return originalHost;

  // 先检查主域名
  if (await probeDomain(pool[0])) return pool[0];

  // 主域名失败，尝试备用
  for (let i = 1; i < pool.length; i++) {
    if (await probeDomain(pool[i])) return pool[i];
  }

  // 全部失败，返回主域名（让请求自然失败，触发缓存回退）
  return pool[0];
}

// 带故障转移的 fetch
async function fetchWithFallback(request, maxRetries = 2) {
  const url = new URL(request.url);
  const pool = DOMAIN_POOL[url.host];

  // 没有配置域名池，直接请求
  if (!pool || pool.length <= 1) {
    return fetch(request);
  }

  let lastError;
  for (let attempt = 0; attempt < Math.min(pool.length, maxRetries + 1); attempt++) {
    const targetDomain = pool[attempt];
    try {
      const newUrl = new URL(request.url);
      newUrl.host = targetDomain;
      const newRequest = new Request(newUrl.toString(), {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrer: request.referrer,
        integrity: request.integrity
      });
      const resp = await fetch(newRequest);
      if (resp.ok || resp.status === 304) {
        domainHealth.set(targetDomain, { healthy: true, lastCheck: Date.now() });
        return resp;
      }
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (err) {
      lastError = err;
      domainHealth.set(targetDomain, { healthy: false, lastCheck: Date.now() });
    }
  }

  throw lastError;
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // 图片 - Cache First（极速）
  if (request.destination === 'image') {
    e.respondWith(imageStrategy(request));
    return;
  }

  // API - Stale While Revalidate + 域名故障转移
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(apiStrategyWithFallback(request));
    return;
  }

  // 页面导航 - Stale While Revalidate
  if (request.mode === 'navigate') {
    e.respondWith(navigateStrategy(request));
    return;
  }

  // 静态资源 - Cache First
  e.respondWith(cacheFirst(request));
});

// 页面导航策略：Stale While Revalidate + 离线回退
async function navigateStrategy(request) {
  const preCache = await caches.open(PRECACHE);
  const mainCache = await caches.open(CACHE_NAME);

  const cached = await mainCache.match(request);
  const preCached = await preCache.match(request);
  const fallback = cached || preCached;

  const fetchPromise = fetch(request).then(resp => {
    if (resp.ok) {
      mainCache.put(request, resp.clone());
    }
    return resp;
  }).catch(() => fallback);

  if (fallback) return fallback;
  try {
    return await fetchPromise;
  } catch {
    const homeFallback = await preCache.match('/');
    if (homeFallback) return homeFallback;
    throw new Error('Offline and no cache available');
  }
}

// Cache First
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch {
    return cached;
  }
}

// Image strategy
async function imageStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const cloned = resp.clone();
      const headers = new Headers(cloned.headers);
      headers.set('Cache-Control', 'public, max-age=31536000');
      const newResp = new Response(cloned.body, { status: cloned.status, statusText: cloned.statusText, headers });
      cache.put(request, newResp);
      evictImageCache(cache);
    }
    return resp;
  } catch {
    return cached;
  }
}

async function evictImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_IMAGE_CACHE) {
    const toDelete = keys.slice(0, keys.length - MAX_IMAGE_CACHE);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

// ========== API策略：Stale While Revalidate + 域名故障转移 ==========
async function apiStrategyWithFallback(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const url = new URL(request.url);

  // 后台更新：带故障转移
  const fetchPromise = fetchWithFallback(request).then(resp => {
    if (resp.ok) {
      const cloned = resp.clone();
      const headers = new Headers(cloned.headers);
      let maxAge = 600;
      if (url.pathname === '/api/home') maxAge = 3600;
      if (url.pathname === '/api/sources') maxAge = 86400;
      if (url.pathname === '/api/search' && url.searchParams.has('typeId')) maxAge = 7200;
      if (url.pathname === '/api/search' && url.searchParams.has('ids')) maxAge = 259200;
      if (url.pathname === '/api/hot-search') maxAge = 86400;
      if (url.pathname === '/api/detail' || url.pathname === '/api/resolve') maxAge = 1209600;
      headers.set('Cache-Control', 'public, max-age=' + maxAge);
      const newResp = new Response(cloned.body, { status: cloned.status, statusText: cloned.statusText, headers });
      cache.put(request, newResp);
    }
    return resp;
  }).catch(() => cached);

  // 极速：有缓存立即返回，无缓存等网络（带故障转移）
  return cached || fetchPromise;
}
