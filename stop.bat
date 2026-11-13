@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-services.ps1"
if errorlevel 1 echo 停止检查失败，请手工关闭小金店启动窗口。
pause
