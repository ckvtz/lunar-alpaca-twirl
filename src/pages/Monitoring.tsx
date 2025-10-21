import React from 'react';
import MonitoringDashboard from '@/components/MonitoringDashboard';

const Monitoring: React.FC = () => {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">System Monitoring</h1>
      <MonitoringDashboard />
    </div>
  );
};

export default Monitoring;