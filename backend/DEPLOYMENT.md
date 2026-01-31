# Endfield Gacha 后端部署指南

## 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 服务器端口 3001 可用

### 一键部署

```bash
cd backend

# 首次部署
docker-compose up -d --build

# 查看日志
docker-compose logs -f backend
```

---

## 详细部署步骤

### 1. 上传文件到服务器

**方式 A：使用 Git**
```bash
# 在服务器上
cd /root
git clone https://github.com/your-repo/endfield-gacha.git
cd endfield-gacha/gacha-analyzer/backend
```

**方式 B：使用 SCP**
```bash
# 在本地
scp -r backend root@your-server:/root/
```

**方式 C：使用 1Panel 文件管理器**
1. 登录 1Panel
2. 进入 **文件 → 文件管理**
3. 上传整个 `backend` 文件夹

### 2. 部署服务

**方式 A：使用 Docker Compose（推荐）**
```bash
cd backend
docker-compose up -d --build
```

**方式 B：使用部署脚本**
```bash
cd backend
chmod +x deploy.sh
./deploy.sh
# 选择 "1) 首次部署"
```

**方式 C：使用 1Panel 界面**
1. 进入 **容器 → Compose 模板**
2. 点击 **创建 Compose**
3. **名称**: `endfield-backend`
4. **路径**: 选择 `backend` 文件夹
5. 点击 **启动**

### 3. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 测试健康检查
curl http://localhost:3001/health

# 查看日志
docker-compose logs -f backend
```

预期返回：
```json
{
  "status": "ok",
  "service": "hg-proxy",
  "timestamp": "2026-01-29T..."
}
```

---

## 配置说明

### 环境变量

在 `docker-compose.yml` 中配置：

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `PORT` | 服务端口 | `3001` | `3001` |
| `ALLOWED_ORIGINS` | 允许的跨域来源 | 无 | `https://endfield.15963574.xyz` |
| `NODE_ENV` | 运行环境 | `production` | `production`/`development` |

### 支持多个域名

编辑 `docker-compose.yml`：
```yaml
environment:
  - ALLOWED_ORIGINS=https://endfield.15963574.xyz,https://example.com,https://other.com
```

### 修改端口

如果 3001 端口被占用：
```yaml
ports:
  - "3002:3001"  # 主机端口:容器端口
```

---

## 服务管理

### 启动服务
```bash
docker-compose up -d
```

### 停止服务
```bash
docker-compose down
```

### 重启服务
```bash
docker-compose restart backend
```

### 更新服务
```bash
# 拉取最新代码（如果使用 Git）
git pull origin main

# 重新构建并启动
docker-compose down
docker-compose up -d --build
```

### 查看日志
```bash
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100
```

### 进入容器
```bash
docker-compose exec backend sh
```

---

## 在 1Panel 中管理

### 查看容器

1. 进入 **容器 → 容器列表**
2. 找到 `endfield-backend` 容器
3. 可以看到状态、CPU、内存使用情况

### 查看日志

1. 在容器列表中找到 `endfield-backend`
2. 点击 **日志** 按钮
3. 可以实时查看日志输出

### 重启容器

1. 在容器列表中找到 `endfield-backend`
2. 点击 **重启** 按钮

### 终端访问

1. 在容器列表中找到 `endfield-backend`
2. 点击 **终端** 按钮
3. 可以直接在容器内执行命令

---

## 常见问题

### 1. 容器启动失败

**检查日志**
```bash
docker-compose logs backend
```

**常见原因**：
- 端口被占用 → 修改 `docker-compose.yml` 中的端口
- 内存不足 → 调整资源限制或清理其他容器
- 配置错误 → 检查环境变量

### 2. 无法访问 API

**检查防火墙**
```bash
# 检查端口是否开放
netstat -tlnp | grep 3001

# 或使用 1Panel 的防火墙管理
```

**检查 CORS 配置**
```bash
# 测试 CORS
curl -H "Origin: https://endfield.15963574.xyz" \
     -X OPTIONS \
     http://localhost:3001/api/hg-proxy?action=grant
```

### 3. 健康检查失败

**临时禁用健康检查**

编辑 `docker-compose.yml`，注释掉 `healthcheck` 部分：
```yaml
# healthcheck:
#   test: [...]
```

### 4. 日志文件过大

**清理日志**
```bash
# 查看日志大小
docker inspect endfield-backend | grep LogPath

# 清理日志
echo "" > $(docker inspect --format='{{.LogPath}}' endfield-backend)
```

### 5. 容器自动重启

容器配置了 `restart: always`，会在以下情况自动重启：
- 容器异常退出
- Docker 服务重启
- 服务器重启

---

## API 端点

部署后可用的 API 端点：

### 健康检查
```bash
GET /health
```

### 代理端点
```bash
POST /api/hg-proxy?action=grant
GET  /api/hg-proxy?action=bindings&appToken=xxx
POST /api/hg-proxy?action=u8token
GET  /api/hg-proxy?action=records&u8Token=xxx&type=char&poolType=xxx
POST /api/hg-proxy?action=records-batch
```

---

## 性能优化

### 1. 资源限制

根据实际情况调整 `docker-compose.yml`：
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # 增加 CPU 限制
      memory: 1024M    # 增加内存限制
```

### 2. 日志管理

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"   # 增加单文件大小
    max-file: "5"     # 增加保留文件数
```

### 3. 网络优化

如果有多个服务需要通信，使用自定义网络：
```yaml
networks:
  endfield-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## 生产环境配置

### 1. 使用反向代理

**Nginx 配置示例**：
```nginx
upstream endfield_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name api.endfield.15963574.xyz;

    location /api/ {
        proxy_pass http://endfield_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 2. 启用 HTTPS

使用 Caddy（自动 SSL）：
```caddyfile
api.endfield.15963574.xyz {
    reverse_proxy localhost:3001
}
```

### 3. 监控和告警

使用 Docker 自带的监控：
```bash
docker stats endfield-backend
```

---

## 备份和恢复

### 备份配置
```bash
# 备份 docker-compose.yml
cp docker-compose.yml docker-compose.yml.backup

# 备份整个 backend 文件夹
tar -czf backend-backup-$(date +%Y%m%d).tar.gz .
```

### 恢复
```bash
# 解压备份
tar -xzf backend-backup-YYYYMMDD.tar.gz

# 重新部署
docker-compose up -d --build
```

---

## 卸载

### 完全删除
```bash
# 停止并删除容器、网络
docker-compose down

# 删除镜像
docker rmi endfield-backend

# 删除网络（如果不再使用）
docker network rm endfield-network

# 删除文件夹
cd ..
rm -rf backend
```

---

## 技术支持

- **项目地址**: https://github.com/your-repo/endfield-gacha
- **前端地址**: https://endfield.15963574.xyz
- **API 文档**: 访问 `/health` 端点查看服务状态

## 更新日志

- **2026-01-29**: 初始版本
  - Docker Compose 配置
  - 健康检查
  - 日志管理
  - CORS 支持
