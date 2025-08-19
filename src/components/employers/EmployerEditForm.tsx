
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TRADE_OPTIONS } from "@/constants/trades";
import { GoogleAddressInput, GoogleAddress } from "@/components/projects/GoogleAddressInput";

const employerTypeOptions = [
  { value: "builder", label: "Builder" },
  { value: "principal_contractor", label: "Principal Contractor" },
  { value: "large_contractor", label: "Contractor (Large)" },
  { value: "small_contractor", label: "Contractor (Small)" },
  { value: "individual", label: "Individual" },
] as const;

type EmployerType = typeof employerTypeOptions[number]["value"];

type RoleTag = "builder" | "head_contractor";

const FormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  employer_type: z.enum([
    "builder",
    "principal_contractor",
    "large_contractor",
    "small_contractor",
    "individual",
  ] as [EmployerType, ...EmployerType[]]),
  abn: z.string().optional().nullable(),
  primary_contact_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable(),
  website: z.string().url("Invalid URL").optional().nullable(),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  contact_notes: z.string().optional().nullable(),
  estimated_worker_count: z.number().min(0).optional().nullable(),
  enterprise_agreement_status: z.boolean().optional().nullable(),
});

export type EmployerEditFormProps = {
  employer: {
    id: string;
    name: string;
    employer_type: string;
    abn?: string | null;
    primary_contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    contact_notes?: string | null;
    estimated_worker_count?: number | null;
    enterprise_agreement_status?: boolean | null;
  };
  onCancel: () => void;
  onSaved: (updated: { id: string; name: string; employer_type: string }) => void;
};

export default function EmployerEditForm({ employer, onCancel, onSaved }: EmployerEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

const form = useForm<z.input<typeof FormSchema>>({
  resolver: zodResolver(FormSchema),
  defaultValues: {
    name: employer.name ?? "",
    employer_type: employer.employer_type as EmployerType,
    abn: employer.abn ?? null,
    primary_contact_name: employer.primary_contact_name ?? null,
    phone: employer.phone ?? null,
    email: employer.email ?? null,
    website: employer.website ?? null,
    address_line_1: employer.address_line_1 ?? null,
    address_line_2: employer.address_line_2 ?? null,
    suburb: employer.suburb ?? null,
    state: employer.state ?? null,
    postcode: employer.postcode ?? null,
    contact_notes: employer.contact_notes ?? null,
    estimated_worker_count: employer.estimated_worker_count ?? null,
    enterprise_agreement_status: employer.enterprise_agreement_status ?? null,
  },
});

  // Load existing durable classification tags and trade capabilities
  const { data: roleTags = [] } = useQuery({
    queryKey: ["employer_role_tags", employer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employer_role_tags")
        .select("tag")
        .eq("employer_id", employer.id);
      if (error) throw error;
      return (data ?? []) as { tag: "builder" | "head_contractor" }[];
    },
  });

  const { data: tradeCaps = [] } = useQuery({
    queryKey: ["contractor_trade_capabilities", employer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contractor_trade_capabilities")
        .select("trade_type")
        .eq("employer_id", employer.id);
      if (error) throw error;
      return (data ?? []) as { trade_type: string }[];
    },
  });

  // Local state mirrors for editable tags/caps
  const [isBuilder, setIsBuilder] = useState(false);
  const [isHeadContractor, setIsHeadContractor] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);

  useEffect(() => {
    const tags = new Set(roleTags.map((r) => r.tag));
    setIsBuilder(tags.has("builder"));
    setIsHeadContractor(tags.has("head_contractor"));
  }, [roleTags]);

  useEffect(() => {
    setSelectedTrades(tradeCaps.map((c) => c.trade_type));
  }, [tradeCaps]);

const desiredTags = useMemo(() => {
    const s = new Set<RoleTag>();
    if (isBuilder) s.add("builder");
    if (isHeadContractor) s.add("head_contractor");
    return s;
  }, [isBuilder, isHeadContractor]);

  const currentTags = useMemo(() => new Set(roleTags.map((r) => r.tag)), [roleTags]);
  const currentTrades = useMemo(() => new Set(tradeCaps.map((t) => t.trade_type)), [tradeCaps]);
