# GitHub 与 iPhone 安装

核查日期：2026-11-18。目标仓库：<https://github.com/Zh-Med/inspiration>。本方案为公开仓库＋GitHub 托管 Actions＋GitHub Pages，无付费服务、无 LLM、无 Mac 常驻进程。

## 首次发布

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**，保存。若此前首次工作流因 Pages 未启用失败，配置后重跑。
2. 仓库 Actions → **Collect and publish Inspiration** → Run workflow → main。若提示 Actions 禁用，按 GitHub 页面启用本仓库工作流。
3. 等待 build 和 deploy 都显示成功。deploy 环境链接为实际发布地址，预期是 <https://zh-med.github.io/inspiration/>。
4. 查看站点 `build-info.json` 中的更新时间；`data/health.json` 提供来源状态。这些文件都只包含公开数据与健康信息。

不需创建 Secret，也不需填写 DeepSeek API。Actions 的 `github.token` 是 GitHub 为任务提供的临时仓库令牌，用于保存公开采集状态与调用 GitHub API，不是 LLM 密钥。

仓库的 main 存代码；工作流把公开采集状态存到 content-state 分支。这里保存公开出处、短摘录、来源健康、工具统计与去重历史，不保存用户收藏、手机数据或密钥。日后引入私人数据时须先改变存储方案，不能混入此分支。

## 手机安装

1. iPhone 14／iOS 18.7.8 使用 **Safari** 打开实际 Pages HTTPS 地址。
2. 点分享 → **添加到主屏幕** → 添加。以后从 Inspiration 图标启动。
3. 打开 News，拖动书架、进入文章，再返回；与当前确认的 UI 对照。
4. 打开几篇内容后退出，开启飞行模式，再从图标打开：应能阅读缓存的最近三期和有限工具。首次离线无法获取尚未缓存的内容。
5. 恢复网络，分别用 Wi-Fi、蜂窝打开并进入原文。若 GitHub Pages 在实际网络不稳定，需改选可达的免费托管，不能将 Mac localhost 当作手机地址。
6. 设置 → 辅助功能 → 动态效果 → 减弱动态效果，核对书架呼吸／星空停止；再检查大文字、VoiceOver、长标题。

尚无系统推送订阅入口和发送后台，无须在 iPhone 上寻找通知开关。添加主屏幕不等于开通推送；未来须另做设备订阅、独立后台、VAPID、失效清理、深链与锁屏真机测试。LLM API 与 Web Push 是不同能力。

## 自动更新与运行

- UTC `17,47 * * * *`：每小时第17、47分钟尝试更新；当天尚未完成完整采集时自动补跑晨报与科研项目，否则只采新闻。
- UTC `3 0 * * *` 是北京时间 08:03 的 GitHub 晨报入口。日报覆盖 `[前一天08:00, 当天08:00)`，以实际采集时间确定业务日。
- push 到 main 或手动触发：完整采集并发布。记录最近完整采集业务日，避免运行历史轮换后反复执行科研项目采集。
- 构建后检查当前业务日的News覆盖区间、来源可用性和TLDR批次；缺期时失败，不将旧内容当成更新成功。无新闻时允许明确的空日报。发布后再次读取线上内容与独立日报，核对本次采集时间和指纹。
- 手机恢复前台、返回缓存页面和重新聚焦时重新拉取，30秒内合并重复事件；前台持续打开每5分钟检查。离线保留原缓存与收藏。恢复时的新书架等拖动／转场结束后更新，阅读中的文章等离开后应用新数据。
- 采集失败不清空旧状态；部分来源失败仍发布，健康记录明确 partial。完全没有可读内容则拒绝替换站点。
- 工作流串行执行，避免状态写入冲突。首次运行从公开来源重新采集，不依赖 Mac 本机数据。
- 新增前端文件需同步构建白名单与 Service Worker 外壳列表。内容更新不会每次重装外壳；外壳变更自动变更缓存版本。
- 收藏保存在当前站点与设备。改变域名／仓库路径可能导致原收藏不可见，迁移前先导出。

