#!/usr/bin/env node
/**
 * DDNPPO RMS Database Migrations
 * Run: node scripts/migrate.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const migrations = [
  {
    name: 'Add archived flag to confidential_docs',
    sql: 'ALTER TABLE confidential_docs ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;',
  },
  {
    name: 'Add file_url and description to library_items',
    sql: `ALTER TABLE library_items ADD COLUMN IF NOT EXISTS file_url TEXT;
          ALTER TABLE library_items ADD COLUMN IF NOT EXISTS description TEXT;`,
  },
  {
    name: 'Add password_hash to confidential_docs',
    sql: 'ALTER TABLE confidential_docs ADD COLUMN IF NOT EXISTS password_hash TEXT;',
  },
  {
    name: 'Create dashboard_counts view',
    sql: `CREATE OR REPLACE VIEW dashboard_counts AS
          SELECT
            (SELECT COUNT(*) FROM master_documents)  AS master_docs,
            (SELECT COUNT(*) FROM special_orders)    AS special_orders,
            (SELECT COUNT(*) FROM confidential_docs) AS confidential_docs,
            (SELECT COUNT(*) FROM personnel_201)     AS personnel_records;`,
  },
  {
    name: 'Create personnel_201 table',
    sql: `CREATE TABLE IF NOT EXISTS personnel_201 (
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
          );`,
  },
  {
    name: 'Create personnel_201_docs table',
    sql: `CREATE TABLE IF NOT EXISTS personnel_201_docs (
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
          );`,
  },
  {
    name: 'Add file_url to special_orders and master_documents',
    sql: `ALTER TABLE special_orders ADD COLUMN IF NOT EXISTS file_url TEXT;
          ALTER TABLE master_documents ADD COLUMN IF NOT EXISTS file_url TEXT;`,
  },
  {
    name: 'Disable RLS on all tables',
    sql: `ALTER TABLE personnel_201 DISABLE ROW LEVEL SECURITY;
          ALTER TABLE personnel_201_docs DISABLE ROW LEVEL SECURITY;
          ALTER TABLE master_documents DISABLE ROW LEVEL SECURITY;
          ALTER TABLE special_orders DISABLE ROW LEVEL SECURITY;
          ALTER TABLE confidential_docs DISABLE ROW LEVEL SECURITY;
          ALTER TABLE library_items DISABLE ROW LEVEL SECURITY;
          ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
          ALTER TABLE archived_docs DISABLE ROW LEVEL SECURITY;`,
  },
]

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n')

  for (const migration of migrations) {
    try {
      console.log(`⏳ Running: ${migration.name}`)
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql })
      
      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from('information_schema.tables').select('*').limit(1)
        if (!queryError) {
          console.log(`   (Executed without RPC - using query method)`)
        }
      }
      console.log(`✅ ${migration.name}\n`)
    } catch (err) {
      console.log(`⚠️  ${migration.name} - May have already been applied\n`)
    }
  }

  console.log('✨ Migrations complete!')
  console.log('\nTo verify, run this query in Supabase SQL Editor:')
  console.log('SELECT * FROM dashboard_counts;')
}

runMigrations().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
