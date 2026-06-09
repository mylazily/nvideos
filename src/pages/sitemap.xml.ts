import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { Env } from '../lib/types';
import { parseVideoSources } from '../lib/config';

export const prerender = true;

export const GET: APIRoute = async ({ url }) => {
  const siteUrl = url.origin;
  const today = new Date().toISOString().split('T')[0];

  // 静态页面
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/discover', priority: '0.9', changefreq: 'daily' },
    { loc: '/category', priority: '0.8', changefreq: 'daily' },
    { loc: '/search', priority: '0.7', changefreq: 'weekly' },
    { loc: '/profile', priority: '0.5', changefreq: 'monthly' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const page of staticPages) {
    xml += `  <url>\n`;
    xml += `    <loc>${siteUrl}${page.loc}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
