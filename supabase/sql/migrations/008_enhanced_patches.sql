-- Enhanced patches table with geometry and code support
-- This migration adds the geom column for PostGIS geometry and code column for patch codes

-- Add geom column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patches' AND column_name = 'geom'
    ) THEN
        ALTER TABLE patches ADD COLUMN geom geometry(Polygon, 4326);
    END IF;
END $$;

-- Add code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patches' AND column_name = 'code'
    ) THEN
        ALTER TABLE patches ADD COLUMN code text;
        -- Add unique constraint on code
        CREATE UNIQUE INDEX IF NOT EXISTS patches_code_unique_idx ON patches (code) WHERE code IS NOT NULL;
    END IF;
END $$;

-- Add source_kml_path column if it doesn't exist (for future KML support)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patches' AND column_name = 'source_kml_path'
    ) THEN
        ALTER TABLE patches ADD COLUMN source_kml_path text;
    END IF;
END $$;

-- Add updated_at and updated_by columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patches' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE patches ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patches' AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE patches ADD COLUMN updated_by uuid REFERENCES profiles(id);
    END IF;
END $$;

-- Create spatial index on geom column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_patches_geom ON patches USING GIST(geom);

-- Create index on code column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_patches_code ON patches (code) WHERE code IS NOT NULL;

-- Update existing patches to have default values for new columns
UPDATE patches SET 
    code = COALESCE(code, 'PATCH_' || id::text),
    updated_at = COALESCE(updated_at, created_at)
WHERE code IS NULL OR updated_at IS NULL;

-- Function to update patch geometry and metadata
CREATE OR REPLACE FUNCTION update_patch_geometry(
    p_patch_id uuid,
    p_geometry text,
    p_updated_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE patches 
    SET 
        geom = ST_GeomFromText(p_geometry, 4326),
        updated_at = now(),
        updated_by = COALESCE(p_updated_by, updated_by)
    WHERE id = p_patch_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patch with id % not found', p_patch_id;
    END IF;
END;
$$;

-- Function to create new patch with geometry
CREATE OR REPLACE FUNCTION create_patch_with_geometry(
    p_name text,
    p_code text DEFAULT NULL,
    p_type text DEFAULT 'geo',
    p_geometry text DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_patch_id uuid;
BEGIN
    INSERT INTO patches (
        name, 
        code, 
        type, 
        description, 
        created_by,
        geom
    ) VALUES (
        p_name,
        COALESCE(p_code, 'PATCH_' || gen_random_uuid()::text),
        p_type,
        p_description,
        p_created_by,
        CASE 
            WHEN p_geometry IS NOT NULL THEN ST_GeomFromText(p_geometry, 4326)
            ELSE NULL
        END
    ) RETURNING id INTO v_patch_id;
    
    RETURN v_patch_id;
END;
$$;
