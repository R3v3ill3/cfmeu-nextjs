-- Migrate existing trade type assignments to use canonical mappings
-- This addresses the issue where existing contractors are stuck with old trade types

-- First, let's see what trade types are currently in use
DO $$
DECLARE
    rec record;
BEGIN
    RAISE NOTICE 'Current trade types in project_contractor_trades:';
    FOR rec IN 
        SELECT trade_type, COUNT(*) as count 
        FROM project_contractor_trades 
        GROUP BY trade_type 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % records', rec.trade_type, rec.count;
    END LOOP;
    
    RAISE NOTICE 'Current trade types in site_contractor_trades:';
    FOR rec IN 
        SELECT trade_type, COUNT(*) as count 
        FROM site_contractor_trades 
        GROUP BY trade_type 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % records', rec.trade_type, rec.count;
    END LOOP;
END $$;

-- Create a function to intelligently remap trade types based on employer names and context
CREATE OR REPLACE FUNCTION migrate_trade_assignments()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    rec record;
    new_trade_type text;
    updated_count integer := 0;
    deleted_count integer := 0;
    existing_record_id uuid;
BEGIN
    -- Update project_contractor_trades based on employer names and existing trade types
    FOR rec IN 
        SELECT pct.id, pct.trade_type, pct.employer_id, pct.project_id, e.name as employer_name
        FROM project_contractor_trades pct
        JOIN employers e ON e.id = pct.employer_id
        WHERE pct.trade_type IN ('general_construction', 'other', 'labour_hire')
           OR pct.trade_type NOT IN (
               SELECT unnest(enum_range(null::public.trade_type))::text
           )
    LOOP
        new_trade_type := NULL;
        
        -- Try to infer trade type from employer name
        IF rec.employer_name ILIKE '%concrete%' OR rec.employer_name ILIKE '%concreting%' THEN
            new_trade_type := 'concreting';
        ELSIF rec.employer_name ILIKE '%steel%' AND (rec.employer_name ILIKE '%fix%' OR rec.employer_name ILIKE '%rein%') THEN
            new_trade_type := 'reinforcing_steel';
        ELSIF rec.employer_name ILIKE '%steel%' AND rec.employer_name ILIKE '%struct%' THEN
            new_trade_type := 'structural_steel';
        ELSIF rec.employer_name ILIKE '%scaffold%' THEN
            new_trade_type := 'scaffolding';
        ELSIF rec.employer_name ILIKE '%crane%' AND rec.employer_name ILIKE '%tower%' THEN
            new_trade_type := 'tower_crane';
        ELSIF rec.employer_name ILIKE '%crane%' THEN
            new_trade_type := 'mobile_crane';
        ELSIF rec.employer_name ILIKE '%demo%' THEN
            new_trade_type := 'demolition';
        ELSIF rec.employer_name ILIKE '%form%' THEN
            new_trade_type := 'form_work';
        ELSIF rec.employer_name ILIKE '%brick%' THEN
            new_trade_type := 'bricklaying';
        ELSIF rec.employer_name ILIKE '%electric%' THEN
            new_trade_type := 'electrical';
        ELSIF rec.employer_name ILIKE '%plumb%' THEN
            new_trade_type := 'plumbing';
        ELSIF rec.employer_name ILIKE '%carpen%' OR rec.employer_name ILIKE '%joiner%' THEN
            new_trade_type := 'carpentry';
        ELSIF rec.employer_name ILIKE '%paint%' THEN
            new_trade_type := 'painting';
        ELSIF rec.employer_name ILIKE '%plaster%' THEN
            new_trade_type := 'plastering';
        ELSIF rec.employer_name ILIKE '%waterproof%' THEN
            new_trade_type := 'waterproofing';
        ELSIF rec.employer_name ILIKE '%tile%' OR rec.employer_name ILIKE '%tiling%' THEN
            new_trade_type := 'tiling';
        ELSIF rec.employer_name ILIKE '%floor%' THEN
            new_trade_type := 'flooring';
        ELSIF rec.employer_name ILIKE '%roof%' THEN
            new_trade_type := 'roofing';
        ELSIF rec.employer_name ILIKE '%window%' OR rec.employer_name ILIKE '%glazing%' THEN
            new_trade_type := 'windows';
        ELSIF rec.employer_name ILIKE '%facade%' THEN
            new_trade_type := 'facade';
        ELSIF rec.employer_name ILIKE '%kitchen%' THEN
            new_trade_type := 'kitchens';
        ELSIF rec.employer_name ILIKE '%landscape%' THEN
            new_trade_type := 'landscaping';
        ELSIF rec.employer_name ILIKE '%clean%' THEN
            new_trade_type := 'cleaning';
        ELSIF rec.employer_name ILIKE '%traffic%' THEN
            new_trade_type := 'traffic_control';
        ELSIF rec.employer_name ILIKE '%excavat%' OR rec.employer_name ILIKE '%earthwork%' THEN
            new_trade_type := 'earthworks';
        ELSIF rec.employer_name ILIKE '%piling%' OR rec.employer_name ILIKE '%boring%' THEN
            new_trade_type := 'piling';
        ELSIF rec.employer_name ILIKE '%mechanical%' OR rec.employer_name ILIKE '%hvac%' OR rec.employer_name ILIKE '%air con%' THEN
            new_trade_type := 'mechanical_services';
        ELSIF rec.employer_name ILIKE '%fire%' THEN
            new_trade_type := 'fire_protection';
        ELSIF rec.employer_name ILIKE '%security%' THEN
            new_trade_type := 'security_systems';
        ELSIF rec.employer_name ILIKE '%plant%' OR rec.employer_name ILIKE '%equipment%' THEN
            new_trade_type := 'plant_and_equipment';
        ELSIF rec.employer_name ILIKE '%foundation%' THEN
            new_trade_type := 'foundations';
        ELSIF rec.employer_name ILIKE '%ceiling%' THEN
            new_trade_type := 'ceilings';
        ELSIF rec.employer_name ILIKE '%stair%' OR rec.employer_name ILIKE '%balustrade%' THEN
            new_trade_type := 'stairs_balustrades';
        ELSIF rec.employer_name ILIKE '%insulation%' THEN
            new_trade_type := 'insulation';
        ELSIF rec.employer_name ILIKE '%fitout%' THEN
            new_trade_type := 'fitout';
        ELSIF rec.employer_name ILIKE '%civil%' OR rec.employer_name ILIKE '%bridge%' THEN
            new_trade_type := 'civil_infrastructure';
        ELSIF rec.employer_name ILIKE '%pool%' THEN
            new_trade_type := 'pools';
        ELSIF rec.employer_name ILIKE '%pipeline%' OR rec.employer_name ILIKE '%piping%' THEN
            new_trade_type := 'pipeline';
        ELSIF rec.employer_name ILIKE '%technology%' OR rec.employer_name ILIKE '%IT%' OR rec.employer_name ILIKE '%telecom%' THEN
            new_trade_type := 'technology';
        ELSIF rec.trade_type = 'labour_hire' THEN
            new_trade_type := 'labour_hire';
        ELSE
            new_trade_type := 'general_construction';
        END IF;
        
        -- Update the record if we found a better mapping and avoid unique constraint violations
        IF new_trade_type IS NOT NULL AND new_trade_type != rec.trade_type THEN
            -- Check if a record with this combination already exists
            SELECT id INTO existing_record_id
            FROM project_contractor_trades 
            WHERE project_id = rec.project_id 
              AND employer_id = rec.employer_id 
              AND trade_type::text = new_trade_type
              AND id != rec.id;
            
            IF existing_record_id IS NOT NULL THEN
                -- Delete the current record to avoid duplicates
                DELETE FROM project_contractor_trades WHERE id = rec.id;
                deleted_count := deleted_count + 1;
                RAISE NOTICE 'Deleted duplicate record for employer "%" (trade_type: % -> %), keeping existing record', rec.employer_name, rec.trade_type, new_trade_type;
            ELSE
                -- Safe to update
                UPDATE project_contractor_trades 
                SET trade_type = new_trade_type::public.trade_type
                WHERE id = rec.id;
                updated_count := updated_count + 1;
                RAISE NOTICE 'Updated employer "%" from "%" to "%"', rec.employer_name, rec.trade_type, new_trade_type;
            END IF;
        END IF;
    END LOOP;
    
    -- Update site_contractor_trades with same logic (but different unique constraint)
    FOR rec IN 
        SELECT sct.id, sct.trade_type, sct.employer_id, sct.job_site_id, e.name as employer_name
        FROM site_contractor_trades sct
        JOIN employers e ON e.id = sct.employer_id
        WHERE sct.trade_type IN ('general_construction', 'other', 'labour_hire')
           OR sct.trade_type NOT IN (
               SELECT unnest(enum_range(null::public.trade_type))::text
           )
    LOOP
        new_trade_type := NULL;
        
        -- Same logic as above for site contractors
        IF rec.employer_name ILIKE '%concrete%' OR rec.employer_name ILIKE '%concreting%' THEN
            new_trade_type := 'concreting';
        ELSIF rec.employer_name ILIKE '%steel%' AND (rec.employer_name ILIKE '%fix%' OR rec.employer_name ILIKE '%rein%') THEN
            new_trade_type := 'reinforcing_steel';
        ELSIF rec.employer_name ILIKE '%steel%' AND rec.employer_name ILIKE '%struct%' THEN
            new_trade_type := 'structural_steel';
        ELSIF rec.employer_name ILIKE '%scaffold%' THEN
            new_trade_type := 'scaffolding';
        ELSIF rec.employer_name ILIKE '%crane%' AND rec.employer_name ILIKE '%tower%' THEN
            new_trade_type := 'tower_crane';
        ELSIF rec.employer_name ILIKE '%crane%' THEN
            new_trade_type := 'mobile_crane';
        ELSIF rec.employer_name ILIKE '%demo%' THEN
            new_trade_type := 'demolition';
        ELSIF rec.employer_name ILIKE '%form%' THEN
            new_trade_type := 'form_work';
        ELSIF rec.employer_name ILIKE '%brick%' THEN
            new_trade_type := 'bricklaying';
        ELSIF rec.employer_name ILIKE '%electric%' THEN
            new_trade_type := 'electrical';
        ELSIF rec.employer_name ILIKE '%plumb%' THEN
            new_trade_type := 'plumbing';
        ELSIF rec.employer_name ILIKE '%carpen%' OR rec.employer_name ILIKE '%joiner%' THEN
            new_trade_type := 'carpentry';
        ELSIF rec.employer_name ILIKE '%paint%' THEN
            new_trade_type := 'painting';
        ELSIF rec.employer_name ILIKE '%plaster%' THEN
            new_trade_type := 'plastering';
        ELSIF rec.employer_name ILIKE '%waterproof%' THEN
            new_trade_type := 'waterproofing';
        ELSIF rec.employer_name ILIKE '%tile%' OR rec.employer_name ILIKE '%tiling%' THEN
            new_trade_type := 'tiling';
        ELSIF rec.employer_name ILIKE '%floor%' THEN
            new_trade_type := 'flooring';
        ELSIF rec.employer_name ILIKE '%roof%' THEN
            new_trade_type := 'roofing';
        ELSIF rec.employer_name ILIKE '%window%' OR rec.employer_name ILIKE '%glazing%' THEN
            new_trade_type := 'windows';
        ELSIF rec.employer_name ILIKE '%facade%' THEN
            new_trade_type := 'facade';
        ELSIF rec.employer_name ILIKE '%kitchen%' THEN
            new_trade_type := 'kitchens';
        ELSIF rec.employer_name ILIKE '%landscape%' THEN
            new_trade_type := 'landscaping';
        ELSIF rec.employer_name ILIKE '%clean%' THEN
            new_trade_type := 'cleaning';
        ELSIF rec.employer_name ILIKE '%traffic%' THEN
            new_trade_type := 'traffic_control';
        ELSIF rec.employer_name ILIKE '%excavat%' OR rec.employer_name ILIKE '%earthwork%' THEN
            new_trade_type := 'earthworks';
        ELSIF rec.employer_name ILIKE '%piling%' OR rec.employer_name ILIKE '%boring%' THEN
            new_trade_type := 'piling';
        ELSIF rec.employer_name ILIKE '%mechanical%' OR rec.employer_name ILIKE '%hvac%' OR rec.employer_name ILIKE '%air con%' THEN
            new_trade_type := 'mechanical_services';
        ELSIF rec.employer_name ILIKE '%fire%' THEN
            new_trade_type := 'fire_protection';
        ELSIF rec.employer_name ILIKE '%security%' THEN
            new_trade_type := 'security_systems';
        ELSIF rec.employer_name ILIKE '%plant%' OR rec.employer_name ILIKE '%equipment%' THEN
            new_trade_type := 'plant_and_equipment';
        ELSIF rec.employer_name ILIKE '%foundation%' THEN
            new_trade_type := 'foundations';
        ELSIF rec.employer_name ILIKE '%ceiling%' THEN
            new_trade_type := 'ceilings';
        ELSIF rec.employer_name ILIKE '%stair%' OR rec.employer_name ILIKE '%balustrade%' THEN
            new_trade_type := 'stairs_balustrades';
        ELSIF rec.employer_name ILIKE '%insulation%' THEN
            new_trade_type := 'insulation';
        ELSIF rec.employer_name ILIKE '%fitout%' THEN
            new_trade_type := 'fitout';
        ELSIF rec.employer_name ILIKE '%civil%' OR rec.employer_name ILIKE '%bridge%' THEN
            new_trade_type := 'civil_infrastructure';
        ELSIF rec.employer_name ILIKE '%pool%' THEN
            new_trade_type := 'pools';
        ELSIF rec.employer_name ILIKE '%pipeline%' OR rec.employer_name ILIKE '%piping%' THEN
            new_trade_type := 'pipeline';
        ELSIF rec.employer_name ILIKE '%technology%' OR rec.employer_name ILIKE '%IT%' OR rec.employer_name ILIKE '%telecom%' THEN
            new_trade_type := 'technology';
        ELSIF rec.trade_type = 'labour_hire' THEN
            new_trade_type := 'labour_hire';
        ELSE
            new_trade_type := 'general_construction';
        END IF;
        
        -- Update if we found a better mapping and avoid unique constraint violations
        IF new_trade_type IS NOT NULL AND new_trade_type != rec.trade_type THEN
            -- Check if a record with this combination already exists for site trades
            SELECT id INTO existing_record_id
            FROM site_contractor_trades 
            WHERE job_site_id = rec.job_site_id 
              AND employer_id = rec.employer_id 
              AND trade_type = new_trade_type::trade_type
              AND id != rec.id;
            
            IF existing_record_id IS NOT NULL THEN
                -- Delete the current record to avoid duplicates
                DELETE FROM site_contractor_trades WHERE id = rec.id;
                deleted_count := deleted_count + 1;
                RAISE NOTICE 'Deleted duplicate site record for employer "%" (trade_type: % -> %), keeping existing record', rec.employer_name, rec.trade_type, new_trade_type;
            ELSE
                -- Safe to update
                UPDATE site_contractor_trades 
                SET trade_type = new_trade_type::public.trade_type
                WHERE id = rec.id;
                updated_count := updated_count + 1;
                RAISE NOTICE 'Updated site contractor "%" from "%" to "%"', rec.employer_name, rec.trade_type, new_trade_type;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration complete. Updated % trade assignments, deleted % duplicates.', updated_count, deleted_count;
