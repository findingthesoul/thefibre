"use client";

import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Reusable copy-to-clipboard button. Used in scheduling list rows to copy
// the public booking URL. Stops click propagation so it can sit inside a
// row-level <Link> without triggering navigation.
export function CopyLinkButton({
  url,
  label = "Copy booking link",
  copiedLabel = "Copied!",
  className,
}: {
  url: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // The url prop may be a path (e.g. "/sjoerd/intro-call") or absolute.
  // We resolve it against window.location.origin at click time so the
  // copied value is always an absolute URL.
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const absolute = url.startsWith("http")
        ? url
        : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
      void navigator.clipboard.writeText(absolute).then(() => {
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 1500);
      });
    },
    [url],
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={handleClick}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className={className}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

// Icon button to open the public booking page in a new tab. Rendered
// as a <button> (not <a>) because it sits inside a row-level <Link>,
// and nested anchors are invalid HTML. Stops click propagation so the
// row-level navigation doesn't fire. Mirrors CopyLinkButton — same
// ghost-icon button shape, lucide icon, so the two read as a pair.
export function OpenBookingLink({
  href,
  label = "Open booking page",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  // Resolve path-style hrefs against window.location.origin at click time
  // so that callers can pass either "/sjoerd/intro" or an absolute URL.
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const absolute = href.startsWith("http")
          ? href
          : `${window.location.origin}${href.startsWith("/") ? href : `/${href}`}`;
        window.open(absolute, "_blank", "noopener,noreferrer");
      }}
      aria-label={label}
      title={label}
      className={className}
    >
      <ExternalLink className="h-4 w-4" />
    </Button>
  );
}
