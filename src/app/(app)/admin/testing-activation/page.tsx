"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@supabase/supabase-js"
import { generateTemporaryPassword, isDevelopmentEmail } from "@/utils/auth-utils"
import { CheckCircle2, User, Mail, Shield, MapPin, AlertCircle } from "lucide-react"

interface PendingUser {
  id: string
  email: string
  full_name: string | null
  role: string
  status: string
  created_at: string
  assigned_patch_ids: string[]
}

interface AuthTestResult {
  success: boolean
  email: string
  tempPassword?: string
  userId?: string
  error?: string
}

export default function TestingActivationPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, AuthTestResult>>({})

  useEffect(() => {
    loadPendingUsers()
  }, [])

  const loadPendingUsers = async () => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from("pending_users")
        .select("id,email,full_name,role,status,created_at,assigned_patch_ids")
        .eq("status", "draft")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPendingUsers(data || [])
    } catch (err) {
      console.error("Failed to load pending users:", err)
    }
  }

  const createTestingAuthUser = async (pendingUser: PendingUser) => {
    if (!isDevelopmentEmail(pendingUser.email)) {
      setTestResults(prev => ({
        ...prev,
        [pendingUser.id]: {
          success: false,
          email: pendingUser.email,
          error: "Only testing emails (@testing.org) can be activated here"
        }
      }))
      return
    }

    setTestResults(prev => ({
      ...prev,
      [pendingUser.id]: { success: false, email: pendingUser.email, error: "Creating..." }
    }))

    try {
      const tempPassword = generateTemporaryPassword()

      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )

      const { data: authUser, error: createError } = await serviceSupabase.auth.admin.createUser({
        email: pendingUser.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          role: pendingUser.role,
          full_name: pendingUser.full_name || pendingUser.email.split("@")[0],
          created_via: 'testing_activation'
        }
      })

      if (createError) {
        throw createError
      }

      setTestResults(prev => ({
        ...prev,
        [pendingUser.id]: {
          success: true,
          email: pendingUser.email,
          tempPassword,
          userId: authUser.user?.id
        }
      }))

    } catch (error: any) {
      console.error("Failed to create testing user:", error)
      setTestResults(prev => ({
        ...prev,
        [pendingUser.id]: {
          success: false,
          email: pendingUser.email,
          error: error.message || "Unknown error"
        }
      }))
    }
  }

  const testingUsers = pendingUsers.filter(user => isDevelopmentEmail(user.email))

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Testing User Activation</h1>
          <p className="text-muted-foreground">
            Create authentication credentials for testing users. All existing assignments and relationships will be preserved.
          </p>
        </div>

        {testingUsers.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No testing users found. Testing users should have emails ending with @testing.org.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Testing Users Ready for Activation</CardTitle>
              <CardDescription>
                Click "Create Test Account" to generate login credentials for each testing user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Patches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testingUsers.map((user) => {
                    const result = testResults[user.id]
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.full_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "destructive" : "default"}>
                            {user.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.assigned_patch_ids?.length || 0} patches</TableCell>
                        <TableCell>
                          {result?.success ? (
                            <Badge className="bg-green-100 text-green-800">
                              ✓ Created
                            </Badge>
                          ) : result?.error ? (
                            <Badge variant="destructive">
                              ✗ Error
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Ready</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => createTestingAuthUser(user)}
                            disabled={!!result || loading}
                            variant={result?.success ? "outline" : "default"}
                          >
                            {result?.success ? "Created" : "Create Test Account"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Test Results */}
              <div className="mt-6 space-y-3">
                {Object.entries(testResults).map(([userId, result]) => (
                  <div key={userId}>
                    {result.success ? (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <div className="space-y-2">
                            <div><strong>✅ Testing account created!</strong></div>
                            <div className="text-sm space-y-1">
                              <div><strong>Email:</strong> {result.email}</div>
                              <div>
                                <strong>Temporary Password:</strong>{' '}
                                <code className="bg-white px-2 py-1 rounded border border-green-300">
                                  {result.tempPassword}
                                </code>
                              </div>
                              <div className="text-green-700">
                                <strong>Instructions:</strong> Use these credentials to test the application.
                                The user will have full access based on their role and existing assignments.
                              </div>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div><strong>❌ Failed to create account for {result.email}</strong></div>
                          <div className="text-sm mt-1">Error: {result.error}</div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>

              {testingUsers.length > 0 && Object.values(testResults).some(r => r.success) && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-blue-800">
                    <div><strong>📋 Next Steps:</strong></div>
                    <ol className="text-sm mt-2 space-y-1 list-decimal list-inside">
                      <li>Test the created accounts with the provided credentials</li>
                      <li>Verify all existing patch assignments and relationships work correctly</li>
                      <li>When ready for production, update emails from @testing.org to real emails</li>
                      <li>Users can set real passwords via email reset at that time</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}