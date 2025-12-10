// src/components/PingMonitor.jsx
import React, { useEffect, useState } from 'react';
import ApiService from '../services/api';

const PingMonitor = ({ host }) => {
  const [status, setStatus] = useState('checking');
  const [latency, setLatency] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    const pingHost = async () => {
      try {
        const response = await ApiService.pingHost(host.ip);
        
        setStatus(response.status);
        setLatency(response.latency);
        setLastCheck(new Date().toLocaleTimeString());
      } catch (error) {
        setStatus('error');
        console.error('Ping请求失败:', error);
      }
    };

    pingHost();
    const interval = setInterval(pingHost, 5000);

    return () => clearInterval(interval);
  }, [host.ip]);

  return (
    <div className="ping-monitor">
      <h2>{host.name} - Ping监控</h2>
      <div className="monitor-content">
        <div className="status-section">
          <div className={`status-display ${status}`}>
            {status === 'online' && '在线'}
            {status === 'offline' && '离线'}
            {status === 'checking' && '检查中...'}
            {status === 'error' && '错误'}
          </div>
          {latency !== null && (
            <div className="latency-info">
              延迟: <span className="latency-value">{latency}ms</span>
            </div>
          )}
          {lastCheck && (
            <div className="last-check">
              最后检查: {lastCheck}
            </div>
          )}
        </div>
        <div className="host-details">
          <p><strong>IP地址:</strong> {host.ip}</p>
          <p><strong>监控模式:</strong> Ping检测</p>
        </div>
      </div>
    </div>
  );
};

export default PingMonitor;