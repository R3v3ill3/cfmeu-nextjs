import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jzuoawqxqmrsftbtjkzv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dW9hd3F4cW1yc2Z0YnRqa3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDM2NjAwNywiZXhwIjoyMDY5OTQyMDA3fQ.xMwtPYT0LtYV4QC-B91VDpwMtxio6dNDVilTLQbZnBA'
)

async function checkSchema() {
  console.log('🔍 Checking database schema...')

  try {
    // Check template categories
    const { data: categories, error: catError } = await supabase
      .from('weighting_template_categories')
      .select('id')
      .limit(10)

    if (catError) {
      console.log('Categories error:', catError)
    } else {
      console.log('✅ Template categories exist:', categories?.map(c => c.id))
    }

    // Check employers table columns
    const { data: employers, error: empError } = await supabase
      .from('employers')
      .select('id, name, abn')
      .limit(1)

    if (empError) {
      console.log('Employers error:', empError)
    } else {
      console.log('✅ Employers table accessible')
    }

    // Check template constraint
    const { data: constraintCheck, error: conError } = await supabase
      .from('weighting_templates')
      .select('template_category')
      .limit(1)

    if (conError) {
      console.log('Templates error:', conError)
    } else {
      console.log('✅ Templates table accessible')
    }

  } catch (error) {
    console.error('Schema check error:', error)
  }
}

checkSchema()