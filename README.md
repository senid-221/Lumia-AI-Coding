# Lumia AI Agent

Lumia AI Agent is a Next.js coding-agent workspace with the UI design from the reference screen, Google login, PostgreSQL/Prisma persistence, and server-side AI chat.

## Environment
Copy .env.example to .env.local and set DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, and OPENAI_API_KEY.

## Run
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev

The visual Claude/Sonnet controls remain part of the reference UI; the first executable provider is OpenAI through the Responses API.