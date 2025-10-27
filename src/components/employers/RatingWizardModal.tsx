"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, Users } from "lucide-react";
import { RatingWizard } from "@/components/mobile/rating-system/RatingWizard";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { RatingWizardFormData, RatingTrack, RoleType } from "@/types/rating";

interface RatingWizardModalProps {
  employerId: string;
  employerName: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function RatingWizardModal({
  employerId,
  employerName,
  isOpen,
  onClose,
  onComplete
}: RatingWizardModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (data: RatingWizardFormData) => {
    setIsSubmitting(true);
    try {
      // Here you would submit to the appropriate API endpoint
      // For now, we'll just simulate the submission
      console.log('Submitting rating data:', data);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Assessment Submitted",
        description: "Your organiser expertise assessment has been saved successfully.",
      });

      onComplete();
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      toast({
        title: "Submission Failed",
        description: "Unable to save your assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [toast, onComplete]);

  const handleCancel = useCallback(() => {
    // Don't close immediately, ask for confirmation if there are unsaved changes
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rate {employerName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <RatingWizard
            employerId={employerId}
            employerName={employerName}
            track="organiser_expertise"
            roleContext="organiser"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            showPreview={true}
            allowSaveDraft={true}
            className="h-full"
          />
        </div>

        {/* Footer with context */}
        <div className="p-4 border-t bg-muted/50">
          <div className="text-xs text-muted-foreground text-center">
            This assessment will contribute to the employer's overall traffic light rating.
            Your expertise assessment takes priority over project compliance data when there's a conflict.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
