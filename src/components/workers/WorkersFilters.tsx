import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkerFilters = {
  search: string;
  unionStatus: string[];
  jobSites: string[];
  employmentStatus: string[];
  hasEmail: boolean | null;
  hasMobile: boolean | null;
};

interface WorkersFiltersProps {
  filters: WorkerFilters;
  onFiltersChange: (filters: WorkerFilters) => void;
  className?: string;
}

export const WorkersFilters = ({ filters, onFiltersChange, className }: WorkersFiltersProps) => {
  const { data: jobSites } = useQuery({
    queryKey: ["job-sites-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const unionStatusOptions = [
    { value: "member", label: "Member" },
    { value: "non_member", label: "Non-member" },
    { value: "potential", label: "Potential" },
    { value: "declined", label: "Declined" },
  ];

  const employmentStatusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "terminated", label: "Terminated" },
  ];

  const clearAllFilters = () => {
    onFiltersChange({
      search: "",
      unionStatus: [],
      jobSites: [],
      employmentStatus: [],
      hasEmail: null,
      hasMobile: null,
    });
  };

  const removeFilter = (filterType: string, value?: string) => {
    switch (filterType) {
      case "unionStatus":
        onFiltersChange({
          ...filters,
          unionStatus: filters.unionStatus.filter(s => s !== value)
        });
        break;
      case "jobSites":
        onFiltersChange({
          ...filters,
          jobSites: filters.jobSites.filter(s => s !== value)
        });
        break;
      case "employmentStatus":
        onFiltersChange({
          ...filters,
          employmentStatus: filters.employmentStatus.filter(s => s !== value)
        });
        break;
      case "hasEmail":
        onFiltersChange({
          ...filters,
          hasEmail: null
        });
        break;
      case "hasMobile":
        onFiltersChange({
          ...filters,
          hasMobile: null
        });
        break;
    }
  };

  const activeFiltersCount = 
    filters.unionStatus.length + 
    filters.jobSites.length + 
    filters.employmentStatus.length +
    (filters.hasEmail !== null ? 1 : 0) +
    (filters.hasMobile !== null ? 1 : 0);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active Filters ({activeFiltersCount})</Label>
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {filters.unionStatus.map(status => (
              <Badge key={status} variant="secondary" className="flex items-center gap-1">
                {unionStatusOptions.find(opt => opt.value === status)?.label}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFilter("unionStatus", status)}
                />
              </Badge>
            ))}
            {filters.jobSites.map(siteId => (
              <Badge key={siteId} variant="secondary" className="flex items-center gap-1">
                {jobSites?.find(site => site.id === siteId)?.name}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFilter("jobSites", siteId)}
                />
              </Badge>
            ))}
            {filters.employmentStatus.map(status => (
              <Badge key={status} variant="secondary" className="flex items-center gap-1">
                {employmentStatusOptions.find(opt => opt.value === status)?.label}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFilter("employmentStatus", status)}
                />
              </Badge>
            ))}
            {filters.hasEmail !== null && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {filters.hasEmail ? "Has Email" : "No Email"}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFilter("hasEmail")}
                />
              </Badge>
            )}
            {filters.hasMobile !== null && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {filters.hasMobile ? "Has Mobile" : "No Mobile"}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFilter("hasMobile")}
                />
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Filter Sections */}
      <Accordion type="multiple" defaultValue={["union-status", "contact-info"]} className="w-full">
        {/* Union Status */}
        <AccordionItem value="union-status">
          <AccordionTrigger className="text-sm font-medium">
            Union Status
            {filters.unionStatus.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {filters.unionStatus.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {unionStatusOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`union-${option.value}`}
                  checked={filters.unionStatus.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onFiltersChange({
                        ...filters,
                        unionStatus: [...filters.unionStatus, option.value]
                      });
                    } else {
                      onFiltersChange({
                        ...filters,
                        unionStatus: filters.unionStatus.filter(s => s !== option.value)
                      });
                    }
                  }}
                />
                <Label htmlFor={`union-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Contact Information */}
        <AccordionItem value="contact-info">
          <AccordionTrigger className="text-sm font-medium">
            Contact Information
            {(filters.hasEmail !== null || filters.hasMobile !== null) && (
              <Badge variant="outline" className="ml-2">
                {(filters.hasEmail !== null ? 1 : 0) + (filters.hasMobile !== null ? 1 : 0)}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">EMAIL</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-email"
                  checked={filters.hasEmail === true}
                  onCheckedChange={(checked) => {
                    onFiltersChange({
                      ...filters,
                      hasEmail: checked ? true : null
                    });
                  }}
                />
                <Label htmlFor="has-email" className="text-sm">Has Email</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-email"
                  checked={filters.hasEmail === false}
                  onCheckedChange={(checked) => {
                    onFiltersChange({
                      ...filters,
                      hasEmail: checked ? false : null
                    });
                  }}
                />
                <Label htmlFor="no-email" className="text-sm">No Email</Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">MOBILE</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-mobile"
                  checked={filters.hasMobile === true}
                  onCheckedChange={(checked) => {
                    onFiltersChange({
                      ...filters,
                      hasMobile: checked ? true : null
                    });
                  }}
                />
                <Label htmlFor="has-mobile" className="text-sm">Has Mobile</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-mobile"
                  checked={filters.hasMobile === false}
                  onCheckedChange={(checked) => {
                    onFiltersChange({
                      ...filters,
                      hasMobile: checked ? false : null
                    });
                  }}
                />
                <Label htmlFor="no-mobile" className="text-sm">No Mobile</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Job Sites */}
        <AccordionItem value="job-sites">
          <AccordionTrigger className="text-sm font-medium">
            Job Sites
            {filters.jobSites.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {filters.jobSites.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {jobSites?.map(site => (
              <div key={site.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`site-${site.id}`}
                  checked={filters.jobSites.includes(site.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onFiltersChange({
                        ...filters,
                        jobSites: [...filters.jobSites, site.id]
                      });
                    } else {
                      onFiltersChange({
                        ...filters,
                        jobSites: filters.jobSites.filter(s => s !== site.id)
                      });
                    }
                  }}
                />
                <Label htmlFor={`site-${site.id}`} className="text-sm">
                  {site.name}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Employment Status */}
        <AccordionItem value="employment-status">
          <AccordionTrigger className="text-sm font-medium">
            Employment Status
            {filters.employmentStatus.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {filters.employmentStatus.length}
              </Badge>
            )}
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {employmentStatusOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`employment-${option.value}`}
                  checked={filters.employmentStatus.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onFiltersChange({
                        ...filters,
                        employmentStatus: [...filters.employmentStatus, option.value]
                      });
                    } else {
                      onFiltersChange({
                        ...filters,
                        employmentStatus: filters.employmentStatus.filter(s => s !== option.value)
                      });
                    }
                  }}
                />
                <Label htmlFor={`employment-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};