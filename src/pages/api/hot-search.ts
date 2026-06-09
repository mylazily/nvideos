// 热搜 API - 返回热搜词列表
// GET /api/hot-search

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';

export const prerender = false;

const CDN_CACHE_TTL = 86400; // CDN边缘缓存 1天

export const GET: APIRoute = async () => {
  try {
    const rawHot = (env as Env).HOT_SEARCHES || '';
    const hotSearches = rawHot.split(',').map(s => s.trim()).filter(Boolean);

    return new Response(JSON.stringify({ success: true, data: hotSearches }), {
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
