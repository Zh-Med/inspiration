# 来源扩充与封面核验

## TLDR摘录补全（2026-11-15，最新）

用户反馈 TLDR 阅读页文本提前截断。已移除“标题＋摘录合计最多25词”的本地限制，改为保留发布方 `kf-row-summary` 的完整清洗文本，并仅剔除末尾的“Open article →”导航标签；当天已固定的旧版不完整条目会按原顺序定点补抓，不改变前10篇选择。2026-11-15 实际刷新10/10成功，10条摘要为49–79词，截断标记与末尾导航标签均为0；TLDR页面和原始出处入口保持不变。全部43项测试、语法检查和静态构建通过，本地 `dist/` 已重建，未上传部署。

## TLDR恢复应用内阅读（2026-11-15，最新）

按用户最新指示恢复点击纸页进入应用内英文短摘录详情，底部提供Read on TLDR与Original article两个链接，取消点击纸页直接外跳。75%原文复制未实施；保持短摘录，不调用模型、不翻译。外壳缓存v63，以下官方直达描述保留为历史记录，以本节为准。

## TLDR 官方阅读入口（2026-11-15，最新）

按用户确认的方案，点击TLDR当前纸页或收藏条目直接打开官方story页面的新标签，完整阅读由官方提供，不经过本地短摘录详情。原书架保留位置；历史story深链提供英文直达入口。每日10篇、来源顺序、材质和手势不变，不调用DeepSeek或翻译。外壳缓存v62，本地变更，未上传部署。下节短摘录展示描述为此前实现记录，由本节取代。

## TLDR 独立书架（2026-11-15）

使用项目真实 HTTP 请求读取首页及前 10 篇详情，均成功解析，10 条英文短摘录已存入本地独立 `tldrIssues`。仅接受正文新闻卡片，跳过广告；每批前 10 篇，不按兴趣重排、不向 News/Medicine 合并，不调用任何模型。页面是汇编来源，摘录不代表原始报道已被独立核实。

以北京时间 08:00 划分批次，首次成功取得的列表固定，重复执行补抓失败详情；不足 10 条时只展示实际读到的内容，不用后续文章补位。每日重新请求，不依赖跨日304。缺少发布日期时保留 `publishedAt:null`，UI 明示 Collected。保留英文标题和发布方完整短摘录，完整内容由 TLDR 和原始出处链接打开，不批量转载完整正文。

本地 `collect` / `--news-only` 包含 TLDR；`--tldr-only` 可单独更新。独立书架复用纸张、呼吸、拖动和阅读转场；总览改为 2×2，保留原卡片尺寸。静态构建导出详情，离线缓存保留最近3批；本机服务保留30批。尚未上传、部署或实现系统通知。

验证：43项测试、语法检查和静态构建通过；独立临时Chrome在320/390/800宽度检查四栏入口、卡片尺寸、10内容页＋5空白页、英文详情与来源链接、阅读返回和Reduce Motion，页面异常0。已查看实际截图；未将Chrome模拟视图当作iPhone/WebKit真机验收。外壳缓存v61。

## 最新：用户来源列表与两本子刊接入

2026-11-15，用户授权加入两本子刊及所列网站。此处“接入”指本地采集、阅读、导出和来源配置；系统Web Push仍未实现，未上传/部署，不声称手机已能收到通知。

直接HTTP核查用户13个入口：OpenAI、Anthropic News、DeepMind、NVIDIA均HTTP200，复用原源；The Decoder（10条）、Ars Technica AI（20条）、MIT Technology Review AI（10条）、TechCrunch AI（20条）、Simon Willison（30条）均HTTP200且有日期/摘录，已作为5个新源加入。GitHub Trending首次直接HTTP200，已适配工具发现；后一轮列表请求超时，随后复用本轮已直接取得的列表，通过真实仓库API核对7个AI/科研候选，已进入工具列表。Hacker News连接超时、两个Reddit RSS为 `Network ECONNRESET`，均未收到HTTP响应，列入停用候选，不把它们说成403或采集成功。

