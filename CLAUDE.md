# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 React + Express 的前后端分离架构的 Linux 主机监控平台。支持两种监控模式：

1. **Ping 监控**：检测主机连通性，无需 SSH 配置
2. **SSH 监控**：深度监控 CPU、内存、磁盘等系统指标

## 常用命令

### 开发

```bash
npm install              # 安装依赖
npm start               # 启动前端开发服务器 (3000端口)
npm run server          # 启动后端服务器 (5001端口)
npm run build           # 构建生产版本
npm test                # 运行测试
```

### 部署配置

- 前端已配置 `HOST=0.0.0.0` 监听所有网卡
- 后端已配置监听 `0.0.0.0:5001`
- 部署时需修改 `src/services/api.js` 中的 API 地址为实际服务器地址

## 架构说明

### 前端架构 (React SPA)

**组件层次结构：**

```
App (根组件，管理主机列表状态)
├── HostList (左侧主机列表 + Ping检测 + SSH开关)
└── MonitorContainer (右侧监控区域)
    ├── HostMonitor (SSH监控模式)
    │   └── SystemMetrics (环形图表)
    └── PingMonitor (仅Ping监控模式)
```

**关键文件：**

- `src/App.jsx` - 主机列表配置在此，添加新主机需修改 `hosts` state
- `src/components/HostList.jsx` - 负责每5秒执行 Ping 检测
- `src/components/HostMonitor.jsx` - SSH 模式下每3秒请求指标数据
- `src/services/api.js` - API 基础 URL 配置

### 后端架构 (Express REST API)

**API 端点：**

```
GET  /api/ping/:ip                 # Ping连通性检测
GET  /api/metrics/:ip              # 获取系统指标（SSH）
POST /api/toggle-ssh-monitor       # 切换SSH监控状态
```

**SSH 连接管理 (server/server.js)：**

后端使用三层连接池机制优化性能：

1. **活跃连接池** (`connectionPool`) - 已建立的 SSH 长连接，可复用
2. **正在建立的连接** (`connectingPool`) - 防止重复连接
3. **活跃监控集合** (`activeMonitors`) - 跟踪哪些主机启用了 SSH 监控

**关键机制：**

- 长连接复用：SSH 连接建立后会保持在池中，避免频繁握手
- 自动重连：连接断开时，如果主机仍在 `activeMonitors` 中，5秒后自动重连
- 闲置清理：5分钟无活动的连接会被自动清理
- 缓存策略：指标数据缓存55秒，SSH配置缓存5分钟

**数据采集命令：**

```bash
# CPU使用率
top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}'

# 内存使用率 (兼容中文环境)
LC_ALL=C free | grep Mem | awk '{printf("%.2f", $3/$2 * 100.0)}'

# 系统运行时间
uptime -p 2>/dev/null || uptime

# 磁盘使用率
df -h | grep -E "/$" | awk '{print $5}' | head -1
```

## 添加新监控主机

1. 修改 `src/App.jsx` 中的 `hosts` 数组，添加新主机信息
2. 如需 SSH 监控，在项目根目录创建 `ssh-config.json`（已在 .gitignore 中）：
   
   ```json
   {
   "sshConfigs": [
    {
      "ip": "服务器IP",
      "username": "用户名",
      "password": "密码",        // 或使用 privateKey
      "port": 22
    }
   ]
   }
   ```
3. 将主机的 `sshConnected` 设为 `true` 启用 SSH 监控

## 重要注意事项

- `ssh-config.json` 包含敏感信息，已被 .gitignore 排除，不应提交到版本控制
- SSH 连接使用 SSH2 库，支持密码和私钥两种认证方式
- 系统指标采集使用 `Promise.allSettled` 容错，部分命令失败不会导致整体失败
- 中文系统环境兼容性：内存命令使用 `LC_ALL=C` 确保输出格式一致
