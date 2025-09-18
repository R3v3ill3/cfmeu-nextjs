"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FWCSearchResult } from "@/types/fwcLookup";

interface FwcEbaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employerId: string;
  employerName: string;
  abn?: string;
  onLinkEba: () => void;
}

export function FwcEbaSearchModal({ isOpen, onClose, employerId, employerName, abn, onLinkEba }: FwcEbaSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState(employerName);
  const [results, setResults] = useState<FWCSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    setIsLoading(true);
    setResults([]);
    try {
      const response = await fetch("/api/fwc-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: searchTerm }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to search");
      }
      setResults(data.results);
    } catch (error) {
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkEba = async (eba: FWCSearchResult) => {
    try {
      const { error } = await supabase.rpc("link_eba_to_employer", {
        p_employer_id: employerId,
        p_eba_data: eba,
      });
      if (error) throw error;
      toast({
        title: "EBA Linked",
        description: `${eba.title} has been linked to ${employerName}.`,
      });
      onLinkEba();
    } catch (error) {
      toast({
        title: "Linking Failed",
        description: error instanceof Error ? error.message : "Could not link EBA.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Search FWC for EBA: {employerName}</DialogTitle>
          <DialogDescription>
            Search for an Enterprise Bargaining Agreement on the Fair Work Commission website and link it to this employer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Enter search term..." />
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? (
              <>
                <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </Button>
        </div>
        <div className="mt-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <img src="/spinner.gif" alt="Loading" className="h-8 w-8" />
            </div>
          ) : results.length > 0 ? (
            <ul className="space-y-2">
              {results.map((result, index) => (
                <li key={index} className="p-2 border rounded-md">
                  <h4 className="font-semibold">{result.title}</h4>
                  <p>Status: {result.status}</p>
                  <p>Approved: {result.approvedDate || "N/A"}</p>
                  <p>Expires: {result.expiryDate || "N/A"}</p>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => handleLinkEba(result)}>
                      Link to Employer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground">No results to display.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
