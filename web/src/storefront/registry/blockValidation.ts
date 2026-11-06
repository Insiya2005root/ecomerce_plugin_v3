import type {
  BlockDefinition,
  BlockSettingsMap,
  BlockValidationResult,
  SettingPrimitive,
  StorefrontBlock,
  StorefrontPageType,
} from '../types/storefront';

const FORBIDDEN_COMMERCE_KEYS = new Set([
  'products',
  'product',
  'categories',
  'category',
  'orders',
  'order',
  'taxrules',
  'taxclasses',
  'taxclassid',
  'costprice',
  'barcode',
  'discountrules',
  'variants',
  'inventory',
]);

function cloneSettings<T extends BlockSettingsMap>(settings: T): T {
  return JSON.parse(JSON.stringify(settings || {}));
}

export function resolveBlockTypeString(rawBlock: unknown): string {
  if (!rawBlock || typeof rawBlock !== 'object') {
    return 'ecommerce.unknown';
  }
  const obj = rawBlock as Record<string, unknown>;
  if (typeof obj.blockType === 'string' && obj.blockType.trim().length > 0) {
    return obj.blockType.trim();
  }
  // Milestone 1 proof block compatibility where blockType was omitted
  if (obj.id === 'ecommerce-plugin' || obj.type === 'ecommerce-plugin') {
    return 'ecommerce.foundation';
  }
  return 'ecommerce.unknown';
}

