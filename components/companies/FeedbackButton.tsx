"use client";

import { useState } from "react";
import { Flame, ThumbsUp, Eye, ThumbsDown, ChevronDown } from "lucide-react";
import { FEEDBACK_SIGNALS, type FeedbackSignal } from "@/lib/thesis";

interface Props {
  companyId: string;
  currentSignal?: FeedbackSignal | null;
  source?: string;
  onSaved?: (signal: FeedbackSignal) => void;
  compact?: boolean;
}

const ICONS: Record<FeedbackSignal, React.ReactNode> = {
  HIGH_PRIORITY: <Flame size={13} />,
  INTERESTED: <ThumbsUp size={13} />,
  WATCH: <Eye size={13} />,
  PASS: <ThumbsDown size={13} />,
};

export default function FeedbackButton({ companyId, currentSignal, source = "list", onSaved, compact = false }: Props) {
  const [signal, setSignal] = useState<FeedbackSignal | null>(currentSignal ?? null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const current = FEEDBACK_SIGNALS.find((s) => s.value === signal);

  const select = async (value: FeedbackSignal) => {
    setSaving(true);
    setOpen(false);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, signal: value, source }),
      });
      setSignal(value);
      onSaved?.(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 ${
          compact ? "px-2 py-1" : "px-2.5 py-1.5"
        } ${current ? current.color : "border-slate-200 text-slate-400 bg-white hover:bg-slate-50 hover:text-slate-600"}`}
      >
        {current ? (
          <>
            {ICONS[current.value]}
            {!compact && <span>{current.label}</span>}
          </>
        ) : (
          <>
            <ThumbsUp size={13} />
            {!compact && <span>Rate</span>}
          </>
        )}
        <ChevronDown size={11} className="opacity-50" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-1 min-w-[150px]">
            {FEEDBACK_SIGNALS.map((s) => (
              <button
                key={s.value}
                onClick={() => select(s.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors text-left ${
                  signal === s.value ? s.color : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                {ICONS[s.value]}
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
            {signal && (
              <button
                onClick={() => select("PASS")}
                className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 pt-1 pb-0.5"
              >
                Clear rating
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
