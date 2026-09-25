-- Scans illimités pendant la phase de test : même plafond très haut pour tous
-- (invité, gratuit, premium). Le compteur scan_usage continue de mesurer l'usage.
-- La vraie limite reste celle de la clé Gemini (quota gratuit de Google).
-- Pour rétablir des limites : redéfinir cette fonction, par exemple
--   case when p_is_anonymous then 1 when p_plan = 'premium' then 30 else 3 end
-- 100000 est aussi le seuil à partir duquel l'app affiche « Scans illimités ».
create or replace function public.scan_quota(p_plan text, p_is_anonymous boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select 100000;
$$;
