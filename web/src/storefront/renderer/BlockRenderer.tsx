import React from 'react';
import { blockRegistry } from '../registry/blockRegistry';
import {
  resolveBlockTypeString,
  validateStorefrontBlock,
} from '../registry/blockValidation';
import { EditorHint, StorefrontShell } from '../components/StorefrontState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { BlockRendererProps } from '../types/storefront';

export interface UnknownBlockFallbackProps {
  blockType: string;
  isEditing: boolean;
}

export function UnknownBlockFallback({
  blockType,
  isEditing,
}: UnknownBlockFallbackProps) {
  // Public mode: fail safely without exposing technical debug strings to customers
  if (!isEditing) {
    return null;
  }

  return (
    <StorefrontShell>
      <Alert data-editing="true" data-unknown-block="true">
        <AlertTitle>Unsupported Ecommerce block: {blockType}</AlertTitle>
        <AlertDescription>This block type isn't in this version of the Ecommerce plugin. Remove it, or pick another block under Plugin Settings.</AlertDescription>
      </Alert>
    </StorefrontShell>
  );
}

/**
 * OpenExt's page builder keeps a plugin block's configuration as JSON text in `content`
 * ({"blockType":"ecommerce.product-grid","settings":{...}}), and its settings panel writes there.
 * Pages created by older plugin versions also carry blockType/settings directly on the block; those are
 * only a fallback, so edits made in the page builder always win.
 */
export function unwrapCmsBlock(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.content !== 'string' || !obj.content.trim().startsWith('{')) return raw;
  try {
    const parsed = JSON.parse(obj.content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;
    const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : obj.settings;
    return { ...obj, ...parsed, blockType: parsed.blockType ?? obj.blockType, settings };
  } catch {
    return raw;
  }
}

/** A block dropped from the page builder palette has no block type until one is picked in its settings. */
function hasChosenBlockType(block: unknown): boolean {
  const obj = (block || {}) as Record<string, unknown>;
  return typeof obj.blockType === 'string' && obj.blockType.trim().length > 0;
}

export function BlockRenderer({ block: rawBlock, isEditing = false }: BlockRendererProps) {
  const block = unwrapCmsBlock(rawBlock);
  if (!hasChosenBlockType(block)) {
    return isEditing ? (
      <StorefrontShell>
        <EditorHint>Ecommerce block: choose what it shows (product grid, cart, checkout…) under Plugin Settings on the right.</EditorHint>
      </StorefrontShell>
    ) : null;
  }
  const resolvedBlockType = resolveBlockTypeString(block);
  const definition = blockRegistry.get(resolvedBlockType);

  // Validate and normalize settings against typed definition
  const validation = validateStorefrontBlock(block, isEditing, definition);

  // Skip disabled optional blocks
  if (!validation.shouldRender) {
    return null;
  }

  // Unknown or unregistered block type
  if (!definition || !validation.isRegistered) {
    return (
      <UnknownBlockFallback
        blockType={validation.resolvedBlockType}
        isEditing={isEditing}
      />
    );
  }

  // Planned blocks whose functionality has not been implemented yet render null in public mode
  if (definition.status === 'planned' && !isEditing) {
    return null;
  }

  const Component = definition.component;

  // Never execute arbitrary code; only render the statically registered React component
  return (
    <Component
      block={validation.block}
      settings={validation.block.settings}
      isEditing={isEditing}
      definition={definition}
      validation={validation}
    />
  );
}

export interface PageBlocksRendererProps {
  blocks: unknown[];
  isEditing?: boolean;
}

export function PageBlocksRenderer({
  blocks,
  isEditing = false,
}: PageBlocksRendererProps) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col" data-editing={isEditing}>
      {blocks.map((b, index) => {
        const rawObj = b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
        const key =
          (typeof rawObj?.uniqueId === 'string' && rawObj.uniqueId) ||
          (typeof rawObj?.id === 'string' && rawObj.id) ||
          `block-${index}`;

        return <BlockRenderer key={key} block={b} isEditing={isEditing} />;
      })}
    </div>
  );
}
