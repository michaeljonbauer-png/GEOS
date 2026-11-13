"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, X, Send, RotateCcw, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ProposalState = "pending" | "saving" | "done" | "cancelled" | "error";
type Proposal = {
  id: string; type: string; title: string;
  details: { label: string; value: string }[]; warnings: string[];
  payload: Record<string, unknown>;
  state?: ProposalState; resultUrl?: string; resultText?: string;
};
type Turn = {
  role: "user" | "assistant"; content: string; toolsUsed?: string[]; error?: boolean;
  proposals?: Proposal[];
  // A note recording a confirmed/cancelled change; shown small, still sent as context.
  note?: boolean;
};

const STORAGE_KEY = "geos.assistant.history";
export const OPEN_ASSISTANT_EVENT = "geos:open-assistant";

const TOOL_LABELS: Record<string, string> = {
  search_companies: "companies",
  get_company: "company details",
  search_contacts: "contacts",
  list_activity: "activity",
  pipeline_overview: "pipeline",
  portfolio_overview: "portfolio",
  lp_overview: "LPs",
  get_thesis_and_preferences: "thesis",
  add_company: "drafted a change",
  add_contact: "drafted a change",
  update_company: "drafted a change",
  update_contact: "drafted a change",
  log_activity: "drafted a change",
  add_note: "drafted a change",
};

