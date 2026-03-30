# Survey System

A full-stack survey app with:
- React + Vite frontend
- Express backend
- PostgreSQL as the source of truth
- Redis for cache and temporary autosave state

It supports:
- admin login
- survey creation and editing
- multiple questions per survey
- public fill-only survey links
- live admin response monitoring
- Postgres backups
- survey/response history for rollback and audit

## Stack

- Frontend: React, Vite, Axios
- Backend: Node.js, Express
- Database: PostgreSQL
- Cache: Redis
- Auth: JWT
- Local infra: Docker Compose

## Current Architecture

```text
Browser
  -> React frontend (port 3006 in dev)
  -> Express API (port 3005 in dev)
  -> PostgreSQL (persistent data)
  -> Redis (cache + autosave temp state)
```

Notes:
- RabbitMQ has been removed
- WebSocket has been removed
- public respondents use a normal HTTP form route

## Main Features

- Admin can create and manage surveys
- Each survey can contain multiple questions
- Supported question types:
  - text
  - long text
  - single choice
  - multiple choice
  - rating
- Public users can fill a survey without admin login
- Admin can monitor incoming responses from the survey editor
- Survey and response history is stored for rollback/audit
- Postgres backups can be run manually or by cron

## Project Structure

```text
Survey-System/
├── client/                     # React frontend
├── server/                     # Express backend
├── scripts/                    # helper scripts
├── docs/                       # extra documentation
├── docker-compose.yml          # postgres + redis + backend container config
├── Dockerfile
├── package.json                # root workspace scripts
└── README.md
```

Important backend areas:
- [server/index.js](/home/ronin/Survey-System/server/index.js)
- [server/routes/surveys.js](/home/ronin/Survey-System/server/routes/surveys.js)
- [server/routes/responses.js](/home/ronin/Survey-System/server/routes/responses.js)
- [server/database/schema.sql](/home/ronin/Survey-System/server/database/schema.sql)
- [server/services/history-service.js](/home/ronin/Survey-System/server/services/history-service.js)

Important frontend areas:
- [client/src/App.jsx](/home/ronin/Survey-System/client/src/App.jsx)
- [client/src/components/SurveyForm.jsx](/home/ronin/Survey-System/client/src/components/SurveyForm.jsx)
- [client/src/components/PublicSurveyPage.jsx](/home/ronin/Survey-System/client/src/components/PublicSurveyPage.jsx)
- [client/src/components/LiveResponsesPanel.jsx](/home/ronin/Survey-System/client/src/components/LiveResponsesPanel.jsx)

## Prerequisites

- Node.js 18+
- npm 9+
- Docker Desktop or Docker Engine with Compose
- WSL Ubuntu if you are following the current local setup

## Quick Start

### 1. Install dependencies

```bash
cd ~/Survey-System
npm install
```

### 2. Start infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `5432`
- Redis on `6379`

### 3. Run database migration

```bash
cd ~/Survey-System/server
npm run migrate
```

### 4. Seed demo data

```bash
cd ~/Survey-System/server
npm run seed
```

This creates:
- demo user
- demo published survey
- sample feedback responses

### 5. Start backend

```bash
cd ~/Survey-System/server
npm run dev
```

Default backend dev URL:
- `http://localhost:3005`

### 6. Start frontend

In another terminal:

```bash
cd ~/Survey-System/client
npm run dev
```

Default frontend dev URL:
- `http://localhost:3006`

## Demo Login

- Email: `test@example.com`
- Password: `password123`

If needed, recreate demo data:

```bash
cd ~/Survey-System/server
npm run seed
```

## Public Survey Link

The public fill-only survey route is:

```text
/form/:surveyId
```

Example:

```text
http://localhost:3006/form/2e03d8a1-d969-4e46-ab78-4c2a457a7466
```

Rules:
- the survey must be `published`
- no admin login is required for respondents
- this is an HTTP form, not an admin page

Important:
- `localhost` only works on your machine
- to share it with others, you must deploy the app and use a real domain/app URL

Then the public link becomes something like:

```text
https://your-domain.com/form/2e03d8a1-d969-4e46-ab78-4c2a457a7466
```

## Main URLs In Local Development

- Frontend: `http://localhost:3006`
- Backend health: `http://localhost:3005/health`
- Public survey example:
  `http://localhost:3006/form/2e03d8a1-d969-4e46-ab78-4c2a457a7466`

## Useful Commands

From repo root:

```bash
npm run build
npm run lint
npm test
```

Run only backend:

```bash
cd ~/Survey-System/server
npm run dev
npm run migrate
npm run seed
npm run backup:db
```

Run only frontend:

```bash
cd ~/Survey-System/client
npm run dev
npm run build
npm run lint
```

Infra logs:

```bash
cd ~/Survey-System
docker-compose logs -f
```

## Database Backup

Manual Postgres backup:

```bash
cd ~/Survey-System
npm run backup:db
```

