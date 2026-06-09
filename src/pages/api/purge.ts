// 缓存清除 API - 用于手动刷新缓存
// GET /api/purge?token=xxx

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../../lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const adminToken = (env as Env).ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return new Response(JSON.stringify({ success: false, error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 清除内存缓存
  try {
    // @ts-ignore
    globalThis._homeCache = undefined;
    // @ts-ignore
    globalThis._discoverApiCache = undefined;
  } catch {}

  return new Response(JSON.stringify({ success: true, message: '缓存已清除' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
