# Lumia AI Agent

Lumia AI Agent is a Next.js coding-agent workspace with the reference Lumia UI, real Google sign-in, PostgreSQL/Prisma persistence, autonomous specialist coding, project memory, execution control, and an optional durable Redis worker.

## Architecture

- Web service: Next.js application (npm run dev / npm start)
- Database: PostgreSQL through Prisma
- AI execution: bounded multi-agent specialist orchestration with provider routing
- Providers: Anthropic, OpenAI, Google Gemini, xAI, and Zencoder Auto/Auto+
- Zencoder mode: Lumia routes Auto/Auto+ across configured provider APIs; it does not depend on an undocumented `api.z.ai` REST endpoint or an assumed `zen` executable
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
OPENAI_MODEL=GPT-5.5
LUMIA_PROVIDER=openai
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=
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

### Model catalog

| Provider | Models |
|---|---|
| Anthropic | Haiku 4.5, Sonnet 4.6, Opus 4.6, Opus 4.7 |
| OpenAI | GPT-5.3 Codex, GPT-5.4, GPT-5.4-mini, GPT-5.5 |
| Google | Gemini Pro 3.1, Gemini Flash 3.0 |
| xAI | Grok Code Fast 1 |
| Zencoder | Auto, Auto+ |

Configure the provider API keys you want to use. Zencoder Auto/Auto+ selects among configured providers; it is intentionally implemented as Lumia routing rather than guessing an undocumented Zencoder REST endpoint.
