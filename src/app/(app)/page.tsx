"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import { Users, Building, FileText, TrendingUp, AlertTriangle, Clock } from "lucide-react"
import { useDashboardData } from "@/hooks/useDashboardData"
import { getProgressIndicatorClass } from "@/utils/densityColors"

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const { data, isLoading } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Union organising platform overview</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
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
    { name: "Certified", value: data?.ebaExpiry.certified || 0, color: "hsl(var(--success))" },
    { name: "Signed", value: data?.ebaExpiry.signed || 0, color: "hsl(var(--primary))" },
    { name: "Lodged", value: data?.ebaExpiry.lodged || 0, color: "hsl(var(--secondary))" },
  ]

  const expiryData = [
    { name: "Expired", value: data?.ebaExpiry.expired || 0, color: "hsl(var(--destructive))" },
    { name: "6 Weeks", value: data?.ebaExpiry.expiring6Weeks || 0, color: "hsl(var(--warning))" },
    { name: "3 Months", value: data?.ebaExpiry.expiring3Months || 0, color: "hsl(var(--info))" },
    { name: "6 Months", value: data?.ebaExpiry.expiring6Months || 0, color: "hsl(var(--muted))" },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Union organising platform overview</p>
        {data?.errors?.length ? (
          <p className="text-sm text-warning mt-1">Some data failed to load; showing partial results.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalWorkers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.memberCount || 0} union members ({data?.membershipRate?.toFixed(1) || 0}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employers</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalEmployers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.mappedEmployersCount || 0} mapped with worker data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EBA Coverage</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.ebaPercentage?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {data?.totalEbas || 0} of {data?.totalEmployers || 0} employers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Member Density</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.avgMemberDensity?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Across {data?.mappedEmployersCount || 0} mapped employers
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired EBAs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data?.ebaExpiry.expired || 0}</div>
            {(data?.ebaExpiry.expired || 0) > 0 && (
              <Badge variant="destructive" className="mt-2">URGENT</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-warning/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring (6 weeks)</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{data?.ebaExpiry.expiring6Weeks || 0}</div>
            {(data?.ebaExpiry.expiring6Weeks || 0) > 0 && (
              <Badge variant="outline" className="mt-2 border-warning text-warning">Action Needed</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring (3 months)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.ebaExpiry.expiring3Months || 0}</div>
            <p className="text-xs text-muted-foreground">Plan ahead</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring (6 months)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.ebaExpiry.expiring6Months || 0}</div>
            <p className="text-xs text-muted-foreground">Future planning</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>EBA Status Distribution</CardTitle>
            <CardDescription>Progress of EBAs through workflow stages</CardDescription>
          </CardHeader>
          <CardContent>
            {ebaStatusData.some(d => d.value > 0) ? (
              <div className="h-64">
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
              <div className="text-center py-8 text-muted-foreground">
                No EBA data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>EBA Expiry Timeline</CardTitle>
            <CardDescription>Distribution of EBA expiry dates</CardDescription>
          </CardHeader>
          <CardContent>
            {expiryData.some(d => d.value > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expiryData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No expiry data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Union Membership Progress</CardTitle>
          <CardDescription>Overall membership density across all workers and mapped employers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Membership Rate</span>
              <span>{data?.membershipRate?.toFixed(1) || 0}%</span>
            </div>
            <Progress value={data?.membershipRate || 0} className="h-2" indicatorClassName={getProgressIndicatorClass(data?.membershipRate || 0)} />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Average Member Density (Mapped Employers)</span>
              <span>{data?.avgMemberDensity?.toFixed(1) || 0}%</span>
            </div>
            <Progress value={data?.avgMemberDensity || 0} className="h-2" indicatorClassName={getProgressIndicatorClass(data?.avgMemberDensity || 0)} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data?.memberCount || 0}</div>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data?.mappedEmployersCount || 0}</div>
              <p className="text-sm text-muted-foreground">Mapped Employers</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

