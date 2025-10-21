# SubscriptionGuard — MVP

[![CI](https://github.com/ckvtz/lunar-alpaca-twirl/actions/workflows/ci-and-notify.yml/badge.svg)](https://github.com/ckvtz/lunar-alpaca-twirl/actions)

Local development:
1. Copy `.env.local.example` → `.env.local` and set `TELEGRAM_BOT_TOKEN`.
2. `pnpm install`
3. `source .env.local`
4. `PORT=32101 npx ts-node server.ts`

Worker:
- `/api/wf_send_notification_job` processes a single notification id.
- Uses Telegram if `TELEGRAM_BOT_TOKEN` is set.

