# WP Campsite Checker

Wilsons Promontory campsite availability checker with email notifications.

**Live:** https://campsite.sheltoncui.com

## Features

- **Weekend** — Quick check for the next 8 weekends (full weekend + nightly breakdown)
- **Holidays** — One-click query for VIC public holidays (2026)
- **Custom** — Pick any check-in/check-out dates (up to 14 nights)
- **Favourites** — Save date ranges to monitor, with per-night tracking
  - Campsite filter: monitor specific sites (e.g. 23rd Ave #298, #299)
  - Email notifications when availability changes (every 15 min check)
  - Mark booked / unmark per night
  - Subscribe/unsubscribe toggle per monitor

## Architecture

Fully serverless on AWS:

```
Frontend (Vite + React)  →  S3 + CloudFront
Backend (Serverless Framework)  →  Lambda + API Gateway + DynamoDB
Auth  →  Cognito
Email  →  SES (noreply@sheltoncui.com)
Cron  →  EventBridge (every 15 min)
Domain  →  campsite.sheltoncui.com (ACM + CloudFront)
```

## Project Structure

```
├── frontend/          Vite + React app
├── backend/           Serverless Framework (Lambda functions)
│   ├── serverless.yml
│   └── src/
│       ├── functions/   favourites, check, cron, settings
│       └── utils/       db, api, email, shared
├── shared/            Common constants, dates, holidays
└── pnpm-workspace.yaml
```

## Deploy

```bash
# Backend
cd backend && sls deploy

# Frontend
pnpm --filter frontend build
aws s3 sync frontend/dist/ s3://wp-campsite-backend-frontend-dev --delete
aws cloudfront create-invalidation --distribution-id E2GF7OASNMO6HC --paths "/*"
```

## Local Dev

```bash
pnpm install
pnpm dev          # frontend on localhost:5173
```

Made by Shelton
