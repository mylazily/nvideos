import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ url }) => {
  const siteUrl = url.origin;
  return new Response(
    `User-agent: *
Allow: /
Disallow: /api/
Disallow: /guide

Sitemap: ${siteUrl}/sitemap.xml
`,
    {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );
};
