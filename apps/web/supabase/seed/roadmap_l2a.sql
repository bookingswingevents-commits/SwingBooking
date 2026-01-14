-- Seed templates for L2A (Les Deux Alpes)

with res as (
  select id from public.residencies
  where name ilike '%L2A%' or name ilike '%Les 2 Alpes%' or name ilike '%Les Deux Alpes%'
  limit 1
)
insert into public.roadmap_templates (residency_id, week_type, title, content)
select
  id,
  'calm',
  'Semaine calme',
  '{
    "intro": "Bienvenue à la résidence. Merci de vérifier les informations ci-dessous.",
    "contacts": [
      {"label":"Julien","value":"06 08 90 65 79"},
      {"label":"Nicolas","value":"06 84 54 29 57"}
    ],
    "addresses": [
      {"label":"Appartement","value":"4 Av. de la Muzelle, 38860 Les Deux Alpes"}
    ],
    "access": [
      {"label":"Clés","value":"Réception Orée des Pistes"},
      {"label":"Code","value":"1789"},
      {"label":"Appartement","value":"B326 (3e étage)"}
    ],
    "lodging": [
      {"label":"Linge","value":"Draps propres à récupérer à Orée des Pistes"},
      {"label":"Linge","value":"Draps sales à ramener à Orée des Pistes"}
    ],
    "meals": [
      {"label":"Repas","value":"Tous les soirs pour l’artiste + accompagnant"}
    ],
    "schedule": [
      {"day":"Mercredi","time":"18:30-19:30","place":"Orée des Pistes","notes":"Arrivée 17h • Repas • 20:30-21:30"},
      {"day":"Samedi","time":"21:00-23:00","place":"Les Crêtes","notes":"Arrivée 20h"}
    ],
    "logistics": [],
    "notes": ""
  }'::jsonb
from res
on conflict (residency_id, week_type) do update
set title = excluded.title,
    content = excluded.content,
    updated_at = now();

with res as (
  select id from public.residencies
  where name ilike '%L2A%' or name ilike '%Les 2 Alpes%' or name ilike '%Les Deux Alpes%'
  limit 1
)
insert into public.roadmap_templates (residency_id, week_type, title, content)
select
  id,
  'strong',
  'Semaine forte',
  '{
    "intro": "Bienvenue à la résidence. Merci de vérifier les informations ci-dessous.",
    "contacts": [
      {"label":"Julien","value":"06 08 90 65 79"},
      {"label":"Nicolas","value":"06 84 54 29 57"}
    ],
    "addresses": [
      {"label":"Appartement","value":"4 Av. de la Muzelle, 38860 Les Deux Alpes"}
    ],
    "access": [
      {"label":"Clés","value":"Réception Orée des Pistes"},
      {"label":"Code","value":"1789"},
      {"label":"Appartement","value":"B326 (3e étage)"}
    ],
    "lodging": [
      {"label":"Linge","value":"Draps propres à récupérer à Orée des Pistes"},
      {"label":"Linge","value":"Draps sales à ramener à Orée des Pistes"}
    ],
    "meals": [
      {"label":"Repas","value":"Tous les soirs pour l’artiste + accompagnant"}
    ],
    "schedule": [
      {"day":"Mercredi","time":"18:30-19:30","place":"Orée des Pistes","notes":"Arrivée 17h • Repas • 20:30-21:30"},
      {"day":"Samedi","time":"21:00-23:00","place":"Les Crêtes","notes":"Arrivée 20h"},
      {"day":"Mardi","time":"16:00-17:30","place":"Belambra L’Orée des Pistes","notes":"After-ski"},
      {"day":"Vendredi","time":"16:00-17:30","place":"Belambra L’Orée des Pistes","notes":"After-ski"}
    ],
    "logistics": [],
    "notes": ""
  }'::jsonb
from res
on conflict (residency_id, week_type) do update
set title = excluded.title,
    content = excluded.content,
    updated_at = now();
