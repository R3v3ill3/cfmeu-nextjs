"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Share, ExternalLink, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ShareLinkGeneratorProps {
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

export function ShareLinkGenerator({ projectId, projectName }: ShareLinkGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLinkResponse | null>(null);
  const [resourceType, setResourceType] = useState<'PROJECT_MAPPING_SHEET'>('PROJECT_MAPPING_SHEET');
  const [expiresInHours, setExpiresInHours] = useState('48');

  const generateShareLink = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch(`/api/projects/${projectId}/generate-share-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType,
          expiresInHours: parseInt(expiresInHours),
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share className="h-4 w-4" />
          Share Mapping Sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Mapping Sheet</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Generate a secure link to share <strong>{projectName}</strong> mapping sheet with external delegates.
          </div>

          {!shareLink && (
            <>
              <div className="space-y-2">
                <Label htmlFor="resource-type">Resource Type</Label>
                <Select value={resourceType} onValueChange={(value: any) => setResourceType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROJECT_MAPPING_SHEET">Project Mapping Sheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires-in">Link Expires In</Label>
                <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours (recommended)</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={generateShareLink} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? 'Generating...' : 'Generate Share Link'}
              </Button>
            </>
          )}

          {shareLink && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                  <Share className="h-4 w-4" />
                  Share Link Generated
                </div>
                <div className="text-sm text-green-700">
                  This link allows external users to view and update the mapping sheet for{' '}
                  <strong>{projectName}</strong>.
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secure Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={shareLink.shareUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(shareLink.shareUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(shareLink.shareUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Link Details</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Expires:</span>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {formatExpiryTime(shareLink.expiresAt)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Resource:</span>
                    <Badge variant="outline">
                      {shareLink.resourceType.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token:</span>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {shareLink.token.substring(0, 8)}...
                    </code>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• This link is secure and can only be used by people you share it with</div>
                  <div>• The link will expire automatically after the specified time</div>
                  <div>• Recipients can view and update project information through this link</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShareLink(null)}
                  className="flex-1"
                >
                  Generate Another Link
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
