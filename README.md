# Nexavion Business Intelligence

A business intelligence dashboard usage tracker built with React, Vite, Tailwind CSS, Recharts, Express, and Supabase. It also includes client tracking, sales, expenditure, and profit analytics.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and configure the Supabase values. Authentication and private workspace data require a Supabase project.
4. Start the frontend and API together with `npm run dev`.
5. Open [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:4000/api/health](http://localhost:4000/api/health).

To inspect the empty dashboard and Business management interface locally without signing in, open [http://localhost:5173/?preview=1](http://localhost:5173/?preview=1). This development-only preview is read-only and uses no account or sample data; normal authentication remains required otherwise.

## Supabase

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor. Set `SUPABASE_URL` and the public `SUPABASE_ANON_KEY` on the API server, and `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Vite. The public anon/publishable key is safe to use in the browser. `SUPABASE_SERVICE_ROLE_KEY` is optional and server-only; it is needed only for server-side contact form storage. Never use a service-role key as a `VITE_` variable.

The API and frontend must use the URL and anon key from the same Supabase project. The schema SQL creates the `dashboard_usage` and `sales_opportunities` tables used by the dashboard and sales pipeline; the script requests a PostgREST schema-cache refresh after creating them.

For the Business management module, run [`supabase/business-management.sql`](./supabase/business-management.sql) in the Supabase SQL editor after the base schema. It adds user-owned client, product, supplier, order, order-item, expense, payment, PO, and order-status history tables with RLS and refreshes the API schema cache. No additional environment variables are required.

The business AI analyst uses those same user-owned orders and expenses. Set `ANTHROPIC_API_KEY` in the API server's environment (for local development, add it to `.env`; for Render, add it in the service's environment settings). This is a server-only secret: do not prefix it with `VITE_` or add it to Vercel. `ANTHROPIC_MODEL` is optional; the server defaults to `claude-haiku-4-5-20251001`. No Anthropic key is included in this repository.

Enable Email auth and Google in Supabase **Authentication → Providers**. In **Authentication → URL Configuration**, add the local frontend URL (`http://localhost:5173`) and your deployed Vercel URL to the allowed redirect URLs. The Google Cloud OAuth client must list `https://zcxoibarghyataxsrvlf.supabase.co/auth/v1/callback` as an authorized redirect URI. Add the Google client ID and secret to Supabase's Google provider settings; do not put those secrets in frontend environment variables.

The API reads/writes `public.dashboard_usage` and `public.sales_opportunities` for the authenticated Supabase user. Every analytics API request requires a valid Supabase access token; the API verifies it and passes the user token to PostgreSQL, where row-level security restricts records to `auth.uid()`. The service-role key is not used for dashboard or sales records. Contact submissions are stored in `public.contact_submissions` by the server API when its optional service-role key is configured.

The sign-up form collects each user's name and email. Users can add sales records with their own record name, pipeline stage, revenue, profit, and loss; totals and team performance are calculated from those records. The app does not seed sample users, companies, sales, or revenue. Existing records from before per-user ownership was added remain unassigned and are not shown in user workspaces.

## Deploy

- **Hostinger Node.js hosting (full app):** Push this repository to GitHub and deploy it using a Hostinger plan that supports Node.js applications. Set the project root to the repository root, build command to `npm install && npm run build`, and start command to `npm start`. The Express server serves the Vite `dist` build and `/api` endpoints from the same origin. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` as Hostinger environment variables; add `ANTHROPIC_API_KEY` if enabling the business AI analyst. Set `FRONTEND_URL` to the exact deployed site origin (include both `https://example.com` and `https://www.example.com` if both are used). Leave `VITE_API_BASE_URL` unset for same-origin API requests. Add the deployed site URL to Supabase Authentication's allowed redirect URLs. Keep service-role and AI keys server-only.
- **Vercel frontend:** Import this repository, use the default Vite build command (`npm run build`) and output directory (`dist`). Set `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- **Render API:** Create a Node web service from this repository with build command `npm install` and start command `npm start`. The included [`render.yaml`](./render.yaml) can also create the service. Set `FRONTEND_URL` to the Vercel origin, plus `SUPABASE_URL` and the public `SUPABASE_ANON_KEY`. Optionally set `SUPABASE_SERVICE_ROLE_KEY` to enable contact-form storage.
- **Supabase:** Apply the SQL schema above, enable Email and Google auth providers, and configure OAuth redirect URLs. Keep any service-role key in Render's environment settings only.
- **GitHub:** Push this project to a GitHub repository, then connect it to Vercel and Render for deployment.

## API

- `GET /api/health` — API configuration health check.
- `GET /api/overview?range=7d|30d|90d` — authenticated user's sales KPIs, pipeline, dashboard usage, and activity.
- `POST /api/opportunities` — add a sales record (`companyName`, `stage`, `amount`, `profitAmount`, and `lossAmount`) to the authenticated user's workspace.
- `POST /api/events` — record a dashboard activity (`dashboard`, `action`, `durationSeconds`, and `device`) for the authenticated account.
- `POST /api/chat` — authenticated business performance analysis; accepts `{ "message": "...", "history": [{ "role": "user|assistant", "content": "..." }] }`, uses only the signed-in user's business data, and is limited to 8 requests per user per minute.
- `POST /api/contact` — submit `fullName`, `email`, `phone`, `company`, `subject`, and `message`. The API validates and normalizes input, enforces a per-IP submission limit, and stores submissions in Supabase.

## Business AI analyst

The analyst computes totals in server code from the authenticated user's `business_orders` and `business_expenses` rows. Only delivered orders count as revenue; product profit is shown before overhead, while total net profit subtracts delivered purchase costs and all recorded expenses. Monthly comparisons use month-to-date versus the same elapsed period in the prior month. The API passes a compact summary and up to five prior chat messages to Anthropic; it does not send other users' data or use the Supabase service-role key.

To test it, configure the Supabase values and `ANTHROPIC_API_KEY`, apply both Supabase SQL files, and sign in to a workspace that has business orders and expenses. Open **Overview**, ask one of the suggested questions, and confirm the answer reflects those records. The development preview displays the panel in read-only mode; it does not make AI requests. Without the Anthropic key, authenticated chat requests return a setup message. Backend metrics can be checked independently with `node --input-type=module` by importing `calculateBusinessMetrics` from `server/businessMetrics.js`; the production frontend can be validated with `npm run build`.
