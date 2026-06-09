// 解析 API - 解析视频播放地址
// GET /api/resolve?url=视频地址

import type { APIRoute } from 'astro';
import { isValidVideoUrl } from '../../lib/config';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const videoUrl = url.searchParams.get('url');

  if (!videoUrl) {
    return new Response(JSON.stringify({ success: false, error: '缺少视频地址' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 校验视频地址
  if (!isValidVideoUrl(videoUrl)) {
    return new Response(JSON.stringify({ success: false, error: '无效的视频地址' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 直接返回解析后的地址（可扩展为第三方解析服务）
  return new Response(JSON.stringify({
    success: true,
    data: { url: videoUrl, type: videoUrl.endsWith('.m3u8') ? 'hls' : 'mp4' }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
    },
  });
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
