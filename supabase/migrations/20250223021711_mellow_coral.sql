/*
  # Create storage bucket for reports

  1. New Storage Bucket
    - Create a new public bucket called 'reportes' for storing report images
    - Enable public access for the bucket
*/

-- Enable storage if not already enabled
CREATE EXTENSION IF NOT EXISTS "storage";

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('reportes', 'reportes', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reportes');

-- Create policy to allow public read access
CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reportes');