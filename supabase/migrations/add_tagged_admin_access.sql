-- Add tagged_admin_access column to master_documents table
-- This stores the baseline (permanent) admin roles allowed to view each document
-- Format: comma-separated list of admin roles (e.g., "P2,P3,P5")

ALTER TABLE master_documents
ADD COLUMN IF NOT EXISTS tagged_admin_access TEXT DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_master_documents_tagged_admin_access 
  ON master_documents(id, tagged_admin_access);

-- Update existing documents to have no tagged access (unrestricted to full-access roles only)
UPDATE master_documents 
SET tagged_admin_access = NULL 
WHERE tagged_admin_access IS NULL;
