# 个人轻后台设计（方案 A）

## 1. 目标

在**不接回多商户 SaaS**的前提下，让 QQ 可以：

1. 查看预约申请  
2. 同意 / 拒绝  
3. 手动关闭某个「日期 + 时间」的可约档  
4. 同意或拒绝后，向**预约人邮箱**发送结果反馈  

## 2. 方案选型

| 项 | 方案 | 权重 | 结论 |
| --- | --- | --- | --- |
| 产品形态 | A 个人轻后台 `/my-admin` / B 重接多商户 `/admin` | 90 / 45 | 采用 A |
| 存储 | A 个人 D1 表（与 tenants 分离） / B 外接 Supabase | 88 / 70 | 采用 A |
| 预约人邮件 | A Resend 事务邮件 / B 仅状态页不发信 | 90 / 55 | 采用 A（未配置密钥时后台仍可操作，提示需补发） |
| 登录 | A 单一管理密码 Cookie / B 魔法链接 | 85 / 65 | 采用 A（个人够用） |

## 3. 数据

### `personal_bookings`

- 状态：`pending` | `approved` | `rejected` | `cancelled`
- 占用档期：`pending`、`approved` 占用该 `date + start_time`
- `rejected` / `cancelled` 释放档期（除非另有手动封禁）

### `personal_slot_blocks`

- 手动关闭的具体 `date + start_time`
- 同意某预约后也会写入一条 block（防止拒绝后又被误开；取消同意时可删）

## 4. 流程

1. 访客选时段 → 填昵称与**邮箱** → 提交  
2. 写入 `pending`，邮件通知 QQ（FormSubmit，保持现网习惯）  
3. QQ 在 `/my-admin` 同意 → 状态 `approved` + 封禁该时段 → **Resend 通知预约人**  
4. QQ 拒绝 → `rejected` → **Resend 通知预约人**  
5. QQ 也可不经过预约，直接封禁「本周五 22:00」这类格子  

## 5. 环境变量

| 变量 | 用途 |
| --- | --- |
| `PERSONAL_ADMIN_PASSWORD` | 轻后台密码（本地默认见 vite 配置，上线务必改） |
| `RESEND_API_KEY` | 给预约人发信 |
| `RESEND_FROM_EMAIL` | 发件人（需在 Resend 验证域名或用测试发件人） |

## 7. 本地试用

1. `npm run local`（或 `npm run dev`）
2. 打开 `/` 走预约；填写邮箱
3. 打开 `/my-admin`，默认本地密码见 `env.example`（`qq-weekend-dev`）
4. 点击「同意并通知」或「拒绝并通知」
5. 配置 `RESEND_API_KEY` 后，预约人才能真正收到反馈邮件；未配置时后台仍可改状态并提示手动通知

## 8. 执行记录

| 日期 | 内容 |
| --- | --- |
| 2026-08-21 | 落地个人表、公开 API、轻后台、同意/拒绝邮件钩子 |
