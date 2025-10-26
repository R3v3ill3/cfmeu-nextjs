#!/usr/bin/env tsx

// CFMEU Employer Rating System - Sample Data Creation Script
// Creates test data for validating the rating system functionality

import { createClient } from '@supabase/supabase-js'
import { WeightingProfile, UserRole } from '../src/lib/weighting-system/types/WeightingTypes'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createSampleData() {
  console.log('🚀 Creating sample data for CFMEU Rating System...')

  try {
    // 1. Create template categories
    console.log('\n📁 Creating template categories...')
    const { data: categories, error: categoriesError } = await supabase
      .from('weighting_template_categories')
      .upsert([
        { id: 'general', name: 'General Construction', description: 'Standard construction industry assessments' },
        { id: 'specialized', name: 'Specialized Trades', description: 'Specialized trade and subcontractor assessments' },
        { id: 'civil', name: 'Civil Infrastructure', description: 'Civil and infrastructure projects' },
        { id: 'residential', name: 'Residential Construction', description: 'Residential building projects' }
      ])
      .select()

    if (categoriesError) {
      console.error('Error creating categories:', categoriesError)
    } else {
      console.log(`✅ Created ${categories?.length || 0} template categories`)
    }

    // 2. Create sample weighting templates
    console.log('\n⚖️ Creating weighting templates...')
    const leadOrganiserTemplate = {
      template_name: 'Lead Organiser - Construction Focus',
      description: 'Balanced weighting for lead organisers assessing construction employers',
      template_category: 'general',
      target_role: 'lead_organiser' as UserRole,
      target_employer_type: 'all',
      is_system_template: true,
      is_active: true,
      template_data: {
        profile_name: 'Lead Organiser Construction',
        profile_type: 'organiser_assessment',
        user_role: 'lead_organiser' as UserRole,
        employer_category_focus: 'all',
        project_data_weight: 0.6,
        organiser_expertise_weight: 0.4,
        track1_weightings: {
          cbus_paying_weight: 0.15,
          cbus_on_time_weight: 0.10,
          cbus_all_workers_weight: 0.10,
          incolink_entitlements_weight: 0.15,
          incolink_on_time_weight: 0.10,
          incolink_all_workers_weight: 0.10,
          union_relations_right_of_entry_weight: 0.15,
          union_relations_delegate_accommodation_weight: 0.10,
          union_relations_access_to_info_weight: 0.10,
          union_relations_access_to_inductions_weight: 0.05,
          safety_hsr_respect_weight: 0.20,
          safety_general_standards_weight: 0.15,
          safety_incidents_weight: 0.25,
          subcontractor_usage_levels_weight: 0.30,
          subcontractor_practices_weight: 0.70,
          builder_tender_consultation_weight: 0.15,
          builder_communication_weight: 0.15,
          builder_delegate_facilities_weight: 0.10,
          builder_contractor_compliance_weight: 0.20,
          builder_eba_contractor_percentage_weight: 0.40
        },
        track2_weightings: {
          cbus_overall_assessment_weight: 0.20,
          incolink_overall_assessment_weight: 0.20,
          union_relations_overall_weight: 0.25,
          safety_culture_overall_weight: 0.20,
          historical_relationship_quality_weight: 0.10,
          eba_status_weight: 0.05,
          organiser_confidence_multiplier: 1.00
        }
      }
    }

    const { data: template, error: templateError } = await supabase
      .from('weighting_templates')
      .insert(leadOrganiserTemplate)
      .select()
      .single()

    if (templateError) {
      console.error('Error creating template:', templateError)
    } else {
      console.log(`✅ Created template: ${template.template_name}`)
    }

    // 3. Create sample employers
    console.log('\n🏢 Creating sample employers...')
    const sampleEmployers = [
      {
        name: 'BuildRight Construction Pty Ltd',
        abn: '12345678901',
        employer_type: 'head_contractor',
        primary_industry: 'commercial_construction',
        states_of_operation: ['VIC', 'NSW'],
        contact_email: 'admin@buildright.com.au',
        phone: '0398765432',
        address: '123 Construction St, Melbourne VIC 3000',
        website: 'https://buildright.com.au'
      },
      {
        name: 'Specialist Electrical Services',
        abn: '23456789012',
        employer_type: 'subcontractor',
        primary_industry: 'electrical',
        states_of_operation: ['VIC'],
        contact_email: 'info@specialistelec.com.au',
        phone: '0391234567',
        address: '456 Circuit Rd, Melbourne VIC 3000',
        website: 'https://specialistelec.com.au'
      },
      {
        name: 'CivilWorks Infrastructure',
        abn: '34567890123',
        employer_type: 'head_contractor',
        primary_industry: 'civil_infrastructure',
        states_of_operation: ['VIC', 'QLD', 'NSW'],
        contact_email: 'projects@civilworks.com.au',
        phone: '0398761234',
        address: '789 Highway Ave, Melbourne VIC 3000',
        website: 'https://civilworks.com.au'
      }
    ]

    const { data: employers, error: employersError } = await supabase
      .from('employers')
      .upsert(sampleEmployers, { onConflict: 'abn' })
      .select()

    if (employersError) {
      console.error('Error creating employers:', employersError)
    } else {
      console.log(`✅ Created ${employers?.length || 0} sample employers`)
    }

    // 4. Create sample projects
    console.log('\n🏗️ Creating sample projects...')
    if (employers && employers.length > 0) {
      const sampleProjects = [
        {
          name: 'Melbourne Office Tower Development',
          description: '50-story commercial office tower in CBD',
          employer_id: employers[0].id,
          project_type: 'commercial',
          primary_industry: 'commercial_construction',
          contract_value: 150000000,
          start_date: '2024-01-15',
          estimated_completion_date: '2026-06-30',
          state: 'VIC',
          address: '789 Collins St, Melbourne VIC 3000',
          status: 'in_progress'
        },
        {
          name: 'Hospital Expansion Project',
          description: 'Major hospital wing expansion and renovation',
          employer_id: employers[2].id,
          project_type: 'healthcare',
          primary_industry: 'civil_infrastructure',
          contract_value: 85000000,
          start_date: '2024-03-01',
          estimated_completion_date: '2025-12-31',
          state: 'VIC',
          address: '321 Health Precinct, Melbourne VIC 3000',
          status: 'in_progress'
        }
      ]

      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .insert(sampleProjects)
        .select()

      if (projectsError) {
        console.error('Error creating projects:', projectsError)
      } else {
        console.log(`✅ Created ${projects?.length || 0} sample projects`)
      }
    }

    // 5. Create sample organiser expertise assessments
    console.log('\n👷 Creating organiser expertise assessments...')
    if (employers && employers.length > 0) {
      const expertiseAssessments = employers.map(employer => ({
        employer_id: employer.id,
        organiser_id: 'demo-organiser-id', // This would be a real user ID
        union_relations_expertise_rating: 0.75,
        safety_culture_expertise_rating: 0.80,
        eba_negotiation_effectiveness_rating: 0.70,
        delegate_relationship_quality_rating: 0.85,
        site_visit_frequency_rating: 0.90,
        communication_effectiveness_rating: 0.78,
        conflict_resolution_expertise_rating: 0.72,
        overall_expertise_confidence: 0.78,
        expertise_assessment_notes: 'Strong relationship with delegates, good safety culture observed.',
        last_assessment_date: new Date().toISOString(),
        next_assessment_due_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }))

      const { data: expertise, error: expertiseError } = await supabase
        .from('organiser_expertise_assessments')
        .insert(expertiseAssessments)
        .select()

      if (expertiseError) {
        console.error('Error creating expertise assessments:', expertiseError)
      } else {
        console.log(`✅ Created ${expertise?.length || 0} expertise assessments`)
      }
    }

    console.log('\n🎉 Sample data creation completed!')
    console.log('\n📋 Summary:')
    console.log('- Template categories created')
    console.log('- Sample weighting template created')
    console.log('- Sample employers created')
    console.log('- Sample projects created')
    console.log('- Sample expertise assessments created')
    console.log('\n✨ The rating system is now ready for testing!')

  } catch (error) {
    console.error('❌ Error creating sample data:', error)
    process.exit(1)
  }
}

// Run the script
createSampleData()