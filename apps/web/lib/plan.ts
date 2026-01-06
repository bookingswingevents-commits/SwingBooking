export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'premium';

export interface PlanConfig {
  id: SubscriptionPlan;
  label: string;
  monthlyEventsLimit: number | null; // null = illimité
  modificationsPerRequest: number | null; // null = illimité
  hasCommission: boolean;
  canAccessArtistCatalog: boolean; // Premium : accès au catalogue artistes complet
}

export const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Sans abonnement',
    monthlyEventsLimit: null, // tu peux mettre 2 si tu veux limiter les free
    modificationsPerRequest: 1,
    hasCommission: false,
    canAccessArtistCatalog: false,
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    monthlyEventsLimit: 2, // 2 événements confirmés / mois
    modificationsPerRequest: 2,
    hasCommission: false,
    canAccessArtistCatalog: false,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    monthlyEventsLimit: null,
    modificationsPerRequest: null,
    hasCommission: false,
    canAccessArtistCatalog: false,
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    monthlyEventsLimit: null,
    modificationsPerRequest: null,
    hasCommission: false,
    canAccessArtistCatalog: true,
  },
};

export function getPlanConfig(plan: string | null | undefined): PlanConfig {
  if (plan === 'starter' || plan === 'pro' || plan === 'premium') {
    return PLANS[plan];
  }
  return PLANS.free;
}
