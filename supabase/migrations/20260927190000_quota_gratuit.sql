-- Le compte gratuit passe de 2 à 1 scan par jour : le coût d'un scan (appel à l'IA) est payé par
-- l'éditeur, et l'écart avec le Premium doit rester lisible. Invité et gratuit sont désormais
-- au même niveau ; seul le compte permet de garder son journal d'un téléphone à l'autre.
create or replace function public.scan_quota(p_plan text, p_is_anonymous boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_anonymous then 1
    when p_plan = 'premium' then 30
    else 1
  end;
$$;
