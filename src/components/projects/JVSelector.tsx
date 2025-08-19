
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type JVStatus = "yes" | "no" | "unsure";

export function JVSelector({
  status,
  label,
  onChangeStatus,
  onChangeLabel,
}: {
  status: JVStatus;
  label: string;
  onChangeStatus: (v: JVStatus) => void;
  onChangeLabel: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>JV?</Label>
      <RadioGroup
        value={status}
        onValueChange={(v) => onChangeStatus(v as JVStatus)}
        className="grid grid-cols-3 gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem id="jv-no" value="no" />
          <Label htmlFor="jv-no">No</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem id="jv-yes" value="yes" />
          <Label htmlFor="jv-yes">Yes</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem id="jv-unsure" value="unsure" />
          <Label htmlFor="jv-unsure">Not sure</Label>
        </div>
      </RadioGroup>

      {status === "yes" && (
        <div>
          <Label htmlFor="jv_label">JV Label</Label>
          <Input
            id="jv_label"
            value={label}
            onChange={(e) => onChangeLabel(e.target.value)}
            placeholder="e.g., Acme–Beta JV"
          />
        </div>
      )}
    </div>
  );
}
