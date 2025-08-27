import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EventsService, type Event, type CreateEventPayload, type UpdateEventPayload } from "@/services/eventsService";
import { useToast } from "@/hooks/use-toast";

export function useEvents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await EventsService.getEvents();
      if (error) {
        throw new Error(error.message || 'Failed to fetch events');
      }
      return data;
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (payload: CreateEventPayload) => EventsService.createEvent(payload),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to create event",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        toast({
          title: "Success",
          description: "Event created successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEventPayload }) => 
      EventsService.updateEvent(id, payload),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to update event",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => EventsService.deleteEvent(id),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to delete event",
          variant: "destructive",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        toast({
          title: "Success",
          description: "Event deleted successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    createEvent: createEventMutation.mutate,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
}