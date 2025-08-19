import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EbaEditDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ebaRecord: {
    id: string;
    eba_data_form_received?: string;
    date_draft_signing_sent?: string;
    followup_phone_call?: string;
    followup_email_sent?: string;
    out_of_office_received?: string;
    docs_prepared?: string;
    date_barg_docs_sent?: string;
    date_eba_signed?: string;
    date_vote_occurred?: string;
    eba_lodged_fwc?: string;
    fwc_certified_date?: string;
    nominal_expiry_date?: string;
    comments?: string;
  };
}

interface DateField {
  key: string;
  label: string;
  value?: Date;
}

export const EbaEditDatesModal = ({ isOpen, onClose, ebaRecord }: EbaEditDatesModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateFields, setDateFields] = useState<DateField[]>(() => [
    { key: 'eba_data_form_received', label: 'EBA Data Form Received', value: ebaRecord.eba_data_form_received ? new Date(ebaRecord.eba_data_form_received) : undefined },
    { key: 'date_draft_signing_sent', label: 'Draft Signing Sent', value: ebaRecord.date_draft_signing_sent ? new Date(ebaRecord.date_draft_signing_sent) : undefined },
    { key: 'followup_phone_call', label: 'Follow-up Phone Call', value: ebaRecord.followup_phone_call ? new Date(ebaRecord.followup_phone_call) : undefined },
    { key: 'followup_email_sent', label: 'Follow-up Email Sent', value: ebaRecord.followup_email_sent ? new Date(ebaRecord.followup_email_sent) : undefined },
    { key: 'out_of_office_received', label: 'Out of Office Received', value: ebaRecord.out_of_office_received ? new Date(ebaRecord.out_of_office_received) : undefined },
    { key: 'docs_prepared', label: 'Documents Prepared', value: ebaRecord.docs_prepared ? new Date(ebaRecord.docs_prepared) : undefined },
    { key: 'date_barg_docs_sent', label: 'Bargaining Docs Sent', value: ebaRecord.date_barg_docs_sent ? new Date(ebaRecord.date_barg_docs_sent) : undefined },
    { key: 'date_eba_signed', label: 'EBA Signed', value: ebaRecord.date_eba_signed ? new Date(ebaRecord.date_eba_signed) : undefined },
    { key: 'date_vote_occurred', label: 'Vote Occurred', value: ebaRecord.date_vote_occurred ? new Date(ebaRecord.date_vote_occurred) : undefined },
    { key: 'eba_lodged_fwc', label: 'EBA Lodged with FWC', value: ebaRecord.eba_lodged_fwc ? new Date(ebaRecord.eba_lodged_fwc) : undefined },
    { key: 'fwc_certified_date', label: 'FWC Certified Date', value: ebaRecord.fwc_certified_date ? new Date(ebaRecord.fwc_certified_date) : undefined },
    { key: 'nominal_expiry_date', label: 'Nominal Expiry Date', value: ebaRecord.nominal_expiry_date ? new Date(ebaRecord.nominal_expiry_date) : undefined },
  ]);

  const [comments, setComments] = useState(ebaRecord.comments || "");

  const updateDatesMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const { error } = await supabase
        .from('company_eba_records')
        .update(updateData)
        .eq('id', ebaRecord.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Dates Updated",
        description: "EBA dates have been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['eba-record', ebaRecord.id] });
      queryClient.invalidateQueries({ queryKey: ['eba-records'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update EBA dates. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating EBA dates:', error);
    },
  });

  const handleDateChange = (fieldKey: string, date: Date | undefined) => {
    setDateFields(prev => 
      prev.map(field => 
        field.key === fieldKey ? { ...field, value: date } : field
      )
    );
  };

  const handleSave = () => {
    const updateData: any = { comments };
    
    dateFields.forEach(field => {
      updateData[field.key] = field.value ? field.value.toISOString().split('T')[0] : null;
    });

    updateDatesMutation.mutate(updateData);
  };

  const resetForm = () => {
    setDateFields([
      { key: 'eba_data_form_received', label: 'EBA Data Form Received', value: ebaRecord.eba_data_form_received ? new Date(ebaRecord.eba_data_form_received) : undefined },
      { key: 'date_draft_signing_sent', label: 'Draft Signing Sent', value: ebaRecord.date_draft_signing_sent ? new Date(ebaRecord.date_draft_signing_sent) : undefined },
      { key: 'followup_phone_call', label: 'Follow-up Phone Call', value: ebaRecord.followup_phone_call ? new Date(ebaRecord.followup_phone_call) : undefined },
      { key: 'followup_email_sent', label: 'Follow-up Email Sent', value: ebaRecord.followup_email_sent ? new Date(ebaRecord.followup_email_sent) : undefined },
      { key: 'out_of_office_received', label: 'Out of Office Received', value: ebaRecord.out_of_office_received ? new Date(ebaRecord.out_of_office_received) : undefined },
      { key: 'docs_prepared', label: 'Documents Prepared', value: ebaRecord.docs_prepared ? new Date(ebaRecord.docs_prepared) : undefined },
      { key: 'date_barg_docs_sent', label: 'Bargaining Docs Sent', value: ebaRecord.date_barg_docs_sent ? new Date(ebaRecord.date_barg_docs_sent) : undefined },
      { key: 'date_eba_signed', label: 'EBA Signed', value: ebaRecord.date_eba_signed ? new Date(ebaRecord.date_eba_signed) : undefined },
      { key: 'date_vote_occurred', label: 'Vote Occurred', value: ebaRecord.date_vote_occurred ? new Date(ebaRecord.date_vote_occurred) : undefined },
      { key: 'eba_lodged_fwc', label: 'EBA Lodged with FWC', value: ebaRecord.eba_lodged_fwc ? new Date(ebaRecord.eba_lodged_fwc) : undefined },
      { key: 'fwc_certified_date', label: 'FWC Certified Date', value: ebaRecord.fwc_certified_date ? new Date(ebaRecord.fwc_certified_date) : undefined },
      { key: 'nominal_expiry_date', label: 'Nominal Expiry Date', value: ebaRecord.nominal_expiry_date ? new Date(ebaRecord.nominal_expiry_date) : undefined },
    ]);
    setComments(ebaRecord.comments || "");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Edit EBA Dates
          </DialogTitle>
          <DialogDescription>
            Update the dates for various stages of the EBA process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dateFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => handleDateChange(field.key, date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => {
                e.stopPropagation();
                setComments(e.target.value);
              }}
              onFocus={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Add comments or notes about the EBA process"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateDatesMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateDatesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};