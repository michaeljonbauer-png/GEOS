"use client";

import { useState } from "react";
import { ExternalLink, Pencil, X, Check } from "lucide-react";

interface SourceInfo {
  sourceLabel: string;
  sourceUrl: string | null;
  capturedAt?: string;
}

interface Props {
  companyId: string;
  field: string;
  source?: SourceInfo;
  onSaved?: (updated: SourceInfo) => void;
}

export default function SourceBadge({ companyId, field, source, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(source?.sourceLabel ?? "");
  const [url, setUrl] = useState(source?.sourceUrl ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/sources`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, sourceLabel: label.trim(), sourceUrl: url.trim() || null }),
      });
      if (res.ok) {
        const saved = await res.json();
        onSaved?.({ sourceLabel: saved.sourceLabel, sourceUrl: saved.sourceUrl, capturedAt: saved.capturedAt });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await fetch(`/api/companies/${companyId}/sources?field=${encodeURIComponent(field)}`, {
      method: "DELETE",
    });
    setLabel("");
    setUrl("");
    onSaved?.({ sourceLabel: "", sourceUrl: null });
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 ml-1.5">
        <input
          autoFocus
          placeholder="Source (e.g. PitchBook)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-blue-400"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <input
          placeholder="URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-36 focus:outline-none focus:border-blue-400"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button
          onClick={save}
          disabled={saving || !label.trim()}
          className="text-green-600 hover:text-green-700 disabled:opacity-40"
          title="Save source"
        >
          <Check size={13} />
        </button>
        {source?.sourceLabel && (
          <button onClick={remove} className="text-red-400 hover:text-red-600" title="Remove source">
            <X size={13} />
          </button>
        )}
        <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      </span>
    );
  }

  if (source?.sourceLabel) {
    return (
      <span className="inline-flex items-center gap-0.5 ml-1.5 group">
        {source.sourceUrl ? (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-100 transition-colors"
            title={source.capturedAt ? `Source captured ${new Date(source.capturedAt).toLocaleDateString()}` : undefined}
          >
            {source.sourceLabel}
            <ExternalLink size={9} />
          </a>
        ) : (
          <span
            className="inline-flex items-center text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5"
            title={source.capturedAt ? `Source captured ${new Date(source.capturedAt).toLocaleDateString()}` : undefined}
          >
            {source.sourceLabel}
          </span>
        )}
        <button
          onClick={() => { setLabel(source.sourceLabel); setUrl(source.sourceUrl ?? ""); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity ml-0.5"
          title="Edit source"
        >
          <Pencil size={10} />
        </button>
      </span>
    );
  }

  // No source yet — show a faint "+ source" prompt on hover
  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-0.5 ml-1.5 text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
      title="Add source for this data point"
    >
      + source
    </button>
  );
}
