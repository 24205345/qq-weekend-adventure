# 本地一键启动：检查 Node → 安装依赖 → 启动开发服务器 → 打开浏览器
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  和 QQ 的周末小冒险 · 本地快速启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "项目目录: $ProjectRoot"
Write-Host ""

function Get-NodeMajorMinorPatch {
  param([string]$VersionText)
  if ($VersionText -match "v?(\d+)\.(\d+)\.(\d+)") {
    return [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
  }
  return $null
}

function Test-VinextReady {
  return (Test-Path (Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js")) -and (
    (Test-Path (Join-Path $ProjectRoot "node_modules\.bin\vinext.cmd")) -or
    (Test-Path (Join-Path $ProjectRoot "node_modules\.bin\vinext")) -or
    (Test-Path (Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"))
  )
}

# 1. 检查 Node / npm
try {
  $nodeVersionRaw = (& node -v 2>$null)
  $npmVersionRaw = (& npm -v 2>$null)
} catch {
  Write-Host "[错误] 未检测到 Node.js 或 npm。" -ForegroundColor Red
  Write-Host "请先安装 Node.js >= 22.13.0：https://nodejs.org/" -ForegroundColor Yellow
  exit 1
}

if (-not $nodeVersionRaw -or -not $npmVersionRaw) {
  Write-Host "[错误] 未检测到 Node.js 或 npm。" -ForegroundColor Red
  Write-Host "请先安装 Node.js >= 22.13.0：https://nodejs.org/" -ForegroundColor Yellow
  exit 1
}

$minNode = [version]"22.13.0"
$currentNode = Get-NodeMajorMinorPatch $nodeVersionRaw
if (-not $currentNode -or $currentNode -lt $minNode) {
  Write-Host "[错误] Node 版本过低：$nodeVersionRaw（需要 >= 22.13.0）" -ForegroundColor Red
  exit 1
}

Write-Host "[OK] Node $nodeVersionRaw / npm $npmVersionRaw" -ForegroundColor Green

# 2. 缺依赖或 vinext CLI 丢失则安装（常见：node_modules 不完整、.bin 丢失）
$needInstall = -not (Test-Path (Join-Path $ProjectRoot "node_modules"))
if (-not $needInstall -and -not (Test-Path (Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"))) {
  $needInstall = $true
  Write-Host "[提示] 检测到 vinext 缺失，将重新安装依赖。" -ForegroundColor Yellow
}
if (-not $needInstall) {
  $pkgLock = Join-Path $ProjectRoot "package-lock.json"
  $marker = Join-Path $ProjectRoot "node_modules\.package-lock.json"
  if ((Test-Path $pkgLock) -and (Test-Path $marker)) {
    $lockTime = (Get-Item $pkgLock).LastWriteTimeUtc
    $markerTime = (Get-Item $marker).LastWriteTimeUtc
    if ($lockTime -gt $markerTime) {
      $needInstall = $true
      Write-Host "[提示] 检测到 package-lock.json 比已安装依赖更新，将重新安装。" -ForegroundColor Yellow
    }
  }
}

if ($needInstall) {
  Write-Host "[步骤] 正在安装依赖（首次可能较慢）..." -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] npm install 失败。" -ForegroundColor Red
    exit $LASTEXITCODE
  }
  if (-not (Test-Path (Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"))) {
    Write-Host "[错误] 依赖安装后仍找不到 vinext，请删除 node_modules 后重试。" -ForegroundColor Red
    exit 1
  }
  Write-Host "[OK] 依赖安装完成" -ForegroundColor Green
} else {
  Write-Host "[OK] 依赖已就绪，跳过安装" -ForegroundColor Green
}

# 3. 默认本地地址（本项目 vinext 默认 3000；若占用会自动换端口，以终端输出为准）
$LocalUrl = if ($env:LOCAL_DEV_URL) { $env:LOCAL_DEV_URL } else { "http://localhost:3000" }

Write-Host ""
Write-Host "[步骤] 启动开发服务器..." -ForegroundColor Yellow
Write-Host "浏览器将稍后打开: $LocalUrl" -ForegroundColor DarkGray
Write-Host "按 Ctrl+C 可停止服务" -ForegroundColor DarkGray
Write-Host ""

# 延迟打开浏览器，给服务一点启动时间
$openJob = Start-Job -ScriptBlock {
  param($Url)
  Start-Sleep -Seconds 8
  try {
    Start-Process $Url | Out-Null
  } catch {
    # 忽略自动打开失败，用户可手动访问
  }
} -ArgumentList $LocalUrl

$devExitCode = 0
try {
  npm run dev
  $devExitCode = $LASTEXITCODE
  if ($null -eq $devExitCode) { $devExitCode = 0 }
} catch {
  Write-Host "[错误] 启动开发服务器异常：$($_.Exception.Message)" -ForegroundColor Red
  $devExitCode = 1
} finally {
  if ($openJob) {
    Stop-Job $openJob -ErrorAction SilentlyContinue
    Remove-Job $openJob -Force -ErrorAction SilentlyContinue
  }
}

if ($devExitCode -ne 0) {
  Write-Host ""
  Write-Host "[错误] 开发服务器退出，代码: $devExitCode" -ForegroundColor Red
  Write-Host "若仍失败，可在项目目录手动执行: npm install" -ForegroundColor Yellow
  Write-Host "然后执行: npm run dev" -ForegroundColor Yellow
  exit $devExitCode
}
