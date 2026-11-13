@echo off
chcp 65001 >nul
title 小金店旧料管理系统 - 服务启动器
cd /d "%~dp0"
if exist "server\.restore-in-progress.json" (
    echo [错误] 检测到未结束的恢复，请先运行 data-maintenance.bat 的恢复中断回滚。
    pause
    exit /b 1
)

echo.
echo ========================================
echo   小金店旧料管理系统 - 一键启动
echo ========================================
echo.

REM 检查 Node.js 是否可用
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 24+ 后再运行。
    pause
    exit /b 1
)

REM 检查依赖是否安装
if not exist "server\node_modules" (
    echo [提示] 检测到后端依赖未安装，正在自动安装...
    cd server && call npm install && cd ..
)
if not exist "client\node_modules" (
    echo [提示] 检测到前端依赖未安装，正在自动安装...
    cd client && call npm install && cd ..
)

REM 检查数据库是否初始化
if not exist "server\prisma\dev.db" (
    echo [错误] 没有找到业务数据库，已停止启动。请从备份恢复，或按数据维护说明初始化新店。
    pause
    exit /b 1
)

echo.
echo [启动] 正在拉起前后端服务，崩溃会自动重启...
echo [提示] 首次启动约需 3-5 秒，浏览器访问 http://localhost:5173
echo [停止] 直接关闭本窗口，或按 Ctrl+C
echo.

node "%~dp0scripts\launcher.js"

pause
