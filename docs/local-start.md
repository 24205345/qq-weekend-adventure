# 本地一键启动说明（执行文档）

## 1. 背景与目标

仓库已支持 `npm run dev`，但 Windows 上手仍需手动检查 Node、安装依赖并找本地地址。本轮增加一键脚本，降低本地浏览 demo 的门槛。

## 2. 方案选择

| 方案 | 内容 | 权重 |
| --- | --- | --- |
| A（已采用） | `start-local.bat` + `scripts/start-local.ps1`，并挂 `npm run local` | 90 |
| B（未采用） | 仅跨平台 Node 脚本，通过 `npm run local` 调用 | 65 |

选择 A：当前主力环境是 Windows，双击 bat 最接近“一键”。

## 3. 交付文件

| 文件 | 作用 |
| --- | --- |
| `start-local.bat` | 双击入口，调用 PowerShell 脚本 |
| `scripts/start-local.ps1` | 实际逻辑：版本检查、安装依赖、启动、开浏览器 |
| `package.json` → `local` | 终端里一键：`npm run local` |
| `docs/local-start.md` | 本执行说明 |

## 4. 使用方式

1. 安装 [Node.js](https://nodejs.org/) `>=22.13.0`。
2. 任选其一：
   - 双击 `start-local.bat`
   - 或在项目根目录执行：`npm run local`
3. 等待依赖安装（仅首次或 lock 变更时）与服务启动。
4. 约 8 秒后脚本会尝试打开 `http://localhost:3000`；若端口被占用，以终端里 Vite/vinext 打印的 Local 地址为准。

可选环境变量：

```text
LOCAL_DEV_URL=http://localhost:3000
```

用于覆盖默认打开的浏览器地址。

## 5. 脚本行为摘要

1. 切到项目根目录。
2. 检查 `node` / `npm`，且 Node `>= 22.13.0`。
3. 若无 `node_modules`，或 `package-lock.json` 比已安装标记更新，则执行 `npm install`。
4. 后台延迟打开浏览器。
5. 前台执行 `npm run dev`；`Ctrl+C` 停止服务。

## 6. 已知边界

- 主要面向 Windows；Mac/Linux 可直接用 `npm install` + `npm run dev`。
- `/admin` 依赖 Sign in with ChatGPT，本地未必完整可用。
- 邮件通知依赖外网 FormSubmit。
- 首页童话流程一般可本地浏览；多商户接口依赖本地 D1 绑定是否正常。

## 7. 验证清单

- [ ] 双击 `start-local.bat` 能进入启动流程
- [ ] Node 过低时给出明确错误
- [ ] 无 `node_modules` 时会自动安装
- [ ] 终端出现开发服务器地址
- [ ] 浏览器能打开首页童话邀请页
