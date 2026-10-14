'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StorefrontSubNav } from '@/components/StorefrontSubNav';
import { storefrontApiClient } from '@/storefront/services/storefrontApiClient';
import type {
  StorefrontBlockConfig,
  StorefrontBlockFieldSpec,
  StorefrontPageDTO,
  StorefrontPageType,
} from '@/storefront/types/storefront';
import { PageBlocksRenderer } from '@/storefront/renderer/BlockRenderer';
import { ArrowDown, ArrowUp, CheckCircle2, RotateCcw } from 'lucide-react';

interface StorefrontPageBlueprintManagerProps {
  pageType: StorefrontPageType;
  heading: string;
  subheading: string;
}

function cloneBlocks(blocks: StorefrontBlockConfig[]): StorefrontBlockConfig[] {
  return JSON.parse(JSON.stringify(blocks));
}

export function StorefrontPageBlueprintManager({
  pageType,
  heading,
  subheading,
}: StorefrontPageBlueprintManagerProps) {
  const [pageData, setPageData] = useState<StorefrontPageDTO | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>('');
  const [descriptionDraft, setDescriptionDraft] = useState<string>('');
  const [publishedDraft, setPublishedDraft] = useState<boolean>(true);
  const [blocksDraft, setBlocksDraft] = useState<StorefrontBlockConfig[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'editor' | 'public'>('editor');

  const applyServerPage = useCallback((page: StorefrontPageDTO) => {
    setPageData(page);
    setTitleDraft(page.title);
    setDescriptionDraft(page.description);
    setPublishedDraft(page.isPublished);
    setBlocksDraft(cloneBlocks(page.blocks));
    setConfirmingReset(false);
  }, []);

  const loadPage = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorMessage(null);

      storefrontApiClient
        .getAdminPage(pageType, { signal })
        .then((res) => {
          applyServerPage(res.page);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const msg =
            err instanceof Error && err.message
              ? err.message
              : 'Unable to load storefront page blueprint.';
          setErrorMessage(msg);
          setLoading(false);
        });
    },
    [pageType, applyServerPage]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPage(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadPage]);

  const hasUnsavedChanges = useMemo(() => {
    if (!pageData) return false;
    if (titleDraft.trim() !== pageData.title) return true;
    if (descriptionDraft.trim() !== pageData.description) return true;
    if (publishedDraft !== pageData.isPublished) return true;
    return JSON.stringify(blocksDraft) !== JSON.stringify(pageData.blocks);
  }, [pageData, titleDraft, descriptionDraft, publishedDraft, blocksDraft]);

  const handleMoveBlock = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocksDraft.length) return;
    setSuccessMessage(null);
    setBlocksDraft((prev) => {
      const next = cloneBlocks(prev);
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleToggleBlockEnabled = (blockId: string, enabled: boolean) => {
    setSuccessMessage(null);
    setBlocksDraft((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.required) return block;
        return {
          ...block,
          enabled,
        };
      })
    );
  };

  const handleSettingChange = (blockId: string, settingKey: string, value: any) => {
    setSuccessMessage(null);
    setBlocksDraft((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        return {
          ...block,
          settings: {
            ...block.settings,
            [settingKey]: value,
          },
        };
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageData) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await storefrontApiClient.updateAdminPage(pageType, {
        title: titleDraft.trim(),
        description: descriptionDraft.trim(),
        isPublished: publishedDraft,
        blocks: blocksDraft,
        expectedRevision: pageData.revision,
      });
      applyServerPage(res.page);
      setSuccessMessage('Page blueprint configuration saved and synced with OpenExt Pages.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to save storefront page configuration.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await storefrontApiClient.resetAdminPage(pageType, true);
      applyServerPage(res.page);
      setSuccessMessage('Page restored to its default blueprint structure and settings.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to reset page to default blueprint.';
      setErrorMessage(msg);
    } finally {
      setResetting(false);
    }
  };

  const renderFieldInput = (
    block: StorefrontBlockConfig,
    spec: StorefrontBlockFieldSpec
  ) => {
    const inputId = `block-${block.id}-setting-${spec.key}`;
    const currentValue = block.settings?.[spec.key];

    if (spec.type === 'boolean') {
      const checked = Boolean(currentValue);
      return (
        <div
          key={spec.key}
          className="flex items-center justify-between gap-4 rounded-lg border p-3 bg-muted/10"
        >
          <Label htmlFor={inputId} className="text-sm font-medium cursor-pointer">
            {spec.label}
          </Label>
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={(e) => handleSettingChange(block.id, spec.key, e.target.checked)}
            className="h-5 w-5 rounded border-input accent-primary cursor-pointer"
          />
        </div>
      );
    }

    if (spec.type === 'select') {
      const options = spec.options || [];
      return (
        <div key={spec.key} className="space-y-1.5">
          <Label htmlFor={inputId} className="text-sm font-medium">
            {spec.label}
          </Label>
          <select
            id={inputId}
            value={String(currentValue ?? '')}
            onChange={(e) => {
              const rawVal = e.target.value;
              const isNumOption = typeof options[0]?.value === 'number';
              handleSettingChange(
                block.id,
                spec.key,
                isNumOption ? Number(rawVal) : rawVal
              );
            }}
            className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {options.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (spec.type === 'number') {
      return (
        <div key={spec.key} className="space-y-1.5">
          <Label htmlFor={inputId} className="text-sm font-medium">
            {spec.label}
          </Label>
          <Input
            id={inputId}
            type="number"
            min={spec.min}
            max={spec.max}
            value={currentValue !== undefined ? String(currentValue) : ''}
            onChange={(e) =>
              handleSettingChange(block.id, spec.key, Number(e.target.value) || 0)
            }
            className="min-h-11"
          />
        </div>
      );
    }

    return (
      <div key={spec.key} className="space-y-1.5">
        <Label htmlFor={inputId} className="text-sm font-medium">
          {spec.label}
        </Label>
        <Input
          id={inputId}
          type="text"
          value={currentValue !== undefined ? String(currentValue) : ''}
          onChange={(e) => handleSettingChange(block.id, spec.key, e.target.value)}
          className="min-h-11"
        />
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <StorefrontSubNav activeTab={pageType} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
            {pageData && (
              <>
                <Badge
                  variant="outline"
                  className={
                    pageData.isPublished
                      ? 'bg-green-500/10 text-green-600 border-green-500'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500'
                  }
                >
                  {pageData.isPublished ? 'Published' : 'Draft'}
                </Badge>
                <Badge
                  variant={pageData.isCustomized ? 'default' : 'secondary'}
                >
                  {pageData.isCustomized ? 'Customized' : 'Default Blueprint'}
                </Badge>
                <Badge variant="outline">
                  Blueprint v{pageData.appliedBlueprintVersion}
                </Badge>
              </>
            )}
          </div>
          <p className="text-muted-foreground">{subheading}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => loadPage()}
            disabled={loading || saving || resetting}
          >
            Refresh
          </Button>
          <Button
            type="submit"
            form="storefront-page-blueprint-form"
            className="min-h-11"
            disabled={loading || saving || resetting || !hasUnsavedChanges}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Configuration Action Failed</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
            <span>{errorMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => loadPage()}
            >
              Reload Page State
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-500/50 bg-green-500/10 text-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Changes Saved</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {loading || !pageData ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
          {[1, 2, 3].map((n) => (
            <Card key={n}>
              <CardHeader>
                <Skeleton className="h-6 w-56" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <form
          id="storefront-page-blueprint-form"
          onSubmit={handleSave}
          className="space-y-8"
        >
          {/* Blueprint Metadata & Page Identity */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Page Route & Publication Status</CardTitle>
                  <CardDescription>
                    Controls how this storefront page is registered in OpenExt and whether visitors can access it.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    Route: {pageData.routePattern}
                  </Badge>
                  {pageData.isDynamicTemplate && (
                    <Badge variant="secondary">Dynamic Catalog Template</Badge>
                  )}
                  <Badge variant="outline">Revision #{pageData.revision}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pageData.hasNewerBlueprint && pageData.isCustomized && (
                <Alert>
                  <AlertTitle>Newer Default Blueprint Available (v{pageData.latestBlueprintVersion})</AlertTitle>
                  <AlertDescription>
                    Your merchant customizations are protected and were not overwritten. You can keep your custom configuration or reset to Default Blueprint v{pageData.latestBlueprintVersion} below.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="page-title-input">Page Title</Label>
                  <Input
                    id="page-title-input"
                    type="text"
                    value={titleDraft}
                    onChange={(e) => {
                      setSuccessMessage(null);
                      setTitleDraft(e.target.value);
                    }}
                    className="min-h-11"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="page-status-select">Publication Visibility</Label>
                  <select
                    id="page-status-select"
                    value={publishedDraft ? 'published' : 'draft'}
                    onChange={(e) => {
                      setSuccessMessage(null);
                      setPublishedDraft(e.target.value === 'published');
                    }}
                    className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="published">Published (Visible on Storefront)</option>
                    <option value="draft">Draft (Hidden from Public Visitors)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="page-description-input">Page Description</Label>
                <Input
                  id="page-description-input"
                  type="text"
                  value={descriptionDraft}
                  onChange={(e) => {
                    setSuccessMessage(null);
                    setDescriptionDraft(e.target.value);
                  }}
                  className="min-h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ordered Blueprint Blocks */}
          <section aria-labelledby="ordered-blocks-heading" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2
                  id="ordered-blocks-heading"
                  className="text-lg font-semibold tracking-tight"
                >
                  Ordered Page Blocks ({blocksDraft.length})
                </h2>
                <p className="text-sm text-muted-foreground">
                  Reorder sections and configure display rules. Blocks store layout configuration only; products, inventory, discounts, and taxes are resolved live from your store backend.
                </p>
              </div>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500">
                  Unsaved Changes
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {blocksDraft.map((block, index) => {
                const specs = pageData.fieldSpecs?.[block.blockType] || [];
                return (
                  <Card
                    key={block.id}
                    data-testid={`blueprint-block-${block.id}`}
                    className={!block.enabled ? 'opacity-75 border-dashed' : ''}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              #{index + 1}
                            </Badge>
                            <CardTitle className="text-base">{block.label}</CardTitle>
                            <Badge variant={block.required ? 'default' : 'secondary'}>
                              {block.required ? 'Required System Block' : 'Optional Block'}
                            </Badge>
                            {!block.enabled && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Hidden on Public Page
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs">
                            Block Type: <code className="font-mono">{block.blockType}</code>
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                          {!block.required && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                              onClick={() =>
                                handleToggleBlockEnabled(block.id, !block.enabled)
                              }
                            >
                              {block.enabled ? 'Hide Block' : 'Show Block'}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 px-3"
                            aria-label={`Move ${block.label} up`}
                            disabled={index === 0}
                            onClick={() => handleMoveBlock(index, -1)}
                          >
                            <ArrowUp className="h-4 w-4 mr-1" />
                            Up
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 px-3"
                            aria-label={`Move ${block.label} down`}
                            disabled={index === blocksDraft.length - 1}
                            onClick={() => handleMoveBlock(index, 1)}
                          >
                            <ArrowDown className="h-4 w-4 mr-1" />
                            Down
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {specs.length > 0 && (
                      <CardContent className="pt-2 border-t">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                          {specs.map((spec) => renderFieldInput(block, spec))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Live Blueprint Blocks Preview via BlockRenderer */}
          <section aria-labelledby="blueprint-preview-heading" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2
                  id="blueprint-preview-heading"
                  className="text-lg font-semibold tracking-tight"
                >
                  Live Blueprint Blocks Preview
                </h2>
                <p className="text-sm text-muted-foreground">
                  Simulated rendering of current blocks through the Ecommerce BlockRenderer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'editor' ? 'default' : 'outline'}
                  className="min-h-11"
                  onClick={() => setPreviewMode('editor')}
                >
                  Editor Mode
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'public' ? 'default' : 'outline'}
                  className="min-h-11"
                  onClick={() => setPreviewMode('public')}
                >
                  Public Mode
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <PageBlocksRenderer
                blocks={blocksDraft}
                isEditing={previewMode === 'editor'}
              />
            </div>
          </section>

          {/* Bottom Save + Safe Reset to Default Blueprint */}
          <Card className="border-muted">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Default Blueprint Recovery</CardTitle>
                  <CardDescription>
                    Resetting restores the default block order, visibility, and settings from Blueprint v{pageData.latestBlueprintVersion}. Your products, categories, tax rules, and orders are never affected.
                  </CardDescription>
                </div>

                {!confirmingReset ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 self-start sm:self-auto"
                    onClick={() => setConfirmingReset(true)}
                    disabled={saving || resetting}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default Blueprint
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      className="min-h-11"
                      onClick={handleConfirmReset}
                      disabled={resetting}
                    >
                      {resetting ? 'Resetting...' : 'Confirm Reset to Default'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setConfirmingReset(false)}
                      disabled={resetting}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        </form>
      )}
    </div>
  );
}
