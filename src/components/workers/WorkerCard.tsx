import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, MoreHorizontal, Edit, Trash2, User } from "lucide-react";

interface WorkerCardProps {
  worker: any;
  variant: "card" | "table";
  onEdit?: (worker: any) => void;
  onUpdate: () => void;
  onClick?: (worker: any) => void;
}

export const WorkerCard = ({ worker, variant, onEdit, onUpdate, onClick }: WorkerCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const getUnionStatusColor = (status: string) => {
    switch (status) {
      case "member":
        return "bg-green-100 text-green-800 border-green-200";
      case "potential":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "declined":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatUnionStatus = (status: string) => {
    switch (status) {
      case "member":
        return "Member";
      case "non_member":
        return "Non-member";
      case "potential":
        return "Potential";
      case "declined":
        return "Declined";
      default:
        return status;
    }
  };

  const getInitials = (firstName: string, surname: string) => {
    return `${firstName?.charAt(0) || ""}${surname?.charAt(0) || ""}`.toUpperCase();
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("workers")
        .delete()
        .eq("id", worker.id);

      if (error) throw error;

      toast({
        title: "Worker deleted",
        description: "The worker has been successfully deleted.",
      });

      onUpdate();
    } catch (error) {
      console.error("Error deleting worker:", error);
      toast({
        title: "Error",
        description: "Failed to delete worker. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const currentPlacement = worker.worker_placements?.[0];
  const fullName = `${worker.first_name || ""} ${worker.surname || ""}`.trim();

  if (variant === "table") {
    return (
      <TableRow 
        className={onClick ? "cursor-pointer hover:bg-muted/50" : ""}
        onClick={() => onClick?.(worker)}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={getUnionStatusColor(worker.union_membership_status)}>
                {getInitials(worker.first_name, worker.surname)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-foreground">{fullName}</div>
              {worker.nickname && (
                <div className="text-sm text-muted-foreground">"{worker.nickname}"</div>
              )}
              {worker.member_number && (
                <div className="text-xs text-muted-foreground">Member: {worker.member_number}</div>
              )}
            </div>
          </div>
        </TableCell>
        
        <TableCell>
          <div className="space-y-1">
            {worker.email && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {worker.email}
              </div>
            )}
            {worker.mobile_phone && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {worker.mobile_phone}
              </div>
            )}
          </div>
        </TableCell>

        <TableCell>
          <Badge className={getUnionStatusColor(worker.union_membership_status)}>
            {formatUnionStatus(worker.union_membership_status)}
          </Badge>
        </TableCell>

        <TableCell>
          {currentPlacement ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">{currentPlacement.job_title || "Unknown Role"}</div>
              <div className="text-sm text-muted-foreground">
                {currentPlacement.job_sites?.name || "Unknown Site"}
              </div>
              {worker.organisers && (
                <div className="text-xs text-muted-foreground">
                  Organiser: {worker.organisers.first_name} {worker.organisers.last_name}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">No current placement</div>
              {worker.organisers && (
                <div className="text-xs text-muted-foreground">
                  Organiser: {worker.organisers.first_name} {worker.organisers.last_name}
                </div>
              )}
            </div>
          )}
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            {worker.email && (
              <Button size="sm" variant="outline" asChild>
                <a href={`mailto:${worker.email}`}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
            {worker.mobile_phone && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${worker.mobile_phone}`}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onEdit(worker);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // Card variant for mobile
  return (
    <>
      <Card 
        className={onClick ? "cursor-pointer hover:bg-muted/50" : ""}
        onClick={() => onClick?.(worker)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={getUnionStatusColor(worker.union_membership_status)}>
                {getInitials(worker.first_name, worker.surname)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-foreground truncate">{fullName}</h3>
                  {worker.nickname && (
                    <p className="text-sm text-muted-foreground">"{worker.nickname}"</p>
                  )}
                  {worker.member_number && (
                    <p className="text-xs text-muted-foreground">Member: {worker.member_number}</p>
                  )}
                </div>
                
                <Badge className={getUnionStatusColor(worker.union_membership_status)}>
                  {formatUnionStatus(worker.union_membership_status)}
                </Badge>
              </div>

              <div className="mt-2 text-sm text-muted-foreground">
                {currentPlacement ? (
                  <>
                    <div>{currentPlacement.job_title || "Unknown Role"}</div>
                    <div>{currentPlacement.job_sites?.name || "Unknown Site"}</div>
                  </>
                ) : (
                  <div>No current placement</div>
                )}
                {worker.organisers && (
                  <div className="text-xs mt-1">
                    Organiser: {worker.organisers.first_name} {worker.organisers.last_name}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                {worker.email && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${worker.email}`}>
                      <Mail className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {worker.mobile_phone && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`tel:${worker.mobile_phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onEdit(worker);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Worker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {fullName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};