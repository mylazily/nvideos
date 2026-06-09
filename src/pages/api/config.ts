// 站点配置 API - 返回前端需要的配置
// GET /api/config

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';
import { parseVideoSources } from '../../lib/config';

export const prerender = false;

const CDN_CACHE_TTL = 86400; // CDN边缘缓存 1天

export const GET: APIRoute = async () => {
  try {
    const rawSources = (env as Env).VIDEO_SOURCES || '';
    const rawPool = (env as Env).DOMAIN_POOL || '';
    const siteName = (env as Env).SITE_NAME || 'LVideos';
    const siteUrl = (env as Env).SITE_URL || 'https://lvideos.pages.dev';

    const sources = parseVideoSources(rawSources).map(s => ({
      name: s.name,
      key: s.name.match(/^\d+/)?.[0] || s.name,
      api: s.api,
    }));

    // 解析域名池
    const domainPool: Record<string, string[]> = {};
    rawPool.split(',').map(s => s.trim()).filter(Boolean).forEach(entry => {
      const idx = entry.indexOf('|');
      if (idx === -1) return;
      const name = entry.slice(0, idx).trim();
      const domain = entry.slice(idx + 1).trim();
      if (!domainPool[name]) domainPool[name] = [];
      domainPool[name].push(domain);
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        siteName,
        siteUrl,
        sources,
        domainPool,
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=300, s-maxage=${CDN_CACHE_TTL}, stale-while-revalidate=86400`,
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