- 活动新闻/期刊配置21个，另1个Trending项目发现源；3个社区入口未启用。媒体为 `media-report`，Simon Willison为 `author-commentary`，社区候选为 `community-observation`；均与官方自述区分。
- 两本子刊已加入活动源，官方本期封面明确DOI→本期论文→公开Abstract。实际取得Neuroscience 2026-11封面及1269字符Abstract、Machine Intelligence 2026-10封面及1252字符Abstract（不含此前核查统计的Abstract标签）；原始在线日期分别2026-09-10和2026-09-28。
- 月刊只给年月，`issuePublishedAt` 留空，`issueMonth`保留月份；论文在线日单独保留。不编造封面发布日、不把旧论文塞进当天日报。Medicine额外保留各子刊最新封面并缓存，详情同时显示论文日期与封面月份、可回到官方封面证据。
- 本次没有新增系统推送服务，也没有读写或部署可访问生产密钥的代码。下方旧记录中“子刊尚未接入/14源”由本节更新取代。
- 最终本地复核：两轮实际采集共新增92条新闻/期刊事件（5个媒体/作者源90条、两个子刊2条），Trending新增7个元数据核对候选。新闻源20/21正常，Hugging Face仍超时。40项测试、语法检查、静态构建和导出核对通过；导出150条历史入选内容、51工具、25期日报，确认两个子刊保留Abstract和原始在线日期。只做本地实现，不声称线上或手机推送验证成功。

## Nature子刊：封面到Abstract的直接请求验证

2026-11-15，用户询问Nature Neuroscience和Nature Machine Intelligence。本轮全部使用项目HTTP请求器实测；两本期刊均经官方公开无Cookie跳转后HTTP200，没有403。首次请求被项目原先仅允许 `/nature/` 的跨域跳转规则拒绝（303，不是403）；已把公开跳转白名单扩展到 `/neuro/`、`/natmachintell/`，文章页只允许返回原始的精确 `/articles/…` 路径，不允许跳转到其他文章或期刊。未使用网页检索工具结果充当爬虫采集结果。

