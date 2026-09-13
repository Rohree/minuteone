"use client";

import { useSyncExternalStore } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "./copy-button";

function subscribeNever() {
  return () => {};
}

/** window.location.origin never changes during the component's life, so no subscription is needed. */
function useOrigin(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => null,
  );
}

/** Builds the URL from the browser's own origin so it's correct in both local dev and deployed. */
export function EmbedSnippet({ slug }: { slug: string }) {
  const origin = useOrigin();
  const formUrl = origin ? `${origin}/f/${slug}` : `/f/${slug}`;
  const iframeSnippet = `<iframe src="${formUrl}" width="100%" height="640" style="border:0"></iframe>`;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shareable link</CardTitle>
          <CardDescription>Send this directly, or link to it from anywhere on your site.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted px-2.5 py-1.5 text-sm">{formUrl}</code>
          <CopyButton text={formUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embed on your site</CardTitle>
          <CardDescription>Paste this wherever you want the form to appear.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-start gap-2">
          <pre className="flex-1 overflow-x-auto rounded-md border bg-muted px-2.5 py-1.5 text-sm">
            <code>{iframeSnippet}</code>
          </pre>
          <CopyButton text={iframeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}
