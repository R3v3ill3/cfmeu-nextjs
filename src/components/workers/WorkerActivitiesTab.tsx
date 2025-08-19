import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, MapPin, Users, Edit, Trash2, Star } from "lucide-react";
import { format } from "date-fns";

const activitySchema = z.object({
  activity_type: z.enum(["meeting", "training", "action", "strike", "conversation"]),
  job_site_id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  topic: z.string().optional(),
  notes: z.string().optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface WorkerActivitiesTabProps {
  workerId: string | null;
  onUpdate: () => void;
}

const activityTypes = [
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "training", label: "Training", icon: Users },
  { value: "action", label: "Action", icon: Users },
  { value: "strike", label: "Strike", icon: Users },
  { value: "conversation", label: "Conversation", icon: Users },
];

// New rating scale labels: 1=Supporter Activist, 5=Opposed Activist
const ratingLabels = {
  1: { label: "Supporter Activist", color: "bg-green-600", description: "Actively promotes union activities" },
  2: { label: "Supporter", color: "bg-green-400", description: "Supports union activities" },
  3: { label: "Undecided", color: "bg-yellow-500", description: "Neutral stance" },
  4: { label: "Opposed", color: "bg-red-400", description: "Against activities but not actively opposing" },
  5: { label: "Opposed Activist", color: "bg-red-600", description: "Actively works against union activities" },
};

export const WorkerActivitiesTab = ({ workerId, onUpdate }: WorkerActivitiesTabProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all union activities with worker's ratings
  const { data: activitiesWithRatings = [], isLoading } = useQuery({
    queryKey: ["worker-activities-ratings", workerId],
    queryFn: async () => {
      if (!workerId) return [];
      
      // Get all union activities
      const { data: activities, error: activitiesError } = await supabase
        .from("union_activities")
        .select(`
          *,
          job_sites (
            id,
            name,
            location
          )
        `)
        .order("date", { ascending: false });

      if (activitiesError) throw activitiesError;

      // Get all ratings for this worker
      const { data: ratings, error: ratingsError } = await supabase
        .from("worker_activity_ratings")
        .select("*")
        .eq("worker_id", workerId)
        .eq("rating_type", "activity_participation");

      if (ratingsError) throw ratingsError;

      // Combine activities with their ratings
      const activitiesWithRatings = activities.map(activity => {
        const rating = ratings.find(r => r.activity_id === activity.id);
        return {
          ...activity,
          rating: rating ? {
            id: rating.id,
            value: rating.rating_value,
            notes: rating.notes,
            created_at: rating.created_at
          } : null
        };
      });

      return activitiesWithRatings;
    },
    enabled: !!workerId,
  });

  const { data: jobSites = [] } = useQuery({
    queryKey: ["job-sites-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      activity_type: "meeting",
      job_site_id: "",
      date: "",
      topic: "",
      notes: "",
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      const { data: newActivity, error } = await supabase
        .from("union_activities")
        .insert({
          activity_type: data.activity_type,
          job_site_id: data.job_site_id || null,
          date: data.date,
          topic: data.topic || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newActivity;
    },
    onSuccess: () => {
      toast({
        title: "Activity created",
        description: "New union activity has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-activities-ratings", workerId] });
      setShowAddDialog(false);
      form.reset();
      onUpdate();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create activity. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rateActivityMutation = useMutation({
    mutationFn: async ({ activityId, rating, notes }: { activityId: string; rating: number; notes?: string }) => {
      // Check if rating already exists
      const { data: existing } = await supabase
        .from("worker_activity_ratings")
        .select("id")
        .eq("worker_id", workerId)
        .eq("activity_id", activityId)
        .eq("rating_type", "activity_participation")
        .single();

      if (existing) {
        // Update existing rating
        const { error } = await supabase
          .from("worker_activity_ratings")
          .update({
            rating_value: rating,
            notes: notes || null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Create new rating
        const { error } = await supabase
          .from("worker_activity_ratings")
          .insert({
            worker_id: workerId,
            activity_id: activityId,
            rating_type: "activity_participation",
            rating_value: rating,
            notes: notes || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Rating updated",
        description: "Worker's activity rating has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-activities-ratings", workerId] });
      onUpdate();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      const { error } = await supabase
        .from("worker_activity_ratings")
        .delete()
        .eq("id", ratingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Rating removed",
        description: "Worker's activity rating has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-activities-ratings", workerId] });
      onUpdate();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ActivityFormData) => {
    createActivityMutation.mutate(data);
  };

  const getActivityTypeIcon = (type: string) => {
    const activityType = activityTypes.find(t => t.value === type);
    return activityType ? activityType.icon : Users;
  };

  const getActivityTypeLabel = (type: string) => {
    return activityTypes.find(t => t.value === type)?.label || type;
  };

  const getRatingBadge = (rating: any) => {
    if (!rating || rating.value === null) {
      return <Badge variant="secondary">Unassessed</Badge>;
    }
    const ratingInfo = ratingLabels[rating.value as keyof typeof ratingLabels];
    return (
      <Badge 
        className={`text-white ${ratingInfo.color}`}
        title={ratingInfo.description}
      >
        {ratingInfo.label}
      </Badge>
    );
  };

  const handleQuickRating = (activityId: string, rating: number) => {
    rateActivityMutation.mutate({ activityId, rating });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Union Activities & Ratings</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Rate each worker on their stance toward union activities: 1=Supporter Activist, 3=Undecided, 5=Opposed Activist
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading activities...</div>
      ) : activitiesWithRatings.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No activities found. Create activities to start rating worker participation.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activitiesWithRatings.map((activity) => {
            const IconComponent = getActivityTypeIcon(activity.activity_type);
            return (
              <Card key={activity.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IconComponent className="h-5 w-5" />
                      {getActivityTypeLabel(activity.activity_type)}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getRatingBadge(activity.rating)}
                    </div>
                  </div>
                  {activity.topic && (
                    <p className="text-sm text-muted-foreground mt-1">{activity.topic}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(activity.date), "MMM dd, yyyy")}</span>
                    </div>
                    {activity.job_sites && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{activity.job_sites.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Rating Buttons */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Rate this worker's stance:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ratingLabels).map(([value, info]) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={activity.rating?.value === parseInt(value) ? "default" : "outline"}
                          className={activity.rating?.value === parseInt(value) ? `text-white ${info.color}` : ""}
                          onClick={() => handleQuickRating(activity.id, parseInt(value))}
                          title={info.description}
                        >
                          {value}. {info.label}
                        </Button>
                      ))}
                    </div>
                    
                    {activity.rating && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRatingMutation.mutate(activity.rating.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove Rating
                        </Button>
                        {activity.rating.created_at && (
                          <span className="text-xs text-muted-foreground">
                            Rated {format(new Date(activity.rating.created_at), "MMM dd, yyyy")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {activity.notes && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Activity Notes:</p>
                      <p className="text-sm">{activity.notes}</p>
                    </div>
                  )}

                  {activity.rating?.notes && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                      <p className="text-sm font-medium mb-1">Rating Notes:</p>
                      <p className="text-sm">{activity.rating.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Activity Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Union Activity</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="activity_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activityTypes.map((type) => (
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
                name="job_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Site (Optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific site</SelectItem>
                        {jobSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name} - {site.location}
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Safety meeting, wage negotiations" />
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
                        placeholder="Additional notes about the activity..."
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
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createActivityMutation.isPending}
                >
                  Create Activity
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};