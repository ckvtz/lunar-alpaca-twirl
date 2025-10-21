export default function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ ok: true, now: new Date().toISOString() });
}
