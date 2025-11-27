"use client";

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employer {
  id: string;
  name: string;
  enterprise_agreement_status?: boolean | null;
}

interface EmployerSearchProps {
  employers: Employer[];
  value?: string;
  onSelect: (employerId: string, employerName: string) => void;
  placeholder?: string;
  className?: string;
}

export function EmployerSearch({ 
  employers, 
  value, 
  onSelect, 
  placeholder = "Search employers...",
  className 
}: EmployerSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined);
  
  const selectedEmployer = employers.find(emp => emp.id === value);
  
  // Filter employers based on search
  const filteredEmployers = employers.filter(employer =>
    employer.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100); // Limit to 100 results for performance

  // Measure trigger width when popover opens to maintain consistent width
  useEffect(() => {
    if (open && triggerRef.current) {
      const width = triggerRef.current.offsetWidth;
      setPopoverWidth(width);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedEmployer ? (
            <div className="flex items-center gap-2 flex-1 text-left">
              <span className="truncate">{selectedEmployer.name}</span>
              {selectedEmployer.enterprise_agreement_status ? (
                <Badge variant="default" className="text-xs">EBA</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">No EBA</Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0" 
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={popoverWidth ? { 
          width: `${popoverWidth}px`, 
          minWidth: '300px', 
          maxWidth: '400px',
          height: '400px', // Fixed height prevents repositioning
        } : { 
          minWidth: '300px', 
          maxWidth: '400px',
          height: '400px', // Fixed height prevents repositioning
        }}
      >
        <Command className="h-[400px] flex flex-col">
          <div className="sticky top-0 z-10 bg-white border-b">
            <CommandInput 
              placeholder="Search employers..." 
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            No employer found.
          </CommandEmpty>
          <CommandGroup className="flex-1 overflow-y-auto min-h-0">
            {filteredEmployers.map((employer) => (
              <CommandItem
                key={employer.id}
                onSelect={() => {
                  onSelect(employer.id, employer.name);
                  setOpen(false);
                  setSearch('');
                }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === employer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{employer.name}</span>
                </div>
                {employer.enterprise_agreement_status ? (
                  <Badge variant="default" className="text-xs ml-2 shrink-0">EBA</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs ml-2 shrink-0">No EBA</Badge>
                )}
              </CommandItem>
            ))}
            {search && filteredEmployers.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No employers found matching "{search}"
              </div>
            )}
            {filteredEmployers.length === 100 && (
              <div className="p-2 text-xs text-muted-foreground text-center border-t">
                Showing first 100 results. Type more to narrow search.
              </div>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
