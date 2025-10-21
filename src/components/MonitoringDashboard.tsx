import React from 'react';
import { useMonitorStatus } from '@/hooks/use-monitor-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, AlertTriangle, Bot } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'sent':
    case 'succeeded':
      return <Badge variant="default" className="bg-green-500 hover:bg-green-500/80">Success</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'failed':
    case 'error':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const MonitoringDashboard: React.FC = () => {
  const { data, isLoading, isError, error } = useMonitorStatus();

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-2 text-muted-foreground">Loading monitoring data...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Monitoring Error</AlertTitle>
        <AlertDescription>
          Failed to connect to the monitoring API: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const { notifications, cron_runs, cron_error } = data!;

  return (
    <div className="space-y-8">
      
      {/* Cron Job Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Scheduled Dispatcher Runs (pg_cron)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cron_error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Cron Access Warning</AlertTitle>
              <AlertDescription>
                Could not fetch cron job details: {cron_error}. Ensure the `get_cron_job_run_details` function exists and the server has permission.
              </AlertDescription>
            </Alert>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cron_runs.length > 0 ? (
                cron_runs.map((run, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{run.jobname}</TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell>{formatDistanceToNow(parseISO(run.start_time), { addSuffix: true })}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{run.return_message}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No recent cron job runs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bot className="h-5 w-5 mr-2" />
            Recent Notification Attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Last Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <TableRow key={notif.id}>
                    <TableCell className="text-xs max-w-[100px] truncate">{notif.id}</TableCell>
                    <TableCell>{getStatusBadge(notif.status)}</TableCell>
                    <TableCell>{formatDistanceToNow(parseISO(notif.scheduled_at), { addSuffix: true })}</TableCell>
                    <TableCell>{notif.attempts_count}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">
                      {notif.last_error || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No recent notifications found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringDashboard;