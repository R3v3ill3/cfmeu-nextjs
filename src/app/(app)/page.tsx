"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import { Users, Building, FileText, TrendingUp, AlertTriangle, Clock, Activity, Target, CheckCircle, XCircle } from "lucide-react"
import { useDashboardData } from "@/hooks/useDashboardData"
import { getProgressIndicatorClass } from "@/utils/densityColors"
import { desktopDesignSystem } from "@/lib/desktop-design-system"

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const { data, isLoading } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Desktop-optimized header */}
        <div className="lg:bg-white lg:border lg:border-gray-300 lg:rounded-lg lg:p-6 lg:shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">Dashboard</h1>
              <p className="text-gray-700 mt-2 lg:text-lg">Union organising platform overview and analytics</p>
            </div>
            <div className="mt-4 lg:mt-0">
              <Badge variant="outline" className="text-sm px-3 py-1">
                <Activity className="h-3 w-3 mr-1" />
                Live Data
              </Badge>
            </div>
          </div>
        </div>

        {/* Desktop-optimized skeleton grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="lg:bg-white lg:border-gray-300 lg:shadow-md">
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const ebaStatusData = [
    { name: "Certified", value: data?.ebaExpiry.certified || 0, color: "#10b981", icon: CheckCircle },
    { name: "Signed", value: data?.ebaExpiry.signed || 0, color: "#3b82f6", icon: FileText },
    { name: "Lodged", value: data?.ebaExpiry.lodged || 0, color: "#8b5cf6", icon: Target },
  ]

  const expiryData = [
    { name: "Expired", value: data?.ebaExpiry.expired || 0, color: "#ef4444", icon: XCircle },
    { name: "6 Weeks", value: data?.ebaExpiry.expiring6Weeks || 0, color: "#f59e0b", icon: AlertTriangle },
    { name: "3 Months", value: data?.ebaExpiry.expiring3Months || 0, color: "#06b6d4", icon: Clock },
    { name: "6 Months", value: data?.ebaExpiry.expiring6Months || 0, color: "#6b7280", icon: Clock },
  ]

  return (
    <div className="space-y-6">
      {/* Desktop-optimized header with enhanced visual hierarchy */}
      <div className="lg:bg-white lg:border lg:border-gray-300 lg:rounded-lg lg:p-6 lg:shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">Dashboard</h1>
            <p className="text-gray-700 mt-2 lg:text-lg">Union organising platform overview and analytics</p>
            {data?.errors?.length ? (
              <div className="flex items-center gap-2 mt-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-700">Some data failed to load; showing partial results.</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 lg:mt-0 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-sm px-3 py-1 border-green-200 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Live Data
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1 border-blue-200 text-green-700">
              <Activity className="h-3 w-3 mr-1" />
              Real-time Updates
            </Badge>
          </div>
        </div>
      </div>

      {/* Desktop-optimized KPI cards with enhanced layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-800 lg:text-base">Total Workers</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.totalWorkers || 0}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <p className="text-xs text-gray-700 lg:text-sm">
                  {data?.memberCount || 0} union members
                </p>
                <p className="text-xs text-gray-600">
                  ({data?.membershipRate?.toFixed(1) || 0}% membership rate)
                </p>
              </div>
              <div className="w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(data?.membershipRate || 0, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-800 lg:text-base">Total Employers</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <Building className="h-4 w-4 text-green-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.totalEmployers || 0}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <p className="text-xs text-gray-700 lg:text-sm">
                  {data?.mappedEmployersCount || 0} mapped with worker data
                </p>
                <p className="text-xs text-gray-600">
                  ({data?.mappedEmployersCount && data?.totalEmployers ? 
                    ((data.mappedEmployersCount / data.totalEmployers) * 100).toFixed(1) : 0}% mapped)
                </p>
              </div>
              <div className="w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-600 rounded-full transition-all duration-500"
                  style={{ width: `${data?.mappedEmployersCount && data?.totalEmployers ? 
                    (data.mappedEmployersCount / data.totalEmployers) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-800 lg:text-base">EBA Coverage</CardTitle>
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-4 w-4 text-purple-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.ebaPercentage?.toFixed(1) || 0}%</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <p className="text-xs text-gray-700 lg:text-sm">
                  {data?.totalEbas || 0} of {data?.totalEmployers || 0} employers
                </p>
                <p className="text-xs text-gray-600">
                  Enterprise Bargaining Agreements
                </p>
              </div>
              <div className="w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(data?.ebaPercentage || 0, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-800 lg:text-base">Avg Member Density</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-4 w-4 text-orange-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.avgMemberDensity?.toFixed(1) || 0}%</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <p className="text-xs text-gray-700 lg:text-sm">
                  Across {data?.mappedEmployersCount || 0} mapped employers
                </p>
                <p className="text-xs text-gray-600">
                  Average union density
                </p>
              </div>
              <div className="w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(data?.avgMemberDensity || 0, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop-optimized EBA expiry cards with enhanced visual hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="lg:bg-white lg:border-red-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200 border-red-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-red-800 lg:text-base">Expired EBAs</CardTitle>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 lg:text-3xl">{data?.ebaExpiry.expired || 0}</div>
            {(data?.ebaExpiry.expired || 0) > 0 && (
              <Badge variant="destructive" className="mt-2 text-xs">URGENT ACTION REQUIRED</Badge>
            )}
            <p className="text-xs text-gray-600 mt-2">Immediate attention needed</p>
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-amber-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200 border-amber-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-amber-800 lg:text-base">Expiring (6 weeks)</CardTitle>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-4 w-4 text-amber-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 lg:text-3xl">{data?.ebaExpiry.expiring6Weeks || 0}</div>
            {(data?.ebaExpiry.expiring6Weeks || 0) > 0 && (
              <Badge variant="outline" className="mt-2 text-xs border-amber-400 text-amber-800">ACTION NEEDED</Badge>
            )}
            <p className="text-xs text-gray-600 mt-2">High priority renewal</p>
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-800 lg:text-base">Expiring (3 months)</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-4 w-4 text-blue-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.ebaExpiry.expiring3Months || 0}</div>
            <p className="text-xs text-gray-600 mt-2">Plan ahead for renewal</p>
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-800 lg:text-base">Expiring (6 months)</CardTitle>
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-4 w-4 text-gray-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.ebaExpiry.expiring6Months || 0}</div>
            <p className="text-xs text-gray-600 mt-2">Future planning</p>
          </CardContent>
        </Card>
      </div>

      {/* Desktop-optimized charts section with enhanced layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-gray-900 lg:text-xl">EBA Status Distribution</CardTitle>
            <CardDescription className="text-gray-700">Progress of EBAs through workflow stages</CardDescription>
          </CardHeader>
          <CardContent>
            {ebaStatusData.some(d => d.value > 0) ? (
              <div className="h-64 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ebaStatusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {ebaStatusData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm">No EBA data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-gray-900 lg:text-xl">EBA Expiry Timeline</CardTitle>
            <CardDescription className="text-gray-700">Distribution of EBA expiry dates</CardDescription>
          </CardHeader>
          <CardContent>
            {expiryData.some(d => d.value > 0) ? (
              <div className="h-64 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expiryData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm">No expiry data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Desktop-optimized progress section with enhanced visual hierarchy */}
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-gray-900 lg:text-xl">Union Membership Progress</CardTitle>
          <CardDescription className="text-gray-700">Overall membership density across all workers and mapped employers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-800 lg:text-base">Overall Membership Rate</span>
              <span className="text-sm font-semibold text-gray-900 lg:text-lg">{data?.membershipRate?.toFixed(1) || 0}%</span>
            </div>
            <div className="relative">
              <Progress value={data?.membershipRate || 0} className="h-3" indicatorClassName={getProgressIndicatorClass(data?.membershipRate || 0)} />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-800 lg:text-base">Average Member Density (Mapped Employers)</span>
              <span className="text-sm font-semibold text-gray-900 lg:text-lg">{data?.avgMemberDensity?.toFixed(1) || 0}%</span>
            </div>
            <div className="relative">
              <Progress value={data?.avgMemberDensity || 0} className="h-3" indicatorClassName={getProgressIndicatorClass(data?.avgMemberDensity || 0)} />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Desktop-optimized summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-300">
            <div className="text-center p-4 bg-gray-100 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.memberCount || 0}</div>
              <p className="text-sm text-gray-700 lg:text-base mt-1">Total Members</p>
            </div>
            <div className="text-center p-4 bg-gray-100 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 lg:text-3xl">{data?.mappedEmployersCount || 0}</div>
              <p className="text-sm text-gray-700 lg:text-base mt-1">Mapped Employers</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

