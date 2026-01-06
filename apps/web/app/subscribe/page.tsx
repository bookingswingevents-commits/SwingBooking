'use client';

import Link from 'next/link';

type PlanId = 'free' | 'starter' | 'pro' | 'premium';

type UiPlan = {
  id: PlanId;
  name: string;
  price: string;
  highlight?: boolean;
  for: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaExternal?: boolean;
};

const plans: UiPlan[] = [
  {
    id: 'free',
  name: 'Sans abonnement',
  price: '0€ / mois',
  highlight: false,
  for: 'Pour tester la plateforme sans engagement.',
  description:
      '1ère demande offerte (mode découverte). Packs disponibles ensuite, option gestion complète à 69€ HT par projet.',
  features: [
    'Accès au catalogue de formats d’événements',
    'Création de demandes d’événements',
    'Réception des propositions d’artistes adaptées',
    'Feuilles de route et suivi de base',
    'Catalogue d’artistes débloqués après vos événements',
    'Option “gestion complète” à 69€ HT par projet',
    ],
    ctaLabel: 'Créer un compte gratuitement',
    ctaHref: '/signup',
  },
  {
    id: 'starter',
    name: 'Pack Starter',
  price: '79€ / mois',
  highlight: false,
  for: 'Pour les lieux qui programment ponctuellement.',
  description:
      'Idéal si vous organisez quelques événements musicaux par mois, sans limite stricte sur la 1ère demande.',
  features: [
    'Jusqu’à 2 événements confirmés par mois',
    'Jusqu’à 2 modifications de proposition par événement',
    'Accès au catalogue de formats d’événements',
    'Feuilles de route et éléments de communication',
    'Catalogue d’artistes débloqués dans votre espace',
    ],
    // ⚠️ Ces URLs supposent une route API existante type /api/venues/pro
    // que tu pourras brancher à Stripe ou une mise à jour Supabase.
    ctaLabel: 'Choisir le Starter',
    ctaHref: '/api/venues/pro?plan=starter',
  },
  {
    id: 'pro',
    name: 'Pack Pro',
    price: '139€ / mois',
    highlight: true,
    for: 'Pour les lieux qui programment régulièrement.',
  description:
      'Pour les établissements qui veulent programmer sereinement toute l’année, sans limite artificielle.',
  features: [
    'Événements illimités',
    'Modifications de proposition illimitées',
      'Accès complet au catalogue de formats d’événements',
      'Catalogue d’artistes débloqués enrichi au fil des validations',
      'Agenda et historique simplifié de votre programmation',
    ],
    ctaLabel: 'Passer en Pro',
    ctaHref: '/api/venues/pro?plan=pro',
  },
  {
    id: 'premium',
    name: 'Pack Premium',
    price: '229€ / mois',
    highlight: false,
    for: 'Pour les groupes, chaînes et lieux très actifs.',
    description:
      'Pensé pour les réseaux d’établissements, les groupes et les lieux à forte volumétrie.',
    features: [
      'Tout le pack Pro',
      'Accès au catalogue d’artistes complet',
      'Possibilité de choisir directement l’artiste à booker',
      'Multi-établissements (compte groupe)',
      'Gestion d’équipe (plusieurs utilisateurs)',
      'Accompagnement artistique et support prioritaire',
    ],
    ctaLabel: 'Parler avec nous',
    ctaHref:
      'mailto:contact@swingbooking.fr?subject=Int%C3%A9ress%C3%A9%20par%20le%20pack%20Premium',
    ctaExternal: true,
  },
];

export default function SubscribePage() {
  return (
    <div className="max-w-5xl mx-auto py-10 space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Packs &amp; tarifs
        </p>
        <h1 className="text-3xl md:text-4xl font-bold">
          Choisissez la formule qui correspond à votre programmation
        </h1>
        <p className="text-slate-600 max-w-2xl">
          L’accès à Swing Booking est gratuit pour une première demande (mode découverte).
          Ensuite, choisissez un pack (Starter/Pro/Premium) ou l’option “gestion complète”
          à 69€ HT par projet pour déléguer la coordination.
        </p>
      </header>

      {/* Cartes plans */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={
              'border rounded-2xl p-5 flex flex-col gap-4 bg-white ' +
              (plan.highlight ? 'ring-2 ring-[var(--brand)] shadow-sm' : '')
            }
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="text-sm text-slate-500">{plan.for}</p>
            </div>

            <div>
              <div className="text-2xl font-bold">{plan.price}</div>
              {plan.description && (
                <p className="text-sm text-slate-600 mt-1">{plan.description}</p>
              )}
            </div>

            <ul className="text-sm text-slate-700 space-y-1 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-3">
              {plan.ctaExternal ? (
                <a
                  href={plan.ctaHref}
                  className="w-full inline-flex justify-center items-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  {plan.ctaLabel}
                </a>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className="w-full inline-flex justify-center items-center rounded-xl px-3 py-2 text-sm font-medium bg-[var(--brand)] text-white hover:opacity-90"
                >
                  {plan.ctaLabel}
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* FAQ simple */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="border rounded-2xl p-4 bg-white">
          <h3 className="font-semibold mb-1">Puis-je commencer gratuitement&nbsp;?</h3>
          <p className="text-sm text-slate-600">
            Oui. Vous pouvez créer un compte et faire une première demande en mode
            découverte gratuitement. Ensuite, vous choisissez un pack ou l’option “gestion
            complète” à 69€ HT par projet selon vos besoins.
          </p>
        </div>
        <div className="border rounded-2xl p-4 bg-white">
          <h3 className="font-semibold mb-1">Comment fonctionnent les limites&nbsp;?</h3>
          <p className="text-sm text-slate-600">
            Le pack Starter limite à 2 événements confirmés par mois et 2 demandes de
            nouvelle proposition par événement. Le pack Pro retire ces limites. Le pack
            Premium ajoute l’accès direct au catalogue d’artistes et des options pour les
            groupes et réseaux d’établissements.
          </p>
        </div>
        <div className="border rounded-2xl p-4 bg-white">
          <h3 className="font-semibold mb-1">Qui paye les artistes&nbsp;?</h3>
          <p className="text-sm text-slate-600">
            Swing Booking reste un outil SaaS de programmation musicale pour
            établissements. La relation contractuelle et le paiement restent entre vous,
            l&apos;artiste et/ou l&apos;association partenaire. Nous vous aidons à
            structurer la demande et centraliser les infos, pas à prendre la place de
            votre comptabilité.
          </p>
        </div>
      </section>
    </div>
  );
}
