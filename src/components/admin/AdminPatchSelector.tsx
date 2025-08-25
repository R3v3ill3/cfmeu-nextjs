"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronDown, Search, Users } from "lucide-react"

interface PatchOption { id: string; name: string }
interface LeadOption { id: string; label: string; kind: "live" | "draft" }

export default function AdminPatchSelector() {
	const [open, setOpen] = useState(false)
	const [allPatches, setAllPatches] = useState<PatchOption[]>([])
	const [search, setSearch] = useState("")
	const [selectedPatchIds, setSelectedPatchIds] = useState<string[]>([])
	const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
	const [selectedLead, setSelectedLead] = useState<string>("")
	const [loadingLead, setLoadingLead] = useState(false)
	// When a lead organiser is used to select patches, we also filter the visible list
	const [leadFilterPatchIds, setLeadFilterPatchIds] = useState<string[]>([])

	const pathname = usePathname()
	const router = useRouter()
	const params = useSearchParams()

	// Read selection from URL (comma-separated `patch` values)
	useEffect(() => {
		const fromUrl = params.get("patch") || ""
		const ids = fromUrl.split(",").map(s => s.trim()).filter(Boolean)
		setSelectedPatchIds(ids)
	}, [params])

	// Load all patches for admin
	useEffect(() => {
		const load = async () => {
			const { data } = await (supabase as any)
				.from("patches")
				.select("id, name")
				.order("name")
			setAllPatches(((data as any[]) || []).map(r => ({ id: r.id, name: r.name || r.id })))
		}
		load()
	}, [])

	// Load live and draft lead organisers for the special selection
	useEffect(() => {
		const loadLeads = async () => {
			const [live, draft] = await Promise.all([
				(supabase as any).from("profiles").select("id, full_name, email, role").eq("role", "lead_organiser"),
				(supabase as any).from("pending_users").select("id, full_name, email, role, status").eq("role", "lead_organiser").in("status", ["draft", "invited"]) ,
			])
			const lives = (((live as any)?.data as any[]) || []).map((r: any) => ({ id: String(r.id), label: r.full_name || r.email || r.id, kind: "live" as const }))
			const drafts = (((draft as any)?.data as any[]) || []).map((r: any) => ({ id: String(r.id), label: (r.full_name || r.email || r.id) + " (draft)", kind: "draft" as const }))
			setLeadOptions([...lives, ...drafts].sort((a, b) => a.label.localeCompare(b.label)))
		}
		loadLeads()
	}, [])

	const filteredPatches = useMemo(() => {
		const s = search.trim().toLowerCase()
		// Start with either all patches or those restricted by a lead filter
		const base = (leadFilterPatchIds.length > 0)
			? allPatches.filter(p => leadFilterPatchIds.includes(p.id))
			: allPatches
		if (!s) return base
		return base.filter(p => p.name.toLowerCase().includes(s))
	}, [allPatches, search, leadFilterPatchIds])

	const togglePatch = (id: string) => {
		setSelectedPatchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
	}

	const clearAll = () => {
		setSelectedPatchIds([])
		setLeadFilterPatchIds([])
		setSelectedLead("")
	}

	const applyToUrl = () => {
		const sp = new URLSearchParams(params.toString())
		if (selectedPatchIds.length === 0) sp.delete("patch")
		else sp.set("patch", selectedPatchIds.join(","))
		router.replace(`${pathname}?${sp.toString()}`)
		setOpen(false)
	}

	const selectByLeadOrganiser = async () => {
		if (!selectedLead) return
		setLoadingLead(true)
		try {
			const lead = leadOptions.find(l => l.id === selectedLead)
			if (!lead) return

			let liveOrganiserIds: string[] = []
			let draftOrganiserIds: string[] = []

			if (lead.kind === "live") {
				// Live lead → organisers via role_hierarchy and draft organisers via lead_draft_organiser_links
				const [liveKids, draftKids] = await Promise.all([
					(supabase as any).from("role_hierarchy").select("child_user_id").eq("parent_user_id", lead.id).is("end_date", null),
					(supabase as any).from("lead_draft_organiser_links").select("pending_user_id").eq("lead_user_id", lead.id).eq("is_active", true)
				])
				liveOrganiserIds = ((((liveKids as any)?.data as any[]) || []).map((r: any) => String(r.child_user_id)))
				draftOrganiserIds = ((((draftKids as any)?.data as any[]) || []).map((r: any) => String(r.pending_user_id)))
			} else {
				// Draft lead → organisers via draft_lead_organiser_links
				const { data: dl } = await (supabase as any)
					.from("draft_lead_organiser_links")
					.select("organiser_user_id, organiser_pending_user_id")
					.eq("draft_lead_pending_user_id", lead.id)
					.eq("is_active", true)
				liveOrganiserIds = ((dl as any[]) || []).map((r: any) => r.organiser_user_id).filter(Boolean).map((x: any) => String(x))
				draftOrganiserIds = ((dl as any[]) || []).map((r: any) => r.organiser_pending_user_id).filter(Boolean).map((x: any) => String(x))
			}

			// For live organisers, read organiser_patch_assignments
			let patchIds: string[] = []
			if (liveOrganiserIds.length > 0) {
				const { data: opa } = await (supabase as any)
					.from("organiser_patch_assignments")
					.select("patch_id")
					.is("effective_to", null)
					.in("organiser_id", liveOrganiserIds)
				patchIds = patchIds.concat(((opa as any[]) || []).map((r: any) => String(r.patch_id)))
			}
			// For draft organisers, use pending_users.assigned_patch_ids
			if (draftOrganiserIds.length > 0) {
				const { data: pu } = await (supabase as any)
					.from("pending_users")
					.select("id, assigned_patch_ids")
					.in("id", draftOrganiserIds)
				const more = (((pu as any[]) || []).flatMap((r: any) => Array.isArray(r.assigned_patch_ids) ? r.assigned_patch_ids : [])).map((x: any) => String(x))
				patchIds = patchIds.concat(more)
			}
			// De-duplicate and retain only those that exist in patches list (defensive)
			const allowed = new Set(allPatches.map(p => p.id))
			const unique = Array.from(new Set(patchIds.filter(id => allowed.has(id))))
			// Apply both: preselect and filter visible list to these patches
			setSelectedPatchIds(unique)
			setLeadFilterPatchIds(unique)
		} finally {
			setLoadingLead(false)
		}
	}

	const selectedSummary = useMemo(() => {
		if (selectedPatchIds.length === 0) return "All patches"
		if (selectedPatchIds.length === 1) {
			const one = allPatches.find(p => p.id === selectedPatchIds[0])
			return one?.name || "1 selected"
		}
		return `${selectedPatchIds.length} selected`
	}, [selectedPatchIds, allPatches])

	return (
		<div className="flex items-center gap-2">
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm" className="inline-flex items-center gap-2">
						<Users className="h-4 w-4" />
						<span>Patches:</span>
						<Badge variant="secondary">{selectedSummary}</Badge>
						<ChevronDown className="h-3 w-3" />
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-3xl w-[min(95vw,72rem)]">
					<DialogHeader>
						<DialogTitle>Select patches</DialogTitle>
					</DialogHeader>

					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="outline" size="sm" onClick={clearAll}>Display all</Button>
							<div className="flex flex-wrap items-center gap-2 min-w-0">
								<Select value={selectedLead} onValueChange={setSelectedLead}>
									<SelectTrigger className="w-64 md:w-80 max-w-full">
										<SelectValue placeholder="Select lead organiser (live or draft)" />
									</SelectTrigger>
									<SelectContent>
										{leadOptions.map(l => (
											<SelectItem key={`${l.kind}:${l.id}`} value={l.id}>{l.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button size="sm" onClick={selectByLeadOrganiser} disabled={!selectedLead || loadingLead}>{loadingLead ? "Selecting…" : "Select all from lead's organisers"}</Button>
							</div>
						</div>

						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input placeholder="Search patches…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
						</div>

						<div className="max-h-72 overflow-auto rounded border p-2 space-y-1">
							{filteredPatches.map(p => {
								const checked = selectedPatchIds.includes(p.id)
								return (
									<button key={p.id} onClick={() => togglePatch(p.id)} className={`w-full text-left px-3 py-2 rounded hover:bg-accent transition ${checked ? "bg-accent" : ""}`}>
										<span className="inline-flex items-center gap-2">
											<span className={`inline-flex items-center justify-center h-4 w-4 rounded border ${checked ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
												{checked ? <Check className="h-3 w-3" /> : null}
											</span>
											<span>{p.name}</span>
										</span>
									</button>
								)
							})}
							{filteredPatches.length === 0 && (
								<div className="text-sm text-muted-foreground p-2">No patches match your search.</div>
							)}
						</div>

						<div className="flex items-center justify-between pt-2">
							<div className="flex flex-wrap gap-2">
								{selectedPatchIds.map(id => {
									const name = allPatches.find(p => p.id === id)?.name || id
									return (
										<Badge key={id} variant="secondary">{name}</Badge>
									)
								})}
							</div>
							<Button onClick={applyToUrl}>Apply</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}