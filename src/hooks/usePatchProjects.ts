"use client"
import { useProjectsServerSideCompatible } from "@/hooks/useProjectsServerSide"

export interface PatchProjectsQueryParams {
  patchId?: string | null
  q?: string
  tier?: string
  universe?: string
  stage?: string
  eba?: string
  sort?: "name" | "value" | "tier" | "workers" | "members" | "delegates" | "eba_coverage" | "employers"
  dir?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export function usePatchProjects(params: PatchProjectsQueryParams) {
  const {
    patchId,
    q,
    tier = "all",
    universe = "all",
    stage = "all",
    eba = "all",
    sort = "name",
    dir = "asc",
    page = 1,
    pageSize = 25
  } = params

  return useProjectsServerSideCompatible({
    page,
    pageSize,
    sort,
    dir,
    q: q || undefined,
    patch: patchId ? patchId : undefined,
    tier: tier as any,
    universe,
    stage,
    eba: eba as any,
    workers: "all",
    special: "all"
  })
}

