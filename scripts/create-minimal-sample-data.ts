import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jzuoawqxqmrsftbtjkzv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dW9hd3F4cW1yc2Z0YnRqa3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDM2NjAwNywiZXhwIjoyMDY5OTQyMDA3fQ.xMwtPYT0LtYV4QC-B91VDpwMtxio6dNDVilTLQbZnBA'
)

async function createMinimalSampleData() {
  console.log('🚀 Creating minimal sample data for CFMEU Rating System...')

  try {
    // 1. Create sample weighting template (using existing category)
    console.log('\n⚖️ Creating weighting templates...')
    const leadOrganiserTemplate = {
      template_name: 'Lead Organiser - Construction Focus',
      description: 'Balanced weighting for lead organisers assessing construction employers',
      template_category: 'construction', // Use existing category
      target_role: 'lead_organiser',
      target_employer_type: 'all',
      is_system_template: true,
      is_active: true,
      template_data: {
        profile_name: 'Lead Organiser Construction',
        profile_type: 'organiser_assessment',
        user_role: 'lead_organiser',
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

    // 2. Create sample employers (without address field)
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

      // 3. Create sample projects
      if (employers && employers.length > 0) {
        console.log('\n🏗️ Creating sample projects...')
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

        // 4. Create user weighting profile
        console.log('\n👤 Creating user weighting profile...')
        const { data: userProfile, error: profileError } = await supabase
          .from('user_weighting_profiles')
          .insert({
            profile_name: 'Demo Lead Organiser Profile',
            description: 'Sample profile for demonstrating the rating system',
            profile_type: 'organiser_assessment',
            user_role: 'lead_organiser',
            employer_category_focus: 'all',
            project_data_weight: 0.6,
            organiser_expertise_weight: 0.4,
            is_default: true,
            is_active: true,
            version: 1,
            created_by: 'demo-user-id',
            last_updated_by: 'demo-user-id'
          })
          .select()
          .single()

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        } else {
          console.log(`✅ Created user profile: ${userProfile.profile_name}`)

          // 5. Create track weightings for the profile
          console.log('\n⚖️ Creating track weightings...')

          // Track 1 weightings
          const track1Weightings = {
            profile_id: userProfile.id,
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
          }

          const { data: track1, error: track1Error } = await supabase
            .from('track1_weightings')
            .insert(track1Weightings)
            .select()
            .single()

          if (track1Error) {
            console.error('Error creating track1 weightings:', track1Error)
          } else {
            console.log('✅ Created Track 1 weightings')
          }

          // Track 2 weightings
          const track2Weightings = {
            profile_id: userProfile.id,
            cbus_overall_assessment_weight: 0.20,
            incolink_overall_assessment_weight: 0.20,
            union_relations_overall_weight: 0.25,
            safety_culture_overall_weight: 0.20,
            historical_relationship_quality_weight: 0.10,
            eba_status_weight: 0.05,
            organiser_confidence_multiplier: 1.00
          }

          const { data: track2, error: track2Error } = await supabase
            .from('track2_weightings')
            .insert(track2Weightings)
            .select()
            .single()

          if (track2Error) {
            console.error('Error creating track2 weightings:', track2Error)
          } else {
            console.log('✅ Created Track 2 weightings')
          }
        }
      }
    }

    console.log('\n🎉 Sample data creation completed!')
    console.log('\n📋 Summary:')
    console.log('- Sample weighting template created')
    console.log('- Sample employers created')
    console.log('- Sample projects created')
    console.log('- User weighting profile created')
    console.log('- Track weightings created')
    console.log('\n✨ The rating system is now ready for testing!')

    // Test API endpoints
    console.log('\n🧪 Testing API endpoints...')
    const { data: testProfile, error: testError } = await supabase
      .from('user_weighting_profiles')
      .select('*, track1_weightings(*), track2_weightings(*)')
      .limit(1)

    if (testError) {
      console.error('API test error:', testError)
    } else {
      console.log('✅ API test successful - profile and weightings retrieved')
    }

  } catch (error) {
    console.error('❌ Error creating sample data:', error)
  }
}

createMinimalSampleData()