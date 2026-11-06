import type React from 'react';

export type StorefrontPageType = 'shop' | 'product' | 'cart' | 'checkout';

export type StorefrontRegisteredBlockType =
  | 'ecommerce.foundation'
  | 'ecommerce.shop-header'
  | 'ecommerce.category-filter'
  | 'ecommerce.product-grid'
  | 'ecommerce.product-breadcrumbs'
  | 'ecommerce.product-detail'
  | 'ecommerce.related-products'
  | 'ecommerce.cart-items'
  | 'ecommerce.cart-coupon'
  | 'ecommerce.cart-summary'
  | 'ecommerce.checkout-form'
  | 'ecommerce.checkout-summary';

export type SettingPrimitive = string | number | boolean;

export type BlockSettingsMap = Record<string, SettingPrimitive>;

export interface PublicVariantDTO {
  id?: string;
  size: string;
  color: string;
  stock: number;
  inStock: boolean;
  priceOverride: number | null;
}

export interface PublicProductDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Base list price configured on the product document. */
  price: number;
  /** Static catalog display price reflecting product-level static discount only (contextual cart/campaign/BOGO/coupon/tax totals require POST /cart/calculate). */
  catalogPrice: number;
  /** Original base list price when catalogPrice < price, otherwise null. */
  compareAtPrice: number | null;
  /** Static product-level discount percentage (0-100). */
  discountPercentage: number;
  sku: string;
  stock: number;
  inStock: boolean;
  image: string | null;
  images: string[];
  videos: string[];
  categoryId: string | null;
  isDigital: boolean;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  variants: PublicVariantDTO[];
}

export interface PublicCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  parentId: string | null;
}

export interface PublicStorefrontSettingsDTO {
  currency: string;
  currencySymbol: string;
  taxesEnabled: boolean;
  pricesIncludeTax: boolean;
  displayTaxBreakdown: boolean;
  shippingMethod: 'Flat' | 'Distance';
  freeShippingThreshold: number;
  locationSelection: 'Nearest' | 'CustomerSelect';
}

export interface StorefrontPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StorefrontHealthResponse {
  success: boolean;
  status: 'ready' | 'unavailable';
  catalog: {
    publishedProducts: number;
    activeCategories: number;
  };
  pages?: {
    totalBlueprints: number;
    provisionedPages: number;
    publishedPages: number;
    customizedPages: number;
  };
  configuration: {
    taxesEnabled: boolean;
    shippingMethod: 'Flat' | 'Distance';
    locationSelection: 'Nearest' | 'CustomerSelect';
  };
}

export interface StorefrontSettingsResponse {
  success: boolean;
  settings: PublicStorefrontSettingsDTO;
}

export interface StorefrontCategoriesResponse {
  success: boolean;
  categories: PublicCategoryDTO[];
}

export interface StorefrontProductsQuery {
  search?: string;
  categoryId?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';
  page?: number;
  limit?: number;
  ids?: string[];
  minPrice?: number;
  maxPrice?: number;
}

export interface StorefrontProductsResponse {
  success: boolean;
  products: PublicProductDTO[];
  pagination: StorefrontPagination;
}

export interface StorefrontProductDetailResponse {
  success: boolean;
  product: PublicProductDTO;
}

export interface StorefrontBlockFieldSpec {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'text' | 'select' | 'color';
  description?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string | number }>;
  /** Show this field only while another setting has one of these values. */
  showWhen?: { key: string; equals: Array<string | number | boolean> };
}

export interface StorefrontBlockConfig {
  id: string;
  uniqueId: string;
  type: 'ecommerce-plugin';
  blockType: string;
  label: string;
  required: boolean;
  enabled: boolean;
  settings: BlockSettingsMap;
}

export interface StorefrontBlueprintDefinition {
  blueprintId: string;
  pageType: StorefrontPageType;
  version: number;
  slug: string;
  title: string;
  description: string;
  routePattern: string;
  isDynamicTemplate: boolean;
  defaultPublished: boolean;
  blocks: StorefrontBlockConfig[];
  fieldSpecs: Record<string, StorefrontBlockFieldSpec[]>;
}

