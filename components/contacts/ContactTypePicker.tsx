"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, tagColor } from "@/lib/utils";

export function TypeBubble({ label, onRemove, small }: { label: string; onRemove?: () => void; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        tagColor(label)
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-60 hover:opacity-100"
          aria-label={`Remove ${label}`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Airtable-style multi-select: click to open, tick options on/off, or type
// to filter and create a new tag.
export default function ContactTypePicker({
  value,
  options,
  onChange,
  placeholder = "Add type",
  small,
  className,
}: {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  small?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);
  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...options, ...value].filter((o) => {
      const k = o.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [options, value]);

  const q = query.trim();
  const filtered = allOptions.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.length > 0 && !allOptions.some((o) => o.toLowerCase() === q.toLowerCase());

  const toggle = (label: string) => {
    onChange(
      selected.has(label.toLowerCase())
        ? value.filter((v) => v.toLowerCase() !== label.toLowerCase())
        : [...value, label]
    );
  };

  const create = () => {
    if (!canCreate) return;
    onChange([...value, q]);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group flex flex-wrap items-center gap-1 rounded-md text-left min-h-[26px] -mx-1 px-1 py-0.5 hover:bg-slate-100 transition-colors",
            className
          )}
          title="Edit contact types"
        >
          {value.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-300 group-hover:text-slate-500">
              <Plus size={12} /> {placeholder}
            </span>
          ) : (
            value.map((v) => <TypeBubble key={v} label={v} small={small} />)
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent onClick={(e) => e.stopPropagation()}>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1 pb-2 mb-2 border-b border-slate-100">
            {value.map((v) => <TypeBubble key={v} label={v} small onRemove={() => toggle(v)} />)}
          </div>
        )}
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canCreate) create();
              else if (filtered.length === 1) toggle(filtered[0]);
            }
          }}
          placeholder="Find or create a type…"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-300"
        />
        <div className="mt-1.5 max-h-60 overflow-y-auto">
          {filtered.map((o) => {
            const isOn = selected.has(o.toLowerCase());
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
              >
                <TypeBubble label={o} small />
                {isOn && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            );
          })}
          {canCreate && (
            <button
              type="button"
              onClick={create}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Plus size={14} /> Create <TypeBubble label={q} small />
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-2 py-2 text-xs text-slate-400">No types</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
