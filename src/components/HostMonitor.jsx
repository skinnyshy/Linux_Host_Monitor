// src/components/HostMonitor.jsx
import React from 'react';
import SystemMetrics from './SystemMetrics';

const HostMonitor = ({ host }) => {
  return (
    <div className="host-monitor">
      <h2>{host.name} - 系统监控</h2>
      <div className="monitor-content">
        <SystemMetrics host={host} />
      </div>
    </div>
  );
};

export default HostMonitor;