import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, TrendingUp, Shield, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

const ratingSchema = z.object({
  rating_type: z.enum(["leadership", "support_level", "risk"]),
  rating_value: z.number().min(1).max(10),
  notes: z.string().optional(),
});

type RatingFormData = z.infer<typeof ratingSchema>;

interface WorkerRatingsTabProps {
  workerId: string | null;
  onUpdate: () => void;
}

const ratingTypes = [
  { value: "leadership", label: "Leadership Potential", icon: Star, description: "Ability to lead and inspire others" },
  { value: "support_level", label: "Union Support", icon: TrendingUp, description: "Level of support for union activities" },
  { value: "risk", label: "Risk Assessment", icon: Shield, description: "Potential risks or concerns" },
];

export const WorkerRatingsTab = ({ workerId, onUpdate }: WorkerRatingsTabProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRating, setEditingRating] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["worker-ratings", workerId],
    queryFn: async () => {
      if (!workerId) return [];
      
      const { data, error } = await supabase
        .from("worker_activity_ratings")
        .select("*")
        .eq("worker_id", workerId)
        .in("rating_type", ["leadership", "support_level", "risk"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!workerId,
  });

  const form = useForm<RatingFormData>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      rating_type: "leadership",
      rating_value: 5,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RatingFormData) => {
      const { error } = await supabase
        .from("worker_activity_ratings")
        .insert({
          worker_id: workerId,
          rating_type: data.rating_type,
          rating_value: data.rating_value,
          notes: data.notes || null,
          // rated_by would be the current user's ID in a real app
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Rating added",
        description: "Worker rating has been successfully added.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-ratings", workerId] });
      setShowAddDialog(false);
      form.reset();
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RatingFormData) => {
      const { error } = await supabase
        .from("worker_activity_ratings")
        .update({
          rating_type: data.rating_type,
          rating_value: data.rating_value,
          notes: data.notes || null,
        })
        .eq("id", editingRating.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Rating updated",
        description: "Worker rating has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-ratings", workerId] });
      setEditingRating(null);
      form.reset();
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      const { error } = await supabase
        .from("worker_activity_ratings")
        .delete()
        .eq("id", ratingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Rating deleted",
        description: "Worker rating has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-ratings", workerId] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RatingFormData) => {
    if (editingRating) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (rating: any) => {
    setEditingRating(rating);
    form.reset({
      rating_type: rating.rating_type,
      rating_value: rating.rating_value,
      notes: rating.notes || "",
    });
  };

  const getRatingTypeInfo = (type: string) => {
    return ratingTypes.find(t => t.value === type) || ratingTypes[0];
  };

  const getRatingColor = (value: number) => {
    if (value >= 8) return "text-green-600";
    if (value >= 6) return "text-yellow-600";
    if (value >= 4) return "text-orange-600";
    return "text-red-600";
  };

  const getAverageRating = (type: string) => {
    const typeRatings = ratings.filter(r => r.rating_type === type);
    if (typeRatings.length === 0) return null;
    const sum = typeRatings.reduce((acc, r) => acc + r.rating_value, 0);
    return (sum / typeRatings.length).toFixed(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Worker Ratings</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rating
        </Button>
      </div>

      {/* Rating Averages Summary */}
      <div className="grid grid-cols-3 gap-4">
        {ratingTypes.map((type) => {
          const IconComponent = type.icon;
          const average = getAverageRating(type.value);
          return (
            <Card key={type.value}>
              <CardContent className="p-4 text-center">
                <IconComponent className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <h4 className="font-medium text-sm">{type.label}</h4>
                {average ? (
                  <div className={`text-2xl font-bold ${getRatingColor(parseFloat(average))}`}>
                    {average}/10
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No ratings</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading ratings...</div>
      ) : ratings.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No ratings recorded. Add a rating to track worker assessment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ratings.map((rating) => {
            const typeInfo = getRatingTypeInfo(rating.rating_type);
            const IconComponent = typeInfo.icon;
            return (
              <Card key={rating.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IconComponent className="h-5 w-5" />
                      {typeInfo.label}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className={`text-xl font-bold ${getRatingColor(rating.rating_value)}`}>
                        {rating.rating_value}/10
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(rating)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(rating.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{typeInfo.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-2">
                    Rated on {format(new Date(rating.created_at), "dd/MM/yyyy")}
                  </div>
                  {rating.notes && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm">{rating.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={showAddDialog || !!editingRating} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingRating(null);
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRating ? "Edit Rating" : "Add New Rating"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="rating_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ratingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rating_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rating (1-10)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          min={1}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                        <div className="text-center text-2xl font-bold">
                          {field.value}/10
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Additional notes about this rating..."
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingRating(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingRating ? "Update" : "Add"} Rating
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};