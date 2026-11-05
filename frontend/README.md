# CampusConnect

A responsive React + Vite campus events frontend. Deploy this folder to Vercel and set `VITE_API_BASE_URL` to the Flask API origin (for example, `https://your-api.example.com`). The Flask server must allow requests from the deployed Vercel origin through CORS.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.
4. Run `npm run dev`.

Vercel detects Vite automatically; the included `vercel.json` supports client-side routes. Build command: `npm run build`; output directory: `dist`.

## API requirements and known backend gap

The app uses the supplied event and registration routes and sends user creation to `POST /api/users` exactly as specified. Database-backed user creation works only if the Flask backend implements that endpoint and returns `{ id, email, role }`. This workspace does not include the Workshop backend, so its implementation could not be inspected or changed.

The supplied API contract has no route for listing users. The demo switcher therefore retains users created through this app in browser storage (the user rows themselves are created by the API, never fabricated locally). To discover and switch to users already present in the database across devices, add a backend user-list endpoint such as `GET /api/users` and connect it here. The selected user ID is saved in localStorage as requested.

The attendee view expects `GET /api/events/:id/registrations` to return an array of registration objects with `user_id`, `created_at`, and either a joined `email` field or a nested `user.email`. The schema provided does not promise joined attendee emails; if the route returns only registration rows, the backend must include attendee email in its response without changing stored schema.
