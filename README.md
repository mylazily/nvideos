# NVideos

高性能视频聚合搜索播放平台 - Cloudflare Pages 优化版

## 核心优化

### 1. 静态页面生成 (SSG)
- 首页 `/` - 构建时静态生成
- 发现页 `/discover` - 构建时静态生成
- 个人中心 `/profile` - 构建时静态生成（纯客户端数据）
- 分类页 `/category` - 构建时静态生成（骨架屏 + CSR）

### 2. Cloudflare Cache Rules 强制缓存
通过 `_headers` 文件配置多层缓存策略：
- 静态资源：1年 immutable
- 首页 HTML：CDN 6小时
- 发现页 HTML：CDN 30天
- 分类页 HTML：CDN 5天
- 搜索页 HTML：CDN 5天
- 详情页 HTML：CDN 6小时
- API 响应：按类型分层缓存（1小时 ~ 1年）

### 3. Service Worker 离线缓存
- 图片：Cache First，最大300张
- API：Stale While Revalidate
- 页面导航：Stale While Revalidate + 离线回退
- 多域名故障转移

### 4. SEO 增强
- 完整的 Schema.org 结构化数据
- 预渲染确保爬虫获取完整 HTML
- Sitemap + RSS
- Open Graph + Twitter Card
- Canonical URL + 分页处理

## 技术栈

- Astro 7.0
- Cloudflare Pages (SSR/SSG)
- Tailwind CSS v4
- TypeScript
- Service Worker (PWA)

## 部署

```bash
npm install
npm run build
# 使用 Wrangler 部署到 Cloudflare Pages
npx wrangler pages deploy dist
```

## 缓存规则配置

在 Cloudflare Dashboard 中配置 Cache Rules（免费版10条）：

1. API 首页缓存：`/api/home` → 边缘缓存6小时
2. API 发现页缓存：`/api/discover` → 边缘缓存5天
3. API 详情缓存：`/api/detail` → 边缘缓存1年
4. API 搜索分类缓存：`/api/search?typeId=*` → 边缘缓存1年
5. API 源列表缓存：`/api/sources` → 边缘缓存30天
