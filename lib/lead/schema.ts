import { z } from "zod";

/** E.164: + followed by 8-15 digits. */
const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format, e.g. +15551234567");

/** What the hosted lead form / webhook accepts. Consent is mandatory — no consent, no call. */
export const leadIntakeSchema = z.object({
  name: z.string().min(1).max(200),
  phone: e164Phone,
  email: z.string().email().optional(),
  notes: z.string().max(2000).optional(),
  source: z.string().max(100).default("hosted_form"),
  consent: z.literal(true, {
    error: "Consent to be called back is required",
  }),
  /**
   * Business slug this lead is for. Defaulted (not required) so any existing caller — including
   * an external form/CRM webhook that predates multi-tenancy — that omits it still resolves to
   * the seeded "default" tenant, unchanged from single-tenant behavior.
   */
  business: z.string().min(1).max(100).default("default"),
});

export type LeadIntake = z.infer<typeof leadIntakeSchema>;

export const leadOutcomeSchema = z.enum([
  "qualified",
  "not_qualified",
  "callback_requested",
  "no_answer",
  "wrong_number",
  "declined",
]);

export const nextActionSchema = z.enum([
  "book_meeting",
  "send_quote",
  "nurture",
  "drop",
]);

export const leadAnswerSchema = z.object({
  questionId: z.string(),
  value: z.string(),
});

export type LeadAnswer = z.infer<typeof leadAnswerSchema>;

/** The structured result of a call, mapped onto the business's LeadCard shape. */
export const leadCardSchema = z.object({
  outcome: leadOutcomeSchema,
  answers: z.array(leadAnswerSchema),
  score: z.number().min(0).max(100),
  summary: z.string(),
  nextAction: nextActionSchema,
  callId: z.string(),
  durationS: z.number().min(0),
  transcriptRef: z.string().optional(),
});

export type LeadOutcome = z.infer<typeof leadOutcomeSchema>;
export type NextAction = z.infer<typeof nextActionSchema>;
export type LeadCard = z.infer<typeof leadCardSchema>;
