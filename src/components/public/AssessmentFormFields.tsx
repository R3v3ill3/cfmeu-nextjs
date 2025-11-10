/**
 * Reusable Assessment Form Field Components
 * 
 * These components are used in both single and multi-employer workflows
 */

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FourPointRating } from "@/types/assessments";
import { UNION_RESPECT_CRITERIA, SAFETY_CRITERIA, SUBCONTRACTOR_CRITERIA, FOUR_POINT_SCALE } from "@/constants/assessment-criteria";

export interface EmployerAssessmentData {
  // CBUS/INCOLINK Compliance
  cbus_check_conducted: boolean;
  cbus_check_date: string | null;
  cbus_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  cbus_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  cbus_worker_count_status: 'correct' | 'incorrect' | null;
  cbus_enforcement_flag: boolean;
  cbus_followup_required: boolean;
  cbus_notes: string | null;
  
  incolink_check_conducted: boolean;
  incolink_check_date: string | null;
  incolink_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  incolink_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  incolink_worker_count_status: 'correct' | 'incorrect' | null;
  incolink_enforcement_flag: boolean;
  incolink_followup_required: boolean;
  incolink_notes: string | null;
  incolink_company_id: string | null;
  
  // Union Respect Assessment (5 criteria)
  right_of_entry: FourPointRating;
  delegate_accommodation: FourPointRating;
  access_to_information: FourPointRating;
  access_to_inductions: FourPointRating;
  eba_status: FourPointRating;
  union_respect_notes: string;
  
  // Safety Assessment (6 criteria)
  safety_management_systems: FourPointRating;
  incident_reporting: FourPointRating;
  site_safety_culture: FourPointRating;
  risk_assessment_processes: FourPointRating;
  emergency_preparedness: FourPointRating;
  worker_safety_training: FourPointRating;
  lost_time_injuries: number;
  near_misses: number;
  safety_breaches: number;
  safety_notes: string;
  
  // Subcontractor Use Assessment (3 criteria)
  subcontractor_usage: FourPointRating;
  payment_terms: FourPointRating;
  treatment_of_subbies: FourPointRating;
  subcontractor_notes: string;
}

