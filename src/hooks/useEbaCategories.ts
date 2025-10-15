import { useQuery } from "@tanstack/react-query"

export type EbaCategoryType = "contractor_role" | "trade"

export interface EbaCategory {
  category_type: EbaCategoryType
  category_code: string
  category_name: string
  current_employers: number
  total_employers: number
}

export function useEbaCategories(type: EbaCategoryType | null) {
  return useQuery<EbaCategory[]>({
    queryKey: ["eba-categories", type],
    enabled: !!type,
    queryFn: async () => {
      if (!type) return []

      const params = new URLSearchParams()
      params.set("type", type)
      params.set("currentOnly", "true")

      const res = await fetch(`/api/eba/categories?${params.toString()}`)
      if (!res.ok) {
        throw new Error(await res.text())
      }

      const json = await res.json()
      return (json.data || []) as EbaCategory[]
    },
  })
}



