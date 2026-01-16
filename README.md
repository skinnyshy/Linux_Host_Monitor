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

最重要的是api配置，这个文件直接决定你打开浏览器访问3000端口时是从哪个api接口获取的数据，若保持127.0.0.1则代表从打开浏览器的主机上获取数据，自然是获取不到的，会报错。修改服务器上的`src/services/api.js`的代码，将其修改为真实地址，我这里使用的是内网穿透地址

```shell
// src/services/api.js
class ApiService {
  // Ping主机
  static async pingHost(ip) {
    try {
      const response = await fetch(`http://10.126.126.26:5001/api/ping/${ip}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Ping请求失败:', error);
      return { status: 'error', latency: null, message: error.message };
    }
  }

  // 获取系统指标
  static async getSystemMetrics(ip) {
    try {
      const response = await fetch(`http://10.126.126.26:5001/api/metrics/${ip}`);
      const data = await response.json();

      // 确保返回的数据结构正确
      if (data.error) {
        console.warn('获取系统指标时服务器返回错误:', data.message);
        // 即使服务器返回错误，也要返回正确的数据结构
        return {
          cpu: 0,
          memory: 0,
          uptime: '获取失败',
          disk: {
            usage: '0%'
          }
        };
      }

      return data;
    } catch (error) {
      console.error('获取系统指标失败:', error);
      // 不返回随机模拟数据，而是返回默认的错误状态
      return {
        cpu: 0,
        memory: 0,
        uptime: '连接失败',
        disk: {
          usage: '0%'
        }
      };
    }
  }

  // 切换SSH监控状态
  static async toggleSSHMonitor(ip, enable) {
    try {
      const response = await fetch('http://10.126.126.26:5001/api/toggle-ssh-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip, enable }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('切换SSH监控失败:', error);
      return { success: false, message: error.message };
    }
  }
}

export default ApiService;
```

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