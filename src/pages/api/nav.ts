// 导航 API - 返回导航数据
// GET /api/nav

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';

export const prerender = false;

const CDN_CACHE_TTL = 2592000; // CDN边缘缓存 30天

export const GET: APIRoute = async () => {
  try {
    const rawPool = (env as Env).DOMAIN_POOL || '';
    const sites = rawPool.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
      const idx = entry.indexOf('|');
      if (idx === -1) return null;
      return {
        name: entry.slice(0, idx).trim(),
        url: 'https://' + entry.slice(idx + 1).trim(),
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({ success: true, data: sites }), {
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
