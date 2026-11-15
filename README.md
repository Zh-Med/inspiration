# Inspiration

iPhone 优先的 AI 晨报与科研工具雷达。保留英文原始标题与出处，约 5 分钟阅读重要进展，发现可采用的科研工作流。

当前界面：News／Skills／Medicine／TLDR 四个玻璃方格、星空背景、香槟金纸张书架、连续拖动与返回转场。当前 v60 已获用户确认并授权上传，包含共享纸页材质、转场优化和导航页纵向锁定。

## 运行

Node.js 22+、Python 3；没有 npm 依赖，无须 `npm install`。

```sh
npm start                       # 本机 http://localhost:4173
npm run collect                 # 公开新闻 + GitHub 项目采集
npm run collect -- --news-only  # 更新新闻与当日 TLDR
npm run collect -- --tldr-only  # 仅更新当日 TLDR
npm run build                   # 生成 dist/ 静态 PWA，要求已有采集内容
npm run preview:phone           # 同 Wi-Fi 手机预览，仅提供 dist；Ctrl-C 停止
npm run check
npm test
```

`collect` 的退出码：0 全部成功；2 部分来源失败，成功内容仍保存；1 任务失败。采集与构建不需要 API Key，也不进行付费模型调用。摘要 API 尚未完成测试，本次同步不包含摘要服务接入、配置和测试代码。

## GitHub 与 iPhone

已提供 GitHub Actions 工作流：每小时采集新闻，每天北京时间 08:07 触发晨报及工具更新，生成静态阅读数据并部署 GitHub Pages。日报覆盖截至 08:00 的前 24 小时；执行可能延迟，不能保证整点送达。公开采集历史保存在独立 `content-state` 分支，Mac 无须保持运行。

首次配置、更新、手机安装和故障排查见 [部署与安装](docs/DEPLOYMENT.md)。需要在仓库 Settings → Pages 选择 GitHub Actions。页面由 GitHub 提供 HTTPS，使用免费子域名。

这套配置支持网页阅读、主屏幕安装与有限离线缓存。**系统 Web Push 尚未实现**，GitHub Pages 本身不是推送后台。手机真机与七天稳定运行仍需验收。

## 内容质量

TLDR 独立书架：北京时间 08:00 后首次运行固定首页前 10 篇（排除广告、保留顺序），当天重试仅补失败详情或旧版不完整摘录。展示英文原标题、发布方完整短摘录和 TLDR／原站两个入口，点击纸页进入应用内阅读页。不调用 DeepSeek、不翻译、不混入 News 排序。服务端保留 30 个采集批次，阅读缓存保留 3 批；采集日不冒充新闻发布日期。定时任务需发布后才生效；系统 Web Push 未实现。

21 个新闻／期刊来源，另有 GitHub Trending 工具发现入口。保留既有官方源，新增 The Decoder、Ars Technica AI、MIT Technology Review AI、TechCrunch AI、Simon Willison，以及 Nature Neuroscience／Machine Intelligence 的明确封面关联和公开 Abstract。月刊封面进入 Medicine，保留封面月份与论文原始日期，不冒充当天新论文。GitHub Trending 只发现候选，再核对公开仓库元数据，不安装或执行。

Hacker News 直接连接超时，两个 Reddit RSS 连接重置，暂不启用。Hugging Face 本机连接超时，保留失败状态；arXiv q-bio.NC 已停止订阅。JAMA、Science、Lancet 返回403、NEJM访问失败，按用户要求停止接入这四刊。来源实测与边界见 [来源核验](docs/NEWS-SOURCES.md)。

重大官方模型发布、管理层变动优先，确认的期刊封面提高入选优先级；普通内容每源最多 3 条、医学科研最多 3 条，日报最多 10 条。只保留发布方短摘录，不将厂商能力主张当独立验证，也不把期刊封面等同于临床结论。新增来源已纳入本次同步，线上状态待验证。

晚发现的内容回填原日期，不伪装成今日新闻。日期、去重、来源故障与导出规则见 [后端说明](docs/BACKEND.md)；本轮漏报调查和实测见 [新闻覆盖记录](docs/NEWS-COVERAGE.md)。来源数量不代表全网覆盖。

## 数据边界

- 仓库仅上传明确允许的应用、采集脚本、测试与运行文档。
- `data/`、本地研究素材、REA、运行日志和凭据文件不上传。
- Pages 只发布 `dist/` 中的界面和公开新闻／项目快照，不提供本地文件访问。
- 收藏与偏好留在当前设备；清阅读缓存不删除收藏。重要收藏请导出。
- 不设置远程控制、入站隧道或 Mac 自托管 runner。
- 不上传摘要 API 接入、Worker 地址或凭据；本次未访问任何密钥文件。

手机预览使用终端输出的局域网地址；多网卡时用 `PREVIEW_HOST` 指定 Mac 的 Wi-Fi IPv4。仅临时监听该地址，不使用隧道或远程控制。HTTP 预览只验收触控和视觉，PWA 安装、更新及离线须在 HTTPS 发布后复核。验收前不上传；确认后同步到本机 `inspiration/` 上传仓库（远程 `Zh-Med/inspiration`）。

当前 v60 使用共享透明纸页纹理，书架与总览关闭上下滚动，详情保留阅读滚动；用户已确认此版可上传。材质生成方式、回退路径和资源预算见 [性能记录](docs/PERFORMANCE.md)。
