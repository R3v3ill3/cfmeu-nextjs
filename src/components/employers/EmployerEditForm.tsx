
import { useEffect, useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TRADE_OPTIONS } from "@/constants/trades";
import { GoogleAddressInput, GoogleAddress, AddressValidationError } from "@/components/projects/GoogleAddressInput";
import { IncolinkActionModal } from "./IncolinkActionModal";
import { Plus } from "lucide-react";

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
  incolink_id: z.string().optional().nullable(),
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
    incolink_id?: string | null;
  };
  onCancel: () => void;
  onSaved: (updated: { id: string; name: string; employer_type: string }) => void;
};

export default function EmployerEditForm({ employer, onCancel, onSaved }: EmployerEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormReady, setIsFormReady] = useState(false);
  const [isIncolinkModalOpen, setIsIncolinkModalOpen] = useState(false);

  // Stabilize employer object to prevent form re-initialization on every render
  const stableEmployer = useMemo(() => ({
    id: employer.id,
    name: employer.name,
    employer_type: employer.employer_type,
    abn: employer.abn,
    primary_contact_name: employer.primary_contact_name,
    phone: employer.phone,
    email: employer.email,
    website: employer.website,
    address_line_1: employer.address_line_1,
    address_line_2: employer.address_line_2,
    suburb: employer.suburb,
    state: employer.state,
    postcode: employer.postcode,
    contact_notes: employer.contact_notes,
    estimated_worker_count: employer.estimated_worker_count,
    incolink_id: employer.incolink_id,
  }), [employer.id, employer.name, employer.employer_type, employer.abn, employer.primary_contact_name, employer.phone, employer.email, employer.website, employer.address_line_1, employer.address_line_2, employer.suburb, employer.state, employer.postcode, employer.contact_notes, employer.estimated_worker_count, employer.incolink_id]);

  // Stabilize form default values
  const defaultValues = useMemo(() => ({
    name: stableEmployer.name ?? "",
    employer_type: stableEmployer.employer_type as EmployerType,
    abn: stableEmployer.abn ?? null,
    primary_contact_name: stableEmployer.primary_contact_name ?? null,
    phone: stableEmployer.phone ?? null,
    email: stableEmployer.email ?? null,
    website: stableEmployer.website ?? null,
    address_line_1: stableEmployer.address_line_1 ?? null,
    address_line_2: stableEmployer.address_line_2 ?? null,
    suburb: stableEmployer.suburb ?? null,
    state: stableEmployer.state ?? null,
    postcode: stableEmployer.postcode ?? null,
    contact_notes: stableEmployer.contact_notes ?? null,
    estimated_worker_count: stableEmployer.estimated_worker_count ?? null,
    incolink_id: stableEmployer.incolink_id ?? null,
  }), [stableEmployer]);

