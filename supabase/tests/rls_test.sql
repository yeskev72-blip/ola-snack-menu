-- Tests de sécurité (RLS, droits, quota). Tout est annulé à la fin (rollback).
-- Lancer : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- Un « ASSERT » ou une exception « DEVAIT ÉCHOUER » signale un test en échec.

begin;

-- Utilisateurs de test : A et B avec compte, G invité (anonyme).
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'un profil doit être créé pour chaque utilisateur';
  assert (select bool_and(plan = 'free') from public.profiles), 'plan free par défaut';
end $$;

-- ---------------------------------------------------------------- en tant que A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A ne voit que son profil';
  update public.profiles set prenom = 'Awa', calories_cible = 2000 where id = auth.uid();
  assert (select prenom from public.profiles) = 'Awa', 'A peut modifier son profil';
  update public.profiles set prenom = 'Pirate' where id = '00000000-0000-0000-0000-00000000000b';
end $$;

do $$ begin
  update public.profiles set plan = 'premium' where id = auth.uid();
  raise exception 'DEVAIT ÉCHOUER : A ne doit pas pouvoir changer son plan';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.profiles (id) values (gen_random_uuid());
  raise exception 'DEVAIT ÉCHOUER : insertion de profil côté client';
exception when insufficient_privilege then null;
end $$;

-- Repas de A.
insert into public.meals (id, type_repas, total_kcal) values ('10000000-0000-0000-0000-00000000000a', 'dejeuner', 650);
insert into public.meal_items (meal_id, food_key, label, grams, kcal, proteines, glucides, lipides)
values ('10000000-0000-0000-0000-00000000000a', 'riz_blanc', 'Riz blanc', 300, 390, 8.1, 84.6, 0.9);
insert into public.corrections (meal_id, predicted, corrected)
values ('10000000-0000-0000-0000-00000000000a', '{"grams":250}', '{"grams":300}');

do $$ begin
  assert (select user_id from public.meals) = auth.uid(), 'user_id rempli automatiquement';
  insert into public.meals (user_id, type_repas) values ('00000000-0000-0000-0000-00000000000b', 'diner');
  raise exception 'DEVAIT ÉCHOUER : A crée un repas au nom de B';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.foods (food_key, label_fr, categorie, kcal_100g, proteines_100g, glucides_100g, lipides_100g, source)
  values ('pirate', 'Pirate', 'snack', 1, 0, 0, 0, 'x');
  raise exception 'DEVAIT ÉCHOUER : écriture dans foods';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.scan_usage (user_id, day, count) values (auth.uid(), current_date, -99);
  raise exception 'DEVAIT ÉCHOUER : écriture directe dans scan_usage';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  perform public.consume_scan(auth.uid());
  raise exception 'DEVAIT ÉCHOUER : consume_scan appelé par un client';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- en tant que B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$ begin
  assert (select prenom from public.profiles) is null, 'B n''a pas été modifié par A';
  assert (select count(*) from public.meals) = 0, 'B ne voit pas les repas de A';
  assert (select count(*) from public.meal_items) = 0, 'B ne voit pas les éléments de A';
  assert (select count(*) from public.corrections) = 0, 'B ne voit pas les corrections de A';
  update public.meals set total_kcal = 0 where id = '10000000-0000-0000-0000-00000000000a';
  delete from public.meals where id = '10000000-0000-0000-0000-00000000000a';
end $$;

do $$ begin
  insert into public.meal_items (meal_id, label, grams, kcal, proteines, glucides, lipides)
  values ('10000000-0000-0000-0000-00000000000a', 'Intrus', 10, 1, 0, 0, 0);
  raise exception 'DEVAIT ÉCHOUER : B ajoute un élément au repas de A';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- anonyme (non connecté)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  assert (select count(*) from public.foods) > 50, 'la table des plats est publique';
  assert (select count(*) from public.meals) = 0, 'anon ne voit aucun repas';
end $$;

-- ---------------------------------------------------------------- quota (service role)
reset role;
set local role service_role;

do $$
declare r record;
begin
  assert (select count(*) from public.meals where total_kcal = 650) = 1, 'le repas de A est intact';
  for i in 1..2 loop
    select * into r from public.consume_scan('00000000-0000-0000-0000-00000000000a');
    assert r.allowed and r.used = i and r.quota = 2, format('scan gratuit %s autorisé', i);
  end loop;
  select * into r from public.consume_scan('00000000-0000-0000-0000-00000000000a');
  assert not r.allowed and r.used = 2, '3e scan gratuit refusé';

  select * into r from public.consume_scan('00000000-0000-0000-0000-00000000000c');
  assert r.allowed and r.quota = 1, '1er scan invité autorisé';
  select * into r from public.consume_scan('00000000-0000-0000-0000-00000000000c');
  assert not r.allowed, '2e scan invité refusé';

  perform public.release_scan('00000000-0000-0000-0000-00000000000a');
  select * into r from public.consume_scan('00000000-0000-0000-0000-00000000000a');
  assert r.allowed and r.used = 2, 'un scan rendu après échec peut être réutilisé';
end $$;

