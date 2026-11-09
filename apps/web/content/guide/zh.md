<!-- section: overview -->
## 概览与结构

UserHQ 帮助您的团队收集并有效处理来自客户的反馈意见。以下是工作区的核心结构：

<cards>
- **1. Workspace（工作区）**：团队的中央中枢。管理团队成员、账单计费、API 密钥、Webhooks 以及跨所有产品的统一反馈收件箱。
- **2. Products（产品）**：您构建的独立应用或服务（例如 Web 应用、iOS 应用、API）。每个产品都有独立的反馈面板、路线图、更新日志、分类以及品牌定制。
- **3. Customer Portals（客户门户）**：带有品牌标识的公开门户，用户可在其中提交建议、为功能需求投票、关注公开路线图并查看版本发布公告。
</cards>

<!-- section: roles-permissions -->
## 团队角色与权限控制

在保持对工作区设置完全掌控的同时，与整个团队顺畅协作：

<cards>
- **Workspace Owner（所有者）**：最高控制权：管理订阅计费、邀请管理员、生成 API 密钥、配置 Webhooks 以及转移所有权。
- **Workspace Admin（管理员）**：管理产品配置、分流与归类反馈、以官方身份回复客户、管理路线图卡片以及发布更新日志。
- **Workspace Member（成员）**：查看客户反馈提案、参与团队内部讨论并跟进客户需求。
</cards>

<!-- section: requests-inbox -->
## 需求提案与分流处理（Triage）

位于 `/dashboard/[ws]/requests`，统一需求收件箱将所有产品的客户提交整合到一个高效的分流看板中。

<cards>
- **多维度筛选**：按产品、状态阶段（待办、进行中、已完成）、分类、关键词搜索和日期范围即时筛选。
- **快速状态流转**：一键在不同阶段间切换（评估中、已规划、开发中、已完成），系统会自动通知为该需求投票的客户。
</cards>

<!-- section: comments-attention -->
## 评论与待处理收件箱

位于 `/dashboard/[ws]/comments`，此收件箱相当于一个快速响应的客户支持中心。

### 工作流阶段

<stages>
- **Needs Attention（需要关注）**：尚未收到团队官方回复的客户评论。以琥珀色高亮指示器标识，确保不错过任何客户疑问。
- **Handled（已处理）**：团队成员发布官方回复后自动移出关注队列，或支持手动标记为已处理。
</stages>

<!-- section: author-location -->
## 提交者联系与地理洞察

为了向团队提供关于反馈来源的深度背景，需求和评论卡片会展示提交者详细信息：

- **直接邮件沟通**：点击提交者姓名旁的邮件图标，即可发起沟通、预约用户访谈或进行需求追问。
- **地理分布洞察**：查看客户的大致地理位置（例如 `London, United Kingdom [GB]`），以便了解区域使用习惯与趋势。
- **隐私保护设计**：提交者邮箱与地理位置仅对工作区团队成员可见，绝不会公开在外部客户门户上。
</cards>

<!-- section: customer-portals -->
## 公开客户门户

工作区中的每个产品都可以在 `/[ws]/[product]` 拥有专属的公开门户。

<cards>
- **模块化功能开关**：根据当前开放进度，针对各个产品分别开启或关闭反馈面板、路线图、更新日志或常见问题（FAQ）。
- **自定义品牌与主题色**：上传 Logo、配置品牌名称并挑选自定义强调色，打造与应用无缝融合的视觉体验。
- **多语言与 RTL 镜像支持**：全面支持 13 种语言，具备访客语言智能检测、语言切换器及本地化内容编辑功能。
- **默认语言无缝切换**：切换默认语言时，现有翻译自动升级为主字段，旧文本安全归档为翻译。
- **用户徽章认证**：通过发帖与评论旁的身份徽章认可核心客户，支持手动分配或基于链接归因规则自动发放。
</cards>

<!-- section: roadmap-changelog -->
## 路线图规划与版本发布

<cards>
- **互动式路线图**：将功能进度划分为直观的看板列（评估中、计划中、进行中），并将客户反馈直接关联到卡片上。
- **更新日志与发布公告**：发布带有分类标签（新功能、改进优化、问题修复）的更新公告，自动闭环通知关注客户。
</cards>

<!-- section: faq-system -->
## 自助式 FAQ 知识库

在产品门户上添加按分类组织的常见问题解答。及时答疑能有效减少重复需求提交并降低客服支持压力。

<!-- section: themes-push -->
## 外观主题与 Web Push 通知

UserHQ 提供四种主题：**跟随系统**、**浅色**、**深蓝**（Deep Navy）与**炭黑**（Charcoal）。团队成员可在 `/account` 中启用浏览器 Web Push 推送，第一时间获悉新反馈与评论。

<!-- section: api-overview -->
## 自动化 API 与身份鉴权

通过 UserHQ REST Automation API，无缝连接外部系统、CI/CD 流程、Slack、Discord、Linear、GitHub 或内部监控大盘。

### 鉴权请求头（Header）

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **速率限制**：每个 API 密钥享有每分钟 120 次请求的充裕额度，内置令牌桶平滑限流保护。
- **按范围分配权限**：可将密钥权限限制在指定产品，并精准控制读写资源范围。
</cards>

<!-- section: swagger-explorer -->
## 交互式 API 资源管理器

直接在线测试接口、检查参数定义、查看请求与响应 Schema，并一键生成 cURL、TypeScript 与 Python 调用代码。

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhooks 与 HMAC 签名验证

当创建需求、更新状态或发表评论时，UserHQ 会实时分发 HTTP POST 事件。每次投递均在 `x-userhq-signature` 请求头中附带安全的 HMAC-SHA256 签名。

### Node.js / Express HMAC 验证示例

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
