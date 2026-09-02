export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'ready',
  'completed',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CANCELLATION_REASONS = [
  'no_longer_needed',
  'business_took_too_long',
  'selected_by_mistake',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
