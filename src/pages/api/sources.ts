// 公开 API - 获取所有 API 源列表（CDN边缘缓存）

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';
import { isValidApiUrl, parseVideoSources } from '../../lib/config';

export const prerender = false;

const CDN_CACHE_TTL = 2592000; // CDN边缘缓存 30天

export const GET: APIRoute = async (context) => {
  try {
    const raw = (env as Env).VIDEO_SOURCES || '';
    const sources = parseVideoSources(raw);

    // 过滤掉无效的 API 地址（SSRF 防护）
    const data = sources
      .filter((s) => s.api && isValidApiUrl(s.api))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((s) => ({
        name: s.name,
        key: (s.name.match(/^\d+/)?.[0] || s.name),
        api: s.api
      }));

    const response = new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=300, s-maxage=${CDN_CACHE_TTL}, stale-while-revalidate=86400`,
        'CDN-Cache-Control': `public, max-age=${CDN_CACHE_TTL}`,
        'Vary': 'Accept-Encoding',
      },
    });

    return response;
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