Backup script:
- [scripts/backup-postgres.sh](/home/ronin/Survey-System/scripts/backup-postgres.sh)

Backups are stored in:
- [backups](/home/ronin/Survey-System/backups)

Files created:
- timestamped dump files
- `survey_db-latest.dump`

## Automatic Backup Cron

Cron wrapper:
- [scripts/run-backup-cron.sh](/home/ronin/Survey-System/scripts/run-backup-cron.sh)

Installed user cron schedule:

```cron
*/15 * * * * /home/ronin/Survey-System/scripts/run-backup-cron.sh
```

This runs every 15 minutes and writes logs to:
- [backup-cron.log](/home/ronin/Survey-System/backups/backup-cron.log)

Useful checks:

```bash
crontab -l
```

```bash
tail -f /home/ronin/Survey-System/backups/backup-cron.log
```

## Rollback And Audit

The app now stores history in PostgreSQL:

- `survey_history`
- `response_history`

These tables include:
- current snapshot
- previous snapshot
- actor user id
- actor metadata
  - email
  - name
  - IP address
  - user agent
- change metadata

This supports:
- audit trail
- rollback tooling
- debugging who changed what

Schema source:
- [server/database/schema.sql](/home/ronin/Survey-System/server/database/schema.sql)

## API Overview

Admin/auth:
- `POST /auth/register`
- `POST /auth/login`

Health:
- `GET /health`
- `GET /health/live`
- `GET /health/ready`

Admin surveys:
- `GET /api/surveys`
- `POST /api/surveys`
- `GET /api/surveys/:id`
- `PATCH /api/surveys/:id`
- `DELETE /api/surveys/:id`

Public survey:
- `GET /api/public/surveys/public/:id`
- `POST /api/public/responses/public/:surveyId`

Admin responses:
- `GET /api/surveys/:surveyId/responses`
- `POST /api/surveys/:surveyId/responses`
- `PATCH /api/surveys/:surveyId/responses/:responseId`
- `POST /api/surveys/:surveyId/responses/:responseId/complete`

See also:
- [docs/API.md](/home/ronin/Survey-System/docs/API.md)

## Troubleshooting

### Port already in use

Symptoms:
- backend says `EADDRINUSE`
- frontend says `Port 3006 is already in use`

Cause:
- an old dev server is still running

Fix:

```bash
pkill -f "node.*vite"
pkill -f "node index.js"
```

Then restart:

```bash
cd ~/Survey-System/server
npm run dev
```

```bash
cd ~/Survey-System/client
npm run dev
```

Check active ports:

```bash
ss -ltnp | grep ':3005\|:3006'
```

### Backend root shows NOT_FOUND

Symptom:

```json
{"error":"NOT_FOUND","message":"Endpoint not found"}
```

Cause:
- `/` is not a defined backend route

Use this instead:

```text
http://localhost:3005/health
```

### Database/Redis ports do not open in browser

Symptoms:
- `http://localhost:5432` fails
- `http://localhost:6379` fails

Cause:
- these are not HTTP services

That is normal.

Use:

```bash
docker-compose exec postgres psql -U surveyapp -d survey_db
```

```bash
docker-compose exec redis redis-cli -a redispass
```

### Public form does not open

Checklist:
- survey exists
- survey status is `published`
- backend is running on `3005`
- frontend is running on `3006`

Check survey status:

```bash
docker exec $(docker-compose ps -q postgres) psql -U surveyapp -d survey_db -c "SELECT id, title, status FROM surveys ORDER BY created_at DESC;"
```

### Login fails with 401

Cause:
- wrong email/password
- token expired
- demo user not seeded yet

Fix:

```bash
cd ~/Survey-System/server
npm run seed
```

Then use:
- `test@example.com`
- `password123`

### Backup command fails

Cause:
- local `pg_dump` client missing
- or Postgres container is not running

Fix:

```bash
docker-compose up -d postgres
```

Then retry:

```bash
npm run backup:db
```

### Cron backup does not seem to run

Check cron job:

```bash
crontab -l
```

Check cron service:

```bash
service cron status
```

Check backup log:

```bash
tail -f /home/ronin/Survey-System/backups/backup-cron.log
```

### Docker Postgres container name is not `survey-postgres`

This can happen when Compose prefixes the name.

Check it with:

```bash
docker-compose ps
```

The backup script already tries to detect the actual running Postgres container automatically.

## Open Source And Free Hosting

Yes, you can keep this open source on GitHub for free.

But GitHub alone does not host the full working app for this project.

You still need a real runtime host for:
- backend
- Postgres
- Redis

For demos, free/open-source-friendly hosting is possible, but usually with limits such as sleeping services or storage caps.

## Status Summary

Current simplified system:
- RabbitMQ removed
- WebSocket removed
- public fill-only form route added
- backup + cron backup added
- history tables added
- admin live monitoring kept

## License

MIT
