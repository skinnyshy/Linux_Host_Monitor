const express = require('express');
const { exec } = require('child_process');
const { Client } = require('ssh2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// 可配置的轮询间隔（默认60秒）
const POLLING_INTERVAL = process.env.POLLING_INTERVAL || 60000; // 60秒

// 缓存配置 - 存储最近获取的数据和时间戳
const metricsCache = new Map();
const CACHE_DURATION = POLLING_INTERVAL - 5000; // 缓存时间略短于轮询间隔

// SSH连接池 - 支持长连接
const connectionPool = new Map(); // 存储活跃的SSH连接
const activeMonitors = new Set(); // 跟踪正在监控的主机IP

// 从ssh-config.json读取配置
function getSSHConfig(ip) {
  try {
    const configPath = path.join(__dirname, '..', 'ssh-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // 查找匹配的IP配置
    const sshConfig = config.sshConfigs.find(config => config.ip === ip);
    if (!sshConfig) {
      throw new Error(`未找到IP ${ip} 的SSH配置`);
    }
    
    return {
      host: sshConfig.ip,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      password: sshConfig.password,
      privateKey: sshConfig.privateKey ? require('fs').readFileSync(sshConfig.privateKey) : undefined
    };
  } catch (error) {
    console.error('读取SSH配置失败:', error.message);
    throw error;
  }
}

// 建立长连接
async function establishLongConnection(ip, sshConfig) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      console.log(`SSH长连接到 ${ip} 建立成功`);
      
      // 将连接添加到连接池
      connectionPool.set(ip, {
        client: conn,
        createdTime: Date.now(),
        lastActivity: Date.now(),
        isActive: true
      });
      
      // 设置心跳，保持连接活跃
      const heartbeat = setInterval(() => {
        const connection = connectionPool.get(ip);
        if (connection && activeMonitors.has(ip)) {
          // 检查连接是否仍然ready
          if (connection.client && connection.client.readyState === 'normal') {
            connection.client.exec('echo "ping"', (err) => {
              if (err) {
                console.log(`心跳检测失败，尝试重连: ${ip}`);
                reconnectSSH(ip, sshConfig);
              } else {
                const updatedConnection = connectionPool.get(ip);
                if (updatedConnection) {
                  updatedConnection.lastActivity = Date.now();
                }
              }
            });
          } else {
            // 连接状态异常，尝试重连
            console.log(`连接状态异常，尝试重连: ${ip}`);
            clearInterval(heartbeat);
            reconnectSSH(ip, sshConfig);
          }
        } else {
          // 如果不再监控该主机，清理连接
          clearInterval(heartbeat);
          const connection = connectionPool.get(ip);
          if (connection) {
            connection.client.end();
            connectionPool.delete(ip);
          }
        }
      }, 30000); // 每30秒发送一次心跳

      resolve(conn);
    }).on('error', (err) => {
      console.error(`SSH连接到 ${ip} 失败:`, err.message);
      reject(err);
    }).on('end', () => {
      console.log(`SSH连接到 ${ip} 已断开`);
      const connection = connectionPool.get(ip);
      if (connection) {
        clearInterval(connection.heartbeat); // 清理心跳定时器
        connectionPool.delete(ip);
      }
    }).on('close', (had_error) => {
      console.log(`SSH连接到 ${ip} 已关闭 (had_error: ${had_error})`);
      const connection = connectionPool.get(ip);
      if (connection) {
        clearInterval(connection.heartbeat); // 清理心跳定时器
        connectionPool.delete(ip);
      }
      if (had_error) {
        console.log(`SSH连接到 ${ip} 异常关闭，尝试重连...`);
        setTimeout(() => reconnectSSH(ip, sshConfig), 5000);
      }
    }).connect(sshConfig);
  });
}

// 重连SSH
async function reconnectSSH(ip, sshConfig) {
  if (!activeMonitors.has(ip)) {
    return; // 如果不再监控，不重连
  }
  
  console.log(`正在重连SSH到 ${ip}...`);
  try {
    await establishLongConnection(ip, sshConfig);
  } catch (error) {
    console.error(`重连SSH失败 ${ip}:`, error.message);
    // 5秒后再次尝试重连
    setTimeout(() => reconnectSSH(ip, sshConfig), 5000);
  }
}

// 获取SSH连接（复用长连接）
async function getSSHConnection(ip, sshConfig) {
  let connection = connectionPool.get(ip);
  
  // 检查连接是否存在且处于就绪状态
  if (connection && connection.client && connection.client.readyState === 'normal') {
    connection.lastActivity = Date.now();
    return connection.client;
  }
  
  // 如果连接无效，先清理旧连接
  if (connection) {
    try {
      connection.client.end();
    } catch (e) {
      console.log(`清理无效连接时出错: ${ip}`, e.message);
    }
    connectionPool.delete(ip);
  }
  
  // 建立新连接
  return await establishLongConnection(ip, sshConfig);
}

