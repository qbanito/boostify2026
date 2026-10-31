import { z } from 'zod';
import type { ArtistProfileAgentAction } from './artist-profile-agent';

export const profileTextFieldSchema = z.enum(['biography', 'displayName', 'genre', 'location']);
export type ProfileTextField = z.infer<typeof profileTextFieldSchema>;
export type ProfileTextChanges = Partial<Record<ProfileTextField, string>>;
export const copilotTextChangesSchema = z.object({
  biography: z.string().trim().min(1).max(12000).optional(),
  displayName: z.string().trim().min(1).max(160).optional(),
  genre: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().min(1).max(200).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one text field.');

export type CopilotUiCommand = ArtistProfileAgentAction
  | { type: 'inspect_interface'; moduleId: string }
  | { type: 'select_view'; moduleId: string; controlId: string }
  | { type: 'inspect_field_options'; moduleId: string; fieldId: string }
  | { type: 'fill_fields'; moduleId: string; fields: Array<{ fieldId: string; value: string }> }
  | { type: 'preview_profile_text'; changes: ProfileTextChanges }
  | { type: 'profile_text_saved'; changes: ProfileTextChanges };

export const copilotUiResultSchema = z.object({
  success: z.boolean(),
  error: z.string().max(1000).optional(),
  moduleId: z.string().max(100).optional(),
  saved: z.boolean().optional(),
  fields: z.array(z.object({
    id: z.string().max(150),
    label: z.string().max(180),
    kind: z.string().max(40),
    value: z.string().max(12000),
    disabled: z.boolean(),
    maxLength: z.number().optional(),
    options: z.array(z.object({ value: z.string().max(500), label: z.string().max(500) })).max(100).optional(),
  })).max(50).optional(),
  views: z.array(z.object({ id: z.string().max(150), label: z.string().max(180), selected: z.boolean() })).max(30).optional(),
  modules: z.array(z.object({
    id: z.string().max(100), name: z.string().max(100), surface: z.enum(['section', 'widget']),
    visible: z.boolean(), expanded: z.boolean(), column: z.enum(['left', 'right']),
  })).max(100).optional(),
  applied: z.array(z.string().max(180)).max(50).optional(),
});
export type CopilotUiResult = z.infer<typeof copilotUiResultSchema>;

export type CopilotStreamEvent =
  | { type: 'session'; runId: string }
  | { type: 'progress'; message: string; target?: string }
  | { type: 'ui_command'; requestId: string; command: CopilotUiCommand }
  | { type: 'result'; response: string; actions: ArtistProfileAgentAction[]; actionsHandled: boolean }
  | { type: 'error'; message: string }
  | { type: 'heartbeat' };

export interface CopilotRuntime {
  requestUi: (command: CopilotUiCommand) => Promise<CopilotUiResult>;
  progress: (message: string, target?: string) => void;
  signal: AbortSignal;
}
