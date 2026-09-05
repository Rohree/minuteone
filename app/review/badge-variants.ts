type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "done":
      return "default";
    case "in_progress":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline"; // pending
  }
}

export function outcomeVariant(outcome: string): BadgeVariant {
  switch (outcome) {
    case "qualified":
      return "default";
    case "callback_requested":
      return "secondary";
    case "not_qualified":
      return "outline";
    default:
      return "destructive"; // no_answer, wrong_number, declined
  }
}
