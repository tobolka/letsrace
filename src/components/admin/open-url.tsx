"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { firstOpenableUrl, openableUrl } from "@/lib/admin/urls";

export { firstOpenableUrl, openableUrl };

export function OpenUrlButton({
  href,
  label = "Open URL",
}: {
  href: string | null | undefined;
  label?: string;
}) {
  const url = openableUrl(href);
  if (!url) {
    return (
      <Button type="button" variant="ghost" size="icon-sm" disabled aria-label={label}>
        <ExternalLink />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" asChild>
          <a href={url} target="_blank" rel="noreferrer" aria-label={label}>
            <ExternalLink />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function UrlInput({
  id,
  value,
  onChange,
  placeholder = "https://…",
  openLabel = "Open URL",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  openLabel?: string;
}) {
  const url = openableUrl(value);

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type="url"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <InputGroupAddon align="inline-end">
        {url ? (
          <InputGroupButton size="icon-xs" asChild>
            <a href={url} target="_blank" rel="noreferrer" aria-label={openLabel}>
              <ExternalLink />
            </a>
          </InputGroupButton>
        ) : (
          <InputGroupButton size="icon-xs" disabled aria-label={openLabel}>
            <ExternalLink />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
