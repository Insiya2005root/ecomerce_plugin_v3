"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudUploadIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { downloadText, parseCsvObjects } from "@/lib/csv";
import { importProducts } from "@/lib/products/api";
import { productsCsvTemplate } from "@/lib/products/csv";
import type { ImportResponse } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Stage =
  | { step: "choose" }
  | { step: "checking"; fileName: string }
  | { step: "preview"; fileName: string; rows: Record<string, string>[]; plan: ImportResponse }
  | { step: "importing"; fileName: string }
  | { step: "done"; result: ImportResponse };

const ACTION_STYLE = {
  create: "text-emerald-700 dark:text-emerald-400",
  update: "text-sky-700 dark:text-sky-400",
  error: "text-destructive",
} as const;

/** CSV import with a server-side dry run first, so nothing is written until the merchant confirms. */
export function ProductImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportResponse) => void;
}) {
  const [stage, setStage] = React.useState<Stage>({ step: "choose" });
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setStage({ step: "choose" });
    setError(null);
  };

  const close = () => {
    if (stage.step === "checking" || stage.step === "importing") return;
    onOpenChange(false);
    reset();
  };

  const check = async (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("Choose a .csv file.");
      return;
    }
    setStage({ step: "checking", fileName: file.name });
    try {
      const { headers, rows } = parseCsvObjects(await file.text());
      if (!headers.some((h) => /^(name|title|sku)$/i.test(h))) throw new Error("The first row must be a header row with at least a Name or SKU column.");
      if (rows.length === 0) throw new Error("The file has a header but no product rows.");
      const plan = await importProducts(rows, true);
      setStage({ step: "preview", fileName: file.name, rows, plan });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the file.");
      setStage({ step: "choose" });
    }
  };

  const commit = async () => {
    if (stage.step !== "preview") return;
    setStage({ step: "importing", fileName: stage.fileName });
    try {
      const result = await importProducts(stage.rows, false);
      setStage({ step: "done", result });
      onImported(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setStage(stage);
    }
  };

  const plan = stage.step === "preview" ? stage.plan : stage.step === "done" ? stage.result : null;
  const writable = plan ? plan.summary.create + plan.summary.update : 0;

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title="Import products"
      description="Create or update products from a CSV file. Rows are matched to existing products by SKU."
      wide
      onSubmit={commit}
      footer={
        stage.step === "done" ? (
          <Button type="button" size="sm" className="rounded-md" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={close} disabled={stage.step === "checking" || stage.step === "importing"}>
              Cancel
            </Button>
            {(stage.step === "preview" || stage.step === "importing") && (
              <Button type="submit" size="sm" className="rounded-md" disabled={stage.step === "importing" || writable === 0}>
                {stage.step === "importing" ? "Importing…" : `Import ${writable} product${writable === 1 ? "" : "s"}`}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}

        {(stage.step === "choose" || stage.step === "checking") && (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) check(file);
              }}
              className="flex flex-col items-center gap-1.5 rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center"
            >
              <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={1.75} className="size-5 text-muted-foreground" />
              {stage.step === "checking" ? (
                <p className="text-[13px]">Checking {stage.fileName}…</p>
              ) : (
                <p className="text-[13px]">
                  Drop a CSV file here, or{" "}
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => inputRef.current?.click()}>
                    browse
                  </button>
                </p>
              )}
              <p className="text-xs text-muted-foreground">Up to 1,000 products per file. Nothing is saved until you confirm.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) check(file);
                }}
              />
            </div>
            <div className="space-y-1.5 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How the file is read</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Use the same columns as Export. New products need Name, Price and Category.</li>
                <li>Category is a name or a full path such as “Apparel &gt; Shirts”; Collection is a title or handle.</li>
                <li>Separate multiple tags or image URLs with “|”. Blank cells leave existing values unchanged.</li>
                <li>Variants and uploaded images aren’t part of the CSV and are kept as they are.</li>
              </ul>
              <button
                type="button"
                className="pt-1 font-medium text-foreground underline underline-offset-2"
                onClick={() => downloadText("product-import-template.csv", productsCsvTemplate())}
              >
                Download a template
              </button>
            </div>
          </>
        )}

        {plan && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(["create", "update", "error"] as const).map((k) => (
                <div key={k} className="rounded-md border px-3 py-2">
                  <p className={cn("text-lg font-semibold tabular-nums", plan.summary[k] > 0 && ACTION_STYLE[k])}>{plan.summary[k]}</p>
                  <p className="text-xs text-muted-foreground">
                    {stage.step === "done"
                      ? { create: "Created", update: "Updated", error: "Skipped" }[k]
                      : { create: "To create", update: "To update", error: "With errors" }[k]}
                  </p>
                </div>
              ))}
            </div>
            {stage.step === "preview" && plan.summary.error > 0 && (
              <p className="text-[13px] text-muted-foreground">Rows with errors are skipped. Fix them in the file and import it again.</p>
            )}
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plan.results.map((r) => (
                    <tr key={r.row} className="align-top">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.row + 1}</td>
                      <td className="px-3 py-2">
                        <span className="block font-medium">{r.name || "—"}</span>
                        {r.sku && <span className="block font-mono text-xs text-muted-foreground">{r.sku}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("font-medium capitalize", ACTION_STYLE[r.action])}>{r.action === "error" ? "Error" : r.action}</span>
                        {r.errors.length > 0 && (
                          <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
