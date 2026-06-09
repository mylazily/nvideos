// 苹果CMS V10 API 相关类型

// API 站点配置
export interface ApiSite {
  name: string;
  api: string;
}

// 导航站点配置
export interface NavSite {
  name: string;
  url: string;
}

// 苹果CMS V10 搜索响应
export interface CmsSearchResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: string;
  total: number;
  list: CmsVideoItem[];
}

// 苹果CMS V10 视频条目
export interface CmsVideoItem {
  vod_id: number;
  vod_name: string;
  vod_sub: string;
  vod_en: string;
  vod_status: number;
  vod_letter: string;
  vod_color: string;
  vod_tags: string;
  vod_class: string;
  vod_pic: string;
  vod_pic_thumb: string;
  vod_pic_slide: string;
  vod_pic_screenshot: string;
  vod_director: string;
  vod_actor: string;
  vod_writer: string;
  vod_behind: string;
  vod_blurb: string;
  vod_remarks: string;
  vod_pubdate: string;
  vod_total: number;
  vod_serial: string;
  vod_tv: string;
  vod_weekday: string;
  vod_area: string;
  vod_lang: string;
  vod_year: string;
  vod_version: string;
  vod_state: string;
  vod_author: string;
  vod_jumpurl: string;
  vod_tpl: string;
  vod_tpl_play: string;
  vod_tpl_down: string;
  type_id: number;
  type_name: string;
  vod_content: string;
  vod_play_from: string;
  vod_play_server: string;
  vod_play_note: string;
  vod_play_url: string;
}

// 播放源（解析后）
export interface PlaySource {
  name: string;
  url: string;
  group: string;
}

// 播放组
export interface PlayGroup {
  from: string;
  sources: PlaySource[];
}

// 搜索结果（前端使用）
export interface SearchResult {
  vod_id: number;
  vod_name: string;
  vod_pic: string;
  vod_remarks: string;
  type_name: string;
  vod_year: string;
  source_key: string;
  source_name: string;
  source_api: string;
  source_detail?: string;
}

// 视频详情（前端使用）
export interface VideoDetail {
  vod_id: number;
  vod_name: string;
  vod_pic: string;
  vod_content: string;
  vod_remarks: string;
  type_name: string;
  vod_year: string;
  vod_area: string;
  vod_director: string;
  vod_actor: string;
  vod_lang: string;
  vod_play_from: string;
  vod_play_url: string;
  play_groups: PlayGroup[];
  source_key: string;
  source_name: string;
  source_api: string;
}

// Cloudflare Pages 环境类型
export interface Env {
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  ADMIN_TOKEN?: string;
  VIDEO_SOURCES?: string;
  HOT_SEARCHES?: string;
  DOMAIN_POOL?: string;
}
