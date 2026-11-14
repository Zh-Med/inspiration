# 内容后端与静态发布

更新：2026-11-14。Node.js 22+、Python 3 标准库；无第三方运行依赖。UI 保持已确认版本，LLM 服务地址留空，不读取 API Key 文件。

## 采集

`npm run collect` 采集新闻及公开 GitHub 项目；`--news-only` 仅新闻。退出码0为全部成功、2为部分失败但数据已保存、1为任务失败。

10个来源在 `server/config.mjs`：OpenAI、Google AI、DeepMind、NVIDIA Blog、NVIDIA Newsroom、Anthropic Newsroom、Hugging Face、Microsoft Research、PyTorch、arXiv q-bio.NC。RSS／Atom／RDF使用禁用DTD的XML解析；Anthropic使用HTMLParser读取带日期卡片，脚本永不执行。缺摘要的近期卡片每轮最多补读6个同源文章的meta description，只保存短摘录，不保存全文。

每源最多处理60条、回看30天；单响应2MB、文件树8MB、15秒请求超时、最多3次网络重试。重定向仅允许同源HTTPS；限流延期。来源结构变化导致零条解析时记录失败，不冒充“无新闻”。来源各自失败，旧成功记录保留。

`data/state.json`为本地内容库，原子替换、单写者锁，不在静态根目录。公开GitHub流程保存其副本到content-state分支，跨runner保留去重、历史日报和Star基线；本机该目录整体排除上传。首次云端运行重新采集。

## 日期、证据和选择

规范URL去追踪参数；相同URL或三天内相同规范标题保守合并。不以多条转载当独立证实，不自动执行语义去重。保留发布时间、原文更新时间、首次发现、采集时间与版本；不知道事件实际发生时间时不填。

日期只有日精度时，保留 `publishedPrecision: day`。标准化存储的00:00Z仅用于稳定分桶，不代表官方给出了具体时刻：来源日期D归入D+1的晨报，界面显示来源日期；精确时间来源按北京时间08:00划分。晚发现按原日期回填，不塞进当天。

`news-priority.mjs`对官方管理层变动、官方模型发布提高优先级，仍要求有效日期与摘录。普通新闻每来源最多3条、医学科研最多3条，每期最多10条；无足够不同来源时允许不足10条。关键词评分仅决定编辑顺序，不是事实验证，也不会据此自动推送。

摘要是发布方英文短摘录，`official-claim`表示官方自述，`preprint`表示预印本；模型摘要未启用。历史日报的 `sourceHealth` 是本轮重建时的采集健康度，不是历史当天曾运行的证明。

## GitHub 工具雷达

五类公开仓库检索：agent-skills、scientific research、neuroscience、literature review、medical imaging。排除fork/private/archived/disabled；每类10个候选。radar-v1按兴趣30、维护25、热度20、透明度15、跨日增长10评分；不足一天不推测增长，Stars不等于实际采用。

每轮最多检查6个仓库的README、Release及文件树；SKILL.md只发现路径，不执行、不安装。所有项目均“未实测”；成本、数据去向和输入输出未核对的字段保持待核对。

## 阅读与构建

本机 `npm start` 监听127.0.0.1:4173，提供 `/api/content`、`/api/digests/YYYY-MM-DD`、`/api/items/:id`、`/api/tools`、`/api/health` 等只读接口。Host与Origin受限，前端不提供文件访问或任意URL代理。本地LLM配置接口只返回未连接，拒绝密钥写入。

`npm run build`要求已有可读内容，显式复制应用资产并导出公开字段到dist/data；不复制本地数据库、项目目录、凭据、REA或研究素材。Pages部署只上传dist。`runtime-config.js`在构建时切换静态数据路径，本机继续API读取；两者均支持仓库子路径。

外壳缓存按Service Worker scope隔离；数据请求不进入外壳缓存。前端阅读缓存最多最近3期、40个工具和150万序列化字符；收藏单独存储，清阅读缓存保留收藏与偏好。拖动、惯性和文章阅读期间延后重排。

## 验证状态

`npm run check`检查JS语法，`npm test`覆盖日期、去重、XML、来源隔离、重试、限流、持久化、只读API、密钥写入拒绝、重大新闻排序、HTML日期隔离、历史回填、静态子路径与空构建拒绝。部署／手机步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

真实来源实测见 [NEWS-COVERAGE.md](NEWS-COVERAGE.md)。待验收：实际GitHub调度、iPhone安装／离线／Wi-Fi＋蜂窝、系统推送和连续七天运行。未经实测不标完成。
