# SaaS 代码迁出说明

> 执行日期：2026-08-27  
> 决策：个人邀请站与多商户 SaaS **彻底拆开**，SaaS 物理迁到同级目录

## 1. 背景

原仓库同时包含：

- 个人童话邀请页（`/`）
- 多商户预约 MVP（`/admin`、`/book/<slug>`）

两者曾共用 D1 与部分 API，维护边界不清。用户决定：

1. 个人站独立维护（邮件 + 轻后台）
2. SaaS 代码迁出，不再与本仓库混放
3. 旧 OpenAI Sites 不再作为发布通道

## 2. 迁出结果

### 本仓库（`qq-weekend-adventure-1` → GitHub `qq-weekend-adventure`）

**保留：**

| 类型 | 路径 |
| --- | --- |
| 页面 | `/`、`/my-admin` |
| API | `/api/personal/*` |
| 库 | `lib/personal-*` |
| 数据 | `personal_bookings`、`personal_slot_blocks` |
| 迁移 | `drizzle/0001_personal_light_admin.sql` |

**删除：**

| 类型 | 原路径 |
| --- | --- |
| 页面 | `app/admin/`、`app/book/` |
| API | `app/api/admin/`、`app/api/public/` |
| 库 | `lib/booking-data.ts`、`merchant.ts` 等 |
| 迁移 | `drizzle/0000_normal_chat.sql`（多商户） |
| 示例 | `examples/` |

### SaaS 本地副本（`G:\project\qq-weekend-adventure-saas`）

**包含：**

- `app/admin/`、`app/book/`、`app/api/admin/`、`app/api/public/`
- `lib/booking-data.ts`、`merchant.ts`、`admin-data.ts` 等
- `db/schema.ts`（仅 tenants 相关表）
- `drizzle/0000_normal_chat.sql`
- 新首页 `app/page.tsx`（SaaS 入口说明）

**已移除个人相关：**

- `/my-admin`、`/api/personal/`、`lib/personal-*`
- 个人文档、`start-local.bat`、`env.example`

> **注意：** SaaS 目录当前**未初始化 Git**，仅存在于本机。若需上 GitHub，需单独 `git init` 并创建远程仓库。

## 3. 操作清单（已完成）

- [x] 从本仓库删除 SaaS 路由与 lib
- [x] 拆分 `db/schema.ts`（个人仅 personal 表）
- [x] 新增个人轻后台与 `/api/personal`
- [x] 复制并清理 `qq-weekend-adventure-saas` 目录
- [x] 更新 README、测试、维护文档
- [x] 新增 [architecture.md](architecture.md)

## 4. 后续建议

### 个人站（本仓库）

1. 选定 Cloudflare / Vercel 并完成首次部署  
2. 配置 `env.example` 中的 Resend 与管理员密码  
3. 停止对外分享旧 `chatgpt.site` 链接  

### SaaS（本地副本）

1. 在 `qq-weekend-adventure-saas` 执行 `npm install`  
2. 如需远程备份：`git init` → 新建 GitHub 仓库 → push  
3. 配置 D1 + ChatGPT 登录后再考虑上线  

## 5. 两项目协作边界

- **不要**再把个人页写回 `tenants` / `bookings`  
- **不要**在两个目录间共享 `node_modules`  
- 改个人功能只在本仓库；改 SaaS 只在 `qq-weekend-adventure-saas`  

## 6. 相关文档

- [architecture.md](architecture.md) — 架构总览  
- [personal-light-admin.md](personal-light-admin.md) — 轻后台  
- [maintenance.md](maintenance.md) — 维护手册  
