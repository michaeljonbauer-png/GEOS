"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { INTERACTION_TYPES, dateInputToISO, toDateInputValue } from "@/lib/utils";

export interface EditableActivity {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  date: string;
  followUpDate: string | null;
  followUpDone?: boolean;
}

export default function EditActivityDialog({
  activity,
  onClose,
  onSaved,
}: {
  activity: EditableActivity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ type: "", direction: "", subject: "", content: "", date: "", followUpDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activity) return;
    setForm({
      type: activity.type,
      direction: activity.direction,
      subject: activity.subject ?? "",
      content: activity.content ?? "",
      date: toDateInputValue(activity.date),
      followUpDate: activity.followUpDate ? toDateInputValue(activity.followUpDate) : "",
    });
  }, [activity]);

  if (!activity) return null;

  const dateChanged = form.date !== toDateInputValue(activity.date);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/interactions/${activity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        direction: form.direction,
        subject: form.subject || null,
        content: form.content || null,
        ...(dateChanged && form.date && { date: dateInputToISO(form.date) }),
        followUpDate: form.followUpDate ? dateInputToISO(form.followUpDate) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Error", description: "Failed to update activity.", variant: "destructive" });
      return;
    }
    toast({ title: "Activity updated" });
    onSaved();
    onClose();
  };

  const remove = async () => {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/interactions/${activity.id}`, { method: "DELETE" });
    toast({ title: "Activity deleted" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit activity</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm((f) => ({ ...f, direction: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">Outbound</SelectItem>
                  <SelectItem value="INBOUND">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Activity date</Label>
            <Input className="mt-1" type="date" max={toDateInputValue(new Date())} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div><Label>Subject</Label><Input className="mt-1" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></div>
          <div><Label>Notes</Label><Textarea className="mt-1" rows={4} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} /></div>
          <div><Label>Follow-up date</Label><Input className="mt-1" type="date" value={form.followUpDate} onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))} /></div>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={remove} className="text-red-600 hover:bg-red-50"><Trash2 size={14} /> Delete</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.date}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
