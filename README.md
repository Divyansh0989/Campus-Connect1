# Event Management API

Flask API for the event management app, using Supabase for data storage.

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
