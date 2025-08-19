import { useState } from "react";
// Worker type is defined inline since it includes relations
import { WorkerCard } from "./WorkerCard";
import { WorkerForm } from "./WorkerForm";
import { WorkerDetailModal } from "./WorkerDetailModal";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WorkersListProps {
  workers: any[];
  loading: boolean;
  onWorkerUpdate: () => void;
}

export const WorkersList = ({ workers, loading, onWorkerUpdate }: WorkersListProps) => {
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showWorkerDetail, setShowWorkerDetail] = useState(false);

  if (loading) {
    return (
      <div className="p-6">
        {/* Desktop Table Skeleton */}
        <div className="hidden md:block">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Union Status</TableHead>
                  <TableHead>Current Position</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="p-4">
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile Cards Skeleton */}
        <div className="md:hidden space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                  <div className="flex gap-2 mt-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-muted-foreground">No workers found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters or add a new worker
        </p>
      </div>
    );
  }

  const handleWorkerClick = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setShowWorkerDetail(true);
  };

  return (
    <>
      <ScrollArea className="h-full">
        {/* Desktop Table View */}
        <div className="hidden md:block p-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Union Status</TableHead>
                  <TableHead>Current Position</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    variant="table"
                    onEdit={setEditingWorker}
                    onUpdate={onWorkerUpdate}
                    onClick={() => handleWorkerClick(worker.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {workers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              variant="card"
              onEdit={setEditingWorker}
              onUpdate={onWorkerUpdate}
              onClick={() => handleWorkerClick(worker.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Edit Worker Dialog */}
      <Dialog open={!!editingWorker} onOpenChange={() => setEditingWorker(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
          </DialogHeader>
          {editingWorker && (
            <WorkerForm
              worker={editingWorker}
              onSuccess={() => {
                setEditingWorker(null);
                onWorkerUpdate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Worker Detail Modal */}
      <WorkerDetailModal
        workerId={selectedWorkerId}
        isOpen={showWorkerDetail}
        onClose={() => {
          setShowWorkerDetail(false);
          setSelectedWorkerId(null);
        }}
        onUpdate={onWorkerUpdate}
      />
    </>
  );
};