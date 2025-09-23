"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Activity, 
  Database, 
  Server, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Cpu,
  HardDrive,
  Zap,
  Globe
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { LeadOrganiserPatchSync } from "./LeadOrganizerPatchSync"

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'disabled' | 'error';
  responseTime?: number;
  error?: string;
  url?: string;
}

interface WorkerHealthData {
  timestamp: string;
  overallStatus: 'healthy' | 'unhealthy' | 'error';
  totalResponseTime: number;
  checks: HealthCheck[];
}

interface SystemMetrics {
  database: {
    status: 'healthy' | 'unhealthy' | 'error';
    responseTime: number;
    error?: string;
  };
  api: {
    status: 'healthy' | 'unhealthy' | 'error';
    responseTime: number;
    error?: string;
  };
  workers: {
    status: 'healthy' | 'unhealthy' | 'disabled' | 'error';
    responseTime?: number;
    error?: string;
  };
  environment: {
    nodeEnv: string;
    nextjsVersion: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

interface SystemHealthData {
  timestamp: string;
  overallStatus: 'healthy' | 'unhealthy' | 'error';
  totalResponseTime: number;
  metrics: SystemMetrics;
  uptime: {
    process: number;
    formatted: string;
  };
}

export function SystemHealthDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch worker health data
  const { 
    data: workerHealth, 
    isLoading: workerLoading, 
    error: workerError,
    refetch: refetchWorkers
  } = useQuery<WorkerHealthData>({
    queryKey: ['health-workers'],
    queryFn: async () => {
      const response = await fetch('/api/health/workers');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    retry: 1,
  });

  // Fetch system health data
  const { 
    data: systemHealth, 
    isLoading: systemLoading, 
    error: systemError,
    refetch: refetchSystem
  } = useQuery<SystemHealthData>({
    queryKey: ['health-system'],
    queryFn: async () => {
      const response = await fetch('/api/health/system');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    retry: 1,
  });

  const handleRefresh = () => {
    refetchWorkers();
    refetchSystem();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'disabled':
        return <Database className="h-5 w-5 text-gray-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'unhealthy':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'disabled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatResponseTime = (ms?: number) => {
    if (ms === undefined) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Health Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-50 border-green-200" : ""}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={handleRefresh} size="sm" disabled={workerLoading || systemLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${workerLoading || systemLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall System Status */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(systemHealth.overallStatus)}
              Overall System Status
              <Badge variant={getStatusVariant(systemHealth.overallStatus)}>
                {systemHealth.overallStatus.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-600">Last Check</div>
                <div>{new Date(systemHealth.timestamp).toLocaleString()}</div>
              </div>
              <div>
                <div className="font-medium text-gray-600">Response Time</div>
                <div>{formatResponseTime(systemHealth.totalResponseTime)}</div>
              </div>
              <div>
                <div className="font-medium text-gray-600">Environment</div>
                <div className="capitalize">{systemHealth.metrics.environment.nodeEnv}</div>
              </div>
              <div>
                <div className="font-medium text-gray-600">Uptime</div>
                <div>{systemHealth.uptime.formatted}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Railway Workers Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Railway Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workerLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking worker health...
              </div>
            )}
            
            {workerError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to check worker health: {workerError.message}
                </AlertDescription>
              </Alert>
            )}

            {workerHealth && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(workerHealth.overallStatus)}
                    <span className="font-medium">Overall Status</span>
                  </div>
                  <Badge variant={getStatusVariant(workerHealth.overallStatus)}>
                    {workerHealth.overallStatus.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {workerHealth.checks.map((check, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(check.status)}
                          <span className="font-medium">{check.service}</span>
                        </div>
                        <Badge variant={getStatusVariant(check.status)} className="text-xs">
                          {check.status}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {check.responseTime !== undefined && (
                          <div className="flex justify-between">
                            <span>Response Time:</span>
                            <span>{formatResponseTime(check.responseTime)}</span>
                          </div>
                        )}
                        {check.url && (
                          <div className="flex justify-between">
                            <span>URL:</span>
                            <span className="font-mono text-xs truncate">{check.url}</span>
                          </div>
                        )}
                        {check.error && (
                          <div className="text-red-600 text-xs mt-2">
                            Error: {check.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Database & API Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database & API
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking system health...
              </div>
            )}
            
            {systemError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to check system health: {systemError.message}
                </AlertDescription>
              </Alert>
            )}

            {systemHealth && (
              <div className="space-y-4">
                {/* Database Health */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(systemHealth.metrics.database.status)}
                      <span className="font-medium">Database</span>
                    </div>
                    <Badge variant={getStatusVariant(systemHealth.metrics.database.status)}>
                      {systemHealth.metrics.database.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span>{formatResponseTime(systemHealth.metrics.database.responseTime)}</span>
                    </div>
                    {systemHealth.metrics.database.error && (
                      <div className="text-red-600 text-xs mt-2">
                        Error: {systemHealth.metrics.database.error}
                      </div>
                    )}
                  </div>
                </div>

                {/* API Health */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(systemHealth.metrics.api.status)}
                      <span className="font-medium">API</span>
                    </div>
                    <Badge variant={getStatusVariant(systemHealth.metrics.api.status)}>
                      {systemHealth.metrics.api.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span>{formatResponseTime(systemHealth.metrics.api.responseTime)}</span>
                    </div>
                    {systemHealth.metrics.api.error && (
                      <div className="text-red-600 text-xs mt-2">
                        Error: {systemHealth.metrics.api.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Environment & Performance */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              System Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Environment</span>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Node.js: {systemHealth.metrics.environment.nodeEnv}</div>
                  <div>Next.js: {systemHealth.metrics.environment.nextjsVersion}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Uptime</span>
                </div>
                <div className="text-sm text-gray-600">
                  <div>{systemHealth.uptime.formatted}</div>
                  <div className="text-xs">Process uptime</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">Memory Usage</span>
                </div>
                <div className="space-y-1">
                  <Progress 
                    value={systemHealth.metrics.environment.memory.percentage} 
                    className="h-2"
                  />
                  <div className="text-xs text-gray-600">
                    {formatBytes(systemHealth.metrics.environment.memory.used)} / {formatBytes(systemHealth.metrics.environment.memory.total)}
                    ({systemHealth.metrics.environment.memory.percentage}%)
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Performance</span>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Check time: {formatResponseTime(systemHealth.totalResponseTime)}</div>
                  <div className="text-xs">Last health check</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Co-ordinator Patch Sync */}
      <LeadOrganiserPatchSync />

      {/* Refresh Info */}
      <div className="text-xs text-gray-500 text-center">
        Health checks run automatically every 30 seconds when auto-refresh is enabled.
        Manual refresh is always available using the refresh button.
      </div>
    </div>
  )
}

