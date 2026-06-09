// 首页 API - 复用共享模块 + CDN边缘缓存
// GET /api/home

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';
import { fetchHomepageVideos } from '../../lib/home-fetcher';

export const prerender = false;

const CDN_CACHE_TTL = 21600; // CDN边缘缓存 6小时

declare global {
  var _homeCache: { data: any[]; time: number } | undefined;
}

export const GET: APIRoute = async (context) => {
  try {
    const videos = await fetchHomepageVideos(env as Env);

    const response = new Response(JSON.stringify({ success: true, data: videos, cached: false }), {
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
    // 降级：尝试从内存缓存返回
    const fallback = globalThis._homeCache?.data;
    if (fallback?.length) {
      return new Response(JSON.stringify({ success: true, data: fallback, cached: true, stale: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=10',
        },
      });
    }
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
