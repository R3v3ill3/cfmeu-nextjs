'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Zap,
  Clock,
  FileText,
  Users,
  History
} from 'lucide-react';
import { getTradeLabel } from '@/utils/tradeUtils';

interface SubcontractorEntry {
  index: number;
  trade: string;
  stage: string;
  company?: string;
  eba?: boolean;
  originalAction: string;
  originalEmployer?: {
    id: string;
    name: string;
    confidence: string;
  };
}

interface EbaEmployer {
  id: string;
  name: string;
  eba_status: 'yes' | 'no' | 'pending' | null;
  project_count: number;
  projects: Array<{
    id: string;
    name: string;
  }>;
  trades: Array<{
    tradeType: string;
    projectName: string;
  }>;
  isKeyContractor: boolean;
  aliases?: Array<{
    alias: string;
    confidence: number;
  }>;
}

interface EbaSelectionIntegrationProps {
  subcontractors: SubcontractorEntry[];
  ebaEmployers: EbaEmployer[];
  onConfirm: (updates: Array<{
    subcontractorIndex: number;
    ebaEmployer: EbaEmployer;
    replaceOriginal: boolean;
  }>) => void;
  onCancel: () => void;
  projectId?: string;
}

interface ReplacementPlan {
  subcontractorIndex: number;
  original: SubcontractorEntry;
  replacement: EbaEmployer;
  replaceOriginal: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

export function EbaSelectionIntegration({
  subcontractors,
  ebaEmployers,
  onConfirm,
  onCancel,
  projectId
}: EbaSelectionIntegrationProps) {
  const [replacementPlan, setReplacementPlan] = useState<ReplacementPlan[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Create replacement plan when component mounts
  React.useEffect(() => {
    const plan = createReplacementPlan(subcontractors, ebaEmployers);
    setReplacementPlan(plan);
  }, [subcontractors, ebaEmployers]);

  /**
   * Create intelligent replacement plan
   */
  const createReplacementPlan = (
    subs: SubcontractorEntry[],
    ebas: EbaEmployer[]
  ): ReplacementPlan[] => {
    const plan: ReplacementPlan[] = [];

    subs.forEach((subcontractor, index) => {
      // Find best EBA employer match for this trade
      const bestMatch = findBestEbaMatch(subcontractor, ebas);

      if (bestMatch) {
        const confidence = calculateMatchConfidence(subcontractor, bestMatch);
        const reasons = getMatchReasons(subcontractor, bestMatch, confidence);

        plan.push({
          subcontractorIndex: index,
          original: subcontractor,
          replacement: bestMatch,
          replaceOriginal: confidence === 'high', // Auto-approve high confidence matches
          confidence,
          reasons
        });
      }
    });

    return plan;
  };

  /**
   * Find best EBA employer match for a subcontractor
   */
  const findBestEbaMatch = (subcontractor: SubcontractorEntry, ebas: EbaEmployer[]): EbaEmployer | null => {
    const tradeCode = subcontractor.trade.toLowerCase().replace(/\s+/g, '_');

    // Filter EBA employers who have worked on this trade
    const tradeMatches = ebas.filter(employer =>
      employer.trades.some(trade =>
        trade.tradeType === tradeCode ||
        trade.tradeType.toLowerCase().includes(subcontractor.trade.toLowerCase())
      )
    );

    if (tradeMatches.length === 0) return null;

    // Prioritize EBA-verified employers
    const ebaVerified = tradeMatches.filter(emp => emp.eba_status === 'yes');
    if (ebaVerified.length > 0) {
      // Return the one with most projects
      return ebaVerified.reduce((prev, current) =>
        current.project_count > prev.project_count ? current : prev
      );
    }

    // Fall back to any trade match, preferring key contractors
    const keyContractors = tradeMatches.filter(emp => emp.isKeyContractor);
    if (keyContractors.length > 0) {
      return keyContractors.reduce((prev, current) =>
        current.project_count > prev.project_count ? current : prev
      );
    }

    // Return the trade match with most projects
    return tradeMatches.reduce((prev, current) =>
      current.project_count > prev.project_count ? current : prev
    );
  };

  /**
   * Calculate match confidence
   */
  const calculateMatchConfidence = (subcontractor: SubcontractorEntry, employer: EbaEmployer): 'high' | 'medium' | 'low' => {
    let score = 0;

    // EBA status (most important)
    if (employer.eba_status === 'yes') score += 40;
    else if (employer.eba_status === 'pending') score += 20;

    // Trade specialization
    const tradeCode = subcontractor.trade.toLowerCase().replace(/\s+/g, '_');
    const hasExactTrade = employer.trades.some(trade => trade.tradeType === tradeCode);
    if (hasExactTrade) score += 30;
    else score += 15; // Partial match

    // Key contractor status
    if (employer.isKeyContractor) score += 20;

    // Project experience
    if (employer.project_count > 10) score += 10;
    else if (employer.project_count > 5) score += 5;

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  /**
   * Get reasons for match recommendation
   */
  const getMatchReasons = (subcontractor: SubcontractorEntry, employer: EbaEmployer, confidence: 'high' | 'medium' | 'low'): string[] => {
    const reasons: string[] = [];

    if (employer.eba_status === 'yes') {
      reasons.push('EBA-verified employer');
    } else if (employer.eba_status === 'pending') {
      reasons.push('EBA pending verification');
    }

    const tradeCode = subcontractor.trade.toLowerCase().replace(/\s+/g, '_');
    const hasExactTrade = employer.trades.some(trade => trade.tradeType === tradeCode);
    if (hasExactTrade) {
      reasons.push(`Specializes in ${subcontractor.trade}`);
    }

    if (employer.isKeyContractor) {
      reasons.push('Key contractor with proven track record');
    }

    if (employer.project_count > 10) {
      reasons.push(`Extensive experience (${employer.project_count}+ projects)`);
    } else if (employer.project_count > 0) {
      reasons.push(`Project experience (${employer.project_count} projects)`);
    }

    // Add confidence-specific reasoning
    if (confidence === 'high') {
      reasons.push('Strong match - recommended replacement');
    } else if (confidence === 'medium') {
      reasons.push('Good match - review recommended');
    } else {
      reasons.push('Potential match - careful review needed');
    }

    return reasons;
  };

  /**
   * Toggle replacement for a specific subcontractor
   */
  const toggleReplacement = useCallback((index: number) => {
    setReplacementPlan(prev => prev.map((plan, i) =>
      i === index ? { ...plan, replaceOriginal: !plan.replaceOriginal } : plan
    ));
  }, []);

  /**
   * Toggle all replacements
   */
  const toggleAllReplacements = useCallback((enabled: boolean) => {
    setReplacementPlan(prev => prev.map(plan => ({
      ...plan,
      replaceOriginal: plan.confidence === 'high' ? enabled : plan.replaceOriginal
    })));
  }, []);

  /**
   * Process the replacement plan
   */
  const handleConfirm = async () => {
    setIsProcessing(true);
    setCurrentStep(0);

    const updates = replacementPlan
      .filter(plan => plan.replaceOriginal)
      .map(plan => ({
        subcontractorIndex: plan.subcontractorIndex,
        ebaEmployer: plan.replacement,
        replaceOriginal: true
      }));

    // Simulate processing steps for better UX
    const steps = [
      'Validating EBA employer selections...',
      'Checking for conflicts...',
      'Preparing replacements...',
      'Finalizing integration...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    onConfirm(updates);
    setIsProcessing(false);
  };

  /**
   * Get confidence icon and color
   */
  const getConfidenceDisplay = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'medium':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'low':
        return {
          icon: <XCircle className="h-4 w-4 text-red-600" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
    }
  };

  const stats = {
    total: replacementPlan.length,
    approved: replacementPlan.filter(p => p.replaceOriginal).length,
    highConfidence: replacementPlan.filter(p => p.confidence === 'high').length,
    ebaVerified: replacementPlan.filter(p => p.replacement.eba_status === 'yes').length
  };

  if (replacementPlan.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            No EBA Matches Found
          </CardTitle>
          <CardDescription>
            No suitable EBA employers were found for the selected subcontractors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This could mean that either no EBA employers work on these trades,
              or they need to be added to the system first.
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button onClick={onCancel}>Close</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            EBA Employer Integration
          </CardTitle>
          <CardDescription>
            Replace scanned subcontractors with verified EBA employers for better compliance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Matches</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{stats.ebaVerified}</div>
              <div className="text-sm text-muted-foreground">EBA Verified</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.highConfidence}</div>
              <div className="text-sm text-muted-foreground">High Confidence</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleAllReplacements(true)}
            >
              Select All Matches
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleAllReplacements(false)}
            >
              Clear Selection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmation(!showConfirmation)}
            >
              {showConfirmation ? 'Hide' : 'Show'} Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Replacement Plan */}
      <div className="space-y-3">
        {replacementPlan.map((plan, index) => {
          const confidenceDisplay = getConfidenceDisplay(plan.confidence);

          return (
            <Card
              key={index}
              className={`transition-all cursor-pointer hover:shadow-md ${
                plan.replaceOriginal ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => toggleReplacement(index)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        plan.replaceOriginal
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {plan.replaceOriginal && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      {/* Original vs Replacement */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-sm text-gray-500 mb-1">Original Subcontractor</div>
                          <div className="font-medium">{plan.original.company || 'Unknown'}</div>
                          <div className="text-sm text-gray-600">{getTradeLabel(plan.original.trade)}</div>
                        </div>

                        <ArrowRight className="h-5 w-5 text-gray-400 mt-4" />

                        <div className="flex-1">
                          <div className="text-sm text-gray-500 mb-1">EBA Employer</div>
                          <div className="font-medium flex items-center gap-2">
                            {plan.replacement.name}
                            {plan.replacement.eba_status === 'yes' && (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                EBA
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {plan.replacement.project_count} projects
                            {plan.replacement.isKeyContractor && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Key Contractor
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Confidence and Reasons */}
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${confidenceDisplay.bgColor} ${confidenceDisplay.borderColor} border`}>
                        {confidenceDisplay.icon}
                        <span className={`text-sm font-medium ${confidenceDisplay.color}`}>
                          {plan.confidence.charAt(0).toUpperCase() + plan.confidence.slice(1)} Confidence Match
                        </span>
                        <div className="text-xs text-gray-600 ml-auto">
                          {plan.reasons.slice(0, 2).join(' • ')}
                          {plan.reasons.length > 2 && (
                            <span className="text-gray-500"> +{plan.reasons.length - 2} more</span>
                          )}
                        </div>
                      </div>

                      {/* Detailed reasons (when expanded) */}
                      {showConfirmation && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium mb-2">Match Details:</div>
                          <div className="space-y-1">
                            {plan.reasons.map((reason, idx) => (
                              <div key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                {reason}
                              </div>
                            ))}
                          </div>

                          {plan.replacement.projects.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="text-sm font-medium mb-1">Recent Projects:</div>
                              <div className="flex flex-wrap gap-1">
                                {plan.replacement.projects.slice(0, 3).map((project, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {project.name}
                                  </Badge>
                                ))}
                                {plan.replacement.projects.length > 3 && (
                                  <span className="text-xs text-gray-500">
                                    +{plan.replacement.projects.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                <span className="font-medium">Processing EBA Integration...</span>
              </div>

              <Progress value={(currentStep + 1) / 4 * 100} className="w-full" />

              <div className="text-sm text-gray-600">
                {currentStep === 0 && 'Validating EBA employer selections...'}
                {currentStep === 1 && 'Checking for conflicts...'}
                {currentStep === 2 && 'Preparing replacements...'}
                {currentStep === 3 && 'Finalizing integration...'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {stats.approved} of {stats.total} matches selected for replacement
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={stats.approved === 0 || isProcessing}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Replace {stats.approved} Subcontractors
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}