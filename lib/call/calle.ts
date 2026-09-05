import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallConnectionStatus, CallProvider, CallResult, PlaceCallInput } from "./provider";

/**
 * CALL-E has no REST/SDK surface for this — `calle mcp config` shows it's an OAuth-protected
 * MCP server. `calle auth login` caches a long-lived bearer access token (~1000-day TTL) at
 * ~/.calle-mcp/cli/<hash>/token.json; its `token.access_token` value is what CALLE_API_KEY holds.
 */
const MCP_SERVER_URL = "https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth";

/** Hard ceiling so one stuck call can't block the poller from processing the rest of its batch. */
const MAX_POLL_MS = 3 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 5000;

/** Statuses documented by CALL-E as terminal; anything else keeps polling. */
const TERMINAL_STATUSES = new Set(["COMPLETED", "NO ANSWER", "DECLINED", "FAILED"]);

/** next_step.action values that mean "nothing more we can do without a human" — treat as terminal. */
const BLOCKED_ACTIONS = new Set([
  "ask_user_for_missing_info",
  "ask_user_for_retry_confirmation",
  "plan_call_same_plan_id",
  "report_blocked",
]);

interface PlanCallOutput {
  plan_id: string;
  ready_to_run: boolean;
  next_step: string;
  clarifying_questions?: string[];
  confirm_token: string | null;
  confirm_summary: string;
}

interface RunOutcome {
  task_completed: boolean;
  completion_confidence?: { score: number; label: string };
  evidence?: string[];
}

interface RunResultPayload {
  summary?: string | null;
  post_summary?: string | null;
  outcome?: RunOutcome | null;
  extracted?: Record<string, unknown>;
  transcript?: string | null;
  call_id?: string | null;
  call_ids?: string[];
}

interface NextStep {
  action: string;
  instruction: string;
  poll_after_seconds?: number | null;
}

interface CallRunOutput {
  run_id: string;
  status: string;
  message?: string | null;
  result?: RunResultPayload;
  activity?: { ts: string }[];
  next_cursor?: string | null;
  next_step?: NextStep | null;
}

/**
 * Real CALL-E provider: an MCP client wrapping plan_call -> run_call -> poll(get_call_run).
 * There's no `resultSchema` parameter on the real API (unlike this interface's shape, kept for
 * fake.ts's benefit) — the expected field keys are instead spelled out in the goal text itself
 * by task-builder.ts, and `extracted` is read back defensively (no schema enforcement).
 */
export class CalleCallProvider implements CallProvider {
  private client: Promise<Client> | null = null;

  async placeCall(input: PlaceCallInput): Promise<CallResult> {
    const client = await this.getClient();

    const plan = await callTool<PlanCallOutput>(client, "plan_call", {
      to_phones: [input.phone],
      goal: input.task,
    });

    if (!plan.ready_to_run || !plan.confirm_token) {
      return {
        connectionStatus: "failed",
        structuredResult: null,
        evidence:
          plan.clarifying_questions && plan.clarifying_questions.length > 0
            ? plan.clarifying_questions
            : [plan.next_step],
        callId: plan.plan_id,
        durationS: 0,
      };
    }

    const run = await callTool<CallRunOutput>(client, "run_call", {
      plan_id: plan.plan_id,
      confirm_token: plan.confirm_token,
    });

    return this.pollUntilDone(client, run.run_id);
  }

  private async pollUntilDone(client: Client, runId: string): Promise<CallResult> {
    const deadline = Date.now() + MAX_POLL_MS;
    let cursor: string | undefined;
    let latest: CallRunOutput | null = null;

    while (Date.now() < deadline) {
      const run = await callTool<CallRunOutput>(client, "get_call_run", {
        run_id: runId,
        ...(cursor ? { cursor } : {}),
      });
      latest = run;
      cursor = run.next_cursor ?? cursor;

      if (isTerminal(run)) return mapRunToCallResult(run);

      const waitMs = run.next_step?.poll_after_seconds
        ? run.next_step.poll_after_seconds * 1000
        : DEFAULT_POLL_INTERVAL_MS;
      await sleep(Math.min(waitMs, MAX_POLL_INTERVAL_MS));
    }

    return {
      connectionStatus: "failed",
      structuredResult: null,
      evidence: [
        `Timed out after ${MAX_POLL_MS / 1000}s waiting for CALL-E run ${runId} to finish` +
          (latest ? ` (last status: ${latest.status}).` : "."),
      ],
      callId: runId,
      durationS: 0,
    };
  }

  private async getClient(): Promise<Client> {
    if (!this.client) this.client = this.connect();
    return this.client;
  }

  private async connect(): Promise<Client> {
    const apiKey = process.env.CALLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "CALLE_API_KEY is not set — required to place real CALL-E calls. See .env.example.",
      );
    }

    const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
      requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
    });
    const client = new Client({ name: "minuteone", version: "0.1.0" });
    await client.connect(transport);
    return client;
  }
}

function isTerminal(run: CallRunOutput): boolean {
  if (run.next_step) {
    if (run.next_step.action === "report_result") return true;
    if (BLOCKED_ACTIONS.has(run.next_step.action)) return true;
    return false;
  }
  return TERMINAL_STATUSES.has(run.status);
}

function mapRunToCallResult(run: CallRunOutput): CallResult {
  if (run.next_step && BLOCKED_ACTIONS.has(run.next_step.action)) {
    return {
      connectionStatus: "failed",
      structuredResult: null,
      evidence: [run.next_step.instruction],
      callId: run.result?.call_id ?? run.run_id,
      durationS: durationFromActivity(run.activity),
    };
  }

  const connectionStatus = mapStatus(run.status);
  const evidence =
    run.result?.outcome?.evidence && run.result.outcome.evidence.length > 0
      ? run.result.outcome.evidence
      : [run.result?.summary ?? run.message ?? `CALL-E run ended with status ${run.status}.`];

  return {
    connectionStatus,
    structuredResult: connectionStatus === "completed" ? (run.result?.extracted ?? {}) : null,
    evidence,
    callId: run.result?.call_id ?? run.run_id,
    durationS: durationFromActivity(run.activity),
    transcriptRef: run.result?.transcript ?? undefined,
  };
}

function mapStatus(status: string): CallConnectionStatus {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "NO ANSWER":
      return "no_answer";
    case "DECLINED":
      return "declined";
    case "FAILED":
      return "failed";
    default:
      return "failed";
  }
}

function durationFromActivity(activity?: { ts: string }[]): number {
  if (!activity || activity.length < 2) return 0;
  const first = Date.parse(activity[0].ts);
  const last = Date.parse(activity[activity.length - 1].ts);
  if (Number.isNaN(first) || Number.isNaN(last) || last <= first) return 0;
  return Math.round((last - first) / 1000);
}

async function callTool<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await client.callTool({ name, arguments: args });

  if (result.isError) {
    const text = extractText(result.content);
    throw new Error(`CALL-E tool "${name}" failed: ${text ?? "unknown error"}`);
  }

  if (result.structuredContent) return result.structuredContent as T;

  const text = extractText(result.content);
  if (text) return JSON.parse(text) as T;

  throw new Error(`CALL-E tool "${name}" returned no structured content or text.`);
}

function extractText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const block = content.find(
    (item): item is { type: "text"; text: string } =>
      typeof item === "object" && item !== null && (item as { type?: unknown }).type === "text",
  );
  return block?.text ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
