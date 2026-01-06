
# Swing Booking — Patch 2025-10-27

Ce patch ajoute :
- Catalogue Artistes (`/artists`) protégé par abonnement Pro (champ `venues.is_pro`).
- API: `/api/artists`, `/api/me`, `/api/venues/pro` (toggle démo).
- Page: `/subscribe` (démo d’activation).
- Emails: `apps/web/lib/emails/templates.ts`.
- SQL: `supabase/sql/20251027_pro_subscription_patch.sql`.

## Démarrage rapide
```bash
cd apps/web
npm i
npm run dev
```

Pensez à appliquer le patch SQL puis régler `venues.is_pro=true` pour les établissements Pro.
