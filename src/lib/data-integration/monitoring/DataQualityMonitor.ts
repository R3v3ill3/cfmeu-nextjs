/**
 * Data Quality Monitoring System
 * Continuously monitors and assesses data quality across the integration pipeline
 */

import { supabase } from '@/integrations/supabase/client';
import { DataQualityMetrics } from '../types/IntegrationTypes';

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  table: string;
  field?: string;
  ruleType: 'completeness' | 'accuracy' | 'consistency' | 'validity' | 'uniqueness' | 'referential';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  parameters: Record<string, any>;
  threshold: number; // 0-100
  weight: number; // for overall scoring
}

export interface DataQualityAssessment {
  id: string;
  table: string;
  recordCount: number;
  assessmentDate: string;
  overallScore: number;
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    uniqueness: number;
    referential: number;
  };
  ruleResults: Array<{
    ruleId: string;
    ruleName: string;
    score: number;
    passed: boolean;
    issues: Array<{
      recordId?: string;
      field?: string;
      value?: any;
      issue: string;
      severity: string;
    }>;
  }>;
  trends: {
    previousScore?: number;
    scoreChange?: number;
    trendDirection: 'improving' | 'stable' | 'declining';
  };
  recommendations: string[];
}

export interface DataQualityIssue {
  id: string;
  table: string;
  recordId?: string;
  field?: string;
  ruleId: string;
  ruleName: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  currentValue?: any;
  expectedValue?: any;
  detectedAt: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface DataQualityTrend {
  table: string;
  date: string;
  overallScore: number;
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    uniqueness: number;
    referential: number;
  };
  issueCount: number;
  recordCount: number;
}

export class DataQualityMonitor {
  private qualityRules: Map<string, DataQualityRule> = new Map();
  private assessmentHistory: Map<string, DataQualityTrend[]> = new Map();
  private activeIssues: Map<string, DataQualityIssue[]> = new Map();
  private assessmentSchedule: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize the data quality monitoring system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Data Quality Monitor...');

