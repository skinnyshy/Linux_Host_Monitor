// src/App.jsx
import React, { useState, useEffect } from 'react';
import HostList from './components/HostList';
import PingMonitor from './components/PingMonitor';
import HostMonitor from './components/HostMonitor';
import './App.css';

function App() {
  const [hosts, setHosts] = useState([
    { id: 1, name: '腾讯云', ip: '10.126.126.26', sshConnected: false }, // 默认关闭SSH监控
    { id: 2, name: 'ucloud', ip: '10.126.126.9', sshConnected: false }, // 默认关闭SSH监控
    { id: 3, name: 'ubuntu_home', ip: '10.126.126.5', sshConnected: false }, // 默认关闭SSH监控
    { id: 4, name: 'vps_usa', ip: '10.126.126.4', sshConnected: false }, // 默认关闭SSH监控
    { id: 5, name: '华为云', ip: '10.126.126.3', sshConnected: false }, // 默认关闭SSH监控
    { id: 6, name: 'NUC8i', ip: '10.126.126.6', sshConnected: false } // 默认关闭SSH监控
    
  ]);
  const [selectedHost, setSelectedHost] = useState(null);

  // 更新主机的SSH连接状态
  const updateHostSSHStatus = (hostId, sshStatus) => {
    setHosts(prevHosts => 
      prevHosts.map(host => 
        host.id === hostId ? { ...host, sshConnected: sshStatus } : host
      )
    );
    
    // 如果当前选中了主机，也需要更新选中的状态
    if (selectedHost && selectedHost.id === hostId) {
      setSelectedHost(prevHost => ({
        ...prevHost,
        sshConnected: sshStatus
      }));
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Linux主机监控平台</h1>
      </header>
      <div className="app-content">
        <HostList 
          hosts={hosts} 
          selectedHost={selectedHost}
          onSelectHost={setSelectedHost}
          onUpdateSSHStatus={updateHostSSHStatus}
        />
        <div className="monitor-container">
          {selectedHost ? (
            <>
              <div className="host-overview">
                <h2>{selectedHost.name} 监控详情</h2>
                <div className="host-info">
                  <span className="host-ip-display">IP: {selectedHost.ip}</span>
                  <span className={`monitor-status ${selectedHost.sshConnected ? 'ssh-enabled' : 'ping-only'}`}>
                    {selectedHost.sshConnected ? 'SSH监控已启用' : '仅Ping监控'}
                  </span>
                </div>
              </div>
              {selectedHost.sshConnected ? (
                <HostMonitor host={selectedHost} />
              ) : (
                <PingMonitor host={selectedHost} />
              )}
            </>
          ) : (
            <div className="welcome-message">
              <h2>欢迎使用Linux主机监控平台</h2>
              <p>请选择左侧主机开始监控</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;