END $$;

-- Execute the migration
SELECT migrate_trade_assignments();

-- Clean up the function
DROP FUNCTION IF EXISTS migrate_trade_assignments();

-- Update stages for existing project_contractor_trades based on new canonical mappings
UPDATE project_contractor_trades SET stage = 'early_works' 
WHERE trade_type IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire')
  AND (stage IS NULL OR stage = 'other');

UPDATE project_contractor_trades SET stage = 'structure'
WHERE trade_type IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations')
  AND (stage IS NULL OR stage = 'other');

UPDATE project_contractor_trades SET stage = 'finishing'
WHERE trade_type IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'internal_walls', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology')
  AND (stage IS NULL OR stage = 'other');

-- Final summary of trade types after migration
DO $$
DECLARE
    rec record;
BEGIN
    RAISE NOTICE 'Trade types after migration in project_contractor_trades:';
    FOR rec IN 
        SELECT trade_type, COUNT(*) as count 
        FROM project_contractor_trades 
        GROUP BY trade_type 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % records', rec.trade_type, rec.count;
    END LOOP;
    
    RAISE NOTICE 'Trade types after migration in site_contractor_trades:';
    FOR rec IN 
        SELECT trade_type, COUNT(*) as count 
        FROM site_contractor_trades 
        GROUP BY trade_type 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % records', rec.trade_type, rec.count;
    END LOOP;
END $$;
