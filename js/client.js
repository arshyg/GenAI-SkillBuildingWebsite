// ─── Supabase client — shared across all pages ───────────────────────────────
const SUPABASE_URL = 'https://jfjegonhtmmuublikxpk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmamVnb25odG1tdXVibGlreHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMTAxMDEsImV4cCI6MjEwNjY4NjEwMX0.1xEklI15Df1nRSgc9JmIz7dytqS2uWB_hV9ec2PFofM'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)