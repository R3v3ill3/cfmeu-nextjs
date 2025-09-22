"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatDistanceToNow } from 'date-fns'

interface CredentialState {
  hasCredentials: boolean
  email: string | null
  updatedAt: string | null
}

export function IncolinkCredentialsCard() {
  const [state, setState] = useState<CredentialState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/incolink/credentials', { cache: 'no-store' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || 'Failed to load credentials')
        }
        const data = (await res.json()) as CredentialState
        setState(data)
        if (data?.hasCredentials && data.email) {
          setEmail(data.email)
        }
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Failed to load Incolink credentials')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/incolink/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to store credentials')
      }
      setPassword('')
      const responseBody = await res.json().catch(() => null)
      setState({ hasCredentials: true, email, updatedAt: responseBody?.updatedAt || new Date().toISOString() })
      setSuccess('Incolink credentials saved successfully.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to store credentials')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/incolink/credentials', { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to delete credentials')
      }
      setState({ hasCredentials: false, email: null, updatedAt: null })
      setPassword('')
      setSuccess('Stored Incolink credentials were removed.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to delete credentials')
    } finally {
      setDeleting(false)
    }
  }

  const lastUpdatedLabel = state?.updatedAt
    ? formatDistanceToNow(new Date(state.updatedAt), { addSuffix: true })
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incolink Credentials</CardTitle>
        <CardDescription>
          Store your Incolink login so imports and scraping can run without prompting for a password. Credentials are encrypted with the server key and can be removed at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading current settings…</p>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="incolink-email">Incolink Email</Label>
                <Input
                  id="incolink-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="user@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="incolink-password">Password</Label>
                <Input
                  id="incolink-password"
                  type="password"
                  required={!state?.hasCredentials}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder={state?.hasCredentials ? 'Enter a new password to replace the stored one' : 'Enter password'}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {state?.hasCredentials ? (
                    <span>
                      Credentials on file for <strong>{state.email}</strong>
                      {lastUpdatedLabel ? ` · Updated ${lastUpdatedLabel}` : ''}
                    </span>
                  ) : (
                    <span>No credentials saved yet.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {state?.hasCredentials && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDelete}
                      disabled={deleting || saving}
                    >
                      {deleting ? 'Removing…' : 'Remove' }
                    </Button>
                  )}
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Credentials'}
                  </Button>
                </div>
              </div>
            </form>

            <Separator />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Only encrypted copies of your credentials are stored. They are decrypted on-demand for Incolink imports and scrapes.</p>
              <p>To rotate credentials, enter a new password and click “Save Credentials”.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
