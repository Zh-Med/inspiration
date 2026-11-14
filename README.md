# Inspiration

iPhone 优先的 AI 晨报与科研工具雷达。保留英文原始标题与出处，约 5 分钟阅读重要进展，发现可采用的科研工作流。

当前界面：News／Skills／Medicine 三个玻璃方格、星空背景、香槟金纸张书架、连续拖动与返回转场。当前 v60 已获用户确认并授权上传，包含共享纸页材质、转场优化和导航页纵向锁定。

## 运行

Node.js 22+、Python 3；没有 npm 依赖，无须 `npm install`。

```sh
npm start                       # 本机 http://localhost:4173
npm run collect                 # 公开新闻 + GitHub 项目采集
npm run collect -- --news-only  # 只更新新闻
npm run build                   # 生成 dist/ 静态 PWA，要求已有采集内容
npm run preview:phone           # 同 Wi-Fi 手机预览，仅提供 dist；Ctrl-C 停止
npm run check
npm test
```

`collect` 的退出码：0 全部成功；2 部分来源失败，成功内容仍保存；1 任务失败。LLM 接口留空，不需要 API Key，不进行付费模型调用。

## GitHub 与 iPhone

已提供 GitHub Actions 工作流：每小时采集新闻，每天北京时间 08:07 触发晨报及工具更新，生成静态阅读数据并部署 GitHub Pages。日报覆盖截至 08:00 的前 24 小时；执行可能延迟，不能保证整点送达。公开采集历史保存在独立 `content-state` 分支，Mac 无须保持运行。

首次配置、更新、手机安装和故障排查见 [部署与安装](docs/DEPLOYMENT.md)。需要在仓库 Settings → Pages 选择 GitHub Actions。页面由 GitHub 提供 HTTPS，使用免费子域名。

这套配置支持网页阅读、主屏幕安装与有限离线缓存。**系统 Web Push 尚未实现**，GitHub Pages 本身不是推送后台。手机真机与七天稳定运行仍需验收。

## 内容质量

10 个官方／研究来源，包括 Anthropic 新闻页及 NVIDIA 新闻室。重大官方模型发布、管理层变动优先；普通内容每源最多 3 条、医学科研最多 3 条，日报最多 10 条。只保留发布方短摘录，不将厂商能力主张当独立验证。

晚发现的内容回填原日期，不伪装成今日新闻。日期、去重、来源故障与导出规则见 [后端说明](docs/BACKEND.md)；本轮漏报调查和实测见 [新闻覆盖记录](docs/NEWS-COVERAGE.md)。来源数量不代表全网覆盖。

## 数据边界

- 仓库仅上传明确允许的应用、采集脚本、测试与运行文档。
- `data/`、本地研究素材、REA、运行日志和凭据文件不上传。
- Pages 只发布 `dist/` 中的界面和公开新闻／项目快照，不提供本地文件访问。
- 收藏与偏好留在当前设备；清阅读缓存不删除收藏。重要收藏请导出。
- 不设置远程控制、入站隧道或 Mac 自托管 runner。
- 未来 LLM 密钥由用户在独立服务管理端配置，本项目不读取密钥文件。

手机预览使用终端输出的局域网地址；多网卡时用 `PREVIEW_HOST` 指定 Mac 的 Wi-Fi IPv4。仅临时监听该地址，不使用隧道或远程控制。HTTP 预览只验收触控和视觉，PWA 安装、更新及离线须在 HTTPS 发布后复核。验收前不上传；确认后同步到本机 `inspiration/` 上传仓库（远程 `Zh-Med/inspiration`）。

当前 v60 使用共享透明纸页纹理，书架与总览关闭上下滚动，详情保留阅读滚动；用户已确认此版可上传。材质生成方式、回退路径和资源预算见 [性能记录](docs/PERFORMANCE.md)。