const desiredTrades = useMemo(() => new Set(selectedTrades), [selectedTrades]);

  // Compose display address string from form values for the autocomplete input
  const wl1 = form.watch("address_line_1");
  const wsuburb = form.watch("suburb");
  const wstate = form.watch("state");
  const wpostcode = form.watch("postcode");
  const displayAddress = useMemo(() => {
    const parts: string[] = [];
    if (wl1) parts.push(String(wl1));
    const cityState = [wsuburb, wstate].filter(Boolean).join(" ");
    if (cityState) parts.push(cityState);
    if (wpostcode) parts.push(String(wpostcode));
    return parts.join(", ");
  }, [wl1, wsuburb, wstate, wpostcode]);

  const handleAddressSelect = (addr: GoogleAddress) => {
    const comps = addr.components || {};
    const streetNumber = comps["street_number"]; // e.g., 123
    const route = comps["route"]; // e.g., Main St
    const line1 = [streetNumber, route].filter(Boolean).join(" ");
    const suburb = comps["locality"] || comps["postal_town"] || comps["sublocality"] || null;
    const state = comps["administrative_area_level_1"] || null;
    const postcode = comps["postal_code"] || null;

    // If Google didn't give granular street parts, fall back to formatted
    const finalLine1 = line1 || addr.formatted || "";
    form.setValue("address_line_1", finalLine1 || null, { shouldDirty: true });
    form.setValue("suburb", suburb, { shouldDirty: true });
    form.setValue("state", state, { shouldDirty: true });
    form.setValue("postcode", postcode, { shouldDirty: true });
  };

