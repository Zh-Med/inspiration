# 内容后端与静态发布

更新：2026-11-15。Node.js 22+、Python 3 标准库；无第三方运行依赖。UI 保持已确认版本，本地已配置公开的独立摘要服务地址，不读取 API Key 文件；尚待用户部署正式 Worker 与发布 PWA 接入。

## 采集

`npm run collect` 采集新闻及公开 GitHub 项目；`--news-only` 仅新闻。退出码0为全部成功、2为部分失败但数据已保存、1为任务失败。

21个新闻/期刊来源在 `server/config.mjs`：原14源另加The Decoder、Ars Technica AI、MIT Technology Review AI、TechCrunch AI、Simon Willison、Nature Neuroscience Cover、Nature Machine Intelligence Cover。原14源为OpenAI、Google AI、DeepMind、NVIDIA Blog/Newsroom、Anthropic Newsroom/Engineering/Research、Kimi、DeepSeek、Hugging Face、Microsoft Research、PyTorch、Nature主刊。用户列表中的已有源按URL去重。媒体标记 `media-report`，个人博客为 `author-commentary`，均不冒充官方自述或独立核实。Hacker News与两个Reddit入口列入 `pendingSources`，直接请求失败所以不启用。

Anthropic三个栏目均使用带日期卡片与同源文章短描述采集；相同文章仍按URL合并。arXiv q-bio.NC 已停止采集并从新日报、阅读列表及静态导出中排除；历史本地记录保留，已有收藏仍可通过本机条目接口读取。

RSS／Atom／RDF使用禁用DTD的XML解析。Anthropic读取带日期卡片；Kimi读取带日期的研究卡片，桌面/手机重复卡片合并，两者缺摘要时每源每轮最多补读6个同源文章的meta description。DeepSeek读取官方更新日志正文，按日期和子标题分项，专门保留标题锚点作为条目身份，避免同一页面的所有更新合并。所有网页均使用HTMLParser，脚本永不执行，只保存短摘录。

Nature仅接受官方本期封面说明中明确链接、且能与本期论文条目核对的文章。保留论文URL、DOI、封面说明URL、封面标题、刊期与论文原始发布日期；主刊有日精度刊期时以刊期作 `publishedAt`，原始论文日期独立存入 `articlePublishedAt`。两个子刊必须成功取得 `Abs1-content` 和 `citation_online_date`，才入库为 `excerptKind: abstract`；最多保留1800字符，封面介绍单独保留。摘要失败时保留之前已验证的摘要并报告失败，不用封面介绍冒充Abstract。

月刊 `issuePublishedAt` 为null、`issueMonth` 保留YYYY-MM、`issuePrecision: month`；`publishedAt` 用论文原始在线日期，绝不虚构月刊发布日。月刊不按发现日期塞进日报；内容视图额外保留每个子刊最新一期的明确封面/摘要，进入Medicine并纳入小容量阅读缓存与静态导出。前端同时显示“论文发表于”和可点击的“封面·YYYY-MM”。确认封面不代表医学有效性或重大消息。

Nature公开页面使用无Cookie跳转：仅明确启用时允许 `idp.nature.com/authorize` 的 `response_type=cookie&client_id=grover` 和 `/transit`，返回地址必须是原始期刊路径（nature/neuro/natmachintell白名单）或原始精确文章路径。最多10跳，总体超时仍受限；不读取、保存或转发Cookie和用户登录凭据，不放宽其他来源的跨域跳转。JAMA、Science、Lancet、NEJM按用户最新要求停用，不参加采集或健康来源分母，不自动重试或启用其RSS替代；具体实测见 [来源核验](NEWS-SOURCES.md)。

每源最多处理60条、回看30天；单响应2MB、文件树8MB、15秒请求超时、最多3次网络重试。重定向仅允许同源HTTPS；限流延期。来源结构变化导致零条解析时记录失败，不冒充“无新闻”。来源各自失败，旧成功记录保留。

