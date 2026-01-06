# Swing Booking — Supabase + Next.js (VS Code Ready)

Couleurs du thème : primaire `#003049`, accent `#ae8616`.

## Aperçu
Application web/mobile de booking d'artistes avec espaces **Établissement**, **Artiste**, et **Admin**. Authentification, RLS, et workflows complets (demande → tri interne → envoi artistes → proposition → validation → feuille de route → feedbacks + facturation).

## Stack
- Next.js 15 + App Router + TypeScript + Tailwind
- Supabase (Auth, Postgres, Storage, Edge Functions)
- RLS (Row Level Security) avec policies par rôle
- Composants UI accessibles + responsive

## Démarrage
1. **Cloner** ce dossier et ouvrir dans VS Code.
2. Créer un projet Supabase, récupérer : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`.
3. Copier `.env.example` → `.env.local` et remplir les valeurs.
4. Installer et lancer :
   ```bash
   cd apps/web
   npm i
   npm run dev
   ```
5. Appliquer la base :
   ```bash
   supabase db push  # ou exécuter les fichiers SQL de /supabase/sql dans l'ordre
   ```

## Rôles
- `admin`
- `venue` (Établissement)
- `artist`

## Workflows (résumé)
- **Catalogue**: un client/établissement choisit un format d'événement.
- **Demande**: formulaire → enregistrement `booking_requests`.
- **Tri interne**: admin/ops ajoute des tags, propose des artistes cibles.
- **Envoi artistes**: notifications → artistes répondent (`availability_responses`).
- **Proposition**: génération `proposals` → retour client (accepter/modifier/refuser).
- **Validation**: état `confirmed` → feuille de route (`itineraries`) envoyée.
- **Après prestation**: feedbacks client & artiste + infos de facturation.

Voir `/supabase/sql` pour le schéma complet et RLS. Voir `/apps/web` pour l’UI et les API route handlers.
