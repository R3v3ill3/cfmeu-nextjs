import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { Loader2, Search } from "lucide-react";

interface ProjectQuickFinderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExistingProject: (projectId: string) => void;
  onCreateNewProject: () => void;
}

interface ProjectListItem {
  id: string;
  name: string;
  full_address: string | null;
  builder_name: string | null;
}

export function ProjectQuickFinder({ open, onOpenChange, onSelectExistingProject, onCreateNewProject }: ProjectQuickFinderProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setResults([]);
      setHasSearched(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const runSearch = async () => {
      if (!debouncedSearch || debouncedSearch.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);

      const term = `%${debouncedSearch.trim()}%`;
      const { data, error } = await supabase
        .rpc('search_projects_basic', {
          p_query: debouncedSearch.trim(),
        });

      if (error) {
        console.error("Project search error:", error);
        setResults([]);
      } else {
        setResults((data as ProjectListItem[]) || []);
      }

      setIsLoading(false);
    };

    runSearch();
  }, [debouncedSearch, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match scan to existing project</DialogTitle>
          <DialogDescription>
            Search for an existing project. If no match is found, continue to create a new project from the scan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by project name, address, or builder"
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="max-h-[320px] rounded border">
            <div className="divide-y">
              {isLoading && (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching projects…
                </div>
              )}

              {!isLoading && results.length === 0 && hasSearched && (
                <div className="py-6 px-4 text-sm text-muted-foreground">
                  No matching projects found.
                </div>
              )}

              {!isLoading && !hasSearched && (
                <div className="py-6 px-4 text-sm text-muted-foreground">
                  Start typing to search existing projects.
                </div>
              )}

              {results.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => onSelectExistingProject(project.id)}
                >
                  <div className="font-medium text-sm">{project.name}</div>
                  {project.full_address && <div className="text-xs text-muted-foreground mt-1">{project.full_address}</div>}
                  {project.builder_name && <div className="text-xs text-muted-foreground">Builder: {project.builder_name}</div>}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreateNewProject}>
            Create new project from scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
