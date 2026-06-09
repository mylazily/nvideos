import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../lib/types';

export const prerender = true;

export const GET: APIRoute = async ({ url }) => {
  const siteUrl = url.origin;
  const siteName = 'LVideos';
  const today = new Date().toISOString();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName} - 免费在线视频</title>
    <link>${siteUrl}</link>
    <description>免费在线视频搜索与播放平台，聚合多源影视资源</description>
    <language>zh-CN</language>
    <lastBuildDate>${today}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <item>
      <title>首页 - 热门视频推荐</title>
      <link>${siteUrl}/</link>
      <guid>${siteUrl}/</guid>
      <pubDate>${today}</pubDate>
    </item>
    <item>
      <title>发现 - 影视分类大全</title>
      <link>${siteUrl}/discover</link>
      <guid>${siteUrl}/discover</guid>
      <pubDate>${today}</pubDate>
    </item>
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
