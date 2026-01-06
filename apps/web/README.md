# Swing Booking Web

## Module "Programmation en residence"

### Setup DB
- Execute the migration: `supabase/migrations/20250308_residencies.sql`
- (Optional) Seed data: `supabase/seed/residency_seed.sql`

### Admin flow
- Clients: `/admin/clients`
- Programmations: `/admin/programmations`
- Detail + agenda: `/admin/programmations/[id]`
  - Envoi des demandes de disponibilite
  - Liste des candidats par semaine
  - Confirmation / annulation
  - Override manuel du type de semaine

### Artist (public) flow
- Lien public securise: `/availability/{token}`
- L'artiste coche ses semaines disponibles (candidature) et peut retirer tant que la semaine est ouverte.

### Emails
- Invitations envoyees via Resend si `RESEND_API_KEY` est configure.
- Sinon, les invitations sont marquees `mocked` dans `residency_invitations`.

### Tests / Scripts
- Sanity week generation: `node scripts/check-residency-week-generation.js`
- Atomic confirm: `node scripts/check-residency-confirmation.js`
  - Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

### Debug auth admin
- Endpoint: `GET /api/admin/whoami`
  - Retourne `{ user, profile_role, metadata_role, is_admin }`
  - Requiert seulement une session active (pas de role admin).

### Devenir admin
- Utiliser `supabase/seed/make_me_admin.sql`
  - Remplacer `:user_id` par l'id auth (voir `/api/admin/whoami`).
  - Le script ajoute `profiles.role` si besoin et force `role='admin'`.

### Notes
- Le default "vacances" est simplifie dans `lib/residencyWeeks.ts`.
  Adaptez les fenetres si besoin (zones scolaires, region, etc.).
