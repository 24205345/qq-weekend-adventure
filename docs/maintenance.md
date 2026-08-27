# 维护手册

## 1. 技术概览

项目是一个基于 React、Next.js 和 vinext 的**个人邀请站**。多商户 SaaS 已迁到同级目录 `../qq-weekend-adventure-saas`（见 `docs/saas-migration.md`）。

| 模块 | 用途 |
| --- | --- |
| `app/page.tsx` | 个人邀请：步骤、状态、日期规则、提交和邀请函 |
| `lib/personal-booking.ts` | 通知 QQ 的 FormSubmit 邮件 |
| `lib/personal-data.ts` / `personal-mail.ts` / `personal-auth.ts` | 个人预约、档期、预约人反馈邮件、轻后台登录 |
| `/my-admin` | 个人轻后台：同意/拒绝/关时段 |
| `app/globals.css` | 响应式布局、日历和童话视觉样式 |
| `app/layout.tsx` | 页面元信息和全局布局 |
| `public/wonderland-garden.png` | 主背景图 |
| `public/og.png` | 社交分享预览图 |
| `.openai/hosting.json` | 旧 OpenAI Sites 标识（**已不可再发布**） |
| `tests/rendered-html.test.mjs` | 构建/源码基础检查 |

主要依赖：

- `react-day-picker`：日历
- `date-fns`：日期计算与中文格式化
- `motion`：否定按钮移动动画
- `lucide-react`：界面图标
- `html-to-image`：邀请函 PNG 导出

## 2. 关键业务配置

日期和时间配置位于 `app/page.tsx` 顶部：

```ts
const FRIDAY_SLOTS = ["21:00", "21:30", "22:00", "22:30", "23:00"];
const WEEKEND_SLOTS = ["10:30", "13:00", "15:30", "18:00", "20:30"];
```

日历通过星期值限制为周五、周六、周日。要临时关闭具体日期，建议新增一个不可用日期列表，再合并到 `DayPicker` 的 `disabled` 配置中，而不是改动通用星期规则。

活动列表也位于 `app/page.tsx` 顶部的 `activities` 数组。新增活动时需要提供唯一 `id`、标题、描述和 Lucide 图标，并同步扩展 `ActivityId` 类型。

## 3. 邮件通知

浏览器直接向以下 FormSubmit AJAX 地址发送 JSON（实现见 `lib/personal-booking.ts`）：

```text
https://formsubmit.co/ajax/18096095446@163.com
```

邮件包含：

- 预约编号
- 申请人名字或昵称
- 日期和时间
- 约会计划
- 悄悄话

首次使用或 FormSubmit 重新验证时，收件邮箱会收到激活邮件。必须点击其中的激活链接，否则预约可能只触发验证邮件而不会正常投递。

排查收不到邮件时，依次检查：

1. 163 邮箱的收件箱、垃圾邮件和广告邮件分类。
2. 是否完成 FormSubmit 激活。
3. 浏览器网络请求是否被广告拦截器或公司网络阻止。
4. 页面是否显示红色发送错误提示。
5. 使用一个新的日期和申请人重新提交，排除重复内容过滤。

当前邮箱地址存在前端代码中，因此任何访问网站的人都能从网络请求中看到它。若未来需要隐藏邮箱、加强防滥用或保存预约，应改为服务端接口，并使用环境变量保存收件地址。

## 4. 本地开发与验证

### 一键启动（Windows）

双击根目录 `start-local.bat`，或执行 `npm run local`。逻辑在 `scripts/start-local.ps1`：检查 Node `>=22.13.0`、按需 `npm install`、再 `npm run dev`，并延迟打开本地地址。详见 [本地一键启动说明](local-start.md)。

### 手动启动

安装依赖并启动：

```bash
npm install
npm run dev
```

提交前至少运行：

```bash
npm run build
```

涉及公共逻辑或依赖升级时，再运行：

```bash
npm test
npm run lint
```

人工检查重点：

1. 手机宽度下文字、活动按钮和邀请函不溢出。
2. 周一至周四不可选，周五与周末显示正确时间。
3. 没填名字、活动或自定义计划时不能继续。
4. 核对页、邮件和邀请函中的申请人信息一致。
5. 保存图片、日历下载和分享功能可正常触发。

## 5. 发布流程

### 旧 OpenAI Sites（已废弃为发布通道）

```text
https://qq-weekend-adventure.qianqianwang1099.chatgpt.site
```

该地址依赖 Codex / OpenAI Sites 控制面。脱离该环境后**无法可靠保存并发布新版本**。`.openai/hosting.json` 仅作历史记录；不要把它当成可恢复的上线入口。旧站若仍可打开，只可当临时过渡，对外请改用新托管地址。

### 个人站新托管（待选定）

推荐：Cloudflare Pages / Workers，或 Vercel。选定后把正式 URL 写回 README，并停止分享旧 Sites 链接。上线清单见 `docs/plan1-personal-split.md`。

GitHub 远程仓库：

```text
https://github.com/24205345/qq-weekend-adventure
```

仓库目前为私有。推送普通代码更新：

```bash
git add <修改的文件>
git commit -m "描述本次修改"
git push origin main
```

GitHub 推送**不会**更新旧 Sites 站点。

## 6. 回滚与安全

- 发布前保留清晰的小提交，出现问题时优先修复后重新发布。
- 旧 Sites 的 `project_id` 已不可作为正式发布依据；迁移到自有托管后以新项目配置为准。
- 不要把密码、邮箱授权码或 API 密钥提交到仓库。
- 不要直接覆盖用户尚未提交的本地修改。
- 如需更换收件邮箱，修改 `lib/personal-booking.ts` 中的地址后必须完成 FormSubmit 激活，并进行一次真实提交测试。

