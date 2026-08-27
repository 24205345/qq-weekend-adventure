# 经验：Windows 本地一键启动脚本

## 适用场景

- 给非开发或临时体验的人快速跑本地 demo
- 仓库有 `npm run dev`，但缺少依赖安装与环境检查
- 目标用户主要在 Windows

## 推荐做法

1. **双击入口用 `.bat`**：调用 PowerShell，规避执行策略问题（`-ExecutionPolicy Bypass`）。
2. **真正逻辑放 `.ps1`**：版本检查、按需安装、启动、打开浏览器。
3. **同时挂 `npm run local`**：方便已在终端里的开发者。
4. **不要用 `&&` 串命令**（部分 Windows PowerShell/旧环境不支持）；分步执行并检查 `$LASTEXITCODE`。
5. **浏览器地址可配置**：默认 Vite 常见端口 `5173`，用环境变量覆盖；实际端口以终端输出为准。

## 避免踩坑

- bat 里用 `cd /d "%~dp0"`，保证从任意位置双击都能进到项目根。
- ps1 用 `$PSScriptRoot` 的父目录当项目根（脚本在 `scripts/` 下时）。
- 首次 `npm install` 可能很慢，要在控制台明确提示。
- 自动开浏览器用延迟 Job，失败时静默忽略，避免挡住启动。

## 本仓库落点

- `start-local.bat`
- `scripts/start-local.ps1`
- `docs/local-start.md`