const SUGGESTIONS = [
  "Summarize my pipeline and flag anything that's gone quiet",
  "Which follow-ups are overdue?",
  "Prospective LPs I have a warm or strong relationship with",
  "Top-scored companies I haven't reached out to yet",
  "What's the latest on my live deals?",
];

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTurns(JSON.parse(saved));
    } catch { /* storage unavailable */ }
    setRestored(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    // Saving before the stored chat is restored would overwrite it with [].
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-40))); } catch { /* storage unavailable */ }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, restored]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((t) => !t.error).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setTurns((t) => [...t, {
        role: "assistant", content: data.reply, toolsUsed: data.toolsUsed,
        proposals: (data.proposals ?? []).map((p: Proposal) => ({ ...p, state: "pending" as const })),
      }]);
    } catch (err) {
      setTurns((t) => [...t, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const closeOnMobile = () => { if (window.innerWidth < 1024) setOpen(false); };

  const patchProposal = (turnIdx: number, id: string, patch: Partial<Proposal>) =>
    setTurns((all) => all.map((t, i) => (i !== turnIdx ? t : { ...t, proposals: t.proposals?.map((p) => (p.id === id ? { ...p, ...patch } : p)) })));

  const confirmProposal = async (turnIdx: number, p: Proposal) => {
    patchProposal(turnIdx, p.id, { state: "saving" });
    try {
      const res = await fetch("/api/assistant/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: p.type, payload: p.payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      patchProposal(turnIdx, p.id, { state: "done", resultUrl: data.url, resultText: data.summary });
      setTurns((all) => [...all, { role: "assistant", note: true, content: `✓ Confirmed and saved: ${data.url ? `[${data.summary}](${data.url})` : data.summary}` }]);
    } catch (err) {
      patchProposal(turnIdx, p.id, { state: "error", resultText: err instanceof Error ? err.message : "Couldn't save" });
    }
  };

  const cancelProposal = (turnIdx: number, p: Proposal) => {
    patchProposal(turnIdx, p.id, { state: "cancelled" });
    setTurns((all) => [...all, { role: "assistant", note: true, content: `✗ Cancelled by user: ${p.title}` }]);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-slate-800 transition-colors"
          aria-label="Ask GEOS"
        >
          <Sparkles size={16} className="text-violet-300" /> Ask GEOS
        </button>
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 sm:w-[440px]",
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100"><Sparkles size={15} className="text-violet-600" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Ask GEOS</p>
              <p className="text-[11px] text-slate-400">Ask questions or have it add and update records</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {turns.length > 0 && (
              <button onClick={() => setTurns([])} disabled={busy} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="New chat">
                <RotateCcw size={15} />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X size={17} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Ask anything about your GEOS data — or general deal questions. Try:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          {turns.map((t, i) =>
            t.note ? (
              <p key={i} className="text-[11px] text-slate-400">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <>{children}</>,
                    a: ({ href, children }) => <Link href={href ?? "#"} onClick={closeOnMobile} className="text-slate-500 underline">{children}</Link>,
                  }}
                >
                  {t.content}
                </ReactMarkdown>
              </p>
            ) : t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-slate-900 px-3.5 py-2 text-sm text-white">{t.content}</div>
              </div>
            ) : (
              <div key={i} className="max-w-full">
                {t.error ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{t.content}</p>
                ) : (
                  <div className="assistant-md text-sm leading-relaxed text-slate-800">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) =>
                          href?.startsWith("/") ? (
                            <Link href={href} onClick={closeOnMobile} className="font-medium text-blue-600 hover:underline">{children}</Link>
                          ) : (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>
                          ),
                        table: ({ children }) => (
                          <div className="my-2 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs">{children}</table></div>
                        ),
                        th: ({ children }) => <th className="bg-slate-50 px-2 py-1.5 text-left font-medium text-slate-600 whitespace-nowrap">{children}</th>,
                        td: ({ children }) => <td className="border-t border-slate-100 px-2 py-1.5 align-top">{children}</td>,
                        ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
                        ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
                        p: ({ children }) => <p className="my-1.5">{children}</p>,
                        h1: ({ children }) => <p className="mt-3 mb-1 font-semibold text-slate-900">{children}</p>,
                        h2: ({ children }) => <p className="mt-3 mb-1 font-semibold text-slate-900">{children}</p>,
                        h3: ({ children }) => <p className="mt-2 mb-1 font-semibold text-slate-900">{children}</p>,
                        code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">{children}</code>,
                      }}
                    >
                      {t.content}
                    </ReactMarkdown>
                  </div>
                )}
                {t.proposals && t.proposals.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {t.proposals.filter((p) => p.state === "pending").length > 1 && (
                      <button
                        onClick={() => t.proposals!.filter((p) => p.state === "pending").forEach((p) => confirmProposal(i, p))}
                        className="text-xs font-medium text-violet-700 hover:underline"
                      >
                        Confirm all ({t.proposals.filter((p) => p.state === "pending").length})
                      </button>
                    )}
                    {t.proposals.map((p) => (
                      <div key={p.id} className={cn(
                        "rounded-xl border p-3",
                        p.state === "done" ? "border-emerald-200 bg-emerald-50" : p.state === "cancelled" ? "border-slate-200 bg-slate-50 opacity-70" : p.state === "error" ? "border-red-200 bg-red-50" : "border-violet-200 bg-violet-50/50"
                      )}>
                        <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                        <dl className="mt-1.5 space-y-0.5">
                          {p.details.map((d) => (
                            <div key={d.label} className="flex gap-2 text-xs">
                              <dt className="w-24 shrink-0 text-slate-500">{d.label}</dt>
                              <dd className="min-w-0 break-words text-slate-800">{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                        {p.warnings.map((w) => (
                          <p key={w} className="mt-1.5 flex items-start gap-1 text-xs text-amber-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</p>
                        ))}
                        <div className="mt-2.5 flex items-center gap-2">
                          {(p.state === "pending" || p.state === "error") && (
                            <>
                              <button onClick={() => confirmProposal(i, p)} className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700">
                                <Check size={13} /> {p.state === "error" ? "Retry" : "Confirm"}
                              </button>
                              <button onClick={() => cancelProposal(i, p)} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-white">Cancel</button>
                            </>
                          )}
                          {p.state === "saving" && <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Saving{p.type === "add_company" && p.payload.research ? " — researching the company, ~30s" : "…"}</span>}
                          {p.state === "done" && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                              <Check size={13} /> {p.resultText}
                              {p.resultUrl && <Link href={p.resultUrl} onClick={closeOnMobile} className="flex items-center gap-0.5 text-emerald-800 underline">View <ArrowRight size={11} /></Link>}
                            </span>
                          )}
                          {p.state === "cancelled" && <span className="text-xs text-slate-400">Cancelled</span>}
                          {p.state === "error" && <span className="text-xs text-red-600">{p.resultText}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {t.toolsUsed && t.toolsUsed.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Looked up: {Array.from(new Set(t.toolsUsed.map((n) => TOOL_LABELS[n] ?? n))).join(", ")}
                  </p>
                )}
              </div>
            )
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Looking through your data…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="border-t border-slate-100 p-3"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-violet-300">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              rows={Math.min(5, Math.max(1, input.split("\n").length))}
              placeholder="Ask a question, or say “add this contact…”"
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-40" aria-label="Send">
              <Send size={14} />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Changes are only saved after you click Confirm.</p>
        </form>
      </aside>
    </>
  );
}
