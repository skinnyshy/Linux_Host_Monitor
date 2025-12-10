const express = require('express');
const { exec } = require('child_process');
const { Client } = require('ssh2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const net = require('net');
const app = express();

app.use(cors());
app.use(express.json());

// 配置缓存
const metricsCache = new Map();
const CACHE_DURATION = 55000;

const connectionPool = new Map();
const connectingPool = new Map();
const activeMonitors = new Set();

let globalConfigCache = null;
let lastConfigLoadTime = 0;

// 同步获取配置
function getSSHConfig(ip) {
  const now = Date.now();
  if (!globalConfigCache || (now - lastConfigLoadTime > 300000)) {
    try {
      const configPath = path.join(__dirname, '..', 'ssh-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      globalConfigCache = JSON.parse(configData);
      lastConfigLoadTime = now;
    } catch (e) {
      console.error('读取配置失败', e);
      throw e;
    }
  }

  const sshConfig = globalConfigCache.sshConfigs.find(config => config.ip === ip);
  if (!sshConfig) throw new Error(`未找到IP ${ip} 的SSH配置`);

  return {
    host: sshConfig.ip,
    port: sshConfig.port || 22,
    username: sshConfig.username,
    password: sshConfig.password,
    privateKey: sshConfig.privateKey ? fs.readFileSync(sshConfig.privateKey) : undefined,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    readyTimeout: 20000
  };
}

async function establishLongConnection(ip, sshConfig) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log(`✅ SSH长连接建立: ${ip}`);
      connectionPool.set(ip, {
        client: conn,
        lastActivity: Date.now(),
        ip: ip
      });
      resolve(conn);
    }).on('error', (err) => {
      console.error(`❌ SSH连接错误 ${ip}:`, err.message);
      reject(err);
    }).on('end', () => {
      console.log(`🔌 SSH连接断开: ${ip}`);
      connectionPool.delete(ip);
      if (activeMonitors.has(ip)) {
         setTimeout(() => reconnectSSH(ip, sshConfig), 5000);
      }
    }).on('close', (had_error) => {
      if (had_error) console.log(`🔒 SSH连接意外关闭: ${ip}`);
      connectionPool.delete(ip);
    }).connect(sshConfig);
  });
}

async function getSSHConnection(ip, sshConfig) {
  // 1. 检查活跃连接
  let connection = connectionPool.get(ip);
  if (connection && connection.client) {
    connection.lastActivity = Date.now();
    return connection.client;
  }

  // 2. 检查正在建立的连接
  if (connectingPool.has(ip)) {
    return connectingPool.get(ip);
  }

  // 3. 建立新连接
  const connectPromise = establishLongConnection(ip, sshConfig)
    .then((conn) => {
      connectingPool.delete(ip);
      return conn;
    })
    .catch((err) => {
      connectingPool.delete(ip);
      throw err;
    });

  connectingPool.set(ip, connectPromise);
  return connectPromise;
}

async function reconnectSSH(ip, sshConfig) {
  if (!activeMonitors.has(ip)) return;
  try {
    if(!connectionPool.has(ip) && !connectingPool.has(ip)) {
        await establishLongConnection(ip, sshConfig);
    }
  } catch (e) {
    // 静默失败，等待下次
  }
}

function execCommand(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let data = '';
      stream.on('data', (chunk) => { data += chunk; })
            .on('close', () => resolve(data.toString().trim()))
            .stderr.on('data', () => {}); 
    });
  });
}

