"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings,
  History,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  Plus
} from "lucide-react";

interface WeightConfig {
  track: 'organiser_expertise' | 'project_data';
  weights: {
    union_respect: number;
    safety: number;
    subcontractor: number;
    compliance: number;
  };
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
}

interface WeightHistory {
  id: string;
  track: string;
  weights: WeightConfig['weights'];
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name: string;
  updated_by_name: string;
}

export function RatingWeightManager() {
  const [configs, setConfigs] = useState<WeightConfig[]>([]);
  const [history, setHistory] = useState<WeightHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for each track
  const [organiserWeights, setOrganiserWeights] = useState<WeightConfig['weights']>({
    union_respect: 0.25,
    safety: 0.25,
    subcontractor: 0.25,
    compliance: 0.25
  });

  const [projectWeights, setProjectWeights] = useState<WeightConfig['weights']>({
    union_respect: 0.357,
    safety: 0.357,
    subcontractor: 0.286,
    compliance: 0 // EBA is gating factor, not part of weights
  });

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  // Fetch current configurations
  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/rating-weights');
      const data = await response.json();

      if (response.ok) {
        setConfigs(data.configurations || []);

        // Set current weights
        if (data.current_weights) {
          if (data.current_weights.organiser_expertise) {
            setOrganiserWeights(data.current_weights.organiser_expertise);
          }
          if (data.current_weights.project_data) {
            setProjectWeights(data.current_weights.project_data);
          }
        }
      } else {
        setError(data.error || 'Failed to fetch configurations');
      }
    } catch (err) {
      setError('Failed to fetch configurations');
    } finally {
      setLoading(false);
    }
  };

  // Fetch weight history
  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/admin/rating-weights?history=true');
      const data = await response.json();

      if (response.ok) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchHistory();
  }, []);

  // Calculate total weights for validation
  const calculateTotal = (weights: WeightConfig['weights']) => {
    return Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  };

  // Handle weight updates
  const handleWeightChange = (
    track: 'organiser_expertise' | 'project_data',
    component: keyof WeightConfig['weights'],
    value: number[]
  ) => {
    if (track === 'organiser_expertise') {
      setOrganiserWeights(prev => ({ ...prev, [component]: value[0] / 100 }));
    } else {
      setProjectWeights(prev => ({ ...prev, [component]: value[0] / 100 }));
    }
  };

  // Save weights
  const saveWeights = async (track: 'organiser_expertise' | 'project_data') => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const weights = track === 'organiser_expertise' ? organiserWeights : projectWeights;
    const total = calculateTotal(weights);

    if (Math.abs(total - 1.0) > 0.001) {
      setError('Weights must sum to 100%');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/rating-weights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track,
          weights,
          name: formData.name || `Updated ${track} weights`,
          description: formData.description || `Updated on ${new Date().toLocaleDateString()}`
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Weights updated successfully!');
        fetchConfigs();
        fetchHistory();
        setFormData({ name: '', description: '' });
      } else {
        setError(data.error || 'Failed to update weights');
      }
    } catch (err) {
      setError('Failed to update weights');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = (track: 'organiser_expertise' | 'project_data') => {
    if (track === 'organiser_expertise') {
      setOrganiserWeights({
        union_respect: 0.25,
        safety: 0.25,
        subcontractor: 0.25,
        compliance: 0.25
      });
    } else {
      setProjectWeights({
        union_respect: 0.357,
        safety: 0.357,
        subcontractor: 0.286,
        compliance: 0
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading weight configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Rating System Weight Configuration</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          EBA status is always treated as a gating factor and is not included in the weight calculations.
          An employer cannot achieve a green rating without an active EBA, regardless of other scores.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="organiser_expertise" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="organiser_expertise">Organiser Expertise Track</TabsTrigger>
          <TabsTrigger value="project_data">Project Data Track</TabsTrigger>
        </TabsList>

        {/* Organiser Expertise Track */}
        <TabsContent value="organiser_expertise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organiser Expertise Weights</CardTitle>
              <CardDescription>
                Configure weights for organiser expertise assessments. All components should sum to 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Union Respect */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Union Respect (5 criteria)</Label>
                  <span className="text-sm font-mono">{(organiserWeights.union_respect * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[organiserWeights.union_respect * 100]}
                  onValueChange={(value) => handleWeightChange('organiser_expertise', 'union_respect', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Safety */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Safety (3 criteria)</Label>
                  <span className="text-sm font-mono">{(organiserWeights.safety * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[organiserWeights.safety * 100]}
                  onValueChange={(value) => handleWeightChange('organiser_expertise', 'safety', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Subcontractor */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Subcontractor (1 criterion)</Label>
                  <span className="text-sm font-mono">{(organiserWeights.subcontractor * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[organiserWeights.subcontractor * 100]}
                  onValueChange={(value) => handleWeightChange('organiser_expertise', 'subcontractor', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Compliance */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Compliance (3 criteria)</Label>
                  <span className="text-sm font-mono">{(organiserWeights.compliance * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[organiserWeights.compliance * 100]}
                  onValueChange={(value) => handleWeightChange('organiser_expertise', 'compliance', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">Total</span>
                <Badge
                  variant={Math.abs(calculateTotal(organiserWeights) - 1.0) < 0.001 ? "default" : "destructive"}
                >
                  {(calculateTotal(organiserWeights) * 100).toFixed(1)}%
                </Badge>
              </div>

              {/* Configuration Details */}
              <div className="space-y-2">
                <Label htmlFor="org-name">Configuration Name</Label>
                <Input
                  id="org-name"
                  placeholder="Enter configuration name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-description">Description</Label>
                <Textarea
                  id="org-description"
                  placeholder="Enter description for this configuration"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => saveWeights('organiser_expertise')}
                  disabled={saving || Math.abs(calculateTotal(organiserWeights) - 1.0) > 0.001}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => resetToDefaults('organiser_expertise')}
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Data Track */}
        <TabsContent value="project_data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Data Weights</CardTitle>
              <CardDescription>
                Configure weights for project-based assessments. EBA is a gating factor and not included in weights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Union Respect */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Union Respect</Label>
                  <span className="text-sm font-mono">{(projectWeights.union_respect * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[projectWeights.union_respect * 100]}
                  onValueChange={(value) => handleWeightChange('project_data', 'union_respect', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Safety */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Safety</Label>
                  <span className="text-sm font-mono">{(projectWeights.safety * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[projectWeights.safety * 100]}
                  onValueChange={(value) => handleWeightChange('project_data', 'safety', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Subcontractor */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Subcontractor</Label>
                  <span className="text-sm font-mono">{(projectWeights.subcontractor * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[projectWeights.subcontractor * 100]}
                  onValueChange={(value) => handleWeightChange('project_data', 'subcontractor', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Compliance (disabled - not part of project weights) */}
              <div className="space-y-2 opacity-50">
                <div className="flex justify-between">
                  <Label>Compliance (EBA)</Label>
                  <span className="text-sm font-mono">Gating Factor</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  EBA status is a gating factor and not included in weight calculations
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">Total</span>
                <Badge
                  variant={Math.abs(calculateTotal(projectWeights) - 1.0) < 0.001 ? "default" : "destructive"}
                >
                  {(calculateTotal(projectWeights) * 100).toFixed(1)}%
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => saveWeights('project_data')}
                  disabled={saving || Math.abs(calculateTotal(projectWeights) - 1.0) > 0.001}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => resetToDefaults('project_data')}
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Weight History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Weight Configuration History
          </CardTitle>
          <CardDescription>
            View historical changes to weight configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Track</TableHead>
                <TableHead>Configuration Name</TableHead>
                <TableHead>Weights</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {item.track.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    UR: {(item.weights.union_respect * 100).toFixed(0)}% |
                    S: {(item.weights.safety * 100).toFixed(0)}% |
                    SC: {(item.weights.subcontractor * 100).toFixed(0)}% |
                    C: {(item.weights.compliance * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell>{new Date(item.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>{item.updated_by_name || 'Unknown'}</TableCell>
                  <TableCell>
                    {item.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    No history available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}