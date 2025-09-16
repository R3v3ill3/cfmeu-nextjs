"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, FileText } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { useUpdateProjectCompliance } from "./hooks/useProjectCompliance";
import { ReportingFrequency } from "@/types/compliance";
import { toast } from "sonner";

interface ComplianceReportingSettingsProps {
  projectId: string;
  currentFrequency: ReportingFrequency;
  nextReportDate: string | null;
}

export function ComplianceReportingSettings({ 
  projectId, 
  currentFrequency, 
  nextReportDate 
}: ComplianceReportingSettingsProps) {
  const updateCompliance = useUpdateProjectCompliance(projectId);

  const frequencies: { value: ReportingFrequency; label: string }[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'six_weekly', label: '6 Weekly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'ad_hoc', label: 'Ad Hoc' }
  ];

  const calculateNextReportDate = (frequency: ReportingFrequency): Date => {
    const today = new Date();
    switch (frequency) {
      case 'weekly':
        return addWeeks(today, 1);
      case 'fortnightly':
        return addWeeks(today, 2);
      case 'monthly':
        return addMonths(today, 1);
      case 'six_weekly':
        return addWeeks(today, 6);
      case 'quarterly':
        return addMonths(today, 3);
      case 'ad_hoc':
        return today;
      default:
        return addMonths(today, 1);
    }
  };

  const handleFrequencyChange = (newFrequency: ReportingFrequency) => {
    const nextDate = calculateNextReportDate(newFrequency);
    updateCompliance.mutate({
      reporting_frequency: newFrequency,
      next_report_date: nextDate.toISOString().split('T')[0]
    });
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      updateCompliance.mutate({
        next_report_date: date.toISOString().split('T')[0]
      });
    }
  };

  const generateReport = () => {
    // TODO: Implement report generation
    toast.info("Report generation will be implemented soon");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Reporting Frequency</Label>
          <Select value={currentFrequency} onValueChange={handleFrequencyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencies.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Next Report Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {nextReportDate
                  ? format(new Date(nextReportDate), "PPP")
                  : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={nextReportDate ? new Date(nextReportDate) : undefined}
                onSelect={handleDateChange}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="invisible">Actions</Label>
          <Button onClick={generateReport} className="w-full">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report Now
          </Button>
        </div>
      </div>

      {nextReportDate && new Date(nextReportDate) < new Date() && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Report is overdue. Please generate and submit the compliance report.
          </p>
        </div>
      )}
    </div>
  );
}
