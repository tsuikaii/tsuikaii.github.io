# 博客多语言

博客继续由 Jekyll / GitHub Pages 托管。界面支持简中、繁中、英语和日语；
OpenCC 在浏览器本地执行简繁转换，英日正文由独立 Cloudflare Worker 按需翻译。
DeepSeek 配置为 `https://api.deepseek.com`、`deepseek-flash`，使用非思考模式和 JSON 输出。

地图页的界面可以切换四种语言，内容只做简繁转换，不调用英日翻译；
构建清单和后端都会执行这条规则。

## 本地预览

需要 Node.js 22 或更高版本，以及已有的 Ruby / Bundler 环境。

```bash
npm ci
npm test
```

仅看界面和简繁转换：

```bash
npm run serve
```

访问 Jekyll 显示的本地地址（通常为 `http://127.0.0.1:4000`）。
生产配置中的 `translation_endpoint` 已指向 Cloudflare Worker。
本地验证请使用下面的临时配置和本地 Worker；正式接口只接受正式博客来源。
若临时清空接口地址，选择英日时界面立即切换、正文保留原文，服务提示只在翻译面板内显示。

验证真实 DeepSeek 翻译：

1. 将 `worker/.dev.vars.example` 复制为 `worker/.dev.vars`，把 `LLM_API_KEY` 改为自己的 key。
   本地 key 文件已被 Git 忽略，且整个 `worker` 目录都被 Jekyll 排除。
2. 新建一个临时 Jekyll 配置（建议放在系统临时目录）：

   ```yaml
   translation_endpoint: http://127.0.0.1:8787
   ```

3. 启动 Jekyll，并加载该临时配置：

   ```bash
   bundle exec jekyll serve --host 127.0.0.1 --config _config.yml,/tmp/blog-preview.yml
   ```

4. 在另一个终端启动本地 Worker：

   ```bash
   npm run worker:dev
   ```

5. 打开 `http://127.0.0.1:4000/about/?lang=en` 或一篇文章，观察翻译状态。

Wrangler 会将调用额度和限流计数器保存在被 Git 忽略的 `.wrangler` 目录，缓存译文及计数器会存入其中。
本地配置显式允许回环地址；生产配置不允许 HTTP 源或 HTTP 模型接口。
若切换到日语后马上切回中文，旧请求不会覆盖当前内容；已经到达后端的请求可能继续完成，但不会保存译文。

## 后端构成

`worker/src/core.js` 实现翻译，`worker/src/index.js` 只导出 Worker 入口和 Durable Object 类。
`worker/wrangler.jsonc` 保存非敏感配置。

英语和日语译文按页面路径、原文 SHA256、目标语言、模型配置和提示词版本缓存 30 天。
首次请求调用一次 DeepSeek；后续读者共享同一译文，同页并发请求合并为一次模型调用。
Cloudflare Cache API 保存边缘副本，SQLite Durable Object 保存跨节点共享副本及调用额度。
原文清单请求携带 `?v=<原文哈希>`，避免 CDN 旧清单阻碍新版本翻译。
正文或 About 修改后原文哈希变化，自动生成新译文，不复用旧版本；过期副本定时清理。
模型错误和无效输出不缓存，缓存命中不消耗模型额度。来源及原文清单仍在每次请求时校验。
边缘命中直接返回；进入 Durable Object 的请求仍受每 IP 限流。

客户端响应保持 `Cache-Control: no-store`，前端不保存译文或语言偏好到浏览器存储。
`X-Translation-Cache` 显示 `MISS`、`HIT`（持久缓存或并发复用）或 `EDGE-HIT`。
旧版 `cache:` 数据仍在启动时清除，新缓存使用独立的 `translation:` 前缀。
未提供管理员手工译文编辑入口。

默认限制：

- 每个 IP 每分钟最多 20 次接口请求。
- 全站每日最多预留 50 次模型调用、200,000 个原文字元。
- 每个页面一次模型调用，每次模型输出最多 32,768 tokens。
- 单页面最多 20,000 个原文字元、1,000 个片段；超出时保留原文。
- 模型单次调用超时 60 秒；浏览器等待超时 180 秒。

额度在调用前原子预留，失败尝试也计入额度；额度按 UTC 日切换，即日本时间每天 09:00 重置。
这是调用次数和输入规模的上限，并不是精确的金额限额；可同时在 DeepSeek 账户侧设置预算。
限额可在 Wrangler 配置中调整。CORS 只负责浏览器跨域访问，不能替代限流。

## 内容与格式

