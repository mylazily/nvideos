// 首页视频获取 - 构建时获取数据

import type { Env } from './types';
import { parseVideoSources, seededShuffle, isValidApiUrl } from './config';

// 从多个源站获取首页视频
export async function fetchHomepageVideos(env: Env): Promise<any[]> {
  const rawSources = env.VIDEO_SOURCES || '';
  const sources = parseVideoSources(rawSources).filter(s => isValidApiUrl(s.api));

  if (sources.length === 0) return [];

  // 取前8个源站，每个获取3个视频
  const selectedSources = sources.slice(0, 8);
  const videos: any[] = [];

  const results = await Promise.allSettled(
    selectedSources.map(async (source) => {
      try {
        const sep = source.api.includes('?') ? '&' : '?';
        const resp = await fetch(`${source.api}${sep}ac=videolist&pg=1&limit=3`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, */*',
          },
          signal: AbortSignal.timeout(5000),
        });
        const data = await resp.json();
        if (data.list && Array.isArray(data.list)) {
          return data.list.map((v: any) => ({
            vod_id: v.vod_id,
            vod_name: v.vod_name,
            vod_pic: v.vod_pic,
            vod_remarks: v.vod_remarks || '',
            source_name: source.name,
            source_key: source.name.match(/^\d+/)?.[0] || source.name,
          }));
        }
        return [];
      } catch {
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      videos.push(...result.value);
    }
  }

  // 去重并打乱
  const seen = new Set();
  const unique = videos.filter(v => {
    if (seen.has(v.vod_id)) return false;
    seen.add(v.vod_id);
    return true;
  });

  return seededShuffle(unique, Date.now() % 10000).slice(0, 12);
}
