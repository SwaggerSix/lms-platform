# LMS Platform - Production Deployment Guide

## Prerequisites

- Node.js 18+ and npm/pnpm
- A Vercel account (Pro plan recommended for cron jobs)
- A Supabase project
- A Resend account for transactional email

## Environment Variables

All required environment variables are listed in `.env.local.example`. Copy it and fill in real values:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only, never expose to client) |
| `RESEND_API_KEY` | Yes | Resend API key for sending emails |
| `EMAIL_FROM` | Yes | Default sender address (e.g., `LMS Platform <noreply@yourdomain.com>`) |
| `CRON_SECRET` | Yes | Secret token to authenticate Vercel Cron requests. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your deployed application |

## Deploying to Vercel

### 1. Connect Repository

1. Push your code to a GitHub, GitLab, or Bitbucket repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel will auto-detect the Next.js framework.

### 2. Configure Environment Variables

In the Vercel dashboard under **Settings > Environment Variables**, add every variable from the table above. Make sure to set them for the **Production** environment (and optionally Preview/Development).

### 3. Deploy

Click **Deploy**. Vercel will build and deploy the application. Subsequent pushes to `main` will trigger automatic deployments.

## Supabase Setup

### Database

Run all migrations in order against your Supabase project. Migrations are located in `supabase/migrations/`. You can apply them using the Supabase CLI:

```bash
npx supabase db push
```

Or apply them manually via the Supabase SQL Editor.

### Row-Level Security (RLS)

Ensure RLS is enabled on all tables. The migrations include RLS policies, but verify in the Supabase dashboard under **Authentication > Policies** that:

- Users can only read/write their own data
- Admin roles have appropriate elevated access
- Service role key bypasses RLS (used only server-side)

### Storage Buckets

If the platform uses file uploads (course materials, documents), create the required storage buckets in Supabase:

1. Go to **Storage** in the Supabase dashboard.
2. Create buckets as needed (e.g., `course-materials`, `documents`, `avatars`).
3. Set appropriate access policies for each bucket.

## Email Configuration (Resend)

1. Sign up at [resend.com](https://resend.com).
2. Verify your sending domain under **Domains** (add the required DNS records).
3. Create an API key under **API Keys**.
4. Set `RESEND_API_KEY` and `EMAIL_FROM` in your environment variables.

In development, if `RESEND_API_KEY` is not set, emails are logged to the console instead of being sent.

## Cron Jobs

The platform uses Vercel Cron to run scheduled reports. The configuration is in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scheduled-reports",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs the scheduled reports endpoint every hour. The endpoint:

1. Checks for reports in the `scheduled_reports` table where `is_active = true` and `next_run_at <= now`.
2. Generates report data based on the `report_type` (enrollment, completion, compliance).
3. Emails the report to configured recipients via Resend.
4. Updates `last_run_at` and calculates the next run time based on frequency.

### Cron Security

The cron endpoint is protected by the `CRON_SECRET` environment variable. Vercel automatically sends this as a Bearer token in the `Authorization` header. Set the same value in both:

- Vercel environment variables (`CRON_SECRET`)
- The Vercel project cron configuration (automatic)

**Important:** Vercel Cron Jobs require the **Pro plan** or higher. On the Hobby plan, cron jobs run once per day maximum.

### Monitoring Cron Executions

View cron execution logs in the Vercel dashboard under **Settings > Cron Jobs**. Each execution shows status, duration, and response body.

## Security Checklist

- [ ] All environment variables are set in Vercel (not committed to source control)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (never in `NEXT_PUBLIC_` prefixed vars)
- [ ] RLS is enabled on all Supabase tables
- [ ] `CRON_SECRET` is set and matches between Vercel config and env vars
- [ ] Domain is verified in Resend for email deliverability
- [ ] HTTPS is enforced (Vercel does this by default)
- [ ] Security headers are configured in `vercel.json` (X-Frame-Options, CSP, etc.)

## Monitoring and Logging

- **Vercel Logs:** Real-time function logs available in the Vercel dashboard under **Deployments > Functions**.
- **Supabase Logs:** Database and API logs available in the Supabase dashboard under **Database > Logs**.
- **Cron Logs:** Cron execution history in Vercel under **Settings > Cron Jobs**.

## Troubleshooting

### Cron jobs not running
- Verify you are on Vercel Pro plan or higher.
- Check that `CRON_SECRET` is set in environment variables.
- Inspect cron logs in the Vercel dashboard.

### Emails not sending
- Verify `RESEND_API_KEY` is set and valid.
- Confirm your sending domain is verified in Resend.
- Check function logs for error messages.

### Database connection issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` and keys are correct.
- Check Supabase project status (not paused).
- Ensure RLS policies allow the required operations.
