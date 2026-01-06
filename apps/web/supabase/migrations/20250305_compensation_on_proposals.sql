-- Ajoute les champs de rémunération artiste sur les propositions
alter table if exists public.proposals
  add column if not exists compensation_mode text,
  add column if not exists compensation_amount numeric(12,2),
  add column if not exists compensation_expenses numeric(12,2),
  add column if not exists compensation_organism text;

-- On évite de forcer une valeur par défaut pour préserver l'existant.