    try {
      // Create monitoring tables
      await this.createQualityTables();

      // Load default quality rules
      await this.loadDefaultQualityRules();

      // Setup automated assessments
      await this.setupAutomatedAssessments();

      // Load existing issues and trends
      await this.loadExistingData();

      console.log('Data Quality Monitor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Data Quality Monitor:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive data quality assessment
   */
  async runQualityAssessment(table?: string): Promise<DataQualityAssessment[]> {
    console.log(`Running data quality assessment${table ? ` for ${table}` : ' for all tables'}...`);

    const tables = table ? [table] : await this.getMonitoredTables();
    const assessments: DataQualityAssessment[] = [];

    for (const tableName of tables) {
      try {
        const assessment = await this.assessTableQuality(tableName);
        assessments.push(assessment);

        // Store assessment results
        await this.storeAssessmentResults(assessment);

        // Update trends
        await this.updateQualityTrends(assessment);

        // Check for new issues
        await this.identifyQualityIssues(assessment);

        console.log(`Completed quality assessment for ${tableName}: score ${assessment.overallScore}`);

      } catch (error) {
        console.error(`Quality assessment failed for ${tableName}:`, error);
      }
    }

    return assessments;
  }

  /**
   * Assess quality for a specific table
   */
  private async assessTableQuality(table: string): Promise<DataQualityAssessment> {
    const rules = Array.from(this.qualityRules.values()).filter(r => r.table === table && r.enabled);
    const recordCount = await this.getRecordCount(table);

    const assessment: DataQualityAssessment = {
      id: `assessment_${table}_${Date.now()}`,
      table,
      recordCount,
      assessmentDate: new Date().toISOString(),
      overallScore: 0,
      dimensionScores: {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        validity: 0,
        uniqueness: 0,
        referential: 0
      },
      ruleResults: [],
      trends: {
        scoreChange: 0,
        trendDirection: 'stable'
      },
      recommendations: []
    };

    // Group rules by dimension
    const rulesByDimension = this.groupRulesByDimension(rules);

    // Assess each dimension
    for (const [dimension, dimensionRules] of Object.entries(rulesByDimension)) {
      const dimensionScore = await this.assessDimension(table, dimension, dimensionRules, recordCount);
      assessment.dimensionScores[dimension as keyof typeof assessment.dimensionScores] = dimensionScore.score;
      assessment.ruleResults.push(...dimensionScore.results);
    }

    // Calculate overall score
    assessment.overallScore = this.calculateOverallScore(assessment.dimensionScores, rules);

    // Get previous assessment for trend analysis
    const previousAssessment = await this.getPreviousAssessment(table);
    if (previousAssessment) {
      assessment.trends.previousScore = previousAssessment.overallScore;
      assessment.trends.scoreChange = assessment.overallScore - previousAssessment.overallScore;
      assessment.trends.trendDirection = this.determineTrendDirection(assessment.trends.scoreChange);
    }

    // Generate recommendations
    assessment.recommendations = this.generateRecommendations(assessment);

    return assessment;
  }

  /**
   * Assess a specific quality dimension
   */
  private async assessDimension(
    table: string,
    dimension: string,
    rules: DataQualityRule[],
    recordCount: number
  ): Promise<{ score: number; results: DataQualityAssessment['ruleResults'][0] }> {
    const results: DataQualityAssessment['ruleResults'][0] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const rule of rules) {
      try {
        const ruleResult = await this.evaluateQualityRule(table, rule, recordCount);
        results.push(ruleResult);

        if (ruleResult.passed) {
          totalWeightedScore += ruleResult.score * rule.weight;
        }
        totalWeight += rule.weight;

      } catch (error) {
        console.error(`Error evaluating rule ${rule.name} for ${table}:`, error);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          score: 0,
          passed: false,
          issues: [{
            issue: `Rule evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: rule.severity
          }]
        });
      }
    }

    const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 100;

    return { score, results };
  }

  /**
   * Evaluate a specific quality rule
   */
  private async evaluateQualityRule(
    table: string,
    rule: DataQualityRule,
    recordCount: number
  ): Promise<DataQualityAssessment['ruleResults'][0]> {
    const startTime = Date.now();

    try {
      let score = 100;
      const issues: Array<{
        recordId?: string;
        field?: string;
        value?: any;
        issue: string;
        severity: string;
      }> = [];

      switch (rule.ruleType) {
        case 'completeness':
          ({ score, issues } = await this.assessCompleteness(table, rule, recordCount));
          break;

        case 'accuracy':
          ({ score, issues } = await this.assessAccuracy(table, rule));
          break;

        case 'consistency':
          ({ score, issues } = await this.assessConsistency(table, rule));
          break;

        case 'validity':
          ({ score, issues } = await this.assessValidity(table, rule));
          break;

        case 'uniqueness':
          ({ score, issues } = await this.assessUniqueness(table, rule));
          break;

        case 'referential':
          ({ score, issues } = await this.assessReferential(table, rule));
          break;

        default:
          throw new Error(`Unknown rule type: ${rule.ruleType}`);
      }

      const passed = score >= rule.threshold;
      const executionTime = Date.now() - startTime;

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        score,
        passed,
        issues
      };

    } catch (error) {
      throw new Error(`Rule evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assess data completeness
   */
  private async assessCompleteness(
    table: string,
    rule: DataQualityRule,
    recordCount: number
  ): Promise<{ score: number; issues: any[] }> {
    const issues: any[] = [];
    let score = 100;

    try {
      // Get required fields from rule parameters
      const requiredFields = rule.parameters.requiredFields || [];

      for (const field of requiredFields) {
        // Count null/empty values for this field
        const { data: nullCounts } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .or(`${field}.is.null,${field}.eq.'')`);

        const nullCount = nullCounts || 0;
        const completenessScore = recordCount > 0 ? ((recordCount - nullCount) / recordCount) * 100 : 100;

        if (completenessScore < 95) {
          issues.push({
            field,
            issue: `Field ${field} has ${nullCount} null/empty values (${(100 - completenessScore).toFixed(1)}% missing)`,
            severity: completenessScore < 80 ? 'high' : 'medium'
          });
        }

        score = Math.min(score, completenessScore);
      }

    } catch (error) {
      console.error('Error assessing completeness:', error);
      issues.push({
        issue: `Completeness assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
      score = 0;
    }

    return { score, issues };
  }

  /**
   * Assess data accuracy
   */
  private async assessAccuracy(
    table: string,
    rule: DataQualityRule
  ): Promise<{ score: number; issues: any[] }> {
    const issues: any[] = [];
    let score = 100;

    try {
      const field = rule.field;
      if (!field) {
        return { score: 100, issues: [] };
      }

      // Check for obvious data issues based on field type
      const { data: sample } = await supabase
        .from(table)
        .select(field)
        .limit(1000);

      if (!sample || sample.length === 0) {
        return { score: 100, issues: [] };
      }

      const fieldValues = sample.map((row: any) => row[field]).filter(v => v != null);

      // Check for accuracy issues based on field patterns
      if (field.includes('email')) {
        const invalidEmails = fieldValues.filter((value: string) =>
          !this.isValidEmail(value)
        );

        if (invalidEmails.length > 0) {
          issues.push({
            field,
            issue: `Found ${invalidEmails.length} invalid email formats`,
            severity: 'high'
          });
          score = Math.max(0, score - (invalidEmails.length / fieldValues.length) * 100);
        }
      }

      if (field.includes('phone') || field.includes('mobile')) {
        const invalidPhones = fieldValues.filter((value: string) =>
          !this.isValidPhoneNumber(value)
        );

        if (invalidPhones.length > 0) {
          issues.push({
            field,
            issue: `Found ${invalidPhones.length} invalid phone formats`,
            severity: 'medium'
          });
          score = Math.max(0, score - (invalidPhones.length / fieldValues.length) * 50);
        }
      }

      if (field.includes('abn')) {
        const invalidAbns = fieldValues.filter((value: string) =>
          !this.isValidABN(value)
        );

        if (invalidAbns.length > 0) {
          issues.push({
            field,
            issue: `Found ${invalidAbns.length} invalid ABN formats`,
            severity: 'high'
          });
          score = Math.max(0, score - (invalidAbns.length / fieldValues.length) * 100);
        }
      }

    } catch (error) {
      console.error('Error assessing accuracy:', error);
      issues.push({
        issue: `Accuracy assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
      score = 0;
    }

    return { score, issues };
  }

  /**
   * Assess data consistency
   */
  private async assessConsistency(
    table: string,
    rule: DataQualityRule
  ): Promise<{ score: number; issues: any[] }> {
    const issues: any[] = [];
    let score = 100;

    try {
      // Check for consistent formatting in common fields
      const consistencyChecks = rule.parameters.consistencyChecks || [];

      for (const check of consistencyChecks) {
        const { field, expectedPattern } = check;

        // Sample records to check consistency
        const { data: sample } = await supabase
          .from(table)
          .select(field)
          .not(field, 'is', null)
          .limit(500);

        if (!sample || sample.length === 0) continue;

        const values = sample.map((row: any) => row[field]).filter(v => v != null);
        const inconsistentValues = values.filter((value: string) =>
          !expectedPattern.test(value)
        );

        if (inconsistentValues.length > 0) {
          issues.push({
            field,
            issue: `Found ${inconsistentValues.length} inconsistent values in ${field}`,
            severity: 'medium'
          });
          score = Math.max(0, score - (inconsistentValues.length / values.length) * 30);
        }
      }

    } catch (error) {
      console.error('Error assessing consistency:', error);
      issues.push({
        issue: `Consistency assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
      score = 0;
    }

    return { score, issues };
  }

  /**
   * Assess data validity
   */
  private async assessValidity(
    table: string,
    rule: DataQualityRule
  ): Promise<{ score: number; issues: any[] }> {
    const issues: any[] = [];
    let score = 100;

    try {
      const field = rule.field;
      if (!field) {
        return { score: 100, issues: [] };
      }

      // Check for values outside expected ranges or formats
      const { data: invalidRecords } = await supabase
        .from(table)
        .select('id, ' + field)
        .or(this.buildValidityCondition(rule));

      if (invalidRecords && invalidRecords.length > 0) {
        issues.push({
          field,
          issue: `Found ${invalidRecords.length} invalid values in ${field}`,
          severity: 'high',
          recordId: invalidRecords[0].id
        });
        score = Math.max(0, score - Math.min(50, invalidRecords.length));
      }

    } catch (error) {
      console.error('Error assessing validity:', error);
      issues.push({
        issue: `Validity assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
      score = 0;
    }

    return { score, issues };
  }

  /**
   * Assess data uniqueness
   */
  private async assessUniqueness(
    table: string,
    rule: DataQualityRule
  ): Promise<{ score: number; issues: any[] }> {
    const issues: any[] = [];
    let score = 100;

    try {
      const field = rule.field;
      if (!field) {
        return { score: 100, issues: [] };
      }

      // Check for duplicate values
      const { data: duplicates } = await supabase
        .from(table)
        .select(field, { count: 'exact', head: true })
        .not(field, 'is', null)
        .group(field)
        .having('count', 'gt', 1);

      if (duplicates && duplicates > 0) {
        issues.push({
          field,
          issue: `Found ${duplicates} duplicate values in ${field}`,
          severity: 'high'
        });
        score = Math.max(0, score - Math.min(40, duplicates * 10));
      }

    } catch (error) {
      console.error('Error assessing uniqueness:', error);
      issues.push({
        issue: `Uniqueness assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
      score = 0;
    }

    return { score, issues };
  }

  /**
   * Assess referential integrity
   */
  private async assessReferential(
    table: string,
    rule: DataQualityRule
  ): Promise<{ score: number; issues: any[] }> {
    const issues: any[] = [];
    let score = 100;

    try {
      const { foreignKey, referenceTable, referenceField } = rule.parameters;

      if (!foreignKey || !referenceTable) {
        return { score: 100, issues: [] };
      }

      // Check for orphaned records
      const { data: orphanedRecords } = await supabase
        .from(table)
        .select('id, ' + foreignKey)
        .not(foreignKey, 'is', null)
        .not(foreignKey, 'in',
          await supabase
            .from(referenceTable)
            .select(referenceField || 'id')
            .then(({ data }) => (data || []).map((r: any) => r[referenceField || 'id']))
        );

      if (orphanedRecords && orphanedRecords.length > 0) {
        issues.push({
          field: foreignKey,
          issue: `Found ${orphanedRecords.length} orphaned records in ${table}`,
          severity: 'high',
          recordId: orphanedRecords[0].id
        });
        score = Math.max(0, score - Math.min(60, orphanedRecords.length * 5));
      }

    } catch (error) {
      console.error('Error assessing referential integrity:', error);
      issues.push({
        issue: `Referential integrity assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
      score = 0;
    }

    return { score, issues };
  }

  /**
   * Store assessment results
   */
  private async storeAssessmentResults(assessment: DataQualityAssessment): Promise<void> {
    try {
      await supabase
        .from('data_quality_assessments')
        .insert({
          id: assessment.id,
          table_name: assessment.table,
          record_count: assessment.recordCount,
          assessment_date: assessment.assessmentDate,
          overall_score: assessment.overallScore,
          dimension_scores: assessment.dimensionScores,
          rule_results: assessment.ruleResults,
          trends: assessment.trends,
          recommendations: assessment.recommendations
        });

    } catch (error) {
      console.error('Error storing assessment results:', error);
    }
  }

  /**
   * Update quality trends
   */
  private async updateQualityTrends(assessment: DataQualityAssessment): Promise<void> {
    try {
      const trend: DataQualityTrend = {
        table: assessment.table,
        date: assessment.assessmentDate,
        overallScore: assessment.overallScore,
        dimensionScores: assessment.dimensionScores,
        issueCount: assessment.ruleResults.reduce((sum, result) =>
          sum + result.issues.filter(issue =>
            ['high', 'critical'].includes(issue.severity)
          ).length, 0),
        recordCount: assessment.recordCount
      };

      if (!this.assessmentHistory.has(assessment.table)) {
        this.assessmentHistory.set(assessment.table, []);
      }

      const history = this.assessmentHistory.get(assessment.table)!;
      history.push(trend);

      // Keep only last 90 days of history
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const filteredHistory = history.filter(t =>
        new Date(t.date) >= ninetyDaysAgo
      );
      this.assessmentHistory.set(assessment.table, filteredHistory);

      // Store in database
      await supabase
        .from('data_quality_trends')
        .upsert(trend);

    } catch (error) {
      console.error('Error updating quality trends:', error);
    }
  }

  /**
   * Identify quality issues from assessment
   */
  private async identifyQualityIssues(assessment: DataQualityAssessment): Promise<void> {
    try {
      for (const ruleResult of assessment.ruleResults) {
        for (const issue of ruleResult.issues) {
          const qualityIssue: DataQualityIssue = {
            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            table: assessment.table,
            recordId: issue.recordId,
            field: issue.field,
            ruleId: ruleResult.ruleId,
            ruleName: ruleResult.ruleName,
            issueType: 'quality_rule_violation',
            severity: issue.severity as any,
            description: issue.issue,
            currentValue: issue.value,
            detectedAt: new Date().toISOString(),
            status: 'open'
          };

          // Check if similar issue already exists
          const existingIssue = await this.findSimilarIssue(qualityIssue);
          if (!existingIssue) {
            await supabase
              .from('data_quality_issues')
              .insert(qualityIssue);
          }
        }
      }

    } catch (error) {
      console.error('Error identifying quality issues:', error);
    }
  }

  /**
   * Get quality dashboard data
   */
  async getQualityDashboard(): Promise<{
    overview: {
      overallScore: number;
      totalIssues: number;
      criticalIssues: number;
      assessedTables: number;
      lastAssessment: string;
    };
    tableScores: Array<{
      table: string;
      score: number;
      issues: number;
      lastAssessed: string;
      trend: 'improving' | 'stable' | 'declining';
    }>;
    recentIssues: Array<{
      id: string;
      table: string;
      issue: string;
      severity: string;
      detectedAt: string;
    }>;
    trends: Array<{
      table: string;
      date: string;
      score: number;
    }>;
  }> {
    try {
      const [overview, tableScores, recentIssues, trends] = await Promise.all([
        this.getQualityOverview(),
        this.getTableScores(),
        this.getRecentIssues(),
        this.getRecentTrends()
      ]);

      return { overview, tableScores, recentIssues, trends };

    } catch (error) {
      console.error('Error getting quality dashboard:', error);
      return this.getEmptyDashboard();
    }
  }

  /**
   * Get quality trends for a table
   */
  async getQualityTrends(
    table: string,
    days: number = 30
  ): Promise<DataQualityTrend[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data: trends } = await supabase
        .from('data_quality_trends')
        .select('*')
        .eq('table', table)
        .gte('date', startDate.toISOString())
        .order('date', { ascending: true });

      return trends || [];

    } catch (error) {
      console.error('Error getting quality trends:', error);
      return [];
    }
  }

  /**
   * Generate quality report
   */
  async generateQualityReport(table?: string): Promise<{
    summary: {
      overallScore: number;
      totalRecords: number;
      totalIssues: number;
      criticalIssues: number;
      recommendations: string[];
    };
    dimensions: {
      [key: string]: {
        score: number;
        issues: number;
        description: string;
      };
    };
    tableDetails?: Array<{
      table: string;
      score: number;
      records: number;
      issues: number;
      topIssues: string[];
    }>;
  }> {
    try {
      const tables = table ? [table] : await this.getMonitoredTables();
      const assessments = await this.runQualityAssessment();

      const totalRecords = assessments.reduce((sum, a) => sum + a.recordCount, 0);
      const totalIssues = assessments.reduce((sum, a) =>
        sum + a.ruleResults.reduce((ruleSum, r) => ruleSum + r.issues.length, 0), 0
      );
      const criticalIssues = assessments.reduce((sum, a) =>
        sum + a.ruleResults.reduce((ruleSum, r) =>
          ruleSum + r.issues.filter(i => ['critical', 'high'].includes(i.severity)).length, 0
        ), 0
      );

      const overallScore = assessments.reduce((sum, a) => sum + a.overallScore, 0) / assessments.length;

      // Aggregate dimension scores
      const dimensions: any = {};
      const allDimensions = ['completeness', 'accuracy', 'consistency', 'validity', 'uniqueness', 'referential'];

      for (const dimension of allDimensions) {
        const dimensionScores = assessments.map(a => a.dimensionScores[dimension as keyof typeof a.dimensionScores]);
        const avgScore = dimensionScores.reduce((sum, score) => sum + score, 0) / dimensionScores.length;
        const dimensionIssues = assessments.reduce((sum, a) =>
          sum + a.ruleResults.filter(r =>
            r.issues.some(i => this.getRuleType(r.ruleId) === dimension)
          ).length, 0
        );

        dimensions[dimension] = {
          score: Math.round(avgScore),
          issues: dimensionIssues,
          description: this.getDimensionDescription(dimension)
        };
      }

      const recommendations = this.generateOverallRecommendations(assessments);

      const result: any = {
        summary: {
          overallScore: Math.round(overallScore),
          totalRecords,
          totalIssues,
          criticalIssues,
          recommendations
        },
        dimensions
      };

      if (!table) {
        result.tableDetails = assessments.map(a => ({
          table: a.table,
          score: a.overallScore,
          records: a.recordCount,
          issues: a.ruleResults.reduce((sum, r) => sum + r.issues.length, 0),
          topIssues: a.ruleResults
            .flatMap(r => r.issues.map(i => `${r.ruleName}: ${i.issue}`))
            .slice(0, 5)
        }));
      }

      return result;

    } catch (error) {
      console.error('Error generating quality report:', error);
      return this.getEmptyReport();
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async createQualityTables(): Promise<void> {
    const tables = [
      // Data quality assessments
      `
        CREATE TABLE IF NOT EXISTS data_quality_assessments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name TEXT NOT NULL,
          record_count INTEGER DEFAULT 0,
          assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
          overall_score NUMERIC NOT NULL,
          dimension_scores JSONB NOT NULL,
          rule_results JSONB NOT NULL,
          trends JSONB,
          recommendations TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_quality_assessments_table_date
          ON data_quality_assessments(table_name, assessment_date);
        CREATE INDEX IF NOT EXISTS idx_quality_assessments_score
          ON data_quality_assessments(overall_score);
      `,
      // Data quality rules
      `
        CREATE TABLE IF NOT EXISTS data_quality_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          table_name TEXT NOT NULL,
          field_name TEXT,
          rule_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          parameters JSONB NOT NULL,
          threshold NUMERIC DEFAULT 80,
          weight NUMERIC DEFAULT 1.0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_quality_rules_table_enabled
          ON data_quality_rules(table_name, enabled);
      `,
      // Data quality issues
      `
        CREATE TABLE IF NOT EXISTS data_quality_issues (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name TEXT NOT NULL,
          record_id TEXT,
          field_name TEXT,
          rule_id UUID REFERENCES data_quality_rules(id),
          rule_name TEXT NOT NULL,
          issue_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          description TEXT NOT NULL,
          current_value JSONB,
          expected_value JSONB,
          detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status TEXT DEFAULT 'open',
          resolved_at TIMESTAMP WITH TIME ZONE,
          resolved_by TEXT,
          resolution TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_quality_issues_table_severity
          ON data_quality_issues(table_name, severity, detected_at);
        CREATE INDEX IF NOT EXISTS idx_quality_issues_status
          ON data_quality_issues(status, detected_at);
      `,
      // Data quality trends
      `
        CREATE TABLE IF NOT EXISTS data_quality_trends (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name TEXT NOT NULL,
          assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
          overall_score NUMERIC NOT NULL,
          dimension_scores JSONB NOT NULL,
          issue_count INTEGER DEFAULT 0,
          record_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_quality_trends_table_date
          ON data_quality_trends(table_name, assessment_date);
      `
    ];

    for (const tableSql of tables) {
      try {
        await supabase.rpc('execute_sql', { sql: tableSql });
      } catch (error) {
        console.error('Error creating quality table:', error);
      }
    }
  }

  private async loadDefaultQualityRules(): Promise<void> {
    const defaultRules: Omit<DataQualityRule, 'id'>[] = [
      // Employer table rules
      {
        name: 'Employer Name Completeness',
        description: 'Employer name should not be null or empty',
        table: 'employers',
        field: 'name',
        ruleType: 'completeness',
        severity: 'high',
        enabled: true,
        parameters: { requiredFields: ['name'] },
        threshold: 95,
        weight: 1.0
      },
      {
        name: 'Employer ABN Validity',
        description: 'ABN should be in valid format if provided',
        table: 'employers',
        field: 'abn',
        ruleType: 'accuracy',
        severity: 'medium',
        enabled: true,
        parameters: {},
        threshold: 90,
        weight: 0.8
      },
      {
        name: 'Employer Email Validity',
        description: 'Email should be in valid format if provided',
        table: 'employers',
        field: 'contact_email',
        ruleType: 'accuracy',
        severity: 'medium',
        enabled: true,
        parameters: {},
        threshold: 90,
        weight: 0.6
      },
      // Projects table rules
      {
        name: 'Project Name Completeness',
        description: 'Project name should not be null or empty',
        table: 'projects',
        field: 'name',
        ruleType: 'completeness',
        severity: 'high',
        enabled: true,
        parameters: { requiredFields: ['name'] },
        threshold: 98,
        weight: 1.0
      },
      {
        name: 'Project Status Validity',
        description: 'Project status should be one of the valid values',
        table: 'projects',
        field: 'status',
        ruleType: 'validity',
        severity: 'high',
        enabled: true,
        parameters: {
          validValues: ['active', 'completed', 'planning', 'on_hold', 'cancelled']
        },
        threshold: 95,
        weight: 0.9
      },
      // Compliance checks rules
      {
        name: 'Compliance Check Date Validity',
        description: 'Checked date should not be in the future',
        table: 'compliance_checks',
        field: 'checked_at',
        ruleType: 'validity',
        severity: 'medium',
        enabled: true,
        parameters: {},
        threshold: 98,
        weight: 0.7
      }
    ];

    for (const rule of defaultRules) {
      try {
        const { data } = await supabase
          .from('data_quality_rules')
          .insert(rule)
          .select('id')
          .single();

        if (data) {
          this.qualityRules.set(data.id, { ...rule, id: data.id });
        }

      } catch (error) {
        // Rule might already exist, try to load it
        const { data } = await supabase
          .from('data_quality_rules')
          .select('*')
          .eq('name', rule.name)
          .single();

        if (data) {
          this.qualityRules.set(data.id, data);
        }
      }
    }

    console.log(`Loaded ${this.qualityRules.size} quality rules`);
  }

  private async setupAutomatedAssessments(): Promise<void> {
    // Schedule daily assessments for each monitored table
    const tables = await this.getMonitoredTables();

    for (const table of tables) {
      // Run assessment every 6 hours
      const timer = setInterval(async () => {
        try {
          await this.runQualityAssessment(table);
        } catch (error) {
          console.error(`Automated assessment failed for ${table}:`, error);
        }
      }, 6 * 60 * 60 * 1000);

      this.assessmentSchedule.set(table, timer);
    }

    console.log(`Setup automated assessments for ${tables.length} tables`);
  }

  private async loadExistingData(): Promise<void> {
    // Load existing rules
    const { data: rules } = await supabase
      .from('data_quality_rules')
      .select('*');

    if (rules) {
      for (const rule of rules) {
        this.qualityRules.set(rule.id, rule);
      }
    }

    // Load recent trends
    const { data: trends } = await supabase
      .from('data_quality_trends')
      .select('*')
      .gte('assessment_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (trends) {
      for (const trend of trends) {
        if (!this.assessmentHistory.has(trend.table_name)) {
          this.assessmentHistory.set(trend.table_name, []);
        }
        this.assessmentHistory.get(trend.table_name)!.push(trend);
      }
    }

    console.log('Loaded existing quality data');
  }

  private async getMonitoredTables(): Promise<string[]> {
    const tables = Array.from(this.qualityRules.values())
      .map(rule => rule.table)
      .filter((table, index, arr) => arr.indexOf(table) === index); // Remove duplicates

    return tables.length > 0 ? tables : ['employers', 'projects', 'compliance_checks'];
  }

  private async getRecordCount(table: string): Promise<number> {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      return count || 0;
    } catch (error) {
      console.error(`Error getting record count for ${table}:`, error);
      return 0;
    }
  }

  private groupRulesByDimension(rules: DataQualityRule[]): Record<string, DataQualityRule[]> {
    const grouped: Record<string, DataQualityRule[]> = {
      completeness: [],
      accuracy: [],
      consistency: [],
      validity: [],
      uniqueness: [],
      referential: []
    };

    for (const rule of rules) {
      if (grouped[rule.ruleType]) {
        grouped[rule.ruleType].push(rule);
      }
    }

    return grouped;
  }

  private calculateOverallScore(
    dimensionScores: DataQualityAssessment['dimensionScores'],
    rules: DataQualityRule[]
  ): number {
    // Weight dimensions based on rule importance
    const dimensionWeights = {
      completeness: 0.25,
      accuracy: 0.25,
      consistency: 0.15,
      validity: 0.20,
      uniqueness: 0.10,
      referential: 0.05
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [dimension, score] of Object.entries(dimensionScores)) {
      const weight = dimensionWeights[dimension as keyof typeof dimensionWeights];
      const rulesInDimension = rules.filter(r => r.ruleType === dimension);

      if (rulesInDimension.length > 0) {
        weightedScore += score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 100;
  }

  private async getPreviousAssessment(table: string): Promise<DataQualityAssessment | null> {
    try {
      const { data } = await supabase
        .from('data_quality_assessments')
        .select('*')
        .eq('table_name', table)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .single();

      return data || null;

    } catch (error) {
      return null;
    }
  }

  private determineTrendDirection(scoreChange: number): 'improving' | 'stable' | 'declining' {
    if (scoreChange > 5) return 'improving';
    if (scoreChange < -5) return 'declining';
    return 'stable';
  }

  private generateRecommendations(assessment: DataQualityAssessment): string[] {
    const recommendations: string[] = [];

    // Analyze rule results and generate recommendations
    for (const result of assessment.ruleResults) {
      if (!result.passed) {
        if (result.ruleName.includes('completeness')) {
          recommendations.push(`Improve data completeness for ${assessment.table} by ensuring required fields are populated`);
        } else if (result.ruleName.includes('accuracy')) {
          recommendations.push(`Review and correct data format issues in ${assessment.table}`);
        } else if (result.ruleName.includes('validity')) {
          recommendations.push(`Validate and correct invalid data values in ${assessment.table}`);
        } else if (result.ruleName.includes('uniqueness')) {
          recommendations.push(`Remove duplicate records or implement unique constraints in ${assessment.table}`);
        } else if (result.ruleName.includes('referential')) {
          recommendations.push(`Fix orphaned records and ensure referential integrity in ${assessment.table}`);
        }
      }
    }

    // General recommendations based on overall score
    if (assessment.overallScore < 70) {
      recommendations.push('Implement data validation at the source system level');
      recommendations.push('Consider data cleansing initiatives for low-quality data');
    }

    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  private buildValidityCondition(rule: DataQualityRule): string {
    const field = rule.field;
    const params = rule.parameters;

    if (!field) return 'false';

    let conditions: string[] = [];

    // Date validation
    if (params.validValues && params.validValues.includes('valid_date')) {
      conditions.push(`${field} < NOW() - INTERVAL '10 years'`);
    }

    // Numeric range validation
    if (params.minValue !== undefined) {
      conditions.push(`${field} < ${params.minValue}`);
    }
    if (params.maxValue !== undefined) {
      conditions.push(`${field} > ${params.maxValue}`);
    }

    // Enum validation
    if (params.validValues && Array.isArray(params.validValues)) {
      const validList = params.validValues.map((v: any) => `'${v}'`).join(', ');
      conditions.push(`NOT (${field} IN (${validList}))`);
    }

    return conditions.length > 0 ? conditions.join(' OR ') : 'false';
  }

  // Validation helper methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic Australian phone number validation
    const phoneRegex = /^(\+61|0)[2-478]\d{8}$/;
    return phoneRegex.test(phone.replace(/[\s-()]/g, ''));
  }

  private isValidABN(abn: string): boolean {
    // Basic ABN validation - 11 digits
    const abnRegex = /^(\d{11})$/;
    return abnRegex.test(abn.replace(/\s/g, ''));
  }

  private async findSimilarIssue(issue: DataQualityIssue): Promise<DataQualityIssue | null> {
    try {
      const { data } = await supabase
        .from('data_quality_issues')
        .select('*')
        .eq('table_name', issue.table)
        .eq('rule_id', issue.ruleId)
        .eq('field_name', issue.field)
        .eq('status', 'open')
        .order('detected_at', { ascending: false })
        .limit(1)
        .single();

      return data || null;

    } catch (error) {
      return null;
    }
  }

  private getRuleType(ruleId: string): string {
    const rule = this.qualityRules.get(ruleId);
    return rule?.ruleType || 'unknown';
  }

  private getDimensionDescription(dimension: string): string {
    const descriptions = {
      completeness: 'Measures presence of required data fields',
      accuracy: 'Evaluates correctness and format of data values',
      consistency: 'Assesses uniformity of data across records',
      validity: 'Checks if data values conform to expected formats and ranges',
      uniqueness: 'Ensures data uniqueness where required',
      referential: 'Validates relationships between data entities'
    };

    return descriptions[dimension as keyof typeof descriptions] || 'Unknown dimension';
  }

  private async getQualityOverview(): Promise<any> {
    try {
      const { data: latestAssessments } = await supabase
        .from('data_quality_assessments')
        .select('*')
        .in('id', (
          await supabase
            .from('data_quality_assessments')
            .select('MAX(id) as max_id, table_name')
            .group('table_name')
        ).data?.map(r => r.max_id) || []
        );

      if (!latestAssessments || latestAssessments.length === 0) {
        return {
          overallScore: 0,
          totalIssues: 0,
          criticalIssues: 0,
          assessedTables: 0,
          lastAssessment: null
        };
      }

      const overallScore = latestAssessments.reduce((sum, a) => sum + a.overall_score, 0) / latestAssessments.length;
      const lastAssessment = Math.max(...latestAssessments.map(a => new Date(a.assessment_date).getTime()));

      const totalIssues = await supabase
        .from('data_quality_issues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      const criticalIssues = await supabase
        .from('data_quality_issues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .in('severity', ['critical', 'high']);

      return {
        overallScore: Math.round(overallScore),
        totalIssues: totalIssues?.count || 0,
        criticalIssues: criticalIssues?.count || 0,
        assessedTables: latestAssessments.length,
        lastAssessment: new Date(lastAssessment).toISOString()
      };

    } catch (error) {
      console.error('Error getting quality overview:', error);
      return {
        overallScore: 0,
        totalIssues: 0,
        criticalIssues: 0,
        assessedTables: 0,
        lastAssessment: null
      };
    }
  }

  private async getTableScores(): Promise<any[]> {
    try {
      const { data: latestAssessments } = await supabase
        .from('data_quality_assessments')
        .select('*')
        .in('id', (
          await supabase
            .from('data_quality_assessments')
            .select('MAX(id) as max_id, table_name')
            .group('table_name')
        ).data?.map(r => r.max_id) || []
        )
        .order('overall_score', { ascending: false });

      return (latestAssessments || []).map(assessment => ({
        table: assessment.table_name,
        score: assessment.overall_score,
        issues: assessment.rule_results.reduce((sum, r) => sum + r.issues.length, 0),
        lastAssessed: assessment.assessment_date,
        trend: assessment.trends?.trendDirection || 'stable'
      }));

    } catch (error) {
      console.error('Error getting table scores:', error);
      return [];
    }
  }

  private async getRecentIssues(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('data_quality_issues')
        .select('id, table_name, description, severity, detected_at')
        .eq('status', 'open')
        .order('detected_at', { ascending: false })
        .limit(10);

      return (data || []).map(issue => ({
        id: issue.id,
        table: issue.table_name,
        issue: issue.description,
        severity: issue.severity,
        detectedAt: issue.detected_at
      }));

    } catch (error) {
      console.error('Error getting recent issues:', error);
      return [];
    }
  }

  private async getRecentTrends(): Promise<any[]> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { data } = await supabase
        .from('data_quality_trends')
        .select('table_name, assessment_date, overall_score')
        .gte('assessment_date', sevenDaysAgo.toISOString())
        .order('assessment_date', { ascending: false });

      return (data || []).map(trend => ({
        table: trend.table_name,
        date: trend.assessment_date,
        score: trend.overall_score
      }));

    } catch (error) {
      console.error('Error getting recent trends:', error);
      return [];
    }
  }

  private getEmptyDashboard(): any {
    return {
      overview: {
        overallScore: 0,
        totalIssues: 0,
        criticalIssues: 0,
        assessedTables: 0,
        lastAssessment: null
      },
      tableScores: [],
      recentIssues: [],
      trends: []
    };
  }

  private generateOverallRecommendations(assessments: DataQualityAssessment[]): string[] {
    const recommendations = new Set<string>();

    for (const assessment of assessments) {
      assessment.recommendations.forEach(rec => recommendations.add(rec));
    }

    // Add general recommendations
    const avgScore = assessments.reduce((sum, a) => sum + a.overallScore, 0) / assessments.length;
    if (avgScore < 80) {
      recommendations.add('Overall data quality needs improvement - consider data governance initiatives');
    }

    return Array.from(recommendations);
  }

  private getEmptyReport(): any {
    return {
      summary: {
        overallScore: 0,
        totalRecords: 0,
        totalIssues: 0,
        criticalIssues: 0,
        recommendations: []
      },
      dimensions: {}
    };
  }
}

// Export singleton instance
export const dataQualityMonitor = new DataQualityMonitor();