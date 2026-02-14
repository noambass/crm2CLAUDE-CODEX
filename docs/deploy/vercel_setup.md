# Vercel Setup (CRM)

## Connect the repo
1. In Vercel, click "Add New..." -> "Project".
2. Choose the GitHub repository and confirm the import.
3. Framework preset: Vite.
4. Build settings:
   - Build Command: npm run build
   - Output Directory: dist
   - Install Command: npm install (default)

## Environment variables
Set the following in Vercel (Project Settings -> Environment Variables):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Environment mapping:
- Preview: values from the Supabase DEV project
- Production: values from the Supabase PROD project

## Verify it works (smoke test)
1. Trigger a Preview deployment (e.g., open a PR).
2. Open the Preview URL.
3. Confirm the app loads and routing works on a refresh (no 404).
4. Log in and verify a basic data read (e.g., dashboard loads).

Notes:
- No additional VITE_ variables were detected in the codebase.
