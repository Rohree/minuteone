"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { BusinessConfig, Question } from "@/lib/config/schema";

const QUESTION_TYPES: Question["type"][] = ["text", "number", "boolean", "single_select"];
const DAYS: BusinessConfig["businessHours"]["days"][number][] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

export function SettingsForm({ initialConfig }: { initialConfig: BusinessConfig }) {
  const router = useRouter();
  const [config, setConfig] = useState<BusinessConfig>(initialConfig);
  const [state, setState] = useState<"idle" | "saving" | "error" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, patch: Partial<Question>) {
    setConfig((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  }

  function addQuestion() {
    if (config.questions.length >= MAX_QUESTIONS) return;
    setConfig((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: `question_${prev.questions.length + 1}`, prompt: "", type: "text", weight: 10 },
      ],
    }));
  }

  function removeQuestion(index: number) {
    if (config.questions.length <= MIN_QUESTIONS) return;
    setConfig((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }));
  }

  function toggleDay(day: (typeof DAYS)[number]) {
    setConfig((prev) => {
      const days = prev.businessHours.days.includes(day)
        ? prev.businessHours.days.filter((d) => d !== day)
        : [...prev.businessHours.days, day];
      return { ...prev, businessHours: { ...prev.businessHours, days } };
    });
  }

  async function handleSubmit() {
    setError(null);
    setState("saving");

    const res = await fetch("/api/dashboard/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (res.ok) {
      setState("saved");
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(body?.error ? JSON.stringify(body.error) : "Something went wrong. Please try again.");
    setState("error");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              value={config.business.name}
              onChange={(e) => setConfig((prev) => ({ ...prev, business: { ...prev.business, name: e.target.value } }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opening-line">Opening line</Label>
            <Textarea
              id="opening-line"
              value={config.business.openingLine}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, business: { ...prev.business, openingLine: e.target.value } }))
              }
              placeholder='Hi, this is Ava calling from Riverside Home Services about the quote request you just submitted — do you have a minute?'
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qualification questions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {config.questions.map((question, index) => (
            <div key={index} className="grid gap-2 rounded-lg border p-3">
              <div className="grid gap-2">
                <Label>Prompt</Label>
                <Textarea
                  value={question.prompt}
                  onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
                  placeholder="What kind of service are you looking for?"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={question.type} onValueChange={(value) => updateQuestion(index, { type: value as Question["type"] })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Weight (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={question.weight}
                    onChange={(e) => updateQuestion(index, { weight: Number(e.target.value) })}
                  />
                </div>
              </div>
              {question.type === "single_select" && (
                <div className="grid gap-2">
                  <Label>Options (comma-separated)</Label>
                  <Input
                    value={(question.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateQuestion(index, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="repair, installation, inspection, other"
                  />
                </div>
              )}
              {(question.type === "single_select" || question.type === "boolean") && (
                <div className="grid gap-2">
                  <Label>Qualifying answers (comma-separated, the ones that count as a positive signal)</Label>
                  <Input
                    value={(question.qualifyingAnswers ?? []).join(", ")}
                    onChange={(e) =>
                      updateQuestion(index, {
                        qualifyingAnswers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder={question.type === "boolean" ? "true" : "repair, installation"}
                  />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                disabled={config.questions.length <= MIN_QUESTIONS}
                onClick={() => removeQuestion(index)}
              >
                Remove question
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" disabled={config.questions.length >= MAX_QUESTIONS} onClick={addQuestion}>
            Add question ({config.questions.length}/{MAX_QUESTIONS})
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business hours &amp; scoring</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="timezone">Timezone (IANA)</Label>
            <Input
              id="timezone"
              value={config.businessHours.timezone}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, businessHours: { ...prev.businessHours, timezone: e.target.value } }))
              }
              placeholder="America/New_York"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={config.businessHours.days.includes(day)}
                  onChange={() => toggleDay(day)}
                />
                {day}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="start">Start (HH:mm)</Label>
              <Input
                id="start"
                value={config.businessHours.start}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, businessHours: { ...prev.businessHours, start: e.target.value } }))
                }
                placeholder="09:00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">End (HH:mm)</Label>
              <Input
                id="end"
                value={config.businessHours.end}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, businessHours: { ...prev.businessHours, end: e.target.value } }))
                }
                placeholder="18:00"
              />
            </div>
          </div>
          <Separator />
          <div className="grid gap-2">
            <Label htmlFor="qualifying-score">Qualifying score (0-100)</Label>
            <Input
              id="qualifying-score"
              type="number"
              min={0}
              max={100}
              value={config.qualifyingScore}
              onChange={(e) => setConfig((prev) => ({ ...prev, qualifyingScore: Number(e.target.value) }))}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {state === "saved" && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </div>
  );
}
