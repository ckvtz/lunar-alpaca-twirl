import React from 'react';
import DashboardOverview from '@/components/DashboardOverview';

const Dashboard: React.FC = () => {
  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <DashboardOverview />
    </div>
  );
};

export default Dashboard;