import { useState } from "react";
import { logger } from "../../lib/logger";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().min(10, "Please provide a detailed description"),
  platform: z.string().min(1, "Platform is required"),
  budget: z.number().min(0, "Budget must be a positive number"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

interface CampaignFormProps {
  onSuccess?: () => void;
}

export function CampaignForm({ onSuccess }: CampaignFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      description: "",
      platform: "",
      budget: 0,
      startDate: "",
      endDate: "",
    },
  });

  const getAISuggestion = async (campaignData: Partial<CampaignFormValues>) => {
    try {
      const response = await fetch("/api/ai/campaign-suggestion", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(campaignData),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setAiSuggestion(data.suggestion);
    } catch (error) {
      logger.error("Error getting AI suggestion:", error);
      toast({
        title: "Error",
        description: "Failed to get AI suggestions",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: CampaignFormValues) => {
    try {
      setIsLoading(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }

      logger.info('Attempting to save campaign:', { ...data, userId: user.uid });

      // Reference to the campaigns collection
      const campaignsRef = collection(db, "campaigns");

      // Add the document to Firestore
      const docRef = await addDoc(campaignsRef, {
        ...data,
        userId: user.uid,
        status: 'active',
        createdAt: serverTimestamp(),
        aiSuggestion: aiSuggestion || null
      });

      logger.info('Campaign saved with ID:', docRef.id);

      toast({
        title: "Success",
        description: "Campaign created successfully",
      });

      if (onSuccess) {
        onSuccess();
      }

      form.reset();
    } catch (error: any) {
      logger.error("Error creating campaign:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormDescription>
                Describe your campaign goals and target audience
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="spotify">Spotify</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="multiple">Multiple Platforms</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="budget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Budget ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {aiSuggestion && (
          <div className="p-4 bg-orange-500/10 rounded-lg">
            <h4 className="font-semibold mb-2">AI Suggestion</h4>
            <p className="text-sm text-muted-foreground">{aiSuggestion}</p>
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => getAISuggestion(form.getValues())}
          >
            Get AI Suggestions
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Campaign"}
          </Button>
        </div>
      </form>
    </Form>
  );
}