-- ---------------------------------------------------------------------------
-- Détail et sources d'un repas
--
-- Deux besoins relevés en entretien (livrables Phase 1) :
--   - « doute sur la fiabilité des outils » : douleur bloquante, citée par les
--     quatre professionnels interrogés. L'app doit pouvoir dire d'où vient
--     chaque chiffre, et laisser signaler celui qui paraît faux.
--   - « huile et calories cachées » : le niveau d'huile choisi au moment du
--     scan modifie les valeurs enregistrées ; sans lui, le détail d'un repas
--     passé ne peut pas expliquer son total.
-- ---------------------------------------------------------------------------

-- Niveau d'huile retenu pour le repas, déjà appliqué aux totaux et aux éléments.
-- 'normal' pour les repas enregistrés avant ce réglage : c'est la valeur qui
-- avait alors servi au calcul.
alter table public.meals
  add column huile text not null default 'normal' check (huile in ('peu', 'normal', 'beaucoup'));

-- ---------------------------------------------------------------------------
-- Signalements de valeurs
-- ---------------------------------------------------------------------------

create table public.food_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Null pour un élément estimé par l'IA, qui n'est dans aucune table.
  food_key text references public.foods (food_key) on update cascade on delete set null,
  -- Libellé tel qu'il s'affichait à l'utilisateur, conservé même sans food_key.
  label text not null check (char_length(label) between 1 and 120),
  -- Le repas d'où part le signalement ; le signalement lui survit.
  meal_id uuid references public.meals (id) on delete set null,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index food_reports_food on public.food_reports (food_key, created_at desc);
create index food_reports_user on public.food_reports (user_id);

alter table public.food_reports enable row level security;

create policy "signalements : création pour soi"
on public.food_reports for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "signalements : lecture de soi"
on public.food_reports for select to authenticated
using (user_id = (select auth.uid()));
