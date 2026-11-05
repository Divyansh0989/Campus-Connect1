# Event Management API

Flask API for the event management app, using Supabase for data storage.

## Supabase tables

- `users`: `id` (uuid), `email` (text), `role` (text). Demo users are students.
- `events`: `id` (uuid), `organiser_id` (uuid → `users.id`), `title` (text), `capacity` (int4), `timestamp` (timestamptz).
- `registrations`: `id` (uuid), `user_id` (uuid → `users.id`), `event_id` (uuid → `events.id`), `created_at` (timestamptz).

The `events.organiser_id` relationship identifies the student who hosts an event. Keep event inserts limited to columns present in this schema.

## Deploy to Render

1. Push this folder to a GitHub/GitLab repository.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render will detect `render.yaml` and create the web service.
4. Set `SUPABASE_URL` and `SUPABASE_KEY` when prompted, then deploy.

The service exposes `GET /` as its health check and starts with Gunicorn.

For local development:

```powershell
cd backend
pip install -r requirements.txt
python app.py
```
