import React from 'react';
import { blockRegistry } from '../registry/blockRegistry';
import {
  resolveBlockTypeString,
  validateStorefrontBlock,
} from '../registry/blockValidation';
import { StorefrontShell } from '../components/StorefrontState';
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

  // Editor mode: show compact professional warning in existing OpenExt / Ecommerce visual language
  return (
    <StorefrontShell>
      <div
        className="ecom-sf-card ecom-sf-card-warning"
        data-editing="true"
        data-unknown-block="true"
        role="alert"
      >
        <div className="ecom-sf-header">
          <div>
            <span className="ecom-sf-badge ecom-sf-badge-warning">
              Unsupported Block
            </span>
            <h3 className="ecom-sf-title">
              Unsupported Ecommerce block: {blockType}
            </h3>
            <p className="ecom-sf-subtitle">
              This block type is not registered in the current version of the Ecommerce plugin. Remove or replace it in the page blueprint.
            </p>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

export function BlockRenderer({ block, isEditing = false }: BlockRendererProps) {
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
    <div className="ecom-sf-blocks-container" data-editing={isEditing}>
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
