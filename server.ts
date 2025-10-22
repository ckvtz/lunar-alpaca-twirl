import express, { Request, Response } from 'express';
import logoSearch from './src/pages/api/action_logo_search.ts';
import createSub from './src/pages/api/action_create_subscription.ts';
import updateSub from './src/pages/api/action_update_subscription.ts';
import deleteSub from './src/pages/api/action_delete_subscription.ts';
import wfSend from './src/pages/api/wf_send_notification_job.ts';
import wfDispatch from './src/pages/api/wf_notification_dispatcher.ts';
import monitorStatus from './src/pages/api/monitor_status.ts';
import generateToken from './src/pages/api/action_generate_telegram_link_token.ts'; // Import new token generator
import linkContact from './src/pages/api/wf_link_telegram_contact.ts'; // Import new contact linker

// simple ping
const ping = (_req: Request, res: Response) => res.json({ ok: true, now: new Date().toISOString() });

const app = express();
app.use(express.json());

// mount handlers
app.get('/api/ping', ping);

// Subscription Actions
app.post('/api/action_logo_search', (req: Request, res: Response) => {
  return (logoSearch as any)(req, res);
});
app.post('/api/action_create_subscription', (req: Request, res: Response) => {
  return (createSub as any)(req, res);
});
app.post('/api/action_update_subscription', (req: Request, res: Response) => {
  return (updateSub as any)(req, res);
});
app.post('/api/action_delete_subscription', (req: Request, res: Response) => {
  return (deleteSub as any)(req, res);
});

// Notification Workflow Endpoints
app.post('/api/wf_send_notification_job', (req: Request, res: Response) => {
  return (wfSend as any)(req, res);
});
app.get('/api/wf_notification_dispatcher', (req: Request, res: Response) => {
  return (wfDispatch as any)(req, res);
});

// Monitoring Endpoint
app.get('/api/monitor_status', (req: Request, res: Response) => {
  return (monitorStatus as any)(req, res);
});

// Telegram Linking Endpoints
app.post('/api/action_generate_telegram_link_token', (req: Request, res: Response) => {
  return (generateToken as any)(req, res);
});
app.post('/api/wf_link_telegram_contact', (req: Request, res: Response) => {
  return (linkContact as any)(req, res);
});


const port = process.env.PORT ? Number(process.env.PORT) : 32100;
app.listen(port, () => {
  console.log(`✅ Backend running at http://localhost:${port}`);
});