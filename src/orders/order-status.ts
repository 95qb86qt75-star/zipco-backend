export const ORDER_STATUSES = [
  'pending',
  'alternative_proposed',
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
  'requirements_changed',
  'other',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const REJECTION_REASONS = [
  'unavailable',
  'cannot_meet_schedule',
  'outside_service_area',
  'insufficient_information',
  'no_capacity',
  'other',
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];
