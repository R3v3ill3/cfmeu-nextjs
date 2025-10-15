import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or lead_organiser
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['admin', 'lead_organiser'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden - admin access required' }, { status: 403 })
    }

    // Fetch pending projects with scan info
    const { data: pendingProjects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        value,
        proposed_start_date,
        created_at,
        main_job_site:job_sites!main_job_site_id (
          full_address
        ),
        scan:mapping_sheet_scans!created_project_id (
          id,
          file_name,
          uploaded_by
        )
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })

    if (projectsError) {
      console.error('Error fetching pending projects:', projectsError)
      return NextResponse.json({ error: 'Failed to load pending projects' }, { status: 500 })
    }

    const enrichedPendingProjects = (pendingProjects || []).map((project) => ({ ...project }))
    const uploaderIds = new Set<string>()

    for (const project of enrichedPendingProjects) {
      const scans = Array.isArray(project.scan) ? project.scan : project.scan ? [project.scan] : []
      scans.forEach((scan: any) => {
        if (scan?.uploaded_by) {
          uploaderIds.add(scan.uploaded_by)
        }
      })
    }

    if (uploaderIds.size > 0) {
      const { data: uploaderProfiles, error: uploaderProfilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(uploaderIds))

      if (uploaderProfilesError) {
        console.error('Error fetching uploader profiles:', uploaderProfilesError)
      }

      const uploaderMap = new Map<string, any>()
      ;(uploaderProfiles || []).forEach((profile: any) => {
        uploaderMap.set(profile.id, profile)
      })

      for (const project of enrichedPendingProjects) {
        const scans = Array.isArray(project.scan) ? project.scan : project.scan ? [project.scan] : []
        const enrichedScans = scans.map((scan: any) => ({
          ...scan,
          uploader: scan?.uploaded_by ? uploaderMap.get(scan.uploaded_by) ?? null : null,
        }))
        project.scan = Array.isArray(project.scan) ? enrichedScans : enrichedScans[0] ?? null
      }
    }

    // Fetch pending employers
    const { data: pendingEmployers, error: employersError } = await supabase
      .from('employers')
      .select(`
        id,
        name,
        employer_type,
        website,
        created_at
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })

    if (employersError) {
      console.error('Error fetching pending employers:', employersError)
    }

    return NextResponse.json({
      projects: enrichedPendingProjects,
      employers: pendingEmployers || [],
    })
  } catch (error) {
    console.error('Pending items fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    )
  }
}
