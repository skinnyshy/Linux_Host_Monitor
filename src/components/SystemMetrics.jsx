// src/components/SystemMetrics.jsx
import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import ApiService from '../services/api';

ChartJS.register(ArcElement, Tooltip, Legend);

const SystemMetrics = ({ host }) => {
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    uptime: '',
    network: { up: 0, down: 0 },
    disk: { usage: '0%' }
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await ApiService.getSystemMetrics(host.ip);
        setMetrics(data);
      } catch (error) {
        console.error('获取指标失败:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);

    return () => clearInterval(interval);
  }, [host.ip]);

  const cpuData = {
    labels: ['已使用', '空闲'],
    datasets: [{
      data: [metrics.cpu, 100 - metrics.cpu],
      backgroundColor: ['#FF6384', '#E0E0E0'],
      borderWidth: 0
    }]
  };

  const memoryData = {
    labels: ['已使用', '可用'],
    datasets: [{
      data: [metrics.memory, 100 - metrics.memory],
      backgroundColor: ['#36A2EB', '#E0E0E0'],
      borderWidth: 0
    }]
  };

  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    cutout: '70%',
    responsive: true,
    maintainAspectRatio: false
  };

  return (
    <div className="system-metrics">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>CPU使用率</h3>
          <div className="chart-container">
            <Doughnut data={cpuData} options={chartOptions} />
            <div className="chart-center-value">{metrics.cpu}%</div>
          </div>
        </div>

        <div className="metric-card">
          <h3>内存使用率</h3>
          <div className="chart-container">
            <Doughnut data={memoryData} options={chartOptions} />
            <div className="chart-center-value">{metrics.memory}%</div>
          </div>
        </div>

        <div className="info-card">
          <h3>系统信息</h3>
          <div className="info-content">
            <p><strong>开机时间:</strong> {metrics.uptime}</p>
            <p><strong>磁盘使用率:</strong> {metrics.disk.usage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemMetrics;