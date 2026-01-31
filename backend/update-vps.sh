#!/bin/bash
# VPS 后端更新脚本
# 用于更新到包含 requestQueue.js 的最新版本

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  终末地后端服务更新脚本"
echo "=========================================="
echo ""

# 1. 检查当前目录
if [ ! -f "docker-compose.yml" ]; then
    echo "错误: 未找到 docker-compose.yml 文件"
    echo "请确保在 backend 目录下运行此脚本"
    exit 1
fi

# 2. 拉取最新代码
echo "[1/6] 拉取最新代码..."
git pull origin main
echo "✓ 代码更新完成"
echo ""

# 3. 停止并删除旧容器
echo "[2/6] 停止并删除旧容器..."
docker-compose down
echo "✓ 容器已停止"
echo ""

# 4. 删除旧镜像（强制重新构建）
echo "[3/6] 删除旧镜像..."
docker rmi backend-backend 2>/dev/null || echo "  (旧镜像不存在，跳过)"
docker rmi endfield-backend 2>/dev/null || echo "  (旧镜像不存在，跳过)"
echo "✓ 旧镜像已删除"
echo ""

# 5. 重新构建镜像（不使用缓存）
echo "[4/6] 重新构建镜像（不使用缓存）..."
docker-compose build --no-cache
echo "✓ 镜像构建完成"
echo ""

# 6. 启动新容器
echo "[5/6] 启动新容器..."
docker-compose up -d
echo "✓ 容器已启动"
echo ""

# 7. 等待容器启动
echo "[6/6] 等待服务启动..."
sleep 5

# 8. 检查容器状态
echo ""
echo "=========================================="
echo "  容器状态检查"
echo "=========================================="
docker-compose ps
echo ""

# 9. 检查容器内文件
echo "=========================================="
echo "  检查容器内文件"
echo "=========================================="
docker exec endfield-backend ls -la /app/
echo ""

# 10. 查看最新日志
echo "=========================================="
echo "  最新日志（最后 20 行）"
echo "=========================================="
docker-compose logs --tail 20 backend
echo ""

# 11. 提示
echo "=========================================="
echo "  更新完成！"
echo "=========================================="
echo ""
echo "如果看到 [RequestQueue] 前缀的日志，说明更新成功！"
echo ""
echo "继续查看实时日志："
echo "  docker-compose logs -f backend"
echo ""
echo "检查健康状态："
echo "  docker inspect endfield-backend | grep -A 10 Health"
echo ""
