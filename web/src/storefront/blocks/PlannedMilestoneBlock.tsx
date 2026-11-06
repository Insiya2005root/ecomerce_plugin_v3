import React from 'react';
import { EditorHint, StorefrontShell } from '../components/StorefrontState';
import type { BlockSettingsMap, StorefrontBlockComponentProps } from '../types/storefront';

/**
 * Placeholder for blocks that are not built yet (e.g. category filter, breadcrumbs, related products).
 * The page builder shows a one-line note so the page layout reads correctly; shoppers see nothing.
 */
export function PlannedMilestoneBlock({ block, isEditing }: StorefrontBlockComponentProps<BlockSettingsMap>) {
  if (isEditing) {
    return (
      <StorefrontShell>
        <EditorHint>
          <strong>{block.label}</strong> · coming soon. Not shown to shoppers yet.
        </EditorHint>
      </StorefrontShell>
    );
  }

  // Public Mode: render null for blocks whose functionality has not been implemented yet
  return null;
}
