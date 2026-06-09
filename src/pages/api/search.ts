// 搜索 API - CDN边缘缓存 + 代理请求到苹果CMS V10 API
// GET /api/search?wd=关键词&api=API地址&page=页码
// GET /api/search?typeId=类型ID&api=API地址&page=页码

import type { APIRoute } from 'astro';
import { isValidApiUrl } from '../../lib/config';

export const GET: APIRoute = async (context) => {
  const { url, request } = context;
  const wd = url.searchParams.get('wd');
  const apiUrl = url.searchParams.get('api');
  const page = url.searchParams.get('page') || '1';
  const typeId = url.searchParams.get('typeId');
  const ids = url.searchParams.get('ids');

  if (!apiUrl) {
    return new Response(JSON.stringify({ success: false, error: '缺少API地址' }), {
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
    let targetUrl: string;

    if (typeId) {
      targetUrl = `${apiUrl}${separator}ac=videolist&t=${encodeURIComponent(typeId)}&pg=${page}`;
    } else if (wd) {
      targetUrl = `${apiUrl}${separator}ac=videolist&wd=${encodeURIComponent(wd)}&pg=${page}`;
    } else {
      targetUrl = `${apiUrl}${separator}ac=videolist&pg=${page}`;
    }

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Referer': new URL(apiUrl).origin + '/',
      },
      signal: AbortSignal.timeout(15000),
    });

    const text = await resp.text();

    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    // 裁剪响应字段，减少传输体积
    if (data && data.list && Array.isArray(data.list)) {
      data.list = data.list.map((video: any) => ({
        vod_id: video.vod_id,
        vod_name: video.vod_name,
        vod_pic: video.vod_pic,
        vod_remarks: video.vod_remarks,
        type_name: video.type_name,
        vod_time: video.vod_time,
      }));
    }

    let cacheControl: string;
    let cdnCacheControl: string;
    if (ids) {
      cacheControl = 'public, max-age=60, s-maxage=2592000, stale-while-revalidate=2592000'; // 30天
      cdnCacheControl = 'public, max-age=2592000';
    } else if (typeId) {
      cacheControl = 'public, max-age=60, s-maxage=31536000, stale-while-revalidate=31536000'; // 1年
      cdnCacheControl = 'public, max-age=31536000';
    } else {
      cacheControl = 'public, max-age=60, s-maxage=432000, stale-while-revalidate=604800'; // 5天
      cdnCacheControl = 'public, max-age=432000';
    }

    const response = new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': cdnCacheControl,
        'Vary': 'Accept-Encoding',
      },
    });

    return response;
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: `搜索失败: ${err instanceof Error ? err.message : '未知错误'}`,
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
