"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Share, ExternalLink, Clock, QrCode, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";
import { useKeyContractorTradesSet } from "@/hooks/useKeyContractorTrades";

export interface ShareAuditFormGeneratorProps {
  projectId: string;
  projectName: string;
}

interface ShareLinkResponse {
  shareUrl: string;
  token: string;
  expiresAt: string;
  resourceType: string;
  resourceId: string;
}

interface Employer {
  id: string;
  name: string;
  roleOrTrade: string;
}

export function ShareAuditFormGenerator({ projectId, projectName }: ShareAuditFormGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLinkResponse | null>(null);
  const [expiresInHours, setExpiresInHours] = useState('48');
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>([]);
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  const { data: mappingData, isLoading } = useMappingSheetData(projectId);
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet();

  // Build employer list from mapping data
  const employers = useMemo(() => {
    if (!mappingData) return [];
    
    const employerMap = new Map<string, Employer>();
    
    // Add contractor roles
    mappingData.contractorRoles.forEach(role => {
      const existing = employerMap.get(role.employerId);
      if (!existing || role.role === 'builder' || role.role === 'head_contractor') {
        employerMap.set(role.employerId, {
          id: role.employerId,
          name: role.employerName,
          roleOrTrade: role.roleLabel,
        });
      }
    });
    
    // Add trade contractors
    mappingData.tradeContractors.forEach(trade => {
      if (!employerMap.has(trade.employerId)) {
        employerMap.set(trade.employerId, {
          id: trade.employerId,
          name: trade.employerName,
          roleOrTrade: trade.tradeLabel,
        });
      }
    });
    
    return Array.from(employerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mappingData]);

  const generateShareLink = async () => {
    if (selectedEmployerIds.length === 0) {
      toast.error('Please select at least one employer');
      return;
    }

    try {
      setIsGenerating(true);

      const response = await fetch(`/api/projects/${projectId}/generate-share-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType: 'PROJECT_AUDIT_COMPLIANCE',
          expiresInHours: parseInt(expiresInHours),
          employerIds: selectedEmployerIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const result: ShareLinkResponse = await response.json();
      setShareLink(result);
      toast.success('Share link generated successfully');

    } catch (error: any) {
      console.error('Failed to generate share link:', error);
      toast.error(error.message || 'Failed to generate share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatExpiryTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursRemaining <= 0) {
      return 'Expired';
    } else if (hoursRemaining < 24) {
      return `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} remaining`;
    } else {
      const daysRemaining = Math.ceil(hoursRemaining / 24);
      return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAllChecked(checked);
    if (checked) {
      setSelectedEmployerIds(employers.map(e => e.id));
    } else {
      setSelectedEmployerIds([]);
    }
  };

  const handleEmployerToggle = (employerId: string, checked: boolean) => {
    setSelectedEmployerIds(prev => {
      const newSelection = checked
        ? [...prev, employerId]
        : prev.filter(id => id !== employerId);
      
      // Update select all checkbox
      setSelectAllChecked(newSelection.length === employers.length);
      return newSelection;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share className="h-4 w-4" />
          Share Audit & Compliance Form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Audit & Compliance Form</DialogTitle>
        </DialogHeader>

        {!shareLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Generate a secure link to share the audit & compliance form for <strong>{projectName}</strong>.
                External users will be able to complete employer compliance assessments for selected employers.
              </p>
            </div>

            {/* Employer Selection */}
            <div className="space-y-3">
              <Label>Select Employers to Assess</Label>
              
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Loading employers...
                </div>
              ) : employers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  No employers found on this project
                </div>
              ) : (
                <div className="space-y-2 border rounded-md p-3 max-h-[300px] overflow-y-auto">
                  {/* Select All */}
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      id="select-all"
                      checked={selectAllChecked}
                      onCheckedChange={handleSelectAll}
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Select All ({employers.length})
                    </label>
                  </div>

                  {/* Individual Employers */}
                  {employers.map((employer) => (
                    <div key={employer.id} className="flex items-start space-x-2 py-1">
                      <Checkbox
                        id={employer.id}
                        checked={selectedEmployerIds.includes(employer.id)}
                        onCheckedChange={(checked) => handleEmployerToggle(employer.id, checked as boolean)}
                      />
                      <label
                        htmlFor={employer.id}
                        className="text-sm leading-tight cursor-pointer flex-1"
                      >
                        <div className="font-medium">{employer.name}</div>
                        <div className="text-xs text-muted-foreground">{employer.roleOrTrade}</div>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {selectedEmployerIds.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedEmployerIds.length} employer{selectedEmployerIds.length === 1 ? '' : 's'} selected
                </div>
              )}
            </div>

            {/* Expiry Selection */}
            <div className="space-y-2">
              <Label htmlFor="expiry">Link Expires In</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger id="expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                  <SelectItem value="72">72 hours</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateShareLink}
              disabled={isGenerating || selectedEmployerIds.length === 0}
              className="w-full"
            >
              {isGenerating ? 'Generating...' : 'Generate Share Link'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {formatExpiryTime(shareLink.expiresAt)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShareLink(null);
                  setSelectedEmployerIds([]);
                  setSelectAllChecked(false);
                }}
              >
                Generate New Link
              </Button>
            </div>

            <Tabs defaultValue="link" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="link">Share Link</TabsTrigger>
                <TabsTrigger value="qr">QR Code</TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="space-y-4">
                <div className="space-y-2">
                  <Label>Secure Link</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink.shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(shareLink.shareUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(shareLink.shareUrl)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(shareLink.shareUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="qr" className="space-y-4">
                <div className="text-center space-y-4">
                  {/* QR Code Display */}
                  <div className="flex justify-center">
                    <div className="rounded-xl border bg-white p-6 shadow-lg">
                      <QRCode
                        value={shareLink.shareUrl}
                        size={240}
                        style={{ height: "auto", width: "240px" }}
                        viewBox="0 0 256 256"
                        level="M"
                      />
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-3 max-w-sm mx-auto">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-1">📱 For Mobile Users</p>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>• <strong>iPhone:</strong> Open Camera app and point at QR code</div>
                        <div>• <strong>Android:</strong> Open Camera or Google Lens</div>
                        <div>• <strong>No app needed</strong> - works with built-in camera</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      QR code links directly to the audit & compliance form with all project data pre-loaded.
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="p-3 bg-muted rounded-md space-y-1">
              <div className="text-sm font-medium">Selected Employers ({selectedEmployerIds.length})</div>
              <div className="text-xs text-muted-foreground">
                {employers
                  .filter(e => selectedEmployerIds.includes(e.id))
                  .map(e => e.name)
                  .join(', ')}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