const onSubmit = async (values: z.input<typeof FormSchema>) => {
  const parsed = FormSchema.parse(values);
  const toNull = (v: any) => (v === "" ? null : v);
  // Prepare payload for RPC
  const updatePayload = {
    name: parsed.name.trim(),
    employer_type: parsed.employer_type,
    abn: toNull(parsed.abn),
    primary_contact_name: toNull(parsed.primary_contact_name),
    phone: toNull(parsed.phone),
    email: toNull(parsed.email),
    website: toNull(parsed.website),
    address_line_1: toNull(parsed.address_line_1),
    address_line_2: toNull(parsed.address_line_2),
    suburb: toNull(parsed.suburb),
    state: toNull(parsed.state),
    postcode: toNull(parsed.postcode),
    contact_notes: toNull(parsed.contact_notes),
    estimated_worker_count: parsed.estimated_worker_count ?? null,
    enterprise_agreement_status: parsed.enterprise_agreement_status ?? null,
  };

  const desiredTagsArray = Array.from(desiredTags);
  const desiredTradesArray = Array.from(desiredTrades);

  const { data, error } = await (supabase as any).rpc('admin_update_employer_full', {
    p_employer_id: employer.id,
    p_update: updatePayload,
    p_role_tags: desiredTagsArray,
    p_trade_types: desiredTradesArray,
  });

  if (error) {
    console.error('[EmployerEditForm] RPC update error', error);
    const code = (error as any).code;
    const msg = code === 'PGRST116' ? "Employer not found or you don't have permission to edit it." : error.message;
    toast({ title: 'Update failed', description: msg, variant: 'destructive' });
    return;
  }

  if (!data) {
    toast({ title: 'No changes saved', description: 'Server returned no updated record.', variant: 'destructive' });
    return;
  }

  const updatedRow = data as any;

  // Optimistically update caches to reflect changes immediately
  queryClient.setQueryData(["employer-detail", employer.id], (prev: any) => {
    if (!prev) return updatedRow;
    return { ...prev, ...updatedRow };
  });

  queryClient.setQueryData(["employers"], (prev: any) => {
    if (!Array.isArray(prev)) return prev;
    return prev.map((e: any) =>
      e?.id === employer.id
        ? { ...e, name: updatedRow.name, employer_type: updatedRow.employer_type, estimated_worker_count: updatedRow.estimated_worker_count }
        : e
    );
  });

  await queryClient.refetchQueries({ queryKey: ["employer-detail", employer.id] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["employers"] }),
    queryClient.invalidateQueries({ queryKey: ["employer_role_tags"] }),
    queryClient.invalidateQueries({ queryKey: ["employer_role_tags", employer.id] }),
    queryClient.invalidateQueries({ queryKey: ["contractor_trade_capabilities"] }),
    queryClient.invalidateQueries({ queryKey: ["contractor_trade_capabilities", employer.id] }),
  ]);

  toast({ title: 'Employer updated', description: 'Changes saved successfully.' });
  const updatedEmployer = { id: employer.id, name: updatedRow.name, employer_type: updatedRow.employer_type };
  onSaved(updatedEmployer as { id: string; name: string; employer_type: string });
};

  return (
    <div className="space-y-6">
      <Form {...form}>
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Company Name</FormLabel>
          <FormControl>
            <Input placeholder="Enter company name" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="employer_type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Employer Type</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {employerTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>

  {/* Company Details */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      control={form.control}
      name="abn"
      render={({ field }) => (
        <FormItem>
          <FormLabel>ABN</FormLabel>
          <FormControl>
            <Input
              placeholder="ABN"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="website"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Website</FormLabel>
          <FormControl>
            <Input
              placeholder="https://example.com"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="estimated_worker_count"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Estimated Worker Count</FormLabel>
          <FormControl>
            <Input
              type="number"
              placeholder="0"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return field.onChange(null);
                const num = Number(v);
                return field.onChange(Number.isNaN(num) ? null : num);
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="enterprise_agreement_status"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Enterprise Agreement</FormLabel>
          <FormControl>
            <div className="flex items-center gap-3">
              <Switch checked={!!field.value} onCheckedChange={field.onChange} />
              <span className="text-sm text-muted-foreground">Has EBA</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>

  {/* Contact Information */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      control={form.control}
      name="primary_contact_name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Primary Contact</FormLabel>
          <FormControl>
            <Input
              placeholder="Full name"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="phone"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Phone</FormLabel>
          <FormControl>
            <Input
              placeholder="Phone number"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
              type="email"
              placeholder="name@example.com"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>

  {/* Address */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="md:col-span-2">
      <GoogleAddressInput value={displayAddress} onChange={handleAddressSelect} placeholder="Search address" />
    </div>

    <FormField
      control={form.control}
      name="address_line_2"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Address Line 2</FormLabel>
          <FormControl>
            <Input
              placeholder="Suite, unit, etc."
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="suburb"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Suburb</FormLabel>
          <FormControl>
            <Input
              placeholder="Suburb"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="state"
      render={({ field }) => (
        <FormItem>
          <FormLabel>State</FormLabel>
          <FormControl>
            <Input
              placeholder="State"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="postcode"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Postcode</FormLabel>
          <FormControl>
            <Input
              placeholder="Postcode"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>

  {/* Notes */}
  <FormField
    control={form.control}
    name="contact_notes"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Contact Notes</FormLabel>
        <FormControl>
          <Textarea
            placeholder="Internal notes about contacts, preferences, etc."
            {...field}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* Durable classification tags */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Classification Tags</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isBuilder}
                  onChange={(e) => setIsBuilder(e.target.checked)}
                />
                Builder
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isHeadContractor}
                  onChange={(e) => setIsHeadContractor(e.target.checked)}
                />
                Head Contractor
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              These tags are also added automatically when this employer is assigned to these roles on any project.
            </p>
          </div>

          {/* Trade capabilities */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Trade Capabilities</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-auto border rounded p-2">
              {TRADE_OPTIONS.map((t) => {
                const checked = selectedTrades.includes(t.value);
                return (
                  <label key={t.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedTrades((prev) => {
                          const set = new Set(prev);
                          if (e.target.checked) set.add(t.value);
                          else set.delete(t.value);
                          return Array.from(set);
                        });
                      }}
                    />
                    {t.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Trades are also added automatically when this employer is assigned to matching trade roles on projects.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