async function getSystemMetricsViaSSH(ip, sshConfig) {
  let conn;
  try {
    conn = await getSSHConnection(ip, sshConfig);
  } catch (err) {
    console.error(`无法获取连接 ${ip}:`, err.message);
    throw err; // 这里抛出错误给外层API处理
  }
    
  const cmdCpu = 'top -bn1 | grep "Cpu(s)" | awk \'{print $2 + $4}\'';
  // 加强对中文环境的支持
  // const cmdMem = 'free | grep -E Mem | awk \'{printf("%.2f", $3/$2 * 100.0)}\'';
  // const cmdMem = 'free | egrep "Mem|内存：" | awk \'{printf("%.2f", $3/$2 * 100.0)}\'';
  const cmdMem = 'LC_ALL=C free | grep Mem | awk \'{printf("%.2f", $3/$2 * 100.0)}\'';

  const cmdUptime = 'uptime -p 2>/dev/null || uptime';
  const cmdDisk = 'df -h | grep -E "/$" | awk \'{print $5}\' | head -1';

  // 使用 allSettled 容错
  const results = await Promise.allSettled([
      execCommand(conn, cmdCpu),
      execCommand(conn, cmdMem),
      execCommand(conn, cmdUptime),
      execCommand(conn, cmdDisk)
  ]);

  const allFailed = results.every(r => r.status === 'rejected');
  
  if (allFailed) {
      const firstError = results[0].reason;
      console.error(`所有命令均失败 ${ip}:`, firstError.message);
      if(connectionPool.has(ip)) {
          try { connectionPool.get(ip).client.end(); } catch(e){}
          connectionPool.delete(ip);
      }
      throw new Error("SSH连接失效");
  }

  const getVal = (idx, def) => results[idx].status === 'fulfilled' ? results[idx].value : def;

  const cpuRaw = getVal(0, '0');
  const memRaw = getVal(1, '0');
  const uptimeRaw = getVal(2, 'unknown');
  const diskRaw = getVal(3, '0%');

  const cpu = parseFloat(cpuRaw.match(/(\d+\.?\d*)/)?.[1] || 0);
  const memory = parseFloat(memRaw.match(/(\d+\.?\d*)/)?.[1] || 0);
  
  console.log(`📊 数据 ${ip}: CPU=${cpu}%, Mem=${memory}%`);
  return { cpu, memory, uptime: uptimeRaw, disk: { usage: diskRaw } };
}

app.get('/api/metrics/:ip', async (req, res) => {
  const { ip } = req.params;
  if (!net.isIP(ip)) return res.status(400).json({ error: 'Invalid IP' });

  try {
    // 缓存检查
    const cachedData = metricsCache.get(ip);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      return res.json(cachedData.data);
    }
    
    // getSSHConfig 是同步的，不需要 await
    const sshConfig = getSSHConfig(ip);
    const metrics = await getSystemMetricsViaSSH(ip, sshConfig);
    
    metricsCache.set(ip, { data: metrics, timestamp: Date.now() });
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ 
      error: '获取失败', 
      message: error.message,
      ...metricsCache.get(ip)?.data || { cpu: 0, memory: 0, uptime: 'N/A', disk: { usage: '0%' } }
    });
  }
});

// [修复] 此处修复了 TypeError
app.post('/api/toggle-ssh-monitor', (req, res) => {
    const { ip, enable } = req.body;
    if (!net.isIP(ip)) return res.status(400).json({ error: 'Invalid IP' });
  
    if (enable) {
      if (!activeMonitors.has(ip)) {
        activeMonitors.add(ip);
        try {
            // 同步获取，如果失败会抛错到下面的 catch
            const sshConfig = getSSHConfig(ip);
            reconnectSSH(ip, sshConfig); 
            console.log(`SSH监控已启动: ${ip}`);
        } catch (e) {
            console.error(`启动监控失败 ${ip}: 配置文件未找到`);
        }
      }
    } else {
      activeMonitors.delete(ip);
      if (connectionPool.has(ip)) {
        try { connectionPool.get(ip).client.end(); } catch(e){}
        connectionPool.delete(ip);
      }
      metricsCache.delete(ip);
      console.log(`SSH监控已停止: ${ip}`);
    }
    res.json({ success: true, ip, enable });
});

app.get('/api/ping/:ip', (req, res) => {
   const { ip } = req.params;
   if (!net.isIP(ip)) return res.status(400).json({ error: 'Invalid IP' });
   
   const cmd = process.platform === 'win32' ? `ping -n 1 ${ip}` : `ping -c 1 ${ip}`;
   exec(cmd, (err, stdout) => {
       if (err) return res.json({ status: 'offline' });
       let latency = 0;
       const match = stdout.match(/time=(\d+\.?\d*)/) || stdout.match(/= (\d+)ms/);
       if(match) latency = Math.round(parseFloat(match[1]));
       res.json({ status: 'online', latency }); 
   });
});

const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => console.log(`Monitor Server running on ${PORT}`));
app.listen(PORT, '0.0.0.0', () => console.log(`Monitor Server running on 0.0.0.0:${PORT}`));

setInterval(() => {
    const now = Date.now();
    for (const [ip, item] of connectionPool) {
        if (!activeMonitors.has(ip) && (now - item.lastActivity > 300000)) {
            console.log(`清理闲置连接: ${ip}`);
            item.client.end();
            connectionPool.delete(ip);
        }
    }
}, 60000);
