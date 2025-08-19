import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  FileText, 
  Vote, 
  Shield, 
  MessageSquare, 
  AlertTriangle,
  UserCheck,
  HelpCircle,
  Plus
} from "lucide-react";

export interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  is_predefined: boolean;
}

interface ActivityTypeSelectorProps {
  templates: ActivityTemplate[];
  selectedTemplate?: ActivityTemplate;
  onTemplateSelect: (template: ActivityTemplate | null) => void;
  onCustomActivityCreate: (name: string, description: string) => void;
}

const categoryIcons = {
  survey: Users,
  petition: FileText,
  ballot: Vote,
  meeting: MessageSquare,
  action: AlertTriangle,
  custom: HelpCircle
};

const categoryColors = {
  survey: "bg-blue-500/10 text-blue-700 border-blue-200",
  petition: "bg-green-500/10 text-green-700 border-green-200",
  ballot: "bg-purple-500/10 text-purple-700 border-purple-200",
  meeting: "bg-orange-500/10 text-orange-700 border-orange-200",
  action: "bg-red-500/10 text-red-700 border-red-200",
  custom: "bg-gray-500/10 text-gray-700 border-gray-200"
};

export function ActivityTypeSelector({ 
  templates, 
  selectedTemplate, 
  onTemplateSelect,
  onCustomActivityCreate 
}: ActivityTypeSelectorProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ActivityTemplate[]>);

  const handleCustomSubmit = () => {
    if (customName.trim()) {
      onCustomActivityCreate(customName.trim(), customDescription.trim());
      setCustomName("");
      setCustomDescription("");
      setShowCustomForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Activity Type</h3>
        <p className="text-sm text-muted-foreground">
          Choose from predefined activity types or create a custom activity.
        </p>
      </div>

      {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
        const Icon = categoryIcons[category as keyof typeof categoryIcons] || HelpCircle;
        
        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <h4 className="font-medium capitalize">{category}</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryTemplates.map((template) => {
                const isSelected = selectedTemplate?.id === template.id;
                
                return (
                  <Card
                    key={template.id}
                    className={`p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => onTemplateSelect(isSelected ? null : template)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{template.name}</h5>
                        <Badge 
                          variant="outline" 
                          className={categoryColors[template.category as keyof typeof categoryColors]}
                        >
                          {template.category}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium">Custom Activity</h4>
            <p className="text-sm text-muted-foreground">
              Create your own activity type for specific needs.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomForm(!showCustomForm)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom
          </Button>
        </div>

        {showCustomForm && (
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customName">Activity Name</Label>
                <Input
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter activity name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customDescription">Description (Optional)</Label>
                <Textarea
                  id="customDescription"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Describe the activity"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleCustomSubmit} disabled={!customName.trim()}>
                Create Activity Type
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomName("");
                  setCustomDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}