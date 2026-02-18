# Redis 配置说明

## 服务器已有 Redis 容器的连接方式

### 方式 1: 将后端容器添加到 Redis 所在网络（推荐）

1. 查看 Redis 容器所在的网络：
```bash
docker inspect redis --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

2. 编辑 `docker-compose.yml`，添加外部网络：
```yaml
networks:
  gobang-network:
    driver: bridge
  redis-network:
    external: true
    name: <上面查到的网络名>
```

3. 在 backend 服务中添加网络：
```yaml
services:
  backend:
    networks:
      - gobang-network
      - redis-network
```

### 方式 2: 通过宿主机访问

如果 Redis 容器使用 `network_mode: "host"` 或暴露了端口：

1. 编辑 `.env` 文件：
```
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
```

2. 或在 Linux 服务器上使用：
```
REDIS_HOST=172.17.0.1  # Docker 网桥 IP
```

### 方式 3: 直接连接 Redis 容器 IP（不推荐）

查看 Redis 容器 IP：
```bash
docker inspect redis --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

然后在 `.env` 中设置：
```
REDIS_HOST=<Redis 容器 IP>
```

## 验证连接

启动后检查 Redis 连接：
```bash
docker logs gobang-backend
```

或查看健康检查端点：
```bash
curl http://localhost:5001/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2026-02-18T...",
  "redis": "connected",
  "rooms": 0
}
```

## 常见问题

### Redis 连接失败

1. 检查 Redis 容器是否运行：
```bash
docker ps | grep redis
```

2. 检查网络是否互通：
```bash
docker network ls
docker network inspect <network-name>
```

3. 测试 Redis 连接：
```bash
docker exec redis redis-cli ping
# 应返回 PONG
```

### 容器间无法解析主机名

如果 `redis` 主机名无法解析，尝试：
1. 确保两个容器在同一网络
2. 使用 `links` 或 `extra_hosts`
3. 直接使用 IP 地址
