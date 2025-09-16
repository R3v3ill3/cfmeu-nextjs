"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getEbaStatusInfo } from "@/components/employers/ebaHelpers"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Button } from "@/components/ui/button"
import { useEbaTrackingServerSideCompatible } from "@/hooks/useEbaTrackingServerSide"

export default function EbaTrackingPage() {
	const [query, setQuery] = useState("")
	const [status, setStatus] = useState<string>("all")
	const [sector, setSector] = useState<string>("all")
	const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
	
	// Feature flag for server-side processing
	const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_EBA_TRACKING === 'true'

	// CLIENT-SIDE DATA FETCHING (Original implementation)
	const { data: clientRows = [], isFetching: clientFetching } = useQuery({
		queryKey: ["eba-tracking", query, status, sector],
		queryFn: async () => {
			let q = supabase
				.from("employers")
				.select("id,name,company_eba_records(*)")
				.order("name")
			const { data, error } = await q
			if (error) throw error
			return data || []
		},
		enabled: !USE_SERVER_SIDE // Only run when server-side is disabled
	})

	// SERVER-SIDE DATA FETCHING (New implementation)
	const serverSideResult = useEbaTrackingServerSideCompatible({
		page: 1,
		pageSize: 1000, // Large page size to get all results for now
		sort: 'name',
		dir: 'asc',
		q: query || undefined,
		status: status as any,
		sector: sector !== 'all' ? sector : undefined,
	})

	// Conditional data selection based on feature flag
	const rows = USE_SERVER_SIDE ? serverSideResult.data : clientRows
	const isFetching = USE_SERVER_SIDE ? serverSideResult.isFetching : clientFetching

	const filtered = useMemo(() => {
		if (USE_SERVER_SIDE) {
			// SERVER-SIDE: Data is already filtered
			return rows
		} else {
			// CLIENT-SIDE: Apply original filtering logic
			const q = query.trim().toLowerCase()
			return (rows as any[])
				.filter((r) => !q || String(r.name).toLowerCase().includes(q))
				.filter((r) => {
					const rec = r.company_eba_records?.[0]
					if (!rec) return status === "all" || status === "none"
					const info = getEbaStatusInfo(rec)
					if (status === "all") return true
					if (status === "none") return info.status === "no_eba"
					return info.status === status
				})
				.filter((r) => {
					if (sector === "all") return true
					const rec = r.company_eba_records?.[0]
					return rec?.sector === sector
				})
		}
	}, [USE_SERVER_SIDE, rows, query, status, sector])

	const sectors = useMemo(() => {
		if (USE_SERVER_SIDE) {
			// SERVER-SIDE: Use sectors from API response
			return serverSideResult.sectors || []
		} else {
			// CLIENT-SIDE: Compute sectors from data
			const s = new Set<string>()
			;(rows as any[]).forEach(r => {
				const sec = r.company_eba_records?.[0]?.sector
				if (sec) s.add(sec)
			})
			return Array.from(s).sort()
		}
	}, [USE_SERVER_SIDE, rows, serverSideResult.sectors])

	return (
		<div className="p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">EBA Tracking</h1>
				{/* Development indicator for which implementation is active */}
				{process.env.NODE_ENV === 'development' && (
					<div className="text-xs px-2 py-1 rounded border">
						{USE_SERVER_SIDE ? (
							<span className="text-green-600">🚀 EBA Server-side {serverSideResult.debug?.queryTime ? `(${serverSideResult.debug.queryTime}ms)` : ''}</span>
						) : (
							<span className="text-blue-600">💻 EBA Client-side</span>
						)}
					</div>
				)}
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Employers</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<Input placeholder="Search employer" value={query} onChange={(e) => setQuery(e.target.value)} />
						<Select value={status} onValueChange={setStatus}>
							<SelectTrigger>
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								<SelectItem value="none">No EBA</SelectItem>
								<SelectItem value="in_progress">In Progress</SelectItem>
								<SelectItem value="lodged">Lodged</SelectItem>
								<SelectItem value="signed">Signed</SelectItem>
								<SelectItem value="certified">Certified</SelectItem>
								<SelectItem value="expired">Expired</SelectItem>
							</SelectContent>
						</Select>
						<Select value={sector} onValueChange={setSector}>
							<SelectTrigger>
								<SelectValue placeholder="Sector" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All sectors</SelectItem>
                                                                {sectors.map((sec: string) => (
									<SelectItem key={sec} value={sec}>{sec}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="rounded-md border overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Employer</TableHead>
									<TableHead>Sector</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map((r: any) => {
									const rec = r.company_eba_records?.[0]
									const info = rec ? getEbaStatusInfo(rec) : { status: "no_eba", label: "No EBA", variant: "destructive" as const }
									return (
										<TableRow key={r.id}>
											<TableCell className="font-medium">{r.name}</TableCell>
											<TableCell>{rec?.sector || "—"}</TableCell>
											<TableCell>
												<Badge variant={info.variant}>{info.label}</Badge>
											</TableCell>
											<TableCell>
												<Button size="sm" variant="outline" onClick={() => setSelectedEmployerId(r.id)}>Open</Button>
											</TableCell>
										</TableRow>
									)
								})}
								{filtered.length === 0 && (
									<TableRow>
										<TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
											{isFetching ? "Loading…" : "No employers match your filters."}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<EmployerDetailModal employerId={selectedEmployerId} isOpen={!!selectedEmployerId} onClose={() => setSelectedEmployerId(null)} initialTab="eba" />
		</div>
	)
}