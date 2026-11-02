"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/admin/fields";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { ApiError, createCollection, updateCollection } from "@/lib/products/api";
import type { Collection } from "@/lib/products/types";

const toHandle = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/** Create (no `collection`) or edit a collection's title, handle and description. */
export function CollectionDrawer({
  open,
  collection,
  onClose,
  onSaved,
}: {
  open: boolean;
  collection?: Collection | null;
  onClose: () => void;
  onSaved: (collection: Collection) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errors, setErrors] = React.useState<{ title?: string; handle?: string }>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  // Reset the draft each time the drawer opens (for a new or a different collection).
  const openKey = open ? collection?._id ?? "new" : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (openKey) {
      setTitle(collection?.title ?? "");
      setHandle(collection?.handle ?? "");
      setDescription(collection?.description ?? "");
      setErrors({});
      setSubmitError(null);
      setSaving(false);
    }
  }

  const save = async () => {
    if (!title.trim()) {
      setErrors({ title: "Title is required." });
      document.getElementById("collection-title")?.focus();
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = { title: title.trim(), handle: toHandle(handle) || undefined, description };
      const saved = collection ? await updateCollection(collection._id, payload) : await createCollection(payload);
      onSaved(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the collection.";
      if (err instanceof ApiError && err.status === 409) setErrors({ handle: message });
      else setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={collection ? "Edit collection" : "Create collection"}
      description="Collections group products for merchandising, e.g. “Summer 2026”."
      onSubmit={save}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
            {saving ? "Saving…" : collection ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && <InlineError message={submitError} />}
        <Field id="collection-title" label="Title" error={errors.title}>
          <TextInput
            id="collection-title"
            value={title}
            error={errors.title}
            placeholder="e.g. Summer 2026"
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((x) => ({ ...x, title: undefined }));
            }}
          />
        </Field>
        <Field
          id="collection-handle"
          label="Handle"
          optional
          error={errors.handle}
          hint={`Used in URLs. ${handle ? `Saved as “${toHandle(handle)}”.` : title ? `Defaults to “${toHandle(title)}”.` : "Generated from the title if blank."}`}
        >
          <TextInput
            id="collection-handle"
            value={handle}
            error={errors.handle}
            placeholder={toHandle(title) || "summer-2026"}
            onChange={(e) => {
              setHandle(e.target.value);
              setErrors((x) => ({ ...x, handle: undefined }));
            }}
          />
        </Field>
        <Field id="collection-description" label="Description" optional>
          <TextArea id="collection-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </SidePanel>
  );
}
