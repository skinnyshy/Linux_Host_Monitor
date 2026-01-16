# Linux主机监控平台

一个基于React的Linux主机监控平台，可以监控主机的连通性和系统指标。

![Snipaste_2025-12-10_20-25-55](https://raw.githubusercontent.com/skinnyshy/PicGo/master/202512102026827.jpg)

![Snipaste_2025-12-10_20-28-44](https://raw.githubusercontent.com/skinnyshy/PicGo/master/202512102028622.jpg)

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

#### 2.5 部署到服务器

部署到服务器需要修改前端package.json中的监听配置，将react-scripts启动方式加上监听网卡

```shell
# 端开发服务器 (3000端口)
# 前端的3000端口是通过react-scripts启动的，需要修改package.json中的启动命令：

# 在package.json中：
{
   "scripts": {
     "start": "HOST=0.0.0.0 react-scripts start"
   }
 }

# 或者，如果你使用的是Windows系统：
{
  "scripts": {
    "start": "set HOST=0.0.0.0 && react-scripts start"
  }
}
```

后端默认监听在ipv6的5001端口，可以不修改，也可以按照下面的方式修改监听网卡

```shell
#后端服务器 (5001端口)
# server.js中的监听部分需要修改：
// 当前代码是：
app.listen(PORT, () => console.log(`Monitor Server running on ${PORT}`));

// 应该改为：
app.listen(PORT, '0.0.0.0', () => console.log(`Monitor Server running on 0.0.0.0:${PORT}`));
```

**API地址配置（重要）**

前端使用环境变量配置API地址，支持灵活部署。在项目根目录创建 `.env` 文件：

```bash
# 复制示例配置文件
cp .env.example .env
```

根据部署场景编辑 `.env` 文件：

```bash
# 场景1: 本地开发（前后端同机器）
REACT_APP_API_BASE_URL=http://localhost:5001

# 场景2: 部署到服务器（前后端在同一域名）
# 留空则使用相对路径，自动使用当前访问的域名
REACT_APP_API_BASE_URL=

# 场景3: 跨域访问（后端在不同地址）
# 设置为实际的后端服务器地址
REACT_APP_API_BASE_URL=http://10.126.126.26:5001
```

> 注意：修改 `.env` 文件后需要重启前端服务才能生效。

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