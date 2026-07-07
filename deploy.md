# Deployment Notes

## Recommended architecture
- Frontend: Vercel
- Backend: Render or Railway
- Database: PostgreSQL (Supabase or Neon)
- Local development: SQLite

## Environment variables
Create these environment variables in production:
- GEMINI_API_KEY
- DATABASE_URL
- NODE_ENV=production
- PORT=3000

## Local development
- Copy .env.example to .env and set GEMINI_API_KEY.
- Leave DATABASE_URL unset to use SQLite locally.
