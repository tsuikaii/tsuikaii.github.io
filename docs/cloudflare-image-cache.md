# Cloudflare 图片缓存配置

目标域名：`assets.hszhe9.com`

当前状态（2026-08-29）：

- Cache Rule `R2 image assets`：Active
- Edge TTL：30 days
- Browser TTL：Override origin，1 day
- Smart Tiered Cache：Active

代码只生成三组固定转换规格，避免为同一原图创建大量冷缓存键：

- 正文、封面和图库缩略图：`width=800` 或 `width=1200`、`quality=75`、`format=auto`
- 灯箱展示图：`width=2560`、`quality=90`、`format=auto`

## Cache Rule

在 `hszhe9.com` Zone 中进入 **Caching → Cache Rules**，新建规则 `R2 image assets`。

匹配表达式：

```text
(http.host eq "assets.hszhe9.com")
```

设置：

- Cache eligibility：Eligible for cache
- Edge TTL：Ignore cache-control header and use this TTL，30 days
- Browser TTL：Override origin and use this TTL，1 day
- Cache key：保持默认，不添加查询参数或自定义 cache key

这条规则把 R2 原图在边缘缓存中的有效期延长到 30 天。Cloudflare 图片转换会沿用原图的缓存规则，且转换结果至少缓存 1 小时；因此规则应匹配原图所在的整个主机，不能只匹配 `/cdn-cgi/image/`。

不要把 Browser TTL 同样提高到 30 天：原图仍使用固定路径，覆盖文件后，Cloudflare 清除缓存并不能清除访客浏览器里的旧副本。显式设置浏览器 1 天还能确保新生成的图片转换变体返回 `Cache-Control: max-age=86400`；边缘缓存保持 30 天，可以兼顾命中率和更新可控性。

## Tiered Cache

进入 **Caching → Tiered Cache**，启用 **Smart Tiered Cache**。边缘节点未命中时会先向上层缓存查询，减少直接回源 R2 的冷启动。

需要注意：新转换规格在某个边缘节点第一次出现时仍可能发生一次图片处理，无法完全消除首次 MISS。站点代码因此只使用 `800/1200/2560` 三种宽度，并让灯箱先显示已缓存的缩略图，再在后台加载 2560 像素展示图。

## 更新或替换原图

如果覆盖了同一路径的原图，应清除原图 URL，而不是只清除 `/cdn-cgi/image/` 转换 URL。例如：

```text
https://assets.hszhe9.com/siena/siena-3.jpg
```

Cloudflare 会连同该原图的 800、1200 和 2560 像素转换变体一起失效。

## 应用后验证

连续请求两次同一个固定规格：

```bash
curl -sS -D - -o /dev/null \
  -H 'Accept: image/avif,image/webp,image/*,*/*;q=0.8' \
  'https://assets.hszhe9.com/cdn-cgi/image/width=1200,quality=75,format=auto/siena/siena-3.jpg'
```

检查响应头：

- 首次请求允许为 `CF-Cache-Status: MISS`
- 后续请求应为 `CF-Cache-Status: HIT`
- `Age` 应随时间增长
- `Cache-Control` 仍保持浏览器端 1 天，不应变成 30 天

## Cloudflare 参考

- [图片转换缓存行为](https://developers.cloudflare.com/images/reference/troubleshooting/#caching-and-purging)
- [R2 自定义域名缓存与 Smart Tiered Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)
- [Cache Rule 的 Edge TTL 设置](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