const form = useForm<z.input<typeof FormSchema>>({
  resolver: zodResolver(FormSchema),
  defaultValues,
  mode: "onChange", // Prevent re-validation on every change
});

  // Load existing durable classification tags and trade capabilities from employer_capabilities
  const { data: roleTags = [] } = useQuery({
    queryKey: ["employer_capabilities_roles", stableEmployer.id],
    queryFn: async () => {
      const { data, error} = await (supabase as any)
        .from("employer_capabilities")
        .select("contractor_role_types!inner(code)")
        .eq("employer_id", stableEmployer.id)
        .eq("capability_type", "contractor_role");
      if (error) throw error;
      // Map to the old format for compatibility with existing code
      return (data ?? []).map((row: any) => ({
        tag: row.contractor_role_types.code as "builder" | "head_contractor"
      }));
    },
  });

  const { data: tradeCaps = [] } = useQuery({
    queryKey: ["employer_capabilities_trades", stableEmployer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employer_capabilities")
        .select("trade_types!inner(code)")
        .eq("employer_id", stableEmployer.id)
        .eq("capability_type", "trade");
      if (error) throw error;
      // Map to the old format for compatibility with existing code
      return (data ?? []).map((row: any) => ({
        trade_type: row.trade_types.code
      }));
    },
  });

  // Local state mirrors for editable tags/caps
  const [isBuilder, setIsBuilder] = useState(false);
  const [isHeadContractor, setIsHeadContractor] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  
  // Separate state for GoogleAddressInput to prevent infinite loops
  const [addressInputValue, setAddressInputValue] = useState("");

  // Delay form rendering to prevent ref composition issues during mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFormReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Stabilize array dependencies from react-query to prevent re-render loops.
  // The `data` array from `useQuery` can be a new reference on each render,
  // causing an infinite loop if used as a `useEffect` dependency directly.
  const roleTagsKey = useMemo(() => JSON.stringify(roleTags), [roleTags]);
  useEffect(() => {
    const tags = new Set(roleTags.map((r) => r.tag));
    setIsBuilder(tags.has("builder"));
    setIsHeadContractor(tags.has("head_contractor"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleTagsKey]);

  const tradeCapsKey = useMemo(() => JSON.stringify(tradeCaps), [tradeCaps]);
  useEffect(() => {
    setSelectedTrades(tradeCaps.map((c) => c.trade_type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeCapsKey]);

  // Initialize address input value from employer data
  useEffect(() => {
    const parts: string[] = [];
    if (stableEmployer.address_line_1) parts.push(stableEmployer.address_line_1);
    const cityState = [stableEmployer.suburb, stableEmployer.state].filter(Boolean).join(" ");
    if (cityState) parts.push(cityState);
    if (stableEmployer.postcode) parts.push(stableEmployer.postcode);
    setAddressInputValue(parts.join(", "));
  }, [stableEmployer.address_line_1, stableEmployer.suburb, stableEmployer.state, stableEmployer.postcode]);

const desiredTags = useMemo(() => {
    const s = new Set<RoleTag>();
    if (isBuilder) s.add("builder");
    if (isHeadContractor) s.add("head_contractor");
    return s;
  }, [isBuilder, isHeadContractor]);

  const currentTags = useMemo(() => new Set(roleTags.map((r) => r.tag)), [roleTags]);
  const currentTrades = useMemo(() => new Set(tradeCaps.map((t) => t.trade_type)), [tradeCaps]);
const desiredTrades = useMemo(() => new Set(selectedTrades), [selectedTrades]);

  const handleAddressSelect = useCallback((addr: GoogleAddress, error?: AddressValidationError | null) => {
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
    
    // Update the address input display value
    const parts: string[] = [];
    if (finalLine1) parts.push(finalLine1);
    const cityState = [suburb, state].filter(Boolean).join(" ");
    if (cityState) parts.push(cityState);
    if (postcode) parts.push(postcode);
    setAddressInputValue(parts.join(", "));
  }, [form]);

const onSubmit = useCallback(async (values: z.input<typeof FormSchema>) => {
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
    incolink_id: toNull(parsed.incolink_id),
  };

  const desiredTagsArray = Array.from(desiredTags);
  const desiredTradesArray = Array.from(desiredTrades);

  const { data, error } = await (supabase as any).rpc('admin_update_employer_full', {
    p_employer_id: stableEmployer.id,
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
  queryClient.setQueryData(["employer-detail", stableEmployer.id], (prev: any) => {
    if (!prev) return updatedRow;
    return { ...prev, ...updatedRow };
  });

  queryClient.setQueryData(["employers"], (prev: any) => {
    if (!Array.isArray(prev)) return prev;
    return prev.map((e: any) =>
      e?.id === stableEmployer.id
        ? { ...e, name: updatedRow.name, employer_type: updatedRow.employer_type, estimated_worker_count: updatedRow.estimated_worker_count }
        : e
    );
  });

  await queryClient.refetchQueries({ queryKey: ["employer-detail", stableEmployer.id] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["employers"] }),
    queryClient.invalidateQueries({ queryKey: ["employer_capabilities_roles"] }),
    queryClient.invalidateQueries({ queryKey: ["employer_capabilities_roles", stableEmployer.id] }),
    queryClient.invalidateQueries({ queryKey: ["employer_capabilities_trades"] }),
    queryClient.invalidateQueries({ queryKey: ["employer_capabilities_trades", stableEmployer.id] }),
    queryClient.invalidateQueries({ queryKey: ["employer-categories", stableEmployer.id] }), // Also invalidate categories tab
  ]);

  toast({ title: 'Employer updated', description: 'Changes saved successfully.' });
  const updatedEmployer = { id: stableEmployer.id, name: updatedRow.name, employer_type: updatedRow.employer_type };
  onSaved(updatedEmployer as { id: string; name: string; employer_type: string });
}, [stableEmployer, desiredTags, desiredTrades, queryClient, toast, onSaved]);

  if (!isFormReady) {
    return <div className="p-4 text-center">Loading form...</div>;
  }

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
          <Select onValueChange={field.onChange} value={field.value}>
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

    {stableEmployer.incolink_id ? (
      <FormField
        control={form.control}
        name="incolink_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Incolink ID</FormLabel>
            <FormControl>
              <Input
                placeholder="Incolink Employer ID"
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ) : (
      <FormItem>
        <FormLabel>Incolink ID</FormLabel>
        <Button variant="secondary" className="w-full justify-start" onClick={() => setIsIncolinkModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Incolink ID
        </Button>
      </FormItem>
    )}
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
      <GoogleAddressInput
        value={addressInputValue}
        onChange={handleAddressSelect}
        placeholder="Search Australian address"
        requireSelection={false}
        showLabel={false}
      />
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
      <IncolinkActionModal
        isOpen={isIncolinkModalOpen}
        onClose={() => setIsIncolinkModalOpen(false)}
        employerId={stableEmployer.id}
        employerName={stableEmployer.name}
        currentIncolinkId={stableEmployer.incolink_id}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["employer-detail", stableEmployer.id] });
        }}
      />
    </div>
  );
}
