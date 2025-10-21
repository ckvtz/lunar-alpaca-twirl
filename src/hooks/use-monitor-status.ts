import { useQuery } from '@tanstack/react-query';

interface CronRun {
  jobid: number;
  jobname: string;
  status: string;
  start_time: string;
  end_time: string;
  return_message: string;
}

interface NotificationMonitor {
  id: string;
  status: 'pending' | 'sent' | 'failed';
  scheduled_at: string;
  sent_at: string | null;
  attempts_count: number;
  last_error: string | null;
  subscription_id: string;
}

interface MonitorStatusResponse {
  ok: boolean;
  notifications: NotificationMonitor[];
  notifications_error: string | null;
  cron_runs: CronRun[];
  cron_error: string | null;
}

const fetchMonitorStatus = async (): Promise<MonitorStatusResponse> => {
  const response = await fetch('/api/monitor_status');
  if (!response.ok) {
    throw new Error('Failed to fetch monitor status from server.');
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Server returned error status.');
  }
  return data;
};

export const useMonitorStatus = () => {
  return useQuery<MonitorStatusResponse, Error>({
    queryKey: ['monitorStatus'],
    queryFn: fetchMonitorStatus,
    refetchInterval: 15000, // Refetch every 15 seconds for live monitoring
  });
};