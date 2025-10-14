-- Create mapping-sheet-scans storage bucket for bulk upload PDFs
-- This bucket stores split PDF files from batch uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mapping-sheet-scans',
  'mapping-sheet-scans',
  true, -- Public bucket for easy access
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

-- RLS policies for mapping-sheet-scans bucket
CREATE POLICY "Authenticated users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mapping-sheet-scans' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'mapping-sheet-scans' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can read all files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'mapping-sheet-scans');

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mapping-sheet-scans' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