export interface StorefrontPageDTO {
  id: string;
  pageType: StorefrontPageType;
  blueprintId: string;
  cmsPageId: string | null;
  slug: string;
  title: string;
  description: string;
  routePattern: string;
  isDynamicTemplate: boolean;
  isPublished: boolean;
  appliedBlueprintVersion: number;
  latestBlueprintVersion: number;
  hasNewerBlueprint: boolean;
  appliedBlueprintHash: string;
  currentConfigHash: string;
  isCustomized: boolean;
  customizationState: 'Default' | 'Customized';
  revision: number;
  lastCustomizedAt: string | null;
  lastResetAt: string | null;
  updatedAt: string | null;
  blocks: StorefrontBlockConfig[];
  fieldSpecs: Record<string, StorefrontBlockFieldSpec[]>;
}

export interface PublicStorefrontPageDTO {
  pageType: StorefrontPageType;
  blueprintId: string;
  slug: string;
  title: string;
  description: string;
  routePattern: string;
  isDynamicTemplate: boolean;
  isPublished: boolean;
  appliedBlueprintVersion: number;
  revision: number;
  blocks: StorefrontBlockConfig[];
}

export interface StorefrontPublicPageResponse {
  success: boolean;
  page: PublicStorefrontPageDTO;
}

export interface StorefrontAdminPagesListResponse {
  success: boolean;
  pages: StorefrontPageDTO[];
  blueprints: StorefrontBlueprintDefinition[];
}

export interface StorefrontAdminPageDetailResponse {
  success: boolean;
  page: StorefrontPageDTO;
  blueprint: StorefrontBlueprintDefinition;
}

export interface StorefrontAdminPageMutationResponse {
  success: boolean;
  page: StorefrontPageDTO;
  message?: string;
}

export interface StorefrontUpdatePagePayload {
  title?: string;
  description?: string;
  isPublished?: boolean;
  blocks?: StorefrontBlockConfig[];
  expectedRevision?: number;
}

export interface StorefrontApiErrorShape {
  status: number;
  message: string;
  isNotFound: boolean;
}

export interface StorefrontBlockData {
  id?: string;
  uniqueId?: string;
  type?: string;
  blockType?: string;
  pageType?: StorefrontPageType;
  label?: string;
  required?: boolean;
  enabled?: boolean;
  settings?: Record<string, unknown>;
  content?: string;
  data?: Record<string, unknown>;
  style?: Record<string, string | number | undefined>;
}

export interface StorefrontBlockContext {
  block: StorefrontBlockData;
  isEditing: boolean;
}

/**
 * Validated, normalized StorefrontBlock passed to registered block components.
 */
export interface StorefrontBlock<TSettings extends BlockSettingsMap = BlockSettingsMap> {
  id: string;
  uniqueId: string;
  type: 'ecommerce-plugin';
  blockType: string;
  pageType?: StorefrontPageType;
  label: string;
  required: boolean;
  enabled: boolean;
  settings: TSettings;
}

export interface BlockValidationResult<TSettings extends BlockSettingsMap = BlockSettingsMap> {
  valid: boolean;
  isRegistered: boolean;
  resolvedBlockType: string;
  shouldRender: boolean;
  block: StorefrontBlock<TSettings>;
  warnings: string[];
  error?: string;
}

export interface StorefrontBlockComponentProps<
  TSettings extends BlockSettingsMap = BlockSettingsMap
> {
  block: StorefrontBlock<TSettings>;
  settings: TSettings;
  isEditing: boolean;
  definition: BlockDefinition<TSettings>;
  validation: BlockValidationResult<TSettings>;
}

export interface BlockDefinition<TSettings extends BlockSettingsMap = BlockSettingsMap> {
  blockType: StorefrontRegisteredBlockType | string;
  defaultLabel: string;
  pageType?: StorefrontPageType;
  requiredByDefault: boolean;
  status: 'implemented' | 'planned';
  plannedMilestone?: string;
  defaultSettings: TSettings;
  fieldSpecs: StorefrontBlockFieldSpec[];
  component: React.ComponentType<StorefrontBlockComponentProps<any>>;
}

export interface BlockRegistry {
  register<TSettings extends BlockSettingsMap>(
    definition: BlockDefinition<TSettings>
  ): void;
  get(blockType: string): BlockDefinition<BlockSettingsMap> | undefined;
  has(blockType: string): boolean;
  getAll(): BlockDefinition<BlockSettingsMap>[];
  getByPageType(pageType: StorefrontPageType): BlockDefinition<BlockSettingsMap>[];
}

export interface BlockRendererProps {
  block: unknown;
  isEditing?: boolean;
}
