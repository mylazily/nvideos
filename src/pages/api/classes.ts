// 分类列表 API - 返回所有资源站的分类
// GET /api/classes

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';
import { isValidApiUrl, parseVideoSources } from '../../lib/config';

export const prerender = false;

const CDN_CACHE_TTL = 604800; // CDN边缘缓存 7天

export const GET: APIRoute = async () => {
  try {
    const rawSources = (env as Env).VIDEO_SOURCES || '';
    const sources = parseVideoSources(rawSources).filter(s => isValidApiUrl(s.api));

    const results = await Promise.allSettled(
      sources.map(async (source) => {
        try {
          const sep = source.api.includes('?') ? '&' : '?';
          const resp = await fetch(`${source.api}${sep}ac=list&pg=1`, {
            signal: AbortSignal.timeout(5000),
          });
          const data = await resp.json();
          const classes = (data.class || []).map((c: any) => ({
            type_id: c.type_id,
            type_name: c.type_name,
            type_pid: c.type_pid,
          }));
          return { sourceName: source.name, sourceKey: source.name.match(/^\d+/)?.[0] || source.name, classes };
        } catch {
          return { sourceName: source.name, sourceKey: source.name.match(/^\d+/)?.[0] || source.name, classes: [] };
        }
      })
    );

    const data = results
      .map(r => r.status === 'fulfilled' ? r.value : { sourceName: '', sourceKey: '', classes: [] })
      .filter(r => r.sourceName);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=3600, s-maxage=${CDN_CACHE_TTL}, stale-while-revalidate=86400`,
        'CDN-Cache-Control': `public, max-age=${CDN_CACHE_TTL}`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
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