// 通过SSH连接获取系统指标
async function getSystemMetricsViaSSH(ip, sshConfig) {
  try {
    const conn = await getSSHConnection(ip, sshConfig);
    
    return new Promise((resolve, reject) => {
      conn.exec('top -bn1 | grep "Cpu(s)" | awk \'{print $2 + $4}\' || echo "0.0"', (err, stream) => {
        if (err) {
          return reject(err);
        }
        
        let cpu = 0;
        stream.on('data', (data) => {
          const cpuMatch = data.toString().match(/(\d+\.?\d*)/);
          if (cpuMatch) {
            cpu = parseFloat(cpuMatch[1]) || 0;
          }
        }).on('close', (code, signal) => {
          conn.exec('free | grep Mem | awk \'{printf("%.2f", $3/$2 * 100.0)}\' || echo "0.0"', (err, stream) => {
            if (err) {
              return reject(err);
            }
            
            let memory = 0;
            stream.on('data', (data) => {
              const memMatch = data.toString().match(/(\d+\.?\d*)/);
              if (memMatch) {
                memory = parseFloat(memMatch[1]) || 0;
              }
            }).on('close', (code, signal) => {
              conn.exec('uptime -p 2>/dev/null || uptime', (err, stream) => {
                if (err) {
                  return reject(err);
                }
                
                let uptime = '';
                stream.on('data', (data) => {
                  uptime = data.toString().trim();
                }).on('close', (code, signal) => {
                  conn.exec('df -h | grep -E "/$" | awk \'{print $5}\' | head -1', (err, stream) => {
                    if (err) {
                      return reject(err);
                    }
                    
                    let diskUsage = '0%';
                    stream.on('data', (data) => {
                      diskUsage = data.toString().trim() || '0%';
                    }).on('close', (code, signal) => {
                      console.log(`从${ip}获取的系统指标: CPU=${cpu}%, 内存=${memory}%, 磁盘=${diskUsage}`);
                      
                      resolve({
                        cpu: cpu,
                        memory: memory,
                        uptime: uptime,
                        disk: {
                          usage: diskUsage
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error(`获取SSH连接失败:`, error.message);
    throw error;
  }
}

// 获取系统指标 - 带缓存机制
app.get('/api/metrics/:ip', async (req, res) => {
  const { ip } = req.params;
  
  try {
    // 检查缓存
    const cachedData = metricsCache.get(ip);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log(`从缓存返回IP ${ip} 的数据`);
      return res.json(cachedData.data);
    }
    
    // 从ssh-config.json获取SSH配置
    const sshConfig = await getSSHConfig(ip);
    
    // 通过SSH连接获取真实数据
    const metrics = await getSystemMetricsViaSSH(ip, sshConfig);
    
    // 缓存数据
    metricsCache.set(ip, {
      data: metrics,
      timestamp: Date.now()
    });
    
    res.json(metrics);
  } catch (error) {
    console.error(`获取IP ${ip} 的系统指标失败:`, error.message);
    
    // 返回错误信息给前端
    res.status(500).json({ 
      error: '获取系统指标失败',
      message: error.message,
      // 返回缓存数据或默认值以避免前端错误
      ...metricsCache.get(ip)?.data || {
        cpu: 0,
        memory: 0,
        uptime: '获取失败',
        disk: {
          usage: '0%'
        }
      }
    });
  }
});

// 启动/停止SSH监控的API
app.post('/api/toggle-ssh-monitor', async (req, res) => {
  const { ip, enable } = req.body;
  
  try {
    if (enable) {
      // 启动监控
      if (!activeMonitors.has(ip)) {
        activeMonitors.add(ip);
        
        // 获取SSH配置并建立长连接
        const sshConfig = await getSSHConfig(ip);
        await establishLongConnection(ip, sshConfig);
        
        console.log(`SSH监控已启动: ${ip}`);
      }
      
      res.json({ success: true, message: `SSH监控已启动: ${ip}` });
    } else {
      // 停止监控
      activeMonitors.delete(ip);
      
      // 关闭连接
      if (connectionPool.has(ip)) {
        const connection = connectionPool.get(ip);
        connection.client.end();
        connectionPool.delete(ip);
      }
      
      // 从缓存中移除
      metricsCache.delete(ip);
      
      console.log(`SSH监控已停止: ${ip}`);
      res.json({ success: true, message: `SSH监控已停止: ${ip}` });
    }
  } catch (error) {
    console.error(`切换SSH监控失败:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 定期清理过期的缓存数据
setInterval(() => {
  const now = Date.now();
  for (const [ip, cachedData] of metricsCache.entries()) {
    if (now - cachedData.timestamp >= CACHE_DURATION) {
      metricsCache.delete(ip);
      console.log(`清理过期缓存: ${ip}`);
    }
  }
}, 10000); // 每10秒清理一次

// 定期检查并清理非活跃的SSH连接
setInterval(() => {
  const now = Date.now();
  for (const [ip, connection] of connectionPool.entries()) {
    // 如果连接超过5分钟没有活动，并且不再监控该主机，则断开连接
    if (now - connection.lastActivity > 300000 && !activeMonitors.has(ip)) {
      console.log(`关闭非活跃SSH连接: ${ip}`);
      connection.client.end();
      connectionPool.delete(ip);
    }
  }
}, 60000); // 每分钟检查一次

// 优雅关闭：清理所有连接
process.on('SIGINT', () => {
  console.log('正在关闭服务器，清理SSH连接...');
  for (const [ip, connection] of connectionPool.entries()) {
    connection.client.end();
  }
  process.exit(0);
});


// Ping主机
app.get('/api/ping/:ip', (req, res) => {
  const { ip } = req.params;
  
  // 使用ping命令测试主机连通性
  const pingCommand = process.platform === 'win32' ? `ping -n 1 ${ip}` : `ping -c 1 ${ip}`;
  
  exec(pingCommand, (error, stdout, stderr) => {
    if (error) {
      res.json({ status: 'offline', latency: null });
    } else {
      // 解析延迟时间
      let latency = null;
      if (process.platform !== 'win32') {
        const match = stdout.match(/time=(\d+\.?\d*)\s*ms/);
        if (match) {
          latency = parseFloat(match[1]);
        }
      } else {
        const match = stdout.match(/平均 = (\d+)ms/);
        if (match) {
          latency = parseInt(match[1]);
        }
      }
      res.json({ status: 'online', latency });
    }
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});