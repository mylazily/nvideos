// Astro 中间件 - 在 SSR 之前拦截 App 内置浏览器请求
// 国内App（微信/QQ/抖音等）打开时直接重定向到 /guide 引导页
// 这在边缘层执行，不会触发 SSR，避免 1019 错误

import { defineMiddleware } from 'astro:middleware';

// App 内置浏览器 UA 匹配模式
const APP_UA_PATTERN = /micromessenger|\bqq\/(?!.*qqbrowser)|bytedance|douyin(?!.*newsarticle)|weibo|alipayclient|dingtalk|baiduboxapp|kuaishou/i;

export const onRequest = defineMiddleware((context, next) => {
  const ua = context.request.headers.get('user-agent') || '';

  // 检测是否为 App 内置浏览器
  if (APP_UA_PATTERN.test(ua)) {
    const url = new URL(context.request.url);

    // 已经在引导页，放行
    if (url.pathname === '/guide') {
      return next();
    }

    // 静态资源放行（引导页需要的图标等）
    if (url.pathname.startsWith('/favicon') ||
        url.pathname.startsWith('/icon-') ||
        url.pathname === '/_astro' ||
        url.pathname.startsWith('/chunks/') ||
        url.pathname === '/sw.js') {
      return next();
    }

    // 重定向到引导页（302 临时重定向）
    const redirectUrl = `/guide?from=${encodeURIComponent(url.pathname + url.search)}`;
    return context.redirect(redirectUrl, 302);
  }

  // 非 App 环境，正常 SSR
  return next();
});