GitHub 官方说明：定时任务可能延迟或丢弃，公开仓库60天无活动可能停用定时任务。因此此方案不承诺08:00准点或重大消息即时通知。定期查看 Actions；启用后需做连续七天运行检查。[定时任务限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

### Cloudflare 独立补发

使用独立 Worker 部署 [tldr-scheduler.mjs](../scripts/tldr-scheduler.mjs)，在 Cloudflare 后台添加一条 UTC Cron Trigger `0,9,21,36,51 0 * * *`。对应北京时间 08:00、08:09、08:21、08:36、08:51。08:00 开始检查和采集，正文要等工作流完成后才会出现在 Pages。

在 GitHub 创建只授权 `Zh-Med/inspiration` 的 fine-grained token，授予仓库级 Actions 读写权限。在独立 Worker 后台将值存为 Secret `GITHUB_DISPATCH_TOKEN`。当前摘要 Worker 无需改动。记录 token 的到期日，并在到期前轮换。

当天 TLDR 达到 `ready` 后停止补发。已有 15 分钟内启动、尚未结束的工作流时，留到下一次检查。其余情况下，通过 `workflow_dispatch` 启动现有工作流。Worker 日志只记录结果或 HTTP 状态，验收时对照 Actions 与 Pages 的 `build-info.json` 中的 `tldrDate`、`tldrStatus`。Cloudflare 可补 GitHub 定时触发的缺口，采集、部署和线上校验仍由 GitHub Actions 执行。

## 排错

- **Pages 未启用**：按首次发布第1步配置，再重跑工作流。
- **推送 content-state 被拒绝**：检查仓库或组织的 Actions 权限／分支规则；工作流 build 需要 `contents: write`，deploy 需要 `pages: write` 和 `id-token: write`。
- **来源失败**：查看运行日志与 `data/health.json`，保留旧记录，不将搜索片段直接填充成新闻。
- **旧界面**：关闭主屏幕应用后重开，等待新 Service Worker 激活；不要用删除网站数据作为第一步，否则会丢收藏。
- **今日无文章**：查看日报覆盖窗口和更新时间。晚发现的11月9日新闻回填对应历史日报，不复制进11月14日。

## 费用与能力依据

GitHub Free 的 Pages 支持公开仓库，本方案使用公开仓库、免费域名和标准 GitHub 托管 runner；不启用付费套餐、付费搜索或 LLM。费用规则以账号实际页面为准，发现超额需停用，不自动购买。[Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

工作流部署要求和环境配置依据 [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。iOS 主屏幕 Web App、独立窗口和推送能力依据 [WebKit 官方说明](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)。这里只完成阅读站配置，不能用平台支持推送替代项目实际实现。

## 2026-11-18 漏更调查

截至北京时间09:40，工作流active，main为默认分支，仓库未归档／禁用且当天有活动；已排除60天无活动停用、时区换算错误和当天构建失败。公开Actions记录中，08:00后没有新运行；最后成功发布为06:24，内容仍为11月17日，11月18日日报URL返回404。11月16、17日UTC日各只出现4次schedule运行，明显少于配置的每小时更新加晨报。

可确定故障发生在定时事件触发阶段；公开API不提供未生成run的事件日志，无法证明这一次究竟被延迟还是被丢弃。GitHub官方明确说明高负载时schedule可能延迟或丢弃。官方状态页未列出与本时段对应的Actions事故，不能据此推断没有局部调度问题。依据：[运行记录](https://github.com/Zh-Med/inspiration/actions)、[GitHub schedule限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[官方状态](https://www.githubstatus.com/)。

本轮增加半小时补偿机会、任何定时入口按实际业务日补采、发布前后验证；这些机制减少漏更与假成功，但仍共用GitHub调度，不能保证08:00准时或平台完全停调时自动恢复。真正独立的兜底需另行配置外部调度服务，本轮未注册新服务、未设置Mac常驻任务、未读取API Key。系统Web Push仍暂缓。
