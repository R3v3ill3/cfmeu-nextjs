-- Add type and status columns to patches_with_geojson view
-- This migration updates the patches_with_geojson view to include type and status
-- columns from the patches table for better filtering and display

CREATE OR REPLACE VIEW "public"."patches_with_geojson" WITH ("security_invoker"='on') AS
 SELECT "code",
    "created_at",
    "created_by",
    "geom",
    ("public"."st_asgeojson"("public"."st_makevalid"("geom")))::json AS "geom_geojson",
    "id",
    "name",
    "type",
    "status",
    "source_kml_path",
    "updated_at",
    "updated_by"
   FROM "public"."patches" "p";




