import express from 'express';
import logoSearch from './src/pages/api/action_logo_search.ts';
import createSub from './src/pages/api/action_create_subscription.ts';
import wfSend from './src/pages/api/wf_send_notification_job.ts';

// simple ping
const ping = (req:any, res:any) => res.json({ ok: true, now: new Date().toISOString() });

const app = express();
app.use(express.json());

// mount handlers
app.get('/api/ping', ping);

// If the imported handlers are default functions (req,res), call them directly.
app.post('/api/action_logo_search', (req, res) => {
  return (logoSearch as any)(req, res);
});
app.post('/api/action_create_subscription', (req, res) => {
  return (createSub as any)(req, res);
});
app.post('/api/wf_send_notification_job', (req, res) => {
  return (wfSend as any)(req, res);
});

const port = process.env.PORT ? Number(process.env.PORT) : 32100;
app.listen(port, () => {
  console.log(`✅ Backend running at http://localhost:${port}`);
});
