-- DDNPPO RMS SQL Migrations
-- Copy and paste ALL of this into Supabase SQL Editor and run once

-- 1. Add archived flag to confidential_docs
ALTER TABLE confidential_docs ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- 2. Add file_url and description to library_items
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- 3. Add password hash to confidential_docs
ALTER TABLE confidential_docs ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3.5. Add file_url to confidential_docs (for file uploads)
ALTER TABLE confidential_docs ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 4. Create dashboard_counts view
CREATE OR REPLACE VIEW dashboard_counts AS
SELECT
  (SELECT COUNT(*) FROM master_documents)  AS master_docs,
  (SELECT COUNT(*) FROM special_orders)    AS special_orders,
  (SELECT COUNT(*) FROM confidential_docs) AS confidential_docs,
  (SELECT COUNT(*) FROM personnel_201)     AS personnel_records;

-- 5. Create personnel_201 table
CREATE TABLE IF NOT EXISTS personnel_201 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank TEXT NOT NULL,
  serial_no TEXT,
  unit TEXT,
  date_created TEXT,
  last_updated TEXT,
  initials TEXT,
  avatar_color TEXT,
  address TEXT,
  contact_no TEXT,
  date_of_retirement TEXT,
  status TEXT DEFAULT 'Active',
  firearm_serial_no TEXT,
  pag_ibig_no TEXT,
  phil_health_no TEXT,
  tin TEXT,
  payslip_account_no TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create personnel_201_docs table
CREATE TABLE IF NOT EXISTS personnel_201_docs (
  id TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES personnel_201(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  sublabel TEXT,
  status TEXT NOT NULL DEFAULT 'MISSING',
  date_updated TEXT,
  filed_by TEXT,
  file_size TEXT,
  file_url TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Add file_url to special_orders
ALTER TABLE special_orders ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 8. Add file_url to master_documents
ALTER TABLE master_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE master_documents ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- 9. Add source_type column to archived_docs (to track where docs came from)
ALTER TABLE archived_docs ADD COLUMN IF NOT EXISTS source_type TEXT;

-- 10. Disable RLS on all tables
ALTER TABLE personnel_201 DISABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_201_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE special_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE confidential_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE library_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE archived_docs DISABLE ROW LEVEL SECURITY;

-- Verify the dashboard_counts view works
-- SELECT * FROM dashboard_counts;
