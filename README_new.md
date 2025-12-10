# Linux主机监控平台 - SSH配置指南

## 为主机添加SSH账号操作指南

### 1. SSH配置文件创建

在项目根目录创建 `ssh-config.json` 文件，用于存储SSH连接配置信息：

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

对于更安全的SSH密钥认证方式：

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

### 2. 前端配置修改

在 `src/App.jsx` 文件中，将需要SSH监控的服务器的 `sshConnected` 属性设置为 `true`：

```javascript
const [hosts, setHosts] = useState([
  { id: 1, name: '服务器名称', ip: '服务器IP地址', sshConnected: true },  // 启用SSH监控
  { id: 2, name: '另一个服务器', ip: '另一个IP地址', sshConnected: false }  // 仅Ping监控
]);
```

当 `sshConnected` 设置为 `true` 时，系统将尝试通过SSH连接获取详细的系统指标（CPU、内存、磁盘使用率等）。

### 3. 后端SSH连接配置

在 `server/server.js` 文件中，系统已预置了SSH连接功能。当收到前端请求时，后端将：

1. 从请求中获取服务器IP
2. 使用SSH配置连接到目标服务器
3. 执行系统命令获取监控数据
4. 返回数据给前端

### 4. SSH监控功能说明

启用SSH监控后，系统可以获取以下指标：

- **CPU使用率**：通过 `top` 命令获取
- **内存使用率**：通过 `free` 命令获取
- **系统运行时间**：通过 `uptime` 命令获取
- **磁盘使用率**：通过 `df` 命令获取

### 5. 安全注意事项

#### 5.1 SSH密钥管理
- 推荐使用SSH密钥而不是密码进行身份验证
- 将私钥存储在安全位置，不要硬编码在代码中
- 设置适当的文件权限（如 `chmod 600`）

#### 5.2 配置文件安全
- 将 `ssh-config.json` 添加到 `.gitignore` 文件中，避免提交到版本控制系统
- 使用环境变量存储敏感信息
- 定期轮换SSH密钥和密码

#### 5.3 网络安全
- 使用VPN或私有网络连接监控服务器
- 限制SSH访问的IP范围
- 考虑使用跳板机进行访问

### 6. 故障排除

#### 6.1 SSH连接失败
- 检查SSH服务是否在目标服务器上运行
- 验证SSH用户名和密码/密钥是否正确
- 确认网络连接是否正常

#### 6.2 权限问题
- 确保SSH用户有权限执行系统监控命令
- 检查目标服务器上的命令是否存在

### 7. 高级配置

#### 7.1 多服务器SSH配置
可以在 `ssh-config.json` 中配置多个服务器的SSH信息：

```json
{
  "sshConfigs": [
    {
      "ip": "192.168.1.100",
      "username": "user1",
      "password": "password1",
      "port": 22
    },
    {
      "ip": "192.168.1.101",
      "username": "user2",
      "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----",
      "port": 22
    }
  ]
}
```

#### 7.2 自定义监控命令
可以修改 `server/server.js` 中的系统命令来获取特定的监控数据。

### 8. 运行项目

1. 启动后端服务（端口5001）：
   ```bash
   npm run server
   ```

2. 在另一个终端启动前端（端口3000）：
   ```bash
   npm start
   ```

3. 打开浏览器访问 http://localhost:3000

现在你就可以为你的服务器添加SSH账号并启用详细的系统监控功能了！