| 期刊 | 实际本期封面页 | 官方封面关联 | 论文页与Abstract |
| --- | --- | --- | --- |
| Nature Neuroscience | [Volume 29 Issue 11, November 2026](https://www.nature.com/neuro/volumes/29/issues/11)，HTTP200 | 封面主题“Disentangling neural manifolds”，封面说明中的See Article明确指向 DOI `10.1038/s41593-026-02429-3` | [论文页](https://www.nature.com/articles/s41593-026-02429-3)HTTP200；提取到Abstract段落约1278字符（含段落标签）。正式标题为“Representational learning by optimization of neural manifolds in an olfactory memory network”。 |
| Nature Machine Intelligence | [Volume 8 Issue 10, October 2026](https://www.nature.com/natmachintell/volumes/8/issues/10)，HTTP200 | 封面主题“Downscaling climate projections with GenFocal”，封面说明明确链接 DOI `10.1038/s42256-026-01308-7` | [论文页](https://www.nature.com/articles/s42256-026-01308-7)HTTP200；提取到Abstract段落约1261字符（含段落标签）。正式标题为“Regional climate risk assessment from climate models using probabilistic machine learning”。 |

可获取封面关联和公开摘要的链路已验证；当前仅验证这两个实际样本，不代表全部子刊、全部期次或所有摘要长期可读。两个 `/current-issue` 本轮分别返回11月和10月刊，按实际返回记录，不推测更新到11月。两本月刊页面的刊期只有年月，不将其伪造成某一天；正式自动入库需支持月精度刊期，独立保留论文原始在线日期与封面观察时间。

本轮没有把两本子刊加入活动 `feeds`，活动来源仍14个；未上传、部署或发送推送。HTTP请求器增加了严格范围的公开跳转支持，15项相关测试、JS语法与diff检查通过。未登录、未读取用户凭据、未下载PDF；只提取公开Abstract，未收集论文正文作为内容。

## 最新：直接HTTP复核与期刊停止接入

2026-11-15北京时间11:11起，用户要求核查Anthropic博客、Hugging Face与此前五刊，并明确持续403即放弃。以下使用本机项目 `createFetcher()` 的真实请求结果，不以网页检索工具或搜索缓存代替；未登录或更换身份，期刊返回403后没有再尝试其文章/RSS/替代域名。

| 直接请求入口 | 本轮结果 | 处理 |
| --- | --- | --- |
| `https://www.anthropic.com/news` | HTTP 200，解析29条 | 保留原新闻源。 |
| `https://www.anthropic.com/engineering` | HTTP 200，现有解析器读到4条带日期记录 | 新增Engineering博客源；补读同源短描述，符合30天窗口才入库。 |
| `https://www.anthropic.com/research` | HTTP 200，现有解析器读到5条带日期记录 | 新增Research博客源；不据此宣称完整抓取所有历史文章。 |
| `https://huggingface.co/blog` | `Network UND_ERR_CONNECT_TIMEOUT`，没有收到HTTP响应 | 当前本机不可达，不能标为访问成功，也不是403。 |
| `https://huggingface.co/blog/feed.xml` | `Network UND_ERR_CONNECT_TIMEOUT`，没有收到HTTP响应 | 保留原源降级状态。 |
| `https://jamanetwork.com/journals/jama` | HTTP 403 | 停止接入JAMA，包括Editor’s Choice，不再自动尝试。 |
| `https://www.nature.com/nature/current-issue` | 官方公开跳转后HTTP 200；解析1条明确封面关联，短介绍500字符 | 保留Nature封面源；此为封面介绍，不能写成论文Abstract采集成功。 |
| `https://www.science.org/toc/science/current` | HTTP 403 | 停止接入。 |
| `https://www.thelancet.com/journals/lancet/issue/current` | HTTP 403 | 停止接入。 |
| `https://www.nejm.org/toc/nejm/current` | 本轮连接超时，没有HTTP响应；早前曾HTTP 403 | 停止接入；本轮结果不伪报为403。 |

当前活动配置14源，其中包含可能暂时不可达的Hugging Face；四个停用期刊仍保留来源档案，但不在活动采集列表。下方旧核查保留为历史证据，“待核验”状态由本节停用决定取代。以上只代表此次本机运行，不证明GitHub托管执行器的可达性或长期稳定性。

本地流水线复核于北京时间11:13—11:14完成：复用本轮已取得的两个Anthropic列表响应，文章短描述均由实际HTTP请求补读，新增Engineering 1条、Research 3条，全部有发布方短描述（176／139／155／223字符）。其他活动源照常采集，Hugging Face超时使本轮整体部分成功；四个停用期刊没有再被请求。语法检查、20项相关回归测试、静态构建和文档链接检查通过；导出116条历史入选内容、44工具、24期日报。改动未上传或部署。

核查日期：2026-11-15（北京时间）。用户要求新增 Kimi、DeepSeek，移除 arXiv q-bio.NC，并探索五本期刊的封面文章；随后明确选择**只收官方确认的封面文章**，不以当期主推、编辑精选或整期目录替代。本次仅实施和验证本地采集，未上传或部署，也未接通系统 Web Push。

## 新增 AI 来源

| 来源 | 官方入口 | 采集方式与状态 |
| --- | --- | --- |
| Kimi / Moonshot AI | [Research Blog](https://www.kimi.com/en/blog/) | HTTP 200；读取带日期的研究卡片，按URL合并桌面/手机重复项，补读同站文章meta description。实际解析10条卡片；30天范围内本轮1条。 |
| DeepSeek | [Change Log](https://api-docs.deepseek.com/updates/) | HTTP 200；按正文日期与子标题拆分，每个子标题锚点是独立条目。本轮实际解析25项；30天范围内3项。无需模型API或密钥。 |

DeepSeek不以模型回答作为检索证据。日志的历史更新可能保留在同一页面，故只对此适配器保留安全标题锚点；其他来源继续默认去掉URL fragment。新发现的旧新闻按原发布日期回填，不塞进今天。

## 期刊核验

| 期刊 | 已读取的官方入口 | 封面关联结论 | 当前处理 |
| --- | --- | --- | --- |
| Nature 主刊 | [本期页面](https://www.nature.com/nature/current-issue)、[实际刊期](https://www.nature.com/nature/volumes/659/issues/8140) | 封面说明提供DOI链接，并能与本期论文条目对应；本轮确认1篇。 | 已启用严格封面采集。 |
| JAMA 主刊 | [官方RSS目录](https://jamanetwork.com/pages/rss/)、[当期RSS](https://jamanetwork.com/rss/site_3/67.xml)、[本期页面](https://jamanetwork.com/journals/jama/currentissue) | RSS可读取；本期页面读取结果不稳定，目录/摘要未建立明确的封面与论文对应关系。 | 待核验，不启用当期文章采集。 |
| Science 主刊 | [当期RSS](https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science)、[本期页面](https://www.science.org/toc/science/current) | RSS实际HTTP 200、44条；本期页和实际刊期页HTTP 403，RSS无已确认的封面归属。 | 待核验；不从目录顺序猜封面。 |
| The Lancet 主刊 | [本期页面](https://www.thelancet.com/journals/lancet/issue/current)、[Lancet RSS](https://www.thelancet.com/rssfeed/lancet_current.xml)、[Elsevier官方RSS](https://rss.sciencedirect.com/publication/science/01406736) | Lancet页面/RSS受HTTP 403限制；出版方Elsevier RSS可读取，但为文章列表，无法确认封面关联。 | 待核验；不以出版方目录替代封面。 |
| New England Journal of Medicine（NEJM） | [官方RSS说明](https://www.nejm.org/rss-feed)、[当期RSS](https://www.nejm.org/action/showFeed?jc=nejm&type=etoc&feed=rss)、[本期页面](https://www.nejm.org/toc/nejm/current) | RSS实际HTTP 200；本期页HTTP 403，尚无明确封面标记。RSS的 `coverDate` 仅是刊期日期，不证明某篇上封面。 | 待核验，不启用普通当期文章。 |

未登录、未购买、未下载期刊PDF/封面图片、未使用第三方转发或规避访问限制。浏览器连接超时，改用只读检索和实际HTTP请求；可被搜索工具读取的页面不等于定时采集器一定可读，以运行结果分别记录。

## JAMA Editor’s Choice 可读性补查

2026-11-15，用户进一步询问JAMA Editor’s Choice并表达兴趣。本轮核验可读范围，不改变此前自动采集仅收明确封面文章的规则，也未将Editor’s Choice标作已接入来源。

- [JAMA主刊首页](https://jamanetwork.com/journals/jama)有明确的 `Editor's Choice` 标记及文章链接，足以证明编辑精选身份。它是独立于封面和当期目录的编辑推荐，不能混标为封面文章。
- 本轮所见推荐链接显示短标题“Fluid Tau Biomarker to Identify Tauopathies”，指向[正式文章](https://jamanetwork.com/journals/jama/fullarticle/2856780)。论文正式标题为“Fluid eMTBR-tau243 as a Biomarker of Mixed 3-Repeat and 4-Repeat Tau Pathology”，在线日期2026-11-13，DOI `10.1001/jama.2026.24689`。已通过只读网页工具读取标题、日期、Key Points、Abstract及包含Introduction、Methods、Discussion的正文；不据这一个样本承诺所有精选全文免费可读。
- 实际运行本项目 `createFetcher()`：首页和所选文章均返回HTTP 403；[官方RSS目录](https://jamanetwork.com/pages/rss/)HTTP 200，但目录未列出单独的Editor’s Choice订阅。读取网页工具的结果与自动采集器的可达性分别记录，当前不能标为稳定定时采集成功。
- 若后续接入，应只接收官方Editor’s Choice标记明确指向的文章，归Medicine的“编辑精选”；保留精选证据URL、论文原始日期、首次观察与采集时间。首页没有给出入选时刻，不以观察时间推定入选/发表日期，也不将历史精选包装成新论文。
- 本轮未登录、未读取凭据、未下载PDF、未规避403，未修改活动来源数量或发布线上更新。

## Nature严格规则

1. 官方页面必须存在本期封面说明、规范刊期URL和有效刊期日期，否则该来源报错，保留旧内容。
2. 只接受封面正文中的Nature文章链接或 `doi.org/10.1038/…` 链接；图片署名、订阅链接、目录链接、无链接的DOI文字及标题中的“cover”不构成证明。
3. 封面链接必须对应本期论文卡片，才能取得正式论文标题和原始日期。没有可确认关联时零条入选，不选择首篇补位。
4. 输出保留封面证据URL和DOI。`publishedAt` / `issuePublishedAt` 是封面刊期；`articlePublishedAt` 是原始论文日期。原始日期仅日精度时00:00Z为标准化桶，不代表精确时刻。
5. 不把封面选择当独立科学验证或确定临床结论。当前进入Medicine科研候选，遵守每日最多10条、医学科研最多3条的现有规则；不保证每篇必选。

已实际确认的示例：[Scale-rich network-based metamaterials](https://www.nature.com/articles/s41586-026-11191-2)，对应封面主题“Material gains”，刊期2026-11-12，论文在线日期2026-11-11。保留两种日期，不将晚发现包装为当天新论文。

## 移除与交付边界

- arXiv q-bio.NC 已从活动配置移除，不再请求；生成日报、阅读列表及静态导出均排除该源。历史原始记录保留，避免破坏用户既有收藏。
- 当前活动来源12个；其余四刊列在 `journalWatchlist`，不计作已接入来源，也不影响活动来源健康统计。
- 自动化检查覆盖日期锚点、跨域排除、封面归属、无封面零条、格式失效、重放去重、退订源导出与公开跳转边界。
- 本轮真实采集于北京时间10:27—10:28完成，新增5条（Kimi 1、DeepSeek 3、Nature封面1），均按原日期入档。12活动源中11正常，原有Hugging Face仍连接超时，整体为部分成功。语法检查、36项测试、静态构建及导出核对通过；导出112条历史入选内容、44个工具、24期日报，arXiv源不再进入阅读/健康导出。
- 正式系统推送仍未实现。本次交付是内容来源与日报候选，线上更新、iPhone接收及长期稳定性须分别验证。
