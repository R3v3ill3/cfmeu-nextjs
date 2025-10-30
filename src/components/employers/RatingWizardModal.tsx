"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, Users } from "lucide-react";
import { RatingWizard } from "@/components/employers/RatingWizard";
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
      // Submit to the 4-point expertise assessment API
      const response = await fetch('/api/assessments/expertise-4point', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Submission failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('Assessment submitted successfully:', result);

      toast({
        title: "Assessment Submitted",
        description: `Your 4-point expertise assessment has been saved successfully. Rating: ${result.data.overall_rating} (${result.data.overall_score}/4.0)`,
      });

      onComplete();
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Unable to save your assessment. Please try again.",
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
      <DialogContent className="max-w-4xl flex flex-col p-0 max-lg:max-w-[95vw] max-lg:max-h-[90vh] max-lg:overflow-hidden" style={{ height: '85vh', maxHeight: '95dvh' }}>
        <DialogHeader className="flex-shrink-0 p-4 sm:p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
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
          <DialogDescription className="text-sm">
            Complete a 4-point expertise assessment using a frequency scale (Always, Almost Always, Sometimes, Rarely/Never).
            Your assessment takes priority over project compliance data when there's a conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <RatingWizard
            employerId={employerId}
            employerName={employerName}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            className="flex-1 flex flex-col"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
