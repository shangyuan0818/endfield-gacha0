#!/bin/bash

# ============================================
# 终末地抽卡分析器 - 后端快速部署脚本
# 用途: 将完全后端化导入功能部署到阿里云 ECS
# 日期: 2026-02-24
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量（请根据实际情况修改）
ECS_HOST="your-ecs-ip"
ECS_USER="root"
ECS_BACKEND_PATH="/path/to/backend"
LOCAL_BACKEND_PATH="./gacha-analyzer/backend"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  终末地抽卡分析器 - 后端快速部署${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# 检查本地文件是否存在
echo -e "${YELLOW}[1/7] 检查本地文件...${NC}"
if [ ! -f "$LOCAL_BACKEND_PATH/fullImportService.js" ]; then
    echo -e "${RED}错误: fullImportService.js 不存在${NC}"
    exit 1
fi

if [ ! -f "$LOCAL_BACKEND_PATH/server.js" ]; then
    echo -e "${RED}错误: server.js 不存在${NC}"
    exit 1
fi

if [ ! -f "$LOCAL_BACKEND_PATH/package.json" ]; then
    echo -e "${RED}错误: package.json 不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 本地文件检查完成${NC}"
echo ""

# 上传文件到 ECS
echo -e "${YELLOW}[2/7] 上传文件到 ECS...${NC}"
scp "$LOCAL_BACKEND_PATH/fullImportService.js" "$ECS_USER@$ECS_HOST:$ECS_BACKEND_PATH/"
scp "$LOCAL_BACKEND_PATH/server.js" "$ECS_USER@$ECS_HOST:$ECS_BACKEND_PATH/"
scp "$LOCAL_BACKEND_PATH/package.json" "$ECS_USER@$ECS_HOST:$ECS_BACKEND_PATH/"
scp "$LOCAL_BACKEND_PATH/FULL_IMPORT_SETUP.md" "$ECS_USER@$ECS_HOST:$ECS_BACKEND_PATH/" 2>/dev/null || true

echo -e "${GREEN}✓ 文件上传完成${NC}"
echo ""

# 安装依赖
echo -e "${YELLOW}[3/7] 安装依赖...${NC}"
ssh "$ECS_USER@$ECS_HOST" << ENDSSH
cd "$ECS_BACKEND_PATH"
npm install
echo "✓ 依赖安装完成"
ENDSSH

echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# 配置环境变量
echo -e "${YELLOW}[4/7] 配置环境变量...${NC}"
echo -e "${YELLOW}请输入 Supabase Service Role Key:${NC}"
read -s SUPABASE_SERVICE_ROLE_KEY
echo ""

ssh "$ECS_USER@$ECS_HOST" << ENDSSH
cd $ECS_BACKEND_PATH

# 备份旧的 .env 文件
if [ -f .env ]; then
    cp .env .env.backup.\$(date +%Y%m%d_%H%M%S)
fi

# 创建或更新 .env 文件
cat > .env << EOF
PORT=3001
ALLOWED_ORIGINS=https://ef-gacha.mogujun.icu
SUPABASE_URL=https://lluvpuesaclljbiqacts.supabase.co
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF

echo "✓ 环境变量配置完成"
ENDSSH

echo -e "${GREEN}✓ 环境变量配置完成${NC}"
echo ""

# 重启服务
echo -e "${YELLOW}[5/7] 重启后端服务...${NC}"
ssh "$ECS_USER@$ECS_HOST" << ENDSSH
cd "$ECS_BACKEND_PATH"

# 尝试使用 PM2 重启
if command -v pm2 &> /dev/null; then
    pm2 restart backend || pm2 start server.js --name backend
    echo "✓ PM2 服务重启完成"
# 尝试使用 systemd 重启
elif systemctl is-active --quiet backend; then
    systemctl restart backend
    echo "✓ Systemd 服务重启完成"
# 手动重启
else
    pkill -f "node server.js" || true
    nohup node server.js > backend.log 2>&1 &
    echo "✓ 手动重启完成"
fi
ENDSSH

echo -e "${GREEN}✓ 服务重启完成${NC}"
echo ""

# 等待服务启动
echo -e "${YELLOW}[6/7] 等待服务启动...${NC}"
sleep 3

# 验证部署
echo -e "${YELLOW}[7/7] 验证部署...${NC}"

# 检查健康状态
HEALTH_CHECK=$(curl -s https://ef-backend.mogujun.icu/health)
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
else
    echo -e "${RED}✗ 健康检查失败${NC}"
    echo "响应: $HEALTH_CHECK"
fi

# 检查日志
echo ""
echo -e "${YELLOW}检查服务日志...${NC}"
ssh "$ECS_USER@$ECS_HOST" << ENDSSH
cd "$ECS_BACKEND_PATH"

if command -v pm2 &> /dev/null; then
    pm2 logs backend --lines 20 --nostream | grep -E "(完全后端化导入|Supabase Admin|API 端点)" || true
elif [ -f backend.log ]; then
    tail -20 backend.log | grep -E "(完全后端化导入|Supabase Admin|API 端点)" || true
fi
ENDSSH

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}后续步骤:${NC}"
echo "1. 检查日志确认 '完全后端化导入: 已启用'"
echo "2. 测试导入功能"
echo "3. 监控后端运行状态"
echo ""
echo -e "${YELLOW}测试命令:${NC}"
echo "curl https://ef-backend.mogujun.icu/health"
echo ""
