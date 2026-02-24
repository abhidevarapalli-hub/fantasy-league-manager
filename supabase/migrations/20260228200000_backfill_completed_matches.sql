-- Migration: Auto-backfill stats for completed matches
-- Creates an RPC that finds completed matches missing stats data,
-- and adds an audit log column to track backfill counts.

-- 1. get_matches_needing_backfill — superseded by migration 20260224195201
--    (widened version with date-based detection + ASC sort)
--    Grants also handled there.

-- 2. Add backfill tracking column to audit log
ALTER TABLE lifecycle_audit_log
  ADD COLUMN IF NOT EXISTS matches_backfilled INTEGER DEFAULT 0;
