/**
 * Utility functions to ensure contractor data synchronization across all tables
 * This maintains consistency between project_employer_roles, project_contractor_trades, 
 * and legacy builder_id fields
 */

import { supabase } from "@/integrations/supabase/client";

export interface ContractorAssignmentData {
  projectId: string;
  employerId: string;
  role?: 'builder' | 'head_contractor' | 'project_manager' | 'site_manager';
  tradeType?: string;
  stage?: 'early_works' | 'structure' | 'finishing' | 'other';
  estimatedWorkforce?: number | null;
}

/**
 * Synchronize contractor assignment across all relevant tables
 * This ensures that contractor assignments are properly reflected in all data sources
 */
export async function syncContractorAssignment(data: ContractorAssignmentData) {
  const { projectId, employerId, role, tradeType, stage, estimatedWorkforce } = data;
  
  try {
    // 1. If this is a builder role, update legacy builder_id field for backward compatibility
    if (role === 'builder') {
      await supabase
        .from("projects")
        .update({ builder_id: employerId })
        .eq("id", projectId);
    }
    
    // 2. Upsert to project_employer_roles if role is specified
    if (role) {
      const { error: roleError } = await supabase
        .from("project_employer_roles")
        .upsert({
          project_id: projectId,
          employer_id: employerId,
          role: role,
          start_date: new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'project_id,employer_id,role'
        });
      
      if (roleError) {
        console.error('Error syncing to project_employer_roles:', roleError);
      }
    }
    
    // 3. Upsert to project_contractor_trades if trade type is specified
    if (tradeType) {
      const { error: tradeError } = await supabase
        .from("project_contractor_trades")
        .upsert({
          project_id: projectId,
          employer_id: employerId,
          trade_type: tradeType,
          stage: stage || 'other',
          estimated_project_workforce: estimatedWorkforce
        }, {
          onConflict: 'project_id,employer_id,trade_type'
        });
      
      if (tradeError) {
        console.error('Error syncing to project_contractor_trades:', tradeError);
      }
    }
    
    // 4. Use the newer project_assignments system via RPC if available
    if (role) {
      try {
        await supabase.rpc('assign_contractor_role', {
          p_project_id: projectId,
          p_employer_id: employerId,
          p_role_code: role,
          p_company_name: null,
          p_is_primary: role === 'builder',
          p_estimated_workers: estimatedWorkforce
        });
      } catch (rpcError) {
        // RPC might not exist in all environments, log but don't fail
        console.warn('RPC assign_contractor_role not available:', rpcError);
      }
    }
    
    console.log(`✅ Synchronized contractor assignment: ${employerId} -> ${role || tradeType}`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to sync contractor assignment:', error);
    return { success: false, error };
  }
}

/**
 * Remove contractor assignment from all relevant tables
 */
export async function removeContractorAssignment(projectId: string, employerId: string, options: {
  removeFromRoles?: boolean;
  removeFromTrades?: boolean;
  tradeType?: string;
  role?: string;
} = {}) {
  const { removeFromRoles = true, removeFromTrades = true, tradeType, role } = options;
  
  try {
    // Remove from project_employer_roles if specified
    if (removeFromRoles && role) {
      await supabase
        .from("project_employer_roles")
        .delete()
        .eq("project_id", projectId)
        .eq("employer_id", employerId)
        .eq("role", role);
    }
    
    // Remove from project_contractor_trades if specified
    if (removeFromTrades) {
      let query = supabase
        .from("project_contractor_trades")
        .delete()
        .eq("project_id", projectId)
        .eq("employer_id", employerId);
      
      if (tradeType) {
        query = query.eq("trade_type", tradeType);
      }
      
      await query;
    }
    
    // Remove from project_assignments
    let assignmentQuery = supabase
      .from("project_assignments")
      .delete()
      .eq("project_id", projectId)
      .eq("employer_id", employerId)
      .eq("assignment_type", "contractor_role");
    
    await assignmentQuery;
    
    // If removing builder, clear legacy builder_id
    if (role === 'builder') {
      const { data: project } = await supabase
        .from("projects")
        .select("builder_id")
        .eq("id", projectId)
        .single();
      
      if (project?.builder_id === employerId) {
        await supabase
          .from("projects")
          .update({ builder_id: null })
          .eq("id", projectId);
      }
    }
    
    console.log(`✅ Removed contractor assignment: ${employerId}`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to remove contractor assignment:', error);
    return { success: false, error };
  }
}

/**
 * Audit and fix data inconsistencies across contractor tables
 */
export async function auditContractorDataConsistency(projectId: string) {
  console.log(`🔍 Auditing contractor data consistency for project: ${projectId}`);
  
  const issues: string[] = [];
  const fixes: string[] = [];
  
  try {
    // Get project info
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, builder_id")
      .eq("id", projectId)
      .single();
    
    if (!project) {
      issues.push("Project not found");
      return { issues, fixes };
    }
    
    // Get all contractor data
    const [rolesResult, assignmentsResult, tradesResult] = await Promise.all([
      supabase.from("project_employer_roles")
        .select("role, employer_id, employers(name)")
        .eq("project_id", projectId),
      supabase.from("project_assignments")
        .select("employer_id, role_details, employers(name)")
        .eq("project_id", projectId)
        .eq("assignment_type", "contractor_role"),
      supabase.from("project_contractor_trades")
        .select("employer_id, trade_type, employers(name)")
        .eq("project_id", projectId)
    ]);
    
    const roles = rolesResult.data || [];
    const assignments = assignmentsResult.data || [];
    const trades = tradesResult.data || [];
    
    // Check 1: Legacy builder_id consistency
    if (project.builder_id) {
      const hasBuilderRole = roles.some(r => r.employer_id === project.builder_id && r.role === 'builder');
      const hasBuilderAssignment = assignments.some(a => 
        a.employer_id === project.builder_id && 
        (a.role_details as any)?.role_code === 'builder'
      );
      
      if (!hasBuilderRole && !hasBuilderAssignment) {
        issues.push(`Legacy builder_id ${project.builder_id} not found in roles or assignments`);
      }
    }
    
    // Check 2: Orphaned role assignments
    roles.forEach(role => {
      const hasAssignment = assignments.some(a => 
        a.employer_id === role.employer_id && 
        (a.role_details as any)?.role_code === role.role
      );
      
      if (!hasAssignment) {
        issues.push(`Role ${role.role} for ${role.employers?.name} missing from assignments table`);
      }
    });
    
    // Check 3: Trade assignments without role context
    const employersWithTrades = new Set(trades.map(t => t.employer_id));
    const employersWithRoles = new Set([
      ...roles.map(r => r.employer_id),
      ...assignments.map(a => a.employer_id)
    ]);
    
    employersWithTrades.forEach(employerId => {
      if (!employersWithRoles.has(employerId)) {
        const tradeEmployer = trades.find(t => t.employer_id === employerId);
        issues.push(`Trade assignments found for ${tradeEmployer?.employers?.name} without role assignment`);
      }
    });
    
    console.log(`📊 Audit complete: ${issues.length} issues found`);
    issues.forEach(issue => console.log(`  ❗ ${issue}`));
    
    return { issues, fixes };
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    return { issues: [`Audit failed: ${error}`], fixes: [] };
  }
}

/**
 * Get contractor assignment summary for a project
 */
export async function getContractorAssignmentSummary(projectId: string) {
  try {
    const [rolesResult, tradesResult] = await Promise.all([
      supabase.from("project_employer_roles")
        .select("role, employer_id, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId),
      supabase.from("project_contractor_trades")
        .select("trade_type, stage, employer_id, employers(name)")
        .eq("project_id", projectId)
    ]);
    
    const roles = rolesResult.data || [];
    const trades = tradesResult.data || [];
    
    const summary = {
      totalRoles: roles.length,
      totalTrades: trades.length,
      uniqueEmployers: new Set([...roles.map(r => r.employer_id), ...trades.map(t => t.employer_id)]).size,
      roleBreakdown: roles.reduce((acc, role) => {
        acc[role.role] = (acc[role.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      stageBreakdown: trades.reduce((acc, trade) => {
        acc[trade.stage] = (acc[trade.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return summary;
    
  } catch (error) {
    console.error('Failed to get contractor summary:', error);
    return null;
  }
}
