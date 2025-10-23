import express from 'express';
import type { Request, Response } from 'express';
import logoSearch from './src/pages/api/action_logo_search.ts';
import createSub from './src/pages/api/action_create_subscription.ts';
import updateSub from './src/pages/api/action_update_subscription.ts';
import deleteSub from './src/pages/api/action_delete_subscription.ts';
import wfSend from './src/pages/api/wf_send_notification_job.ts';
import wfDispatch from './src/pages/api/wf_notification_dispatcher.ts';
import monitorStatus from './src/pages/api/monitor_status.ts'; // Updated path

// simple ping
const ping = (_req: Request, res: Response) => res.json({ ok: true, now: new Date().toISOString() });

const app = express();
app.use(express.json());

// API: monitor_status (register before any static/catch-all routes)
app.get("/api/monitor_status", async (req, res) => {
  try {
    const mod = await import("./src/pages/api/monitor_status.ts");
    return (mod.default as any)(req, res);
  } catch (e) {
    console.error("dynamic import monitor_status failed", e);
    return res.status(500).json({ error: "handler import failed" });
  }
});


// mount handlers
app.get('/api/ping', ping);

// If the imported handlers are default functions (req,res), call them directly.
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
app.post('/api/wf_send_notification_job', (req: Request, res: Response) => {
  return (wfSend as any)(req, res);
});

// New dispatcher endpoint (GET request, suitable for scheduling)
app.get('/api/wf_notification_dispatcher', (req: Request, res: Response) => {
  return (wfDispatch as any)(req, res);
});

// New monitoring endpoint
app.get('/api/monitor_status', (req: Request, res: Response) => {
  return (monitorStatus as any)(req, res);
});

const port = process.env.PORT ? Number(process.env.PORT) : 32100;
app.listen(port, () => {
  console.log(`✅ Backend running at http://localhost:${port}`);
});
