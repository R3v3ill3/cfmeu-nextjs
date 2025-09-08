"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Building, 
  Users, 
  FileText, 
  Shield, 
  Award,
  TrendingUp,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import { ActiveConstructionMetrics } from "@/hooks/useNewDashboardData"

interface ActiveConstructionMetricsProps {
  data: ActiveConstructionMetrics;
  isLoading?: boolean;
}

export function ActiveConstructionMetricsComponent({ data, isLoading }: ActiveConstructionMetricsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const MetricCard = ({ 
    icon: Icon, 
    label, 
    value, 
    total, 
    percentage, 
    color = "blue",
    description 
  }: {
    icon: any;
    label: string;
    value: number | string;
    total?: number;
    percentage?: number;
    color?: "blue" | "green" | "orange" | "red" | "purple";
    description?: string;
  }) => {
    const colorClasses = {
      blue: "text-blue-600 bg-blue-50 border-blue-200",
      green: "text-green-600 bg-green-50 border-green-200",
      orange: "text-orange-600 bg-orange-50 border-orange-200",
      red: "text-red-600 bg-red-50 border-red-200",
      purple: "text-purple-600 bg-purple-50 border-purple-200"
    };

    return (
      <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
        <div className="flex items-center space-x-2 mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold">{value}</span>
            {total !== undefined && (
              <span className="text-sm text-gray-600">/ {total}</span>
            )}
          </div>
          {percentage !== undefined && (
            <div className="space-y-1">
              <Progress value={percentage} className="h-2" />
              <span className="text-xs text-gray-600">{percentage}%</span>
            </div>
          )}
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle className="text-green-800">Active Construction Projects</CardTitle>
                <CardDescription>
                  Metrics for {data.total_projects} projects in active construction phase
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-green-200 text-green-700">
              <TrendingUp className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              icon={Building}
              label="Total Projects"
              value={data.total_projects}
              color="green"
              description="Projects in construction"
            />
            <MetricCard
              icon={Users}
              label="Avg Workers/Project"
              value={data.avg_assigned_workers}
              color="blue"
              description="Average assigned workers"
            />
            <MetricCard
              icon={Award}
              label="Avg Members/Project"
              value={data.avg_members}
              color="purple"
              description="Average union members"
            />
          </div>
        </CardContent>
      </Card>

      {/* EBA Coverage */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>EBA Coverage</CardTitle>
              <CardDescription>Enterprise Bargaining Agreement coverage across employers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Builder EBA Coverage */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Project Builders</h4>
                <MetricCard
                  icon={Building}
                  label="Builders with EBA"
                  value={data.total_builders > 0 ? data.eba_builders : "Loading..."}
                  total={data.total_builders > 0 ? data.total_builders : undefined}
                  percentage={data.total_builders > 0 ? data.eba_builder_percentage : undefined}
                  color="blue"
                  description="Primary contractors and builders"
                />
              </div>

            {/* All Employer EBA Coverage */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">All Linked Employers</h4>
              <MetricCard
                icon={Users}
                label="Employers with EBA"
                value={data.eba_employers}
                total={data.total_employers}
                percentage={data.eba_employer_percentage}
                color="green"
                description="Builders, head contractors, subcontractors"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core CFMEU Trades */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle>Core CFMEU Trades</CardTitle>
              <CardDescription>Employer count by key trade categories</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard
              icon={AlertTriangle}
              label="Demolition"
              value={data.core_trades.demolition}
              color="red"
              description="Demolition contractors"
            />
            <MetricCard
              icon={TrendingUp}
              label="Piling"
              value={data.core_trades.piling}
              color="blue"
              description="Foundation piling"
            />
            <MetricCard
              icon={Building}
              label="Concreting"
              value={data.core_trades.concreting}
              color="green"
              description="Concrete contractors"
            />
            <MetricCard
              icon={Shield}
              label="Form Work"
              value={data.core_trades.formwork}
              color="purple"
              description="Formwork specialists"
            />
            <MetricCard
              icon={Users}
              label="Scaffold"
              value={data.core_trades.scaffold}
              color="orange"
              description="Scaffolding contractors"
            />
            <MetricCard
              icon={TrendingUp}
              label="Cranes"
              value={data.core_trades.cranes}
              color="blue"
              description="Tower & mobile cranes"
            />
          </div>
        </CardContent>
      </Card>

      {/* Delegate & Safety Metrics */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <div>
              <CardTitle>Delegates & Safety Representatives</CardTitle>
              <CardDescription>Union representation and safety leadership</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Users}
              label="Site Delegates"
              value={data.projects_with_site_delegates}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_site_delegates / data.total_projects) * 100) : 0}
              color="blue"
              description="Projects with site delegates"
            />
            <MetricCard
              icon={Building}
              label="Company Delegates"
              value={data.projects_with_company_delegates}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_company_delegates / data.total_projects) * 100) : 0}
              color="green"
              description="Employers with company delegates"
            />
            <MetricCard
              icon={Shield}
              label="HSRs"
              value={data.projects_with_hsrs}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_hsrs / data.total_projects) * 100) : 0}
              color="purple"
              description="Projects with HSRs"
            />
            <MetricCard
              icon={Award}
              label="HSR Chair = Delegate"
              value={data.projects_with_hsr_chair_delegate}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_hsr_chair_delegate / data.total_projects) * 100) : 0}
              color="orange"
              description="HSR chairs who are delegates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Health & Safety Committee */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle>Health & Safety Committees</CardTitle>
              <CardDescription>Projects with "full" H&S committees (HSR count ≥ goal)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard
              icon={CheckCircle}
              label="Full Committees"
              value={data.projects_with_full_hs_committee}
              total={data.total_projects}
              percentage={data.total_projects > 0 ? Math.round((data.projects_with_full_hs_committee / data.total_projects) * 100) : 0}
              color="green"
              description="Projects meeting H&S committee goals"
            />
            <MetricCard
              icon={FileText}
              label="Financial Audits"
              value={data.financial_audit_activities}
              color="blue"
              description="Financial Standing List audits completed"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
