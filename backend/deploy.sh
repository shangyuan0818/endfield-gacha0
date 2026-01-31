#!/bin/bash

# Endfield Gacha Backend 部署脚本
# 快速部署和管理 Docker 服务

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="Endfield Gacha Backend"
CONTAINER_NAME="endfield-backend"
IMAGE_NAME="endfield-backend"

# 显示 Banner
show_banner() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║   Endfield Gacha Backend 部署工具     ║"
    echo "║   Version 1.0.0                        ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}检查依赖...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker 未安装${NC}"
        echo "请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker 已安装${NC}"
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}✗ Docker Compose 未安装${NC}"
        echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker Compose 已安装${NC}"
    echo ""
}

# 显示服务状态
show_status() {
    echo -e "${BLUE}服务状态:${NC}"
    docker-compose ps
    echo ""
    
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo -e "${GREEN}✓ 服务正在运行${NC}"
        echo ""
        echo -e "${BLUE}健康检查:${NC}"
        curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
    else
        echo -e "${YELLOW}⚠ 服务未运行${NC}"
    fi
}

# 首次部署
first_deploy() {
    echo -e "${YELLOW}===================${NC}"
    echo -e "${YELLOW}开始首次部署...${NC}"
    echo -e "${YELLOW}===================${NC}"
    echo ""
    
    echo "1. 构建镜像..."
    docker-compose build --no-cache
    
    echo ""
    echo "2. 启动服务..."
    docker-compose up -d
    
    echo ""
    echo "3. 等待服务启动..."
    sleep 5
    
    echo ""
    show_status
    
    echo ""
    echo -e "${GREEN}✓ 部署完成！${NC}"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo "  - 健康检查: http://localhost:3001/health"
    echo "  - API 端点: http://localhost:3001/api/hg-proxy"
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo "  - 查看日志: docker-compose logs -f"
    echo "  - 查看状态: docker-compose ps"
    echo "  - 停止服务: docker-compose down"
}

# 更新服务
update_service() {
    echo -e "${YELLOW}===================${NC}"
    echo -e "${YELLOW}开始更新服务...${NC}"
    echo -e "${YELLOW}===================${NC}"
    echo ""
    
    echo "1. 拉取最新代码..."
    if [ -d ".git" ]; then
        git pull origin main || echo -e "${YELLOW}⚠ Git 拉取失败或未配置，跳过此步骤${NC}"
    else
        echo -e "${YELLOW}⚠ 不是 Git 仓库，跳过拉取${NC}"
    fi
    
    echo ""
    echo "2. 停止旧服务..."
    docker-compose down
    
    echo ""
    echo "3. 构建新镜像..."
    docker-compose build --no-cache
    
    echo ""
    echo "4. 启动新服务..."
    docker-compose up -d
    
    echo ""
    echo "5. 等待服务启动..."
    sleep 5
    
    echo ""
    show_status
    
    echo ""
    echo -e "${GREEN}✓ 更新完成！${NC}"
}

# 停止服务
stop_service() {
    echo -e "${YELLOW}停止服务...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ 服务已停止${NC}"
}

# 查看日志
view_logs() {
    echo -e "${BLUE}显示实时日志 (按 Ctrl+C 退出)...${NC}"
    echo ""
    docker-compose logs -f
}

# 重启服务
restart_service() {
    echo -e "${YELLOW}重启服务...${NC}"
    docker-compose restart
    echo ""
    sleep 3
    show_status
    echo ""
    echo -e "${GREEN}✓ 服务已重启${NC}"
}

# 完全清理
full_cleanup() {
    echo -e "${RED}===================${NC}"
    echo -e "${RED}警告: 完全清理${NC}"
    echo -e "${RED}===================${NC}"
    echo ""
    echo "此操作将："
    echo "  - 停止并删除容器"
    echo "  - 删除镜像"
    echo "  - 删除网络"
    echo "  - 清理构建缓存"
    echo ""
    read -p "确认继续？(输入 'yes' 确认): " confirm
    
    if [ "$confirm" == "yes" ]; then
        echo ""
        echo -e "${YELLOW}开始清理...${NC}"
        
        echo "1. 停止并删除容器..."
        docker-compose down -v
        
        echo "2. 删除镜像..."
        docker rmi $IMAGE_NAME 2>/dev/null || echo "镜像不存在或已删除"
        
        echo "3. 删除网络..."
        docker network rm endfield-network 2>/dev/null || echo "网络不存在或已删除"
        
        echo "4. 清理构建缓存..."
        docker builder prune -f
        
        echo ""
        echo -e "${GREEN}✓ 清理完成${NC}"
    else
        echo ""
        echo -e "${YELLOW}操作已取消${NC}"
    fi
}

# 显示容器信息
show_container_info() {
    echo -e "${BLUE}容器详细信息:${NC}"
    echo ""
    
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo -e "${BLUE}基本信息:${NC}"
        docker inspect $CONTAINER_NAME | jq '.[0] | {
            Name: .Name,
            State: .State.Status,
            IP: .NetworkSettings.IPAddress,
            Ports: .NetworkSettings.Ports
        }'
        
        echo ""
        echo -e "${BLUE}资源使用:${NC}"
        docker stats --no-stream $CONTAINER_NAME
        
        echo ""
        echo -e "${BLUE}最近日志 (最后 20 行):${NC}"
        docker logs --tail 20 $CONTAINER_NAME
    else
        echo -e "${RED}容器未运行${NC}"
    fi
}

# 健康检查
health_check() {
    echo -e "${BLUE}执行健康检查...${NC}"
    echo ""
    
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo "1. 容器状态: ${GREEN}运行中${NC}"
        
        echo ""
        echo "2. API 响应:"
        if curl -f -s http://localhost:3001/health > /dev/null; then
            echo -e "   ${GREEN}✓ 健康检查通过${NC}"
            curl -s http://localhost:3001/health | jq .
        else
            echo -e "   ${RED}✗ 健康检查失败${NC}"
        fi
        
        echo ""
        echo "3. 容器健康状态:"
        docker inspect $CONTAINER_NAME | jq '.[0].State.Health'
    else
        echo -e "${RED}✗ 容器未运行${NC}"
    fi
}

# 主菜单
show_menu() {
    echo ""
    echo -e "${BLUE}请选择操作:${NC}"
    echo "  1) 首次部署"
    echo "  2) 更新服务"
    echo "  3) 停止服务"
    echo "  4) 查看日志"
    echo "  5) 查看状态"
    echo "  6) 重启服务"
    echo "  7) 容器信息"
    echo "  8) 健康检查"
    echo "  9) 完全清理"
    echo "  0) 退出"
    echo ""
}

# 主程序
main() {
    show_banner
    check_dependencies
    
    while true; do
        show_menu
        read -p "请输入选项 (0-9): " choice
        echo ""
        
        case $choice in
            1) first_deploy ;;
            2) update_service ;;
            3) stop_service ;;
            4) view_logs ;;
            5) show_status ;;
            6) restart_service ;;
            7) show_container_info ;;
            8) health_check ;;
            9) full_cleanup ;;
            0)
                echo -e "${GREEN}再见！${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}无效的选项，请重新选择${NC}"
                ;;
        esac
        
        echo ""
        read -p "按 Enter 继续..."
    done
}

# 运行主程序
main
