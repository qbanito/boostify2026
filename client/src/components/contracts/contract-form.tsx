import { useState } from "react";
import { logger } from "../../lib/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CONTRACT_TYPES, type ContractType } from "../../lib/openai";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
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

const formSchema = z.object({
  type: z.enum(Object.values(CONTRACT_TYPES) as [ContractType, ...ContractType[]]),
  artistName: z.string().min(2, "Artist name must be at least 2 characters"),
  otherParty: z.string().min(2, "Other party name must be at least 2 characters"),
  terms: z.string().min(10, "Please provide more details about the terms"),
  additionalDetails: z.string().optional(),
});

export type ContractFormValues = z.infer<typeof formSchema>;

interface ContractFormProps {
  onSubmit: (values: ContractFormValues) => void;
  isLoading?: boolean;
}

export function ContractForm({ onSubmit, isLoading }: ContractFormProps) {
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: CONTRACT_TYPES.DISTRIBUTION,
      artistName: "",
      otherParty: "",
      terms: "",
      additionalDetails: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contract Type</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contract type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={CONTRACT_TYPES.DISTRIBUTION}>
                    Distribution Agreement
                  </SelectItem>
                  <SelectItem value={CONTRACT_TYPES.RECORDING}>
                    Recording Contract
                  </SelectItem>
                  <SelectItem value={CONTRACT_TYPES.PERFORMANCE}>
                    Performance Agreement
                  </SelectItem>
                  <SelectItem value={CONTRACT_TYPES.LICENSING}>
                    Licensing Agreement
                  </SelectItem>
                  <SelectItem value={CONTRACT_TYPES.MANAGEMENT}>
                    Management Contract
                  </SelectItem>
                  <SelectItem value={CONTRACT_TYPES.COLLABORATION}>
                    Collaboration Agreement
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="artistName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Artist Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter artist name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="otherParty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Party Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter other party name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contract Terms</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter the main terms and conditions"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Describe the key terms, conditions, and requirements for this contract
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="additionalDetails"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Details (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter any additional details or special clauses"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Generating Contract..." : "Generate Contract"}
        </Button>
      </form>
    </Form>
  );
}