Jekyll 的 `_plugins/translations.rb` 会在构建后调用 `scripts/build-translations.mjs`：

- 从每个页面生成带稳定 ID 的文本片段和 `translations/source/<页面路径 SHA256>.json`。
- 在 HTML 内嵌相同内容清单，供前端恢复原文、核对版本和定位片段。
- 页面中同样的文字复用 ID，减少翻译片段数。
- 标题、段落、图注和图片替代文字都参与翻译；选择日语时，中文和英文内容一起翻译。
- 日语标题“在观雾山”固定采用作者指定的“観霧山にて”，同样用于列表、图片标签和浏览器标题。
- 代码、公式、ruby 注音及标注 `translate="no"` / `data-no-translate` 的内容保留原样。
- 复制本地 OpenCC 字典、程序及许可证。读者不用访问第三方 CDN 才能简繁转换。

前端仅用 `textContent` 和文本属性应用译文，模型输出不会作为 HTML 执行。
图片源、链接、段落结构及现有图片放大功能保持原有逻辑。
默认显示简体中文，只有用户点击语言选项或访问明确带 `?lang=` 的网址时才切换语言。
导航栏“关于”后面显示“文/A”翻译图标，点击展开语言面板；加载或错误提示只在面板内显示，成功后无常驻说明。
不保存语言偏好，站内点击导航会携带当前语言。
日期按界面语言显示，同时保留原文的日期。
英日选择后若正文尚未翻译，正文区域标记为原文语言。

模型会收到分段文本及相邻片段，文学表达和段间用词仍需要人工判断；初次访问的等待时间取决于模型。
当前没有独立的英日静态页面及 `hreflang`，主要面向即时阅读体验。

## 正式部署

翻译服务地址：`https://tsuikaii-translations.zhe-cf.workers.dev`。
生产配置的来源为 `https://tsuikaii.com`，DeepSeek key 通过 Cloudflare Secret 配置。

再次部署或迁移账户时：

1. 核对 `SITE_ORIGIN`、`ALLOWED_ORIGINS` 和额度配置。
2. 通过 Wrangler 登录 Cloudflare，并设置服务端 Secret：

   ```bash
   npx wrangler login
   npx wrangler secret put LLM_API_KEY --config worker/wrangler.jsonc
   ```

3. 部署 Worker：`npm run worker:deploy`。
4. 将 `_config.yml` 的 `translation_endpoint` 改为实际 Worker 地址（只填服务根地址，不带 `/translate`），
   并通过原有 GitHub Actions 发布博客，确保 `translations/source` 同时发布。
5. 验证英日首次翻译与重复缓存命中、繁体切回原文，以及地图页零 LLM 调用。

Worker 地址无需使用自定义域名；可先用 Cloudflare 分配的 `workers.dev` 地址。
生产环境不要配置 `ALLOW_LOCAL_SOURCE=true`，也不要将 API key 写入 Wrangler vars、GitHub Pages 或前端代码。

## API key 存放

`worker/.dev.vars` 是本机明文配置，只供本地 Worker 读取。它被 Git 忽略，整个 `worker` 目录也被 Jekyll 排除。
本地文件权限设置为 `600`，只有当前账户可以读写；浏览器发给 Worker 的请求仅含页面路径、原文哈希和目标语言。
key 不会进入前端脚本、页面清单或响应。正式部署时使用 Cloudflare Secret。

## 本地验证（2026-10-06）

Jekyll 构建、自动测试和浏览器检查覆盖文本格式保护、版本与输出校验、缓存复用、版本失效、过期清理、
历史缓存清除、调用额度、错误回退、地图禁用、语言面板和手机布局。
已实际验证 DeepSeek 英日接口。正式发布后，还需核对生产原文清单、英日翻译和地图页禁用规则。

参考：[DeepSeek JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)、
[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、
[Durable Object 持久化](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)。

## 电影站中文（2026-10-06）

`https://5cm.tsuikaii.com/` 默认日语，点击中文才调用同一个 Worker 的 `zh-Hans` 翻译。
Worker 根据受允许的 Origin 选择该站的可信原文清单，缓存键包含网站来源，防止与博客混用。
电影站只接受中文目标；博客仍只接受英日目标。两站共享 DeepSeek Secret、调用额度和 30 天缓存策略。
电影站构建覆盖正文、图片标签、曲名、播放器动态标签及错误提示；切回日语恢复原文。
原文更新自动使新请求使用新的哈希，失败不缓存，前端不会把模型输出当作 HTML 执行。
