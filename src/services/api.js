// src/services/api.js
class ApiService {
  // Ping主机
  static async pingHost(ip) {
    try {
      const response = await fetch(`http://127.0.0.1:5001/api/ping/${ip}`);
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
      const response = await fetch(`http://127.0.0.1:5001/api/metrics/${ip}`);
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
            usage: '0%',
            inode: '0%'
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
          usage: '0%',
          inode: '0%'
        }
      };
    }
  }

  // 切换SSH监控状态
  static async toggleSSHMonitor(ip, enable) {
    try {
      const response = await fetch('http://127.0.0.1:5001/api/toggle-ssh-monitor', {
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