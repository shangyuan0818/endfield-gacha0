@echo off
REM ============================================
REM 终末地抽卡分析器 - 后端快速部署脚本 (Windows)
REM 用途: 将完全后端化导入功能部署到阿里云 ECS
REM 日期: 2026-02-24
REM ============================================

setlocal enabledelayedexpansion

REM 配置变量（请根据实际情况修改）
set ECS_HOST=your-ecs-ip
set ECS_USER=root
set ECS_BACKEND_PATH=/path/to/backend
set LOCAL_BACKEND_PATH=.\gacha-analyzer\backend

echo ============================================
echo   终末地抽卡分析器 - 后端快速部署
echo ============================================
echo.

REM 检查本地文件是否存在
echo [1/7] 检查本地文件...
if not exist "%LOCAL_BACKEND_PATH%\fullImportService.js" (
    echo 错误: fullImportService.js 不存在
    exit /b 1
)

if not exist "%LOCAL_BACKEND_PATH%\server.js" (
    echo 错误: server.js 不存在
    exit /b 1
)

if not exist "%LOCAL_BACKEND_PATH%\package.json" (
    echo 错误: package.json 不存在
    exit /b 1
)

echo √ 本地文件检查完成
echo.

REM 提示用户使用 WinSCP 或其他工具上传文件
echo [2/7] 上传文件到 ECS...
echo.
echo 请使用以下方式之一上传文件到 ECS:
echo.
echo 方法 1: 使用 WinSCP
echo   1. 打开 WinSCP
echo   2. 连接到 %ECS_HOST%
echo   3. 上传以下文件到 %ECS_BACKEND_PATH%:
echo      - fullImportService.js
echo      - server.js
echo      - package.json
echo      - FULL_IMPORT_SETUP.md
echo.
echo 方法 2: 使用 scp (需要安装 OpenSSH)
echo   scp "%LOCAL_BACKEND_PATH%\fullImportService.js" %ECS_USER%@%ECS_HOST%:%ECS_BACKEND_PATH%/
echo   scp "%LOCAL_BACKEND_PATH%\server.js" %ECS_USER%@%ECS_HOST%:%ECS_BACKEND_PATH%/
echo   scp "%LOCAL_BACKEND_PATH%\package.json" %ECS_USER%@%ECS_HOST%:%ECS_BACKEND_PATH%/
echo.
echo 方法 3: 使用阿里云控制台
echo   1. 登录阿里云控制台
echo   2. 进入 ECS 实例
echo   3. 使用文件上传功能
echo.
pause
echo.

REM 提示用户执行后续步骤
echo [3/7] 安装依赖...
echo.
echo 请在 ECS 上执行以下命令:
echo.
echo   cd %ECS_BACKEND_PATH%
echo   npm install
echo.
pause
echo.

REM 配置环境变量
echo [4/7] 配置环境变量...
echo.
echo 请在 ECS 上执行以下命令:
echo.
echo   cd %ECS_BACKEND_PATH%
echo   nano .env
echo.
echo 添加以下内容:
echo.
echo   PORT=3001
echo   ALLOWED_ORIGINS=https://ef-gacha.mogujun.icu
echo   SUPABASE_URL=https://lluvpuesaclljbiqacts.supabase.co
echo   SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
echo.
echo 获取 service_role_key:
echo   1. 打开 https://supabase.com/dashboard/project/lluvpuesaclljbiqacts
echo   2. 进入 Settings -^> API
echo   3. 复制 service_role key
echo.
pause
echo.

REM 重启服务
echo [5/7] 重启后端服务...
echo.
echo 请在 ECS 上执行以下命令之一:
echo.
echo 如果使用 PM2:
echo   pm2 restart backend
echo   pm2 logs backend --lines 50
echo.
echo 如果使用 systemd:
echo   systemctl restart backend
echo   journalctl -u backend -n 50 -f
echo.
echo 如果手动运行:
echo   pkill -f "node server.js"
echo   nohup node server.js ^> backend.log 2^>^&1 ^&
echo.
pause
echo.

REM 验证部署
echo [6/7] 验证部署...
echo.
echo 请执行以下命令验证:
echo.
echo 1. 检查健康状态:
echo   curl https://ef-backend.mogujun.icu/health
echo.
echo 2. 检查日志:
echo   pm2 logs backend --lines 100 ^| grep "完全后端化导入"
echo.
echo 3. 测试新 API:
echo   curl https://ef-backend.mogujun.icu/api/hg-proxy?action=import-status^&taskId=test
echo.
pause
echo.

echo ============================================
echo   部署指南完成！
echo ============================================
echo.
echo 后续步骤:
echo 1. 检查日志确认 "完全后端化导入: 已启用"
echo 2. 测试导入功能
echo 3. 监控后端运行状态
echo.
echo 详细文档: URGENT_FIX_GUIDE.md
echo.
pause
