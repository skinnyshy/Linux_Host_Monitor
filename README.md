# Linux主机监控平台

一个基于React的Linux主机监控平台，可以监控主机的连通性和系统指标。

## 功能特性

- 主机列表管理
- Ping连通性监控
- 系统指标监控（CPU、内存、磁盘等）
- 实时数据更新
- 可视化图表展示

## 安装步骤

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动后端服务器：
   ```bash
   npm run server
   ```

3. 启动前端开发服务器：
   ```bash
   npm start
   ```

## 添加自己的监控服务器

要添加你自己的服务器到监控列表中，请按以下步骤操作：

### 1. 修改主机列表

编辑 `src/App.jsx` 文件中的 `hosts` 数组，添加你的服务器信息：

```javascript
const [hosts, setHosts] = useState([
  { id: 1, name: '你的服务器名称', ip: '你的服务器IP地址', sshConnected: false },
  // 添加更多服务器...
]);
```

例如：
```javascript
const [hosts, setHosts] = useState([
  { id: 1, name: '阿里云服务器', ip: '123.123.123.123', sshConnected: false },
  { id: 2, name: '腾讯云服务器', ip: '124.124.124.124', sshConnected: false }
]);
```

### 2. 添加SSH账号实现系统指标监控

要实现对真实服务器的系统指标监控（CPU、内存等），需要配置SSH连接。请按以下步骤操作：

#### 2.1. 创建SSH配置文件

在项目根目录创建 `ssh-config.json` 文件，用于存储SSH连接配置（请确保此文件不被提交到版本控制系统）：

```json
{
  "sshConfigs": [
    {
      "ip": "你的服务器IP地址",
      "username": "SSH用户名",
      "password": "SSH密码",
      "port": 22
    }
  ]
}
```

或者使用SSH密钥的方式：

```json
{
  "sshConfigs": [
    {
      "ip": "你的服务器IP地址",
      "username": "SSH用户名",
      "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----",
      "port": 22
    }
  ]
}
```

#### 2.2. 修改App.jsx文件

在 `src/App.jsx` 文件中，将需要SSH监控的服务器的 `sshConnected` 设置为 `true`：

```javascript
const [hosts, setHosts] = useState([
  { id: 1, name: '阿里云服务器', ip: '123.123.123.123', sshConnected: true },  // 设置为true以启用SSH监控
  { id: 2, name: '腾讯云服务器', ip: '124.124.124.124', sshConnected: false }
]);
```

#### 2.3. 修改后端服务器配置

在 `server/server.js` 中，需要实现真实的SSH连接功能。当前代码中已有SSH连接的框架，但为了安全起见，需要按以下方式启用：

1. 解开 `server/server.js` 中SSH连接部分的注释
2. 修改getSystemMetricsViaSSH函数，从安全存储中获取SSH配置
3. 在实际使用时，建议使用环境变量或安全的配置管理工具来存储SSH凭据

### 3. 运行项目

1. 启动后端服务（端口5001）：
   ```bash
   npm run server
   ```

2. 在另一个终端启动前端（端口3000）：
   ```bash
   npm start
   ```

3. 打开浏览器访问 http://localhost:3000

## 安全注意事项

当前版本使用模拟数据进行演示。如果要在生产环境中使用真实监控功能，请务必：

1. 实施适当的认证和授权机制
2. 对SSH凭据进行加密处理
3. 限制API访问权限
4. 验证和清理所有输入数据

## 技术栈

- 前端：React, Chart.js
- 后端：Node.js, Express, SSH2
- 数据可视化：Chart.js