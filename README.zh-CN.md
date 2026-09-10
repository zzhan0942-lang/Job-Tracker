# Job Tracker

中文 | [English](./README.md)

一个把岗位记录、完整求职进度、下一步提醒和数据可视化放在一起的个人求职记录工具。

Job Tracker 不只保存“当前状态”。从投递、测评、笔试、AI 面试、正式面试、HR 到 Offer，每一次流程变化都可以独立记录，方便回看完整过程。

## 为什么使用 Job Tracker

普通岗位清单通常只能记录一列状态。Job Tracker 将岗位本身和后续进度关联起来：一份岗位信息可以对应多条进度记录，既能快速查看当前进展，也能保留每一次变化的上下文。

## 核心功能

### 岗位记录

记录并管理每一份投递：

- 公司名称、岗位名称与 Base
- 投递日期与当前状态
- 官网链接与备注
- 新增、编辑和删除岗位

岗位信息会与后续求职过程关联，而不是停留在一张静态清单中。

### 完整进度记录

每一次求职事件都可以单独保存，例如：

- 投递
- 收到或完成测评
- 收到或完成笔试
- 收到或完成 AI 面、一面、二面、三面、HR 面
- 收到 Offer、淘汰、主动放弃、流程暂停

每条进度记录可包含事件类型、阶段、事件日期、结果、下一步日期、备注和相关链接。

系统不强制固定流程顺序。例如 `投递 → AI 面 → 笔试 → 一面` 这样的非标准流程也可以按实际经历正常记录。

## ⏰ DDL / 下一步提醒

可为测评、笔试、面试和 HR 等进度设置“下一步日期”。首页的“待跟进”区域会集中展示未来最近的事项，帮助你优先处理临近的求职任务。

### 岗位详情与时间线

每个岗位都有独立详情页，可查看完整进度时间线、已经历阶段和相关信息。你可以在详情页中编辑岗位、添加进展、编辑或删除进展记录。

## 📊 5 个核心数据可视化

1. **求职流程阶段概览**：展示总投递、仍在流程、进入面试和收到 Offer 的记录数量，以及它们相对总投递的占比。
2. **当前状态分布**：查看岗位目前集中在哪些状态，快速了解进行中、已结束和 Offer 等记录的构成。
3. **每周投递趋势**：按最近 8 周统计投递数量，点击或悬停柱状图可以查看某一周的具体数量。
4. **Base 分布**：按 Base 汇总岗位数量，帮助查看投递地点的分布。
5. **流程转化率**：按岗位实际经历过的阶段计算阶段转化，并显示当前最大流失环节提示。

## 首页包含什么

- 总投递数、活跃流程、测评 / 笔试、面试中和 Offer 五项概览
- 待跟进的 Upcoming Tasks
- 最近进展，可筛选“进行中”或“全部”并搜索岗位
- 我的投递，支持搜索、状态筛选与分页
- 求职进度分析和数据可视化

整体上，它是一个更方便整理和查看完整求职过程的个人求职记录工具，而不是招聘分析平台或商业 SaaS。

## Notion 双数据库结构

```text
Job Applications
      ↕ Relation
Progress Records
```

- **Job Applications** 保存岗位本身：公司、岗位、Base、投递日期、当前状态等。
- **Progress Records** 保存每一次求职事件：测评、笔试、面试、结果、下一步日期和备注等。
- 一个岗位可以关联多条进度记录。
- 公司名称、岗位名称和 Base 等信息可通过 Relation / Rollup 同步到进度记录。

这样既保留岗位的当前状态，也不会丢失完整的求职过程。

## 🧩 Notion Template

不想手动创建数据库？可以直接复制已经配置好的 Notion 模板：

[一键复制 Job Tracker Notion Template](https://rapid-acrylic-365.notion.site/Job-Tracker-Notion-Template-3d727236ee1381e9b4f2d98f2be1ebe0?source=copy_link)

快速开始：

1. Duplicate Notion 模板到自己的工作区。
2. 创建自己的 Notion Integration。
3. 将 Integration 连接到两个数据库。
4. 获取 Applications 和 Progress 两个 Data Source ID。
5. 复制 `.env.example` 为 `.env.local`。
6. 填入自己的环境变量。
7. 运行 `npm install`。
8. 运行 `npm run dev`。

模板不包含作者的真实求职数据，也不包含任何 Notion Token。每位使用者都需要使用自己的 Notion Integration 和数据库。

## 手动配置与数据库字段参考

如需手动创建数据库，请使用与代码一致的字段名称和类型；字段名不一致时接口可能无法正常工作。

### Job Applications

| 字段 | Notion 类型 | 用途 |
| --- | --- | --- |
| `岗位标识` | Title | 岗位显示标题 |
| `公司名称` | Text | 公司名称 |
| `岗位名称` | Text | 岗位名称 |
| `Base` | Text | 地点或 Base |
| `投递状态` | Status | 当前状态 |
| `日期` | Date | 投递日期 |
| `备注` | Text | 备注 |
| `官网链接` | URL | 岗位或官网链接 |
| `进度记录` | Relation | 与 Progress Records 的反向关联 |

### Progress Records

| 字段 | Notion 类型 | 用途 |
| --- | --- | --- |
| `记录标题` | Title | 进度记录标题 |
| `关联岗位` | Relation | 关联一条 Job Applications 记录 |
| `公司名称` | Rollup | 从关联岗位同步公司名称 |
| `岗位名称` | Rollup | 从关联岗位同步岗位名称 |
| `Base` | Rollup | 从关联岗位同步 Base |
| `事件类型` | Select | 本次发生的事件 |
| `阶段` | Select | 当前阶段 |
| `事件日期` | Date | 事件日期 |
| `结果` | Select | 事件结果 |
| `下一步日期` | Date | 下一步提醒日期 |
| `备注` | Text | 备注 |
| `相关链接` | URL | 相关链接 |

## 其他实际功能

- Dark Mode，支持白天、黑夜和跟随系统。
- 响应式布局，桌面端使用表格，移动端使用卡片列表。
- 岗位和最近进展均支持搜索、筛选或分页。
- 岗位详情页与完整进度时间线。
- 根据进度事件自动同步岗位状态。
- 使用 Notion API 存储自己的求职记录。
- 服务器端 Basic Auth 保护页面和 API。
- 可部署到支持 Next.js 的平台，或自行托管。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Notion API (`@notionhq/client`)
- Vercel compatible

## 本地运行

```bash
git clone <your-fork-or-repository-url>
cd job-tracker
npm install
cp .env.example .env.local
npm run dev
```

环境变量说明和更完整的英文部署步骤请参阅 [README.md](./README.md)。

## 隐私与安全

- GitHub 仓库不包含作者真实求职数据。
- 仓库不包含真实 Notion Token。
- 每位使用者应使用自己的 Notion Integration 和数据库。
- 不要将 `.env.local` 提交到 GitHub。
- 线上个人实例建议开启 Basic Auth。
- 不要用 `NEXT_PUBLIC_` 前缀保存 Notion Token、Data Source ID 或 Basic Auth 凭据。
- Notion Integration 应只被授权访问目标数据库。