-- Relance après questions : une seule par scan, uniquement par son propriétaire.
do $$
declare v_scan uuid;
begin
  insert into public.scans (user_id, image_sha256) values ('00000000-0000-0000-0000-00000000000a', repeat('a', 64)) returning id into v_scan;
  assert not public.claim_follow_up(v_scan, '00000000-0000-0000-0000-00000000000b', repeat('a', 64)), 'B ne peut pas relancer le scan de A';
  assert not public.claim_follow_up(v_scan, '00000000-0000-0000-0000-00000000000a', repeat('b', 64)), 'relance refusée avec une autre photo';
  assert public.claim_follow_up(v_scan, '00000000-0000-0000-0000-00000000000a', repeat('a', 64)), 'première relance autorisée';
  assert not public.claim_follow_up(v_scan, '00000000-0000-0000-0000-00000000000a', repeat('a', 64)), 'deuxième relance refusée';
  perform public.release_follow_up(v_scan);
  assert public.claim_follow_up(v_scan, '00000000-0000-0000-0000-00000000000a', repeat('a', 64)), 'relance rendue après échec';
  update public.scans set follow_up_used = false, created_at = now() - interval '2 hours' where id = v_scan;
  assert not public.claim_follow_up(v_scan, '00000000-0000-0000-0000-00000000000a', repeat('a', 64)), 'relance expirée après 30 min';
  insert into public.scan_calls (scan_id, user_id, kind, model, ok, total_tokens)
  values (v_scan, '00000000-0000-0000-0000-00000000000a', 'initial', 'gemini-3.8-flash', true, 1230);
end $$;

-- A consulte son quota restant.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare r record;
begin
  select * into r from public.get_scan_status();
  assert r.used = 2 and r.quota = 2 and r.remaining = 0, 'get_scan_status pour A';
  assert (select count(*) from public.scan_usage) = 1, 'A ne voit que son compteur';
end $$;

-- Suppression du compte : tout part en cascade.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.meals) = 0, 'repas supprimés avec le compte';
  assert (select count(*) from public.meal_items) = 0, 'éléments supprimés avec le compte';
  assert (select count(*) from public.corrections) = 0, 'corrections supprimées avec le compte';
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'profil supprimé';
end $$;

-- Les journaux de scans restent invisibles pour les clients.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ begin
  perform 1 from public.scan_calls;
  raise exception 'DEVAIT ÉCHOUER : lecture de scan_calls par un client';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.claim_follow_up(gen_random_uuid(), auth.uid(), repeat('a', 64));
  raise exception 'DEVAIT ÉCHOUER : claim_follow_up appelé par un client';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------------------------------------------------------------- Premium (Chariow)
set local role service_role;
do $$
declare
  r record;
  v_first timestamptz;
  b constant uuid := '00000000-0000-0000-0000-00000000000b';
begin
  select * into r from public.grant_premium(b, 'sale_1', 'monthly', 30, 1000, 'XOF');
  assert r.granted and r.premium_until between now() + interval '29 days' and now() + interval '31 days', 'mensuel : 30 jours';
  v_first := r.premium_until;
  assert (select quota from public.consume_scan(b)) = 30, 'Premium : 30 scans';

  select * into r from public.grant_premium(b, 'sale_1', 'monthly', 30);
  assert not r.granted and r.premium_until = v_first, 'même vente rejouée : rien de plus';

  select * into r from public.grant_premium(b, 'sale_2', 'yearly', 365);
  assert r.granted and r.premium_until = v_first + interval '365 days', 'annuel : prolonge la fin actuelle';

  update public.profiles set premium_until = now() - interval '1 day' where id = b;
  assert (select quota from public.consume_scan(b)) = 2, 'Premium expiré : retour à 2 scans';
  select * into r from public.grant_premium(b, 'sale_3', 'monthly', 30);
  assert r.premium_until > now() + interval '29 days', 'après expiration : 30 jours à partir de maintenant';

  update public.profiles set plan = 'premium', premium_until = null where id = b;
  select * into r from public.grant_premium(b, 'sale_4', 'monthly', 30);
  assert r.granted and r.premium_until is null, 'Premium permanent : reste permanent';
  assert (select quota from public.consume_scan(b)) = 30, 'Premium permanent : 30 scans';
  assert (select count(*) from public.payments where user_id = b) = 4, 'quatre ventes enregistrées';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.payments) = 4, 'B voit ses paiements';
  assert (select quota from public.get_scan_status()) = 30, 'get_scan_status : Premium';
end $$;
do $$ begin
  update public.profiles set premium_until = now() + interval '10 years' where id = auth.uid();
  raise exception 'DEVAIT ÉCHOUER : B prolonge lui-même son Premium';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.payments (user_id, sale_id, offer, days) values (auth.uid(), 'faux', 'yearly', 365);
  raise exception 'DEVAIT ÉCHOUER : B crée un paiement';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.grant_premium(auth.uid(), 'faux', 'yearly', 365);
  raise exception 'DEVAIT ÉCHOUER : grant_premium appelé par un client';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'Tous les tests RLS sont passés' as resultat;
rollback;
