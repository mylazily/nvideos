// 发现页 API - 返回热门搜索、资源站列表、各资源站分类
// GET /api/discover

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';
import { isValidApiUrl, parseVideoSources } from '../../lib/config';

export const prerender = false;

const CDN_CACHE_TTL = 432000; // CDN边缘缓存 5天

export const GET: APIRoute = async (context) => {
  // 2. 内存缓存
  declare global {
    var _discoverApiCache: {
      data: any;
      time: number;
    } | undefined;
  }
  const MEM_CACHE_TTL = 5 * 60 * 1000; // 5分钟
  if (globalThis._discoverApiCache && (Date.now() - globalThis._discoverApiCache.time) < MEM_CACHE_TTL) {
    return new Response(JSON.stringify(globalThis._discoverApiCache.data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=60, s-maxage=${CDN_CACHE_TTL}, stale-while-revalidate=86400`,
        'CDN-Cache-Control': `public, max-age=${CDN_CACHE_TTL}`,
        'X-Cache': 'MEMORY_HIT',
      },
    });
  }

  try {
    // 热门搜索
    let hotSearches: string[] = [];
    try {
      const rawHot = (env as Env).HOT_SEARCHES;
      if (rawHot) {
        hotSearches = rawHot.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch {}

    // 资源站
    let sources: { name: string; key: string; api: string }[] = [];
    try {
      const rawSources = (env as Env).VIDEO_SOURCES || '';
      const parsed = parseVideoSources(rawSources);
      sources = parsed.map((s) => ({
        name: s.name,
        key: s.name.match(/^\d+/)?.[0] || s.name,
        api: s.api,
      }));
    } catch {}

    // 并行获取每个资源站的分类（限制并发数）
    let sourceCategories: any[] = [];
    if (sources.length > 0) {
      // 过滤掉无效的 API 地址（SSRF 防护）
      const validSources = sources.filter(s => s.api && isValidApiUrl(s.api));
      const CONCURRENCY = 5; // 最大并发数
      const categoryResults: PromiseSettledResult<any>[] = [];

      for (let i = 0; i < validSources.length; i += CONCURRENCY) {
        const batch = validSources.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async (source) => {
            if (!source.api) return { sourceName: source.name, sourceKey: source.key, categories: [], error: true };
            try {
              const sep = source.api.includes('?') ? '&' : '?';
              const resp = await fetch(`${source.api}${sep}ac=videolist&pg=1&limit=30`, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/json, */*',
                },
                signal: AbortSignal.timeout(5000),
              });
              const data = await resp.json();
              const typeMap = new Map<string, string>();
              data.list?.forEach((v: any) => {
                if (v.type_name && v.type_id && !typeMap.has(v.type_name)) {
                  typeMap.set(v.type_name, String(v.type_id));
                }
              });
              // 补充更多页
              if (typeMap.size < 10) {
                for (let p = 2; p <= 5; p++) {
                  try {
                    const extra = await fetch(`${source.api}${sep}ac=videolist&pg=${p}&limit=30`, {
                      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                      signal: AbortSignal.timeout(3000),
                    });
                    const extraData = await extra.json();
                    extraData.list?.forEach((v: any) => {
                      if (v.type_name && v.type_id && !typeMap.has(v.type_name)) {
                        typeMap.set(v.type_name, String(v.type_id));
                      }
                    });
                  } catch {}
                }
              }
              const categories = Array.from(typeMap.entries()).map(([name, id]) => ({ name, id }));
              return { sourceName: source.name, sourceKey: source.key, categories, error: false };
            } catch {
              return { sourceName: source.name, sourceKey: source.key, categories: [], error: true };
            }
          })
        );
        categoryResults.push(...batchResults);
      }

      sourceCategories = categoryResults
        .map(r => r.status === 'fulfilled' ? r.value : { sourceName: '', sourceKey: '', categories: [], error: true })
        .filter(r => r.sourceName);
    }

    const result = {
      success: true,
      data: { hotSearches, sources, sourceCategories },
    };

    // 写入内存缓存
    globalThis._discoverApiCache = { data: result, time: Date.now() };

    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=60, s-maxage=${CDN_CACHE_TTL}, stale-while-revalidate=86400`,
        'CDN-Cache-Control': `public, max-age=${CDN_CACHE_TTL}`,
        'Vary': 'Accept-Encoding',
        'X-Cache': 'MISS',
      },
    });

    return response;
  } catch {
    return new Response(JSON.stringify({ success: false, error: '加载失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
