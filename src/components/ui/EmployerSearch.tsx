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
  
  const selectedEmployer = employers.find(emp => emp.id === value);
  
  // Filter employers based on search
  const filteredEmployers = employers.filter(employer =>
    employer.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100); // Limit to 100 results for performance

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
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
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search employers..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No employer found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-y-auto">
            {filteredEmployers.map((employer) => (
              <CommandItem
                key={employer.id}
                onSelect={() => {
                  onSelect(employer.id, employer.name);
                  setOpen(false);
                }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === employer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{employer.name}</span>
                </div>
                {employer.enterprise_agreement_status ? (
                  <Badge variant="default" className="text-xs ml-2">EBA</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs ml-2">No EBA</Badge>
                )}
              </CommandItem>
            ))}
            {search && filteredEmployers.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No employers found matching "{search}"
              </div>
            )}
            {filteredEmployers.length === 50 && (
              <div className="p-2 text-xs text-muted-foreground text-center border-t">
                Showing first 50 results. Type more to narrow search.
              </div>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
