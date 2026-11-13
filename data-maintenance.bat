@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 本工具需要 Node.js 24 或更新版本。
node scripts/data-maintenance.mjs menu
if errorlevel 1 echo 维护未完成，请查看上方原因。
pause
