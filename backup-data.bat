@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 请先关闭小金店服务启动器。本工具需要 Node.js 24 或更新版本。
node scripts/data-maintenance.mjs backup
if errorlevel 1 echo 备份未完成，请查看上方原因；不要删除当前数据库或照片。
pause
