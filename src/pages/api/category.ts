// 分类页视频列表API - 支持JSON和XML两种格式
import type { APIRoute } from 'astro';
import { isValidApiUrl } from '../../lib/config';

export const prerender = false;

// 解析苹果CMS V10 的播放地址
function parseMacCMSUrl(raw: string, from: string): string {
  if (!raw) return '';
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  const domains: Record<string, string> = {
    'gsm3u8': 'https://api.guangsuapi.com',
    'hnm3u8': 'https://www.hongniuzy2.com',
    'ffm3u8': 'https://cj.ffzyapi.com',
  };
  return (domains[from] || 'https://api.guangsuapi.com') + raw;
}

// 解析分类数据 - 支持JSON和XML
function parseClasses(data: any): Array<{type_id: number; type_name: string; type_pid: number}> {
  // JSON格式: { class: [{type_id, type_pid, type_name}] }
  if (data && Array.isArray(data.class)) {
    return data.class.map((c: any) => ({
      type_id: parseInt(c.type_id) || 0,
      type_name: String(c.type_name || ''),
      type_pid: parseInt(c.type_pid) || 0,
    })).filter((c: any) => c.type_id && c.type_name);
  }
  // XML格式解析
  if (typeof data === 'string') {
    const result: any[] = [];
    const nodeMatches = data.match(/<type[^>]*>([\s\S]*?)<\/type>/g) || [];
    for (const node of nodeMatches) {
      const id = parseInt(node.match(/<type_id>(\d+)<\/type_id>/)?.[1] || '0');
      const name = (node.match(/<type_name><!\[CDATA\[([\s\S]*?)\]\]><\/type_name>/)?.[1] || node.match(/<type_name>([\s\S]*?)<\/type_name>/)?.[1] || '').trim();
      const pid = parseInt(node.match(/<type_pid>(\d+)<\/type_pid>/)?.[1] || '0');
      if (id && name) result.push({ type_id: id, type_name: name, type_pid: pid });
    }
    return result;
  }
  return [];
}

// 解析视频列表 - 支持JSON和XML
function parseList(data: any, from: string): { list: any[]; total: number; page: number; pagecount: number } {
  // JSON格式
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const list = (data.list || []).map((v: any) => ({
      vod_id: parseInt(v.vod_id) || 0,
      vod_name: String(v.vod_name || ''),
      vod_pic: parseMacCMSUrl(String(v.vod_pic || ''), from),
      vod_remarks: String(v.vod_remarks || v.vod_subtitle || ''),
      type_id: parseInt(v.type_id) || 0,
      type_name: String(v.type_name || ''),
    }));
    return {
      list,
      total: parseInt(data.total) || 0,
      page: parseInt(data.page) || 1,
      pagecount: parseInt(data.pagecount) || 1,
    };
  }
  // XML格式
  if (typeof data === 'string') {
    const total = parseInt(data.match(/<total>(\d+)<\/total>/)?.[1] || '0');
    const page = parseInt(data.match(/<page>(\d+)<\/page>/)?.[1] || '1');
    const pagecount = parseInt(data.match(/<pagecount>(\d+)<\/pagecount>/)?.[1] || '1');
    const list: any[] = [];
    const nodeMatches = data.match(/<video>[\s\S]*?<\/video>/g) || [];
    for (const node of nodeMatches) {
      const get = (tag: string) => {
        const cdata = node.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1];
        if (cdata !== undefined) return cdata.trim();
        const plain = node.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1];
        return plain?.trim() || '';
      };
      list.push({
        vod_id: parseInt(get('vod_id')) || 0,
        vod_name: get('vod_name'),
        vod_pic: parseMacCMSUrl(get('vod_pic'), from),
        vod_remarks: get('vod_remarks') || get('vod_subtitle') || '',
        type_id: parseInt(get('type_id')) || 0,
        type_name: get('type_name') || '',
      });
    }
    return { list, total, page, pagecount };
  }
  return { list: [], total: 0, page: 1, pagecount: 1 };
}

export const GET: APIRoute = async ({ url }) => {
  const api = url.searchParams.get('api');
  const typeId = url.searchParams.get('typeId');
  const page = parseInt(url.searchParams.get('page') || '1');
  const mode = url.searchParams.get('mode'); // 'classes' 获取分类, 'list' 获取视频列表

  if (!api) {
    return new Response(JSON.stringify({ success: false, error: 'api required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // SSRF 防护：校验 API URL 安全性
  if (!isValidApiUrl(api)) {
    return new Response(JSON.stringify({ success: false, error: '无效的API地址' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const fromMatch = api.match(/\/from\/([^/]+)\//);
    const from = fromMatch?.[1] || 'gsm3u8';
    const apiBase = api.replace(/\/+$/, '');

    if (mode === 'classes') {
      // 获取全部分类
      const classUrl = `${apiBase}/?ac=list&pg=1`;
      const resp = await fetch(classUrl, { cf: { cacheTtl: 3600, cacheEverything: true } });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      const classes = parseClasses(data);
      return new Response(JSON.stringify({ success: true, data: classes }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800' },
      });
    } else {
      // 获取视频列表（全部或按分类）- 使用 videolist 获取完整数据包括图片
      const listUrl = typeId
        ? `${apiBase}/?ac=videolist&t=${typeId}&pg=${page}`
        : `${apiBase}/?ac=videolist&pg=${page}`;
      const resp = await fetch(listUrl, { cf: { cacheTtl: 300, cacheEverything: true } });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      const result = parseList(data, from);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300, s-maxage=604800, stale-while-revalidate=604800' },
      });
    }
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
