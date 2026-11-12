-- ---------------------------------------------------------------------------
-- Temps de saisie d'un repas scanné
--
-- La promesse du produit est une saisie en moins de 30 secondes, et la
-- recherche Phase 1 cite le « suivi trop lourd » comme cause d'abandon des
-- concurrents. Rien ne mesurait ce temps. L'app envoie désormais, pour chaque
-- repas enregistré à partir d'une photo, la durée du parcours et de ses
-- étapes : uniquement des durées et le type de réseau, jamais le contenu.
-- ---------------------------------------------------------------------------

create table public.scan_timings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- De la photo choisie au repas enregistré. Au-delà de 30 minutes la personne
  -- a quitté l'app en route : l'app n'envoie pas ces parcours.
  total_ms integer not null check (total_ms between 0 and 1800000),
  -- Réduction de la photo sur le téléphone.
  prep_ms integer not null check (prep_ms >= 0),
  -- Envoi de la photo et réponse de l'IA (dernier essai, celui qui a abouti).
  analysis_ms integer not null check (analysis_ms >= 0),
  -- Du résultat affiché au bouton « Enregistrer » : relecture et corrections.
  review_ms integer not null check (review_ms >= 0),
  -- Nombre d'analyses lancées, échecs compris.
  attempts smallint not null default 1 check (attempts between 1 and 20),
  -- La personne a répondu aux questions de clarification (seconde analyse).
  follow_up boolean not null default false,
  items smallint not null check (items between 0 and 50),
  platform text not null check (platform in ('web', 'android', 'ios')),
  -- Sur le web, c'est la classe de débit annoncée par le navigateur, pas la
  -- technologie radio : un Wi-Fi lent peut y apparaître comme « 3g ».
  network text not null check (network in ('wifi', '2g', '3g', '4g', '5g', 'cellular', 'unknown')),
  created_at timestamptz not null default now()
);

create index scan_timings_created on public.scan_timings (created_at desc);
create index scan_timings_user on public.scan_timings (user_id);

alter table public.scan_timings enable row level security;

-- L'app dépose ses mesures et ne les relit jamais.
revoke all on public.scan_timings from anon, authenticated;
grant insert on public.scan_timings to authenticated;

create policy "temps de saisie : dépôt pour soi"
on public.scan_timings for insert to authenticated
with check (user_id = (select auth.uid()));

-- Résumé par jour (heure du Bénin) et par réseau, à lire dans le SQL Editor :
--   select * from public.scan_timings_daily order by day desc;
-- La médiane dit ce que vit la personne typique ; le 9e décile, ce que vit
-- celle pour qui ça se passe mal, et c'est elle qui abandonne.
create view public.scan_timings_daily
with (security_invoker = true)
as
select
  (created_at at time zone 'Africa/Porto-Novo')::date as day,
  network,
  count(*) as saisies,
  round(100.0 * count(*) filter (where total_ms < 30000) / count(*)) as pct_sous_30s,
  round((percentile_cont(0.5) within group (order by total_ms) / 1000)::numeric, 1) as mediane_s,
  round((percentile_cont(0.9) within group (order by total_ms) / 1000)::numeric, 1) as p90_s,
  round((percentile_cont(0.5) within group (order by prep_ms) / 1000)::numeric, 1) as mediane_photo_s,
  round((percentile_cont(0.5) within group (order by analysis_ms) / 1000)::numeric, 1) as mediane_analyse_s,
  round((percentile_cont(0.5) within group (order by review_ms) / 1000)::numeric, 1) as mediane_relecture_s
from public.scan_timings
group by 1, 2;

revoke all on public.scan_timings_daily from anon, authenticated;
