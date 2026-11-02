export type DiscountType = "percentage" | "fixed_amount" | "buy_x_get_y" | "spend_x_get_y" | "free_gift" | "campaign" | "custom";
export type DiscountStatus = "Active" | "Draft" | "Paused" | "Archived";
export type TargetType = "SpecificProduct" | "MultipleProducts" | "Category" | "EntireStore";

export type BuyXGetY = {
  buyTargetType?: TargetType;
  buyTargetIds?: string[];
  buyQuantity?: number;
  rewardTargetType?: Exclude<TargetType, "EntireStore">;
  rewardTargetIds?: string[];
  rewardQuantity?: number;
  rewardType?: "Free" | "PercentageOff" | "FixedAmountOff";
  rewardValue?: number;
  repeat?: boolean;
};

export type SpendXGetY = {
  minSpend?: number;
  rewardType?: "FixedAmount" | "Percentage" | "FreeProduct";
  rewardValue?: number;
  rewardTargetIds?: string[];
  maxDiscount?: number | null;
  repeat?: boolean;
};

export type CampaignConfig = {
  childRuleIds?: string[];
  description?: string;
  storefrontDisplay?: boolean;
  marketingHeading?: string;
};

/** A leaf condition or a nested AND/OR group (shape read by the backend CustomDiscountEvaluator). */
export type CustomCondition = {
  type?: string;
  operator?: string;
  value?: unknown;
  product?: string;
  locationField?: string;
  conditions?: CustomCondition[];
};

export type CustomAction = {
  type: "PercentageOff" | "FixedAmountOff" | "FreeShipping" | "SetProductPrice" | "FreeProduct";
  percentage?: number;
  amount?: number;
  applyTo?: "EntireCart" | "SpecificProduct" | "MultipleProducts" | "Category";
  productIds?: string[];
  categoryIds?: string[];
  maxDiscount?: number;
  newPrice?: number;
  rewardProductId?: string;
  quantity?: number;
  autoAdd?: boolean;
};

export type DiscountRule = {
  _id: string;
  name: string;
  code?: string;
  isAutomatic?: boolean;
  type: DiscountType;
  value?: number;
  status: DiscountStatus;
  startDate?: string | null;
  endDate?: string | null;
  minSubtotal?: number | null;
  targetProductIds?: string[];
  buyXGetY?: BuyXGetY;
  spendXGetY?: SpendXGetY;
  campaign?: CampaignConfig;
  priority?: number;
  stackingPolicy?: "allow" | "exclusive";
  maxDiscountAmount?: number | null;
  customConfig?: { conditionTree?: CustomCondition; actions?: CustomAction[] };
  usageLimit?: number | null;
  usedCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type DiscountPayload = Partial<Omit<DiscountRule, "_id" | "createdAt" | "updatedAt" | "usedCount">>;

export type DiscountUsage = {
  usedCount: number;
  usageLimit: number | null;
  orderCount: number;
  cancelledOrderCount: number;
  totalDiscount: number;
  revenue: number;
  recentOrders: {
    _id: string;
    orderNumber: string;
    createdAt: string;
    status: string;
    paymentStatus: string;
    customerName?: string;
    total: number;
    discount: number;
  }[];
};
