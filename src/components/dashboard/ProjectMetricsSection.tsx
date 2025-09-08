"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FolderOpen, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { DashboardProjectCounts } from "@/hooks/useNewDashboardData"

interface ProjectMetricsSectionProps {
  data: DashboardProjectCounts;
  isLoading?: boolean;
  errors?: string[];
}

export function ProjectMetricsSection({ data, isLoading }: ProjectMetricsSectionProps) {
  const router = useRouter();

  const navigateToProjects = (organising_universe?: string, stage_class?: string) => {
    const params = new URLSearchParams();
    if (organising_universe) params.set('universeFilter', organising_universe);
    if (stage_class) params.set('stageFilter', stage_class);
    
    const url = `/projects${params.toString() ? `?${params.toString()}` : ''}`;
    router.push(url);
  };

  const MetricButton = ({ 
    label, 
    value, 
    onClick, 
    variant = "default",
    description 
  }: { 
    label: string; 
    value: number; 
    onClick: () => void;
    variant?: "default" | "primary" | "success" | "warning";
    description?: string;
  }) => (
    <Button
      variant="ghost"
      className={`h-auto p-4 flex flex-col items-start space-y-2 hover:bg-gray-50 border ${
        variant === "primary" ? "border-blue-200 bg-blue-50" :
        variant === "success" ? "border-green-200 bg-green-50" :
        variant === "warning" ? "border-orange-200 bg-orange-50" :
        "border-gray-200"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <Badge variant="secondary" className="ml-2">
          {value}
        </Badge>
      </div>
      {description && (
        <span className="text-xs text-gray-500 text-left">{description}</span>
      )}
    </Button>
  );

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <CardTitle>Project Overview</CardTitle>
          </div>
          <CardDescription>Projects by organizing universe and stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Project Overview</CardTitle>
              <CardDescription>Click any number to view filtered projects</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-blue-200 text-blue-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              {data.total} Total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Universe */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-green-800">Active Projects</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricButton
              label="Construction"
              value={data.active_construction}
              variant="primary"
              description="Currently under construction"
              onClick={() => navigateToProjects('active', 'construction')}
            />
            <MetricButton
              label="Pre-Construction"
              value={data.active_pre_construction}
              variant="success"
              description="Planning and preparation"
              onClick={() => navigateToProjects('active', 'pre_construction')}
            />
          </div>
        </div>

        {/* Potential Universe */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <h3 className="font-semibold text-orange-800">Potential Projects</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricButton
              label="Construction"
              value={data.potential_construction}
              description="Potential active construction"
              onClick={() => navigateToProjects('potential', 'construction')}
            />
            <MetricButton
              label="Pre-Construction"
              value={data.potential_pre_construction}
              description="Potential planning stage"
              onClick={() => navigateToProjects('potential', 'pre_construction')}
            />
            <MetricButton
              label="Future"
              value={data.potential_future}
              description="Future opportunities"
              onClick={() => navigateToProjects('potential', 'future')}
            />
            <MetricButton
              label="Archived"
              value={data.potential_archived}
              description="Completed potentials"
              onClick={() => navigateToProjects('potential', 'archived')}
            />
          </div>
        </div>

        {/* Excluded Universe */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <div className="h-4 w-4 bg-gray-400 rounded-full" />
            <h3 className="font-semibold text-gray-800">Excluded Projects</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricButton
              label="Construction"
              value={data.excluded_construction}
              description="Excluded from organizing"
              onClick={() => navigateToProjects('excluded', 'construction')}
            />
            <MetricButton
              label="Pre-Construction"
              value={data.excluded_pre_construction}
              description="Excluded planning"
              onClick={() => navigateToProjects('excluded', 'pre_construction')}
            />
            <MetricButton
              label="Future"
              value={data.excluded_future}
              description="Excluded future"
              onClick={() => navigateToProjects('excluded', 'future')}
            />
            <MetricButton
              label="Archived"
              value={data.excluded_archived}
              description="Excluded archived"
              onClick={() => navigateToProjects('excluded', 'archived')}
            />
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="pt-4 border-t">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigateToProjects()}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            View All Projects
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
