// 视频详情 API - 代理请求到苹果CMS V10 API
// GET /api/detail?id=视频ID&api=API地址

import type { APIRoute } from 'astro';
import { isValidApiUrl } from '../../lib/config';

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id') || url.searchParams.get('ids');
  const apiUrl = url.searchParams.get('api');

  if (!id || !apiUrl) {
    return new Response(JSON.stringify({ success: false, error: '缺少视频ID或API地址' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // SSRF 防护：校验 API URL 安全性
  if (!isValidApiUrl(apiUrl)) {
    return new Response(JSON.stringify({ success: false, error: '无效的API地址' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const separator = apiUrl.includes('?') ? '&' : '?';
    const targetUrl = `${apiUrl}${separator}ac=videolist&ids=${encodeURIComponent(id)}`;

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Referer': new URL(apiUrl).origin + '/',
      },
      signal: AbortSignal.timeout(15000),
      cf: { cacheTtl: 31536000, cacheEverything: true },
    });

    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    // 裁剪响应字段，减少传输体积
    if (data && data.list && data.list.length > 0) {
      const video = data.list[0];
      const trimmed = {
        vod_id: video.vod_id,
        vod_name: video.vod_name,
        vod_pic: video.vod_pic,
        vod_remarks: video.vod_remarks,
        vod_content: (video.vod_content || '').substring(0, 200),
        vod_play_from: video.vod_play_from,
        vod_play_url: video.vod_play_url,
        vod_actor: video.vod_actor,
        vod_director: video.vod_director,
        type_name: video.type_name,
        type_id: video.type_id,
        vod_year: video.vod_year,
        vod_area: video.vod_area,
        vod_tag: video.vod_tag,
        vod_duration: video.vod_duration,
        vod_time: video.vod_time,
      };
      data = { list: [trimmed] };
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 浏览器缓存1天，CDN缓存1年，过期后 stale-while-revalidate 再用1年
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000',
        'CDN-Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: `获取详情失败: ${err instanceof Error ? err.message : '未知错误'}`,
    }), {
      status: 502,
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
