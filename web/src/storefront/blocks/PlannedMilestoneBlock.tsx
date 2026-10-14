import React from 'react';
import { StorefrontShell } from '../components/StorefrontState';
import type {
  BlockSettingsMap,
  StorefrontBlockComponentProps,
  StorefrontBlockFieldSpec,
} from '../types/storefront';

function formatSettingDisplayValue(
  spec: StorefrontBlockFieldSpec,
  rawValue: unknown
): string {
  if (spec.type === 'boolean') {
    return rawValue ? 'Yes' : 'No';
  }
  if (spec.type === 'select' && Array.isArray(spec.options)) {
    const matched = spec.options.find((opt) => String(opt.value) === String(rawValue));
    if (matched) return matched.label;
  }
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return 'Default';
  }
  return String(rawValue);
}

export function PlannedMilestoneBlock({
  block,
  settings,
  isEditing,
  definition,
}: StorefrontBlockComponentProps<BlockSettingsMap>) {
  const displayHeading =
    typeof settings.heading === 'string' && settings.heading.trim().length > 0
      ? settings.heading.trim()
      : typeof settings.sectionTitle === 'string' && settings.sectionTitle.trim().length > 0
        ? settings.sectionTitle.trim()
        : block.label;

  const displaySubheading =
    typeof settings.subheading === 'string' && settings.subheading.trim().length > 0
      ? settings.subheading.trim()
      : null;

  if (isEditing) {
    return (
      <StorefrontShell>
        <div
          className="ecom-sf-card"
          data-editing="true"
          data-block-id={block.id}
          data-block-type={block.blockType}
        >
          <div className="ecom-sf-header">
            <div>
              <div className="ecom-sf-badge-row">
                <span className="ecom-sf-badge ecom-sf-badge-ready">
                  {block.required ? 'Required System Block' : 'Optional Block'}
                </span>
                <span className="ecom-sf-badge ecom-sf-badge-planned">
                  Available in later milestone
                </span>
              </div>
              <h3 className="ecom-sf-title">{displayHeading}</h3>
              <p className="ecom-sf-subtitle">
                {definition.plannedMilestone
                  ? `Scheduled for ${definition.plannedMilestone}. Blueprint settings are active and validated.`
                  : 'Scheduled for a future storefront milestone. Blueprint settings are active and validated.'}
              </p>
            </div>
          </div>

          {definition.fieldSpecs.length > 0 && (
            <div className="ecom-sf-settings-grid" aria-label={`${block.label} settings`}>
              {definition.fieldSpecs.map((spec) => (
                <div
                  key={spec.key}
                  className="ecom-sf-setting-item"
                  data-setting-key={spec.key}
                >
                  <span className="ecom-sf-metric-label">{spec.label}</span>
                  <strong className="ecom-sf-setting-value">
                    {formatSettingDisplayValue(spec, settings[spec.key])}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </StorefrontShell>
    );
  }

  // Public Mode: render null for blocks whose functionality has not been implemented yet
  return null;
}
