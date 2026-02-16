-- Image Caching Migration
-- Adds support for caching player images in Supabase Storage

-- ============================================================================
-- 1. Create storage bucket for player images
-- ============================================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-images', 'player-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (Usually already enabled, skipping to avoid permissions error)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to player-images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'player-images' );

-- Allow authenticated users (e.g., service role) to upload/update/delete
CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'player-images' );

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'player-images' )
WITH CHECK ( bucket_id = 'player-images' );

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'player-images' );

-- ============================================================================
-- 2. Update master_players table
-- ============================================================================

ALTER TABLE master_players
ADD COLUMN IF NOT EXISTS cached_image_url TEXT;

-- Create index for faster lookup of players needing caching
CREATE INDEX IF NOT EXISTS idx_master_players_cached_image_url 
ON master_players(cached_image_url) 
WHERE cached_image_url IS NULL;
