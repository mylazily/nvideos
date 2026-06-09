// 站点配置
import type { ApiSite } from './types';

// API 请求路径模板
export const API_CONFIG = {
  search: '?ac=videolist&wd=',
  detail: '?ac=videolist&ids=',
  page: '&pg=',
  maxPages: 50,
};

// 播放器配置（与详情页HLS配置保持一致）
export const PLAYER_CONFIG = {
  autoplay: true,
  autoNext: true,
  maxBufferLength: 60,
  maxMaxBufferLength: 120,
  maxBufferSize: 60 * 1024 * 1024,
  maxBufferHole: 0.5,
};

// 自定义 API 配置限制
export const CUSTOM_API_CONFIG = {
  maxCount: 20,
  testTimeout: 5000,
};

// 解析苹果CMS V10 的播放地址
export function parsePlayUrl(vod_play_from: string, vod_play_url: string) {
  const groups = [];
  const fromList = vod_play_from.split('$$$');
  const urlList = vod_play_url.split('$$$');

  for (let i = 0; i < fromList.length; i++) {
    const from = fromList[i]?.trim() || `源${i + 1}`;
    const urls = urlList[i] || '';
    const sources = [];

    const episodes = urls.split('#').filter(Boolean);
    for (const ep of episodes) {
      const parts = ep.split('$');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const url = parts.slice(1).join('$').trim();
        if (url) {
          sources.push({ name, url, group: from });
        }
      } else if (parts.length === 1) {
        // 处理裸 URL（没有 $ 分隔符的情况）
        const raw = parts[0].trim();
        if (raw && (raw.startsWith('http') || raw.startsWith('//'))) {
          const url = raw.startsWith('//') ? 'https:' + raw : raw;
          sources.push({ name: '播放', url, group: from });
        }
      }
    }

    if (sources.length > 0) {
      groups.push({ from, sources });
    }
  }

  return groups;
}

// 构建搜索 URL
export function buildSearchUrl(apiBase: string, keyword: string, page?: number): string {
  let url = `${apiBase}${API_CONFIG.search}${encodeURIComponent(keyword)}`;
  if (page && page > 1) {
    url += `${API_CONFIG.page}${page}`;
  }
  return url;
}

// 构建详情 URL
export function buildDetailUrl(apiBase: string, vodId: number): string {
  return `${apiBase}${API_CONFIG.detail}${vodId}`;
}

// HTML 转义
export function escapeHtml(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (c) => map[c] || c);
}

// 截断文本
export function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// SSRF 防护：禁止访问的内网 IP 段（部署在 CF Pages，只需基础防护）
const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

/**
 * 校验 API URL 是否安全（防止 SSRF）
 * 支持 http:// 和 https:// 协议
 * @param url 待校验的 URL
 * @returns 是否安全
 */
export function isValidApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 只允许 http/https 协议
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const hostname = parsed.hostname;
    // 禁止访问内网 IP
    if (BLOCKED_IP_PATTERNS.some((p) => p.test(hostname))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验解析后的播放地址是否合法
 * 支持 http:// 和 https:// 协议
 * @param url 待校验的 URL
 * @returns 是否合法的视频地址
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    // 允许视频相关格式
    const pathname = parsed.pathname.toLowerCase();
    const videoExts = ['.m3u8', '.mp4', '.webm', '.ogg', '.ts', '.flv', '.mkv'];
    return videoExts.some((ext) => pathname.includes(ext));
  } catch {
    return false;
  }
}

// ========== 环境变量解析（逗号分隔格式）==========

/**
 * 解析 VIDEO_SOURCES 环境变量
 * 格式：逗号分隔，每个 "名称|API地址"
 * 例："11线|https://api1.com/...,12线|https://api2.com/..."
 */
export function parseVideoSources(raw: string): Array<{ name: string; api: string }> {
  if (!raw) return [];
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const idx = item.indexOf('|');
      if (idx === -1) return null;
      return {
        name: item.slice(0, idx).trim(),
        api: item.slice(idx + 1).trim(),
      };
    })
    .filter((item): item is { name: string; api: string } => item !== null && item.name !== '' && item.api !== '');
}

// 种子随机打乱数组（确定性shuffle，同种子同结果）
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
