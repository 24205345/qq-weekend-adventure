# 和 QQ 的周末小冒险

一个面向手机端的可爱童话风约会预约网站。访客可以接受邀请、选择周末日期和时间、填写名字或昵称、挑选活动，最后生成一张约会邀请函；QQ 会通过邮件收到同一份预约信息。

- 旧线上地址（OpenAI Sites，**已不可再发布，勿再依赖**）：https://qq-weekend-adventure.qianqianwang1099.chatgpt.site
- GitHub 仓库：https://github.com/24205345/qq-weekend-adventure
- 当前状态：个人邀请站独立维护；多商户 SaaS 已迁到同级目录 `../qq-weekend-adventure-saas`

## 已实现功能

- 爱丽丝梦游仙境式的复古童话视觉与手机端布局
- 会躲开的“暂时不愿意”按钮，尝试三次后仍允许访客正常拒绝
- 只开放周五晚上和周六、周日的日期选择
- 申请人名字、邮箱与活动选择
- 可选悄悄话、提交前核对页和邮件通知
- 轻后台 `/my-admin`：同意/拒绝、关闭档期、邮件反馈预约人
- 可保存邀请函图片、加入系统日历和分享邀请

## 项目结构

| 路径 | 作用 |
| --- | --- |
| `/` | 童话邀请页 |
| `/my-admin` | 个人轻后台 |
| `/api/personal/*` | 个人预约 API |
| `lib/personal-*` | 个人业务逻辑 |
| `docs/personal-light-admin.md` | 轻后台设计 |

多商户预约 SaaS 已物理迁出，见 **`G:\project\qq-weekend-adventure-saas`**。

## 本地运行

需要 Node.js `>=22.13.0`。

双击 `start-local.bat`，或执行：

```bash
npm run local
```

默认打开 `http://localhost:3000`。配置见 `env.example`。

## 文档

- [架构说明](docs/architecture.md)：目录结构、数据流、与 SaaS 边界
- [产品说明](docs/product-spec.md)
- [个人轻后台设计](docs/personal-light-admin.md)
- [SaaS 迁出说明](docs/saas-migration.md)
- [本地一键启动](docs/local-start.md)
- [维护手册](docs/maintenance.md)
