// src/components/HostList.jsx
import React, { useState, useEffect } from 'react';
import ApiService from '../services/api';

const HostList = ({ hosts, selectedHost, onSelectHost, onUpdateSSHStatus }) => {
  const [hostStatuses, setHostStatuses] = useState({});
  const [sshToggleLoading, setSshToggleLoading] = useState({}); // 跟踪SSH切换加载状态

  // 获取所有主机的ping状态
  useEffect(() => {
    const fetchAllHostStatuses = async () => {
      // 创建一个新的状态对象，避免并发更新问题
      const newStatuses = { ...hostStatuses };
      
      for (const host of hosts) {
        try {
          const pingResult = await ApiService.pingHost(host.ip);
          newStatuses[host.id] = {
            ping: pingResult.status,
            latency: pingResult.latency,
            lastCheck: new Date().toLocaleTimeString(),
            lastUpdate: Date.now()
          };
        } catch (error) {
          newStatuses[host.id] = {
            ping: 'error',
            latency: null,
            lastCheck: new Date().toLocaleTimeString(),
            lastUpdate: Date.now()
          };
        }
      }
      
      setHostStatuses(newStatuses);
    };

    fetchAllHostStatuses();
    
    // 设置定时器，每10秒更新一次主机状态
    const interval = setInterval(fetchAllHostStatuses, 10000);
    
    return () => clearInterval(interval);
  }, [hosts]); // 仅在hosts改变时重新运行

  // 切换SSH监控状态
  const toggleSSHStatus = async (host, event) => {
    event.stopPropagation(); // 阻止事件冒泡，避免触发选择主机
    
    const newSSHStatus = !host.sshConnected;
    
    // 设置加载状态
    setSshToggleLoading(prev => ({
      ...prev,
      [host.id]: true
    }));
    
    try {
      // 调用API切换SSH监控状态
      const result = await ApiService.toggleSSHMonitor(host.ip, newSSHStatus);
      
      if (result.success) {
        // 更新本地状态
        onUpdateSSHStatus(host.id, newSSHStatus);
        console.log(`SSH监控已${newSSHStatus ? '启动' : '停止'}: ${host.ip}`);
      } else {
        console.error('切换SSH监控失败:', result.message);
        // 如果API调用失败，不更新本地状态
      }
    } catch (error) {
      console.error('切换SSH监控时发生错误:', error);
    } finally {
      // 移除加载状态
      setSshToggleLoading(prev => ({
        ...prev,
        [host.id]: false
      }));
    }
  };

  // 获取主机状态的显示文本
  const getStatusText = (host) => {
    const status = hostStatuses[host.id];
    if (!status) return '检查中...';
    
    if (status.ping === 'online') {
      return host.sshConnected ? 'SSH监控中' : 'Ping在线';
    } else if (status.ping === 'offline') {
      return '离线';
    } else {
      return '错误';
    }
  };

  // 获取主机状态的颜色类
  const getStatusClass = (host) => {
    const status = hostStatuses[host.id];
    if (!status) return 'status-indicator checking';
    
    if (status.ping === 'online') {
      return host.sshConnected ? 
        'status-indicator ssh-connected' : 
        'status-indicator ping-online';
    } else if (status.ping === 'offline') {
      return 'status-indicator disconnected';
    } else {
      return 'status-indicator error';
    }
  };

  // 获取延迟显示
  const getLatencyDisplay = (host) => {
    const status = hostStatuses[host.id];
    if (!status || status.latency === null || status.latency === undefined) return '';
    return ` - ${status.latency}ms`;
  };

  return (
    <div className="host-list">
      <h2>主机列表</h2>
      <ul>
        {hosts.map(host => (
          <li 
            key={host.id} 
            className={`host-item ${selectedHost?.id === host.id ? 'selected' : ''}`}
            onClick={() => onSelectHost(host)}
          >
            <div className="host-name">{host.name}</div>
            <div className="host-ip">{host.ip}</div>
            <div className="host-status">
              <span className={getStatusClass(host)}>
                {getStatusText(host)}
                {getLatencyDisplay(host) && (
                  <span className="latency-display">{getLatencyDisplay(host)}</span>
                )}
              </span>
            </div>
            <div className="ssh-toggle-container">
              <label className="ssh-toggle-label">
                SSH监控
                <div className={`ssh-toggle ${host.sshConnected ? 'ssh-toggle-on' : 'ssh-toggle-off'}`}>
                  <input
                    type="checkbox"
                    checked={host.sshConnected}
                    onChange={(e) => toggleSSHStatus(host, e)}
                    className="ssh-toggle-input"
                    disabled={sshToggleLoading[host.id]} // 在加载时禁用开关
                  />
                  <span className={`ssh-toggle-slider ${host.sshConnected ? 'ssh-toggle-slider-on' : 'ssh-toggle-slider-off'}`}>
                    {sshToggleLoading[host.id] && (
                      <span className="ssh-toggle-spinner">⏳</span>
                    )}
                  </span>
                </div>
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HostList;