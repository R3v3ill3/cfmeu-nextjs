"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

type Patch = { id: string; name: string; status: string | null }

export default function PatchManager() {
	const qc = useQueryClient()
	const { toast } = useToast()
	const [name, setName] = useState("")

	const { data: patches = [], isLoading } = useQuery<Patch[]>({
		queryKey: ["admin-patches"],
		queryFn: async () => {
			const { data, error } = await (supabase as any)
				.from("patches")
				.select("id,name,status")
				.order("name")
			if (error) throw error
			return (data as Patch[]) || []
		}
	})

	const createPatch = useMutation({
		mutationFn: async () => {
			if (!name.trim()) throw new Error("Enter a name")
			const { error } = await (supabase as any)
				.from("patches")
				.insert({ name: name.trim() })
			if (error) throw error
		},
		onSuccess: async () => {
			setName("")
			toast({ title: "Patch created" })
			await qc.invalidateQueries({ queryKey: ["admin-patches"] })
		},
		onError: (e: any) => toast({ title: "Error", description: e?.message || String(e), variant: "destructive" })
	})

	return (
		<Card>
			<CardHeader>
				<CardTitle>Patches</CardTitle>
				<CardDescription>Manage patches and create new ones</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2">
					<Input placeholder="New patch name" value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
					<Button onClick={() => createPatch.mutate()} disabled={!name.trim() || createPatch.isPending}>Create</Button>
				</div>
				<div className="rounded-md border overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={2}>Loading…</TableCell>
								</TableRow>
							) : (patches as Patch[]).length === 0 ? (
								<TableRow>
									<TableCell colSpan={2} className="text-sm text-muted-foreground">No patches</TableCell>
								</TableRow>
							) : (
								(patches as Patch[]).map(p => (
									<TableRow key={p.id}>
										<TableCell className="font-medium">{p.name}</TableCell>
										<TableCell>{p.status || "—"}</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	)
}