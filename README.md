# Inspiration

为 iPhone 设计的 AI 晨报与科研工具雷达。每天花约 5 分钟浏览重要进展，保留英文标题、来源和原文入口。

| 栏目 | 内容 |
| --- | --- |
| News | AI 模型、芯片与算力、行业人物、新交互和应用。北京时间 08:00 划分日报，每期最多 5 条。 |
| Skills | 从公开 GitHub 仓库发现可用于科研的工具和工作流。 |
| Medicine | 医学 AI、脑科学等科研内容，保留论文日期和证据出处。 |
| TLDR | 按发布方首页顺序筛选，每日最多 10 条英文摘录，附 TLDR 和原站入口。 |

[打开 Inspiration](https://zh-med.github.io/inspiration/) · [iPhone 安装、自动更新与排错](docs/DEPLOYMENT.md)

GitHub Pages 提供阅读与主屏幕安装。应用支持有限的离线阅读，收藏保存在当前设备。系统 Web Push 尚未实现。

## 实际运行演示

![Inspiration 从总览进入 TLDR 书架，拖动纸页并打开文章](docs/demo.gif)

本地运行录制，使用 390 × 844 的移动端视口和已采集的 TLDR 内容。

## 在 Mac 上运行

需要 Node.js 22+ 和 Python 3。项目没有 npm 运行依赖，可直接打开本机服务。

```sh
npm start  # http://localhost:4173
```

| 操作 | 命令 |
| --- | --- |
| 采集公开内容到本地 | `npm run collect` |
| 只刷新新闻和当日 TLDR | `npm run collect -- --news-only` |
| 只刷新当日 TLDR | `npm run collect -- --tldr-only` |
| 用已有采集内容生成静态站点 `dist/` | `npm run build` |
| 在同一 Wi-Fi 下用 iPhone 预览 `dist/` | `npm run preview:phone` |
| 检查语法与运行测试 | `npm run check`、`npm test` |

采集退出码 `2` 表示部分来源失败，已成功取得的内容仍会保存。`1` 表示任务失败。采集、构建与 GitHub Pages 发布流程均无需 DeepSeek 密钥。正式发布基线及本地摘要集成的状态见相应运行文档。

## 文档

| 我想了解 | 去哪里看 |
| --- | --- |
| 如何安装、更新或定位漏更 | [部署与运行](docs/DEPLOYMENT.md) |
| 数据从哪里来，日报如何分日、去重和入选 | [后端与内容规则](docs/BACKEND.md) |
| 哪些来源启用、停用或已实际核验 | [来源清单与核验](docs/NEWS-SOURCES.md) |
| 如何维护书架与转场性能 | [前端性能](docs/PERFORMANCE.md) |

本地开发仓库另有 `docs/README.md` 文档导航、`docs/PLAN.md` 项目状态和 `docs/DESIGN.md` 界面规范。