`data/state.json`为本地内容库，原子替换、单写者锁，不在静态根目录。公开GitHub流程保存其副本到content-state分支，跨runner保留去重、历史日报和Star基线；本机该目录整体排除上传。首次云端运行重新采集。

## 日期、证据和选择

规范URL去追踪参数；相同URL或三天内相同规范标题保守合并。不以多条转载当独立证实，不自动执行语义去重。保留发布时间、原文更新时间、首次发现、采集时间与版本；不知道事件实际发生时间时不填。

日期只有日精度时，保留 `publishedPrecision: day`。标准化存储的00:00Z仅用于稳定分桶，不代表官方给出了具体时刻：来源日期D归入D+1的晨报，界面显示来源日期；精确时间来源按北京时间08:00划分。晚发现按原日期回填，不塞进当天。

`news-priority.mjs`对官方管理层变动、官方模型发布提高优先级，仍要求有效日期与摘录。普通新闻每来源最多3条、医学科研最多3条，每期最多10条；无足够不同来源时允许不足10条。关键词评分仅决定编辑顺序，不是事实验证，也不会据此自动推送。

摘要是发布方英文短摘录，`official-claim`表示官方自述，`publisher-curated`表示期刊官方确认的封面关联，历史 `preprint`表示预印本；封面摘录不是论文研究结论，研究设计和适用范围另行核对。正式模型摘要尚未由用户启用。摘要 API 尚未完成测试，相关接入、配置和测试代码不包含在本次同步中。历史日报的 `sourceHealth` 是本轮重建时的采集健康度，不是历史当天曾运行的证明。

## GitHub 工具雷达

五类公开仓库检索：agent-skills、scientific research、neuroscience、literature review、medical imaging。排除fork/private/archived/disabled；每类10个候选。radar-v1按兴趣30、维护25、热度20、透明度15、跨日增长10评分；不足一天不推测增长，Stars不等于实际采用。

每轮最多检查6个仓库的README、Release及文件树；SKILL.md只发现路径，不执行、不安装。所有项目均“未实测”；成本、数据去向和输入输出未核对的字段保持待核对。

另接入GitHub Trending公开页面：严格提取仓库卡片中的owner/repo，每轮最多10个，再通过官方仓库API核对身份、真实创建/更新时间、Stars等元数据，筛选AI/科研相关候选并复用原有评分、基线和富化流程。保留发现入口与观察时间，不把榜单观察日期写成项目发布日期。无日期的热榜不进入新闻流水线；`--news-only` 不采集Trending，完整采集时启用。

## 阅读与构建

本机 `npm start` 监听127.0.0.1:4173，提供 `/api/content`、`/api/digests/YYYY-MM-DD`、`/api/items/:id`、`/api/tools`、`/api/health` 等只读接口。Host与Origin受限，前端不提供文件访问或任意URL代理。本地LLM配置接口只返回未连接，拒绝密钥写入。

`npm run build`要求已有可读内容，显式复制应用资产并导出公开字段到dist/data；不复制本地数据库、项目目录、凭据、REA或研究素材。Pages部署只上传dist。`runtime-config.js`在构建时切换静态数据路径，本机继续API读取；两者均支持仓库子路径。

外壳缓存按Service Worker scope隔离；数据请求不进入外壳缓存。前端阅读缓存最多最近3期、40个工具和150万序列化字符；收藏单独存储，清阅读缓存保留收藏与偏好。拖动、惯性和文章阅读期间延后重排。

## 验证状态

`npm run check`检查JS语法，`npm test`覆盖日期、去重、XML、来源隔离、重试、限流、持久化、只读API、密钥写入拒绝、重大新闻排序、HTML日期隔离、历史回填、静态子路径与空构建拒绝。部署／手机步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

真实来源实测见 [NEWS-COVERAGE.md](NEWS-COVERAGE.md)。待验收：实际GitHub调度、iPhone安装／离线／Wi-Fi＋蜂窝、系统推送和连续七天运行。未经实测不标完成。