// CBUS & INCOLINK Compliance Fields
export function ComplianceFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      {/* CBUS Section */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          CBUS Compliance
          {formData.cbus_check_conducted && <Badge variant="default" className="text-xs">Checked</Badge>}
        </h4>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="cbus-conducted"
            checked={formData.cbus_check_conducted}
            onCheckedChange={(checked) => onUpdate('cbus_check_conducted', checked)}
          />
          <Label htmlFor="cbus-conducted" className="text-sm">
            CBUS Check Conducted
          </Label>
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label>Check Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.cbus_check_date
                    ? format(new Date(formData.cbus_check_date), "PPP")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center" sideOffset={4}>
                <div className="w-[280px]">
                  <CalendarComponent
                    mode="single"
                    selected={formData.cbus_check_date ? new Date(formData.cbus_check_date) : undefined}
                    onSelect={(date) => onUpdate('cbus_check_date', date?.toISOString().split('T')[0])}
                    initialFocus
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ThreePointCheckBox
              label="1. Payment Status"
              value={formData.cbus_payment_status}
              onChange={(value) => onUpdate('cbus_payment_status', value)}
            />
            <ThreePointCheckBox
              label="2. Payment Timing"
              value={formData.cbus_payment_timing}
              onChange={(value) => onUpdate('cbus_payment_timing', value)}
              options={['on_time', 'late', 'uncertain']}
            />
            <ThreePointCheckBox
              label="3. Worker Count"
              value={formData.cbus_worker_count_status}
              onChange={(value) => onUpdate('cbus_worker_count_status', value)}
              options={['correct', 'incorrect']}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Label htmlFor="cbus-enforcement" className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                id="cbus-enforcement"
                checked={formData.cbus_enforcement_flag}
                onCheckedChange={(checked) => onUpdate('cbus_enforcement_flag', checked)}
              />
              <span className="text-sm">Enforcement Required</span>
            </Label>
            <Label htmlFor="cbus-followup" className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                id="cbus-followup"
                checked={formData.cbus_followup_required}
                onCheckedChange={(checked) => onUpdate('cbus_followup_required', checked)}
              />
              <span className="text-sm">Follow-up Required</span>
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add any additional notes..."
              value={formData.cbus_notes || ''}
              onChange={(e) => onUpdate('cbus_notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* INCOLINK Section */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          INCOLINK Compliance
          {formData.incolink_check_conducted && <Badge variant="default" className="text-xs">Checked</Badge>}
        </h4>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="incolink-conducted"
            checked={formData.incolink_check_conducted}
            onCheckedChange={(checked) => onUpdate('incolink_check_conducted', checked)}
          />
          <Label htmlFor="incolink-conducted" className="text-sm">
            INCOLINK Check Conducted
          </Label>
        </div>

        <div className="space-y-4 pl-4 border-l-2 border-muted">
          <div className="space-y-2">
            <Label>Check Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.incolink_check_date
                    ? format(new Date(formData.incolink_check_date), "PPP")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center" sideOffset={4}>
                <div className="w-[280px]">
                  <CalendarComponent
                    mode="single"
                    selected={formData.incolink_check_date ? new Date(formData.incolink_check_date) : undefined}
                    onSelect={(date) => onUpdate('incolink_check_date', date?.toISOString().split('T')[0])}
                    initialFocus
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ThreePointCheckBox
              label="1. Payment Status"
              value={formData.incolink_payment_status}
              onChange={(value) => onUpdate('incolink_payment_status', value)}
            />
            <ThreePointCheckBox
              label="2. Payment Timing"
              value={formData.incolink_payment_timing}
              onChange={(value) => onUpdate('incolink_payment_timing', value)}
              options={['on_time', 'late', 'uncertain']}
            />
            <ThreePointCheckBox
              label="3. Worker Count"
              value={formData.incolink_worker_count_status}
              onChange={(value) => onUpdate('incolink_worker_count_status', value)}
              options={['correct', 'incorrect']}
            />
          </div>

          <div className="space-y-2">
            <Label>INCOLINK Company ID (Optional)</Label>
            <Input
              placeholder="Enter company ID..."
              value={formData.incolink_company_id || ''}
              onChange={(e) => onUpdate('incolink_company_id', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Label htmlFor="incolink-enforcement" className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                id="incolink-enforcement"
                checked={formData.incolink_enforcement_flag}
                onCheckedChange={(checked) => onUpdate('incolink_enforcement_flag', checked)}
              />
              <span className="text-sm">Enforcement Required</span>
            </Label>
            <Label htmlFor="incolink-followup" className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                id="incolink-followup"
                checked={formData.incolink_followup_required}
                onCheckedChange={(checked) => onUpdate('incolink_followup_required', checked)}
              />
              <span className="text-sm">Follow-up Required</span>
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add any additional notes..."
              value={formData.incolink_notes || ''}
              onChange={(e) => onUpdate('incolink_notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Union Respect Assessment Fields
export function UnionRespectFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>4-Point Rating Scale:</strong> 1 = Good, 2 = Fair, 3 = Poor, 4 = Terrible
        </p>
      </div>

      {UNION_RESPECT_CRITERIA.map(criterion => (
        <div key={criterion.id} className="space-y-2">
          <Label className="font-medium">{criterion.name}</Label>
          <p className="text-xs text-muted-foreground">{criterion.description}</p>
          <FourPointSelector
            value={formData[criterion.id as keyof EmployerAssessmentData] as FourPointRating}
            onChange={(value) => onUpdate(criterion.id, value)}
            fieldId={criterion.id}
          />
        </div>
      ))}

      <div className="space-y-2">
        <Label>Additional Notes</Label>
        <Textarea
          placeholder="Add any context or observations..."
          value={formData.union_respect_notes}
          onChange={(e) => onUpdate('union_respect_notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// Safety 4-Point Assessment Fields
export function SafetyFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>4-Point Rating Scale:</strong> 1 = Good, 2 = Fair, 3 = Poor, 4 = Terrible
        </p>
      </div>

      <div className="space-y-4">
        <h5 className="font-medium">Safety Criteria</h5>
        {SAFETY_CRITERIA.map(criterion => (
          <div key={criterion.id} className="space-y-2">
            <Label className="font-medium text-sm">{criterion.name}</Label>
            <p className="text-xs text-muted-foreground">{criterion.description}</p>
            <FourPointSelector
              value={formData[criterion.id as keyof EmployerAssessmentData] as FourPointRating}
              onChange={(value) => onUpdate(criterion.id, value)}
              fieldId={criterion.id}
            />
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t pt-4">
        <h5 className="font-medium">Safety Metrics</h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Lost Time Injuries</Label>
            <Input
              type="number"
              min="0"
              value={formData.lost_time_injuries}
              onChange={(e) => onUpdate('lost_time_injuries', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Near Misses</Label>
            <Input
              type="number"
              min="0"
              value={formData.near_misses}
              onChange={(e) => onUpdate('near_misses', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Safety Breaches</Label>
            <Input
              type="number"
              min="0"
              value={formData.safety_breaches}
              onChange={(e) => onUpdate('safety_breaches', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Safety Notes</Label>
        <Textarea
          placeholder="Add safety observations..."
          value={formData.safety_notes}
          onChange={(e) => onUpdate('safety_notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// Subcontractor Use Assessment Fields
export function SubcontractorFields({
  formData,
  onUpdate,
}: {
  formData: EmployerAssessmentData;
  onUpdate: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>4-Point Rating Scale:</strong> 1 = Good, 2 = Fair, 3 = Poor, 4 = Terrible
        </p>
      </div>

      {SUBCONTRACTOR_CRITERIA.map(criterion => (
        <div key={criterion.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="font-medium text-sm">{criterion.name}</Label>
            {criterion.weight && criterion.weight !== 1.0 && (
              <Badge variant="outline" className="text-xs">
                Weight: {criterion.weight}x
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{criterion.description}</p>
          <FourPointSelector
            value={formData[criterion.id as keyof EmployerAssessmentData] as FourPointRating}
            onChange={(value) => onUpdate(criterion.id, value)}
            fieldId={criterion.id}
          />
        </div>
      ))}

      <div className="space-y-2">
        <Label>Subcontractor Notes</Label>
        <Textarea
          placeholder="Add observations about subcontractor practices..."
          value={formData.subcontractor_notes}
          onChange={(e) => onUpdate('subcontractor_notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

// 4-Point Rating Selector Component
export function FourPointSelector({
  value,
  onChange,
  fieldId,
}: {
  value: FourPointRating;
  onChange: (value: FourPointRating) => void;
  fieldId?: string;
}) {
  const stableId = fieldId || 'default';
  return (
    <RadioGroup value={value?.toString()} onValueChange={(v) => onChange(parseInt(v) as FourPointRating)}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(FOUR_POINT_SCALE).map(([key, rating]) => (
          <Label
            key={key}
            htmlFor={`rating-${stableId}-${key}`}
            className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors"
          >
            <RadioGroupItem value={key} id={`rating-${stableId}-${key}`} />
            <div className={cn("w-3 h-3 rounded-full", rating.color)} />
            <span className="text-sm">{rating.label}</span>
          </Label>
        ))}
      </div>
    </RadioGroup>
  );
}

// 3-Point Check Box Component
function ThreePointCheckBox({
  label,
  value,
  onChange,
  options = ['correct', 'incorrect', 'uncertain'],
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options?: string[];
}) {
  const getColor = (val: string | null) => {
    if (val === 'correct' || val === 'on_time') return 'border-green-500 bg-green-50';
    if (val === 'incorrect' || val === 'late') return 'border-red-500 bg-red-50';
    if (val === 'uncertain') return 'border-yellow-500 bg-yellow-50';
    return 'border-gray-200 bg-gray-50';
  };

  const getIcon = (val: string) => {
    if (val === 'correct' || val === 'on_time') return '✅';
    if (val === 'incorrect' || val === 'late') return '❌';
    if (val === 'uncertain') return '❓';
    return '';
  };

  const getLabel = (val: string) => {
    if (val === 'correct') return 'Correct';
    if (val === 'incorrect') return 'Incorrect';
    if (val === 'uncertain') return 'Uncertain';
    if (val === 'on_time') return 'On Time';
    if (val === 'late') return 'Late';
    return val;
  };

  return (
    <div className={cn("p-3 border-2 rounded-lg transition-all", getColor(value))}>
      <Label className="font-medium block mb-2 text-sm">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>
              {getIcon(opt)} {getLabel(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