export function validateStorefrontBlock<TSettings extends BlockSettingsMap = BlockSettingsMap>(
  rawBlock: unknown,
  isEditing: boolean,
  definition?: BlockDefinition<TSettings>
): BlockValidationResult<TSettings> {
  const warnings: string[] = [];

  if (!rawBlock || typeof rawBlock !== 'object') {
    const fallbackBlock: StorefrontBlock<TSettings> = {
      id: 'malformed-block',
      uniqueId: 'malformed-block-unique',
      type: 'ecommerce-plugin',
      blockType: 'ecommerce.unknown',
      label: 'Malformed Block',
      required: false,
      enabled: false,
      settings: (definition ? cloneSettings(definition.defaultSettings) : {}) as TSettings,
    };

    return {
      valid: false,
      isRegistered: false,
      resolvedBlockType: 'ecommerce.unknown',
      shouldRender: isEditing,
      block: fallbackBlock,
      warnings: ['Received non-object block payload.'],
      error: 'Block data must be an object.',
    };
  }

  const obj = rawBlock as Record<string, unknown>;
  const resolvedBlockType = resolveBlockTypeString(rawBlock);

  // If definition was not found in registry
  if (!definition) {
    const unregId =
      typeof obj.id === 'string' && obj.id.trim().length > 0
        ? obj.id.trim()
        : `unregistered-${resolvedBlockType}`;
    const unregUniqueId =
      typeof obj.uniqueId === 'string' && obj.uniqueId.trim().length > 0
        ? obj.uniqueId.trim()
        : unregId;
    const unregLabel =
      typeof obj.label === 'string' && obj.label.trim().length > 0
        ? obj.label.trim()
        : `Unsupported Block (${resolvedBlockType})`;
    const unregEnabled = obj.enabled !== false;

    const unregBlock: StorefrontBlock<TSettings> = {
      id: unregId,
      uniqueId: unregUniqueId,
      type: 'ecommerce-plugin',
      blockType: resolvedBlockType,
      label: unregLabel,
      required: false,
      enabled: unregEnabled,
      settings: {} as TSettings,
    };

    return {
      valid: false,
      isRegistered: false,
      resolvedBlockType,
      shouldRender: isEditing,
      block: unregBlock,
      warnings: [`Unsupported Ecommerce block: ${resolvedBlockType}`],
      error: `Block type "${resolvedBlockType}" is not registered in the block registry.`,
    };
  }

  // Definition is known: normalize block identity
  const id =
    typeof obj.id === 'string' && obj.id.trim().length > 0
      ? obj.id.trim()
      : definition.blockType;

  const uniqueId =
    typeof obj.uniqueId === 'string' && obj.uniqueId.trim().length > 0
      ? obj.uniqueId.trim()
      : id;

  const label =
    typeof obj.label === 'string' && obj.label.trim().length > 0
      ? obj.label.trim()
      : definition.defaultLabel;

  // Preserve required-block rules
  const isRequired = definition.requiredByDefault || Boolean(obj.required);
  let isEnabled = obj.enabled !== false;

  if (isRequired && !isEnabled) {
    warnings.push(
      `Required system block "${label}" (${id}) cannot be disabled. Automatically enforced enabled.`
    );
    isEnabled = true;
  }

  // Validate and normalize settings against fieldSpecs
  const normalizedSettings: Record<string, SettingPrimitive> = cloneSettings(
    definition.defaultSettings
  );

  const rawSettings =
    obj.settings && typeof obj.settings === 'object' && !Array.isArray(obj.settings)
      ? (obj.settings as Record<string, unknown>)
      : obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
        ? (obj.data as Record<string, unknown>)
        : null;

  if (rawSettings) {
    const specsByKey = new Map(definition.fieldSpecs.map((s) => [s.key, s]));

    for (const [key, rawVal] of Object.entries(rawSettings)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (FORBIDDEN_COMMERCE_KEYS.has(normalizedKey)) {
        warnings.push(
          `Forbidden live entity key "${key}" ignored in block "${id}" settings.`
        );
        continue;
      }

      const spec = specsByKey.get(key);
      if (!spec) {
        // Only accept scalar primitives for un-specced keys if already present in defaultSettings
        if (
          key in definition.defaultSettings &&
          (typeof rawVal === 'string' ||
            typeof rawVal === 'number' ||
            typeof rawVal === 'boolean')
        ) {
          normalizedSettings[key] = rawVal;
        }
        continue;
      }

      if (spec.type === 'boolean') {
        normalizedSettings[key] = Boolean(rawVal);
      } else if (spec.type === 'number') {
        const num = Number(rawVal);
        if (Number.isFinite(num)) {
          const min = spec.min !== undefined ? Math.max(spec.min, num) : num;
          const clamped = spec.max !== undefined ? Math.min(spec.max, min) : min;
          normalizedSettings[key] = clamped;
        } else {
          warnings.push(
            `Invalid number for setting "${spec.label}" on block "${id}". Reverted to default.`
          );
        }
      } else if (spec.type === 'string' || spec.type === 'text') {
        if (rawVal !== undefined && rawVal !== null) {
          normalizedSettings[key] = String(rawVal).trim().slice(0, spec.type === 'text' ? 2000 : 240);
        }
      } else if (spec.type === 'color') {
        const v = String(rawVal ?? '').trim();
        if (v === '' || /^#[0-9a-f]{3,8}$/i.test(v)) normalizedSettings[key] = v;
      } else if (spec.type === 'select') {
        const allowed = (spec.options || []).map((o) => o.value);
        const match = allowed.find((val) => String(val) === String(rawVal));
        if (match !== undefined) {
          normalizedSettings[key] = match;
        } else {
          warnings.push(
            `Invalid select option "${String(rawVal)}" for "${spec.label}" on block "${id}". Reverted to default.`
          );
        }
      }
    }
  }

  const normalizedBlock: StorefrontBlock<TSettings> = {
    id,
    uniqueId,
    type: 'ecommerce-plugin',
    blockType: definition.blockType,
    pageType: (obj.pageType as StorefrontPageType) || definition.pageType,
    label,
    required: isRequired,
    enabled: isEnabled,
    settings: normalizedSettings as TSettings,
  };

  // Disabled optional blocks must not render
  const shouldRender = isRequired || isEnabled;

  return {
    valid: true,
    isRegistered: true,
    resolvedBlockType: definition.blockType,
    shouldRender,
    block: normalizedBlock,
    warnings,
  };
}
