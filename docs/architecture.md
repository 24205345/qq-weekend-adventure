# 项目架构说明

> 更新日期：2026-08-27  
> 本仓库：**个人周末邀请站**（主产品）

## 1. 总览

```text
┌─────────────────────────────────────────────────────────┐
│  qq-weekend-adventure-1（本仓库 · GitHub 主仓）          │
│  个人童话邀请 + 轻后台                                     │
├─────────────────────────────────────────────────────────┤
│  /              访客预约流程                               │
│  /my-admin      QQ 同意/拒绝/关档期                        │
│  /api/personal  个人预约 API                               │
│  D1             personal_bookings / personal_slot_blocks   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  qq-weekend-adventure-saas（同级目录 · 本地独立副本）      │
│  多商户预约 SaaS（已物理迁出，未纳入本 Git 仓库）           │
├─────────────────────────────────────────────────────────┤
│  /admin         商户后台                                   │
│  /book/<slug>   公开预约                                   │
│  /api/admin|public                                        │
│  D1             tenants / bookings / …                     │
└─────────────────────────────────────────────────────────┘
```

技术栈（两项目相同基座）：**Next.js + vinext + Vite + Cloudflare Workers + D1**。

## 2. 本仓库目录结构

```text
qq-weekend-adventure-1/
├── app/
│   ├── page.tsx              # 童话邀请首页
│   ├── globals.css           # 童话视觉
│   ├── layout.tsx
│   ├── my-admin/             # 个人轻后台
│   └── api/personal/         # 个人 API
├── lib/
│   ├── personal-*.ts         # 个人业务
│   └── ids.ts                # ID 工具
├── db/schema.ts              # 仅 personal_* 表
├── drizzle/0001_*            # 个人库迁移
├── scripts/start-local.ps1   # 一键启动
├── start-local.bat
├── env.example               # 环境变量模板
├── docs/                     # 文档
└── tests/
```

## 3. 个人站数据流

1. 访客在 `/` 选日期、时段、活动，填写昵称与邮箱  
2. `POST /api/personal/bookings` 写入 `personal_bookings`（状态 `pending`）  
3. FormSubmit 邮件通知 QQ  
4. QQ 在 `/my-admin` 同意或拒绝  
5. 同意时锁定该 `date + start_time`；Resend 向预约人发结果邮件（需配置密钥）

## 4. 环境变量

见 `env.example`：

| 变量 | 用途 |
| --- | --- |
| `PERSONAL_ADMIN_PASSWORD` | `/my-admin` 登录密码 |
| `RESEND_API_KEY` | 向预约人发送同意/拒绝邮件 |
| `RESEND_FROM_EMAIL` | Resend 发件人 |

## 5. 本地开发

```bash
npm install
npm run local   # 或双击 start-local.bat
```

默认地址：`http://localhost:3000`

详见 [local-start.md](local-start.md)。

## 6. 与 SaaS 的关系

- 2026-08-21：逻辑上拆分为「个人站 + SaaS 后置」  
- 2026-08-27：SaaS 代码**物理迁出**到 `G:\project\qq-weekend-adventure-saas`  
- 本仓库**不再包含** `/admin`、`/book`、多商户 API 与 `tenants` 表  

迁出细节：[saas-migration.md](saas-migration.md)

## 7. 旧 OpenAI Sites

旧地址 `*.chatgpt.site` 依赖 Codex/Sites 控制面，**不可再作为发布通道**。新托管请选 Cloudflare 或 Vercel，见 [maintenance.md](maintenance.md)。

## 8. 文档索引

| 文档 | 内容 |
| --- | --- |
| [product-spec.md](product-spec.md) | 产品流程与规则 |
| [personal-light-admin.md](personal-light-admin.md) | 轻后台设计 |
| [saas-migration.md](saas-migration.md) | SaaS 迁出记录 |
| [local-start.md](local-start.md) | 一键启动 |
| [maintenance.md](maintenance.md) | 维护与发布 |
| [experience-local-start.md](experience-local-start.md) | 本地启动经验 |
| [experience-font-consistency.md](experience-font-consistency.md) | 字体统一经验 |
