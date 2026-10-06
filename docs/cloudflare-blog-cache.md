# 博客 CDN 与翻译缓存

2026-10-06 已在 `tsuikaii.com` Zone 应用，并验证活动状态。

## 主站 Cache Rule

复用原有主站规则，命名为 `Blog CDN`，避免重复覆盖。

```text
(http.host eq "tsuikaii.com" and http.request.method in {"GET" "HEAD"})
```

- Eligible for cache（包括 HTML、静态资源和翻译原文 JSON）。
- Edge TTL：忽略源站 Cache-Control，2 小时。
- Browser TTL：尊重源站 TTL，GitHub Pages 当前为 600 秒。
- 默认 cache key，保留查询参数。
- Smart Tiered Cache：已启用。

发布后可在 Caching → Configuration → Custom Purge 按 URL 清除首页、分页、
分类、About 和 feed 的旧缓存，**同时包含 `?lang=zh-Hans`、`?lang=zh-Hant`、
`?lang=en`、`?lang=ja` 的地址**。Cloudflare 默认按查询参数分别缓存，
仅清除 `/about/` 不会清除 `/about/?lang=zh-Hans`。
2026-10-06 已确认该参数地址命中旧 About，导致音乐链接缺失，并按完整 URL 清除。
默认中文导航现在删除 `lang` 参数，英日及繁中仍明确携带目标语言。
浏览器缓存不受 Cloudflare 清除影响。

## 翻译缓存

翻译接口是 POST，不能仅依赖主站 GET/HEAD Cache Rule。Worker 使用 Cache API
保存 30 天边缘副本，Durable Object 保存 30 天共享译文，并合并并发的模型调用。
译文按页面、原文哈希、语言、模型和提示词版本隔离，错误不缓存。
原文清单请求带 `?v=<原文哈希>`，避免 CDN 旧清单阻碍新页面的翻译。

成功响应的 `X-Translation-Cache`：

- `MISS`：本次调用模型。
- `HIT`：复用共享缓存或正在生成的译文。
- `EDGE-HIT`：从当前 Cloudflare 节点缓存返回。

客户端保持 `Cache-Control: no-store`。详细配置见 [多语言说明](multilingual.md)。

参考：[Cloudflare Cache Everything](https://developers.cloudflare.com/cache/how-to/cache-rules/examples/cache-everything/)、
[Edge/Browser TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/)、
[POST 缓存](https://developers.cloudflare.com/workers/examples/cache-post-request/)。
