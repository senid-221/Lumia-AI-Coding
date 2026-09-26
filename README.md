# Lumia AI Agent

Lumia AI Agent is a Next.js coding-agent workspace with the reference Lumia UI, real Google sign-in, PostgreSQL/Prisma persistence, autonomous specialist coding, project memory, execution control, and an optional durable Redis worker.

## Architecture

- Web service: Next.js application (npm run dev / npm start)
- Database: PostgreSQL through Prisma
- AI execution: OpenAI Responses API with bounded specialist orchestration
- Durable jobs: Upstash Redis when configured
- Worker: npm run worker
- Git: authenticated read operations plus explicit branch/commit operations
- Authentication: Auth.js Google provider

## Environment

Set these variables in the web service and worker as appropriate:

```env
DATABASE_URL=
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
LUMIA_PROVIDER=openai
LUMIA_SPECIALIST_TURNS=4

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
LUMIA_WORKER_POLL_MS=2000
```

The worker requires the Redis variables and model credentials. The web service can queue work when Redis is configured.

## Local run

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Run the durable worker separately:

```bash
npm run worker
```

## Production deployment

Deploy the Web Service from the repository using the Dockerfile or a Node runtime.

- Build: npm ci && npx prisma generate && npm run build
- Start: npm start
- Worker command: npm run worker

Run database migrations as a deployment/release step:

```bash
npx prisma migrate deploy
```

Keep OPENAI_API_KEY on the worker when using the durable queue architecture. The web service needs the database and Redis credentials to enqueue and inspect executions.

The visual Claude/Sonnet controls remain part of the Lumia reference UI; the currently executable provider is OpenAI. Provider registration is structured so additional providers can be added without changing the workspace UI.
