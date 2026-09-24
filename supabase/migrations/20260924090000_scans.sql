-- Suivi des scans IA : un scan = un appel facturé au quota, avec au plus une relance
-- gratuite si l'utilisateur répond aux questions de clarification.
-- Chaque appel Gemini est journalisé avec ses tokens pour suivre le coût réel.

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Passe à true quand la relance (réponses aux questions) a été utilisée.
  follow_up_used boolean not null default false,
  -- Empreinte de la photo : la relance gratuite doit porter sur la même image.
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  photo_path text
);

create index scans_user_created on public.scans (user_id, created_at desc);

create table public.scan_calls (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('initial', 'follow_up')),
  attempt smallint not null default 1,
  model text not null,
  ok boolean not null,
  error text,
  prompt_tokens integer,
  output_tokens integer,
  thoughts_tokens integer,
  total_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index scan_calls_user_created on public.scan_calls (user_id, created_at desc);

-- Accès réservé au service role (Edge Function) : RLS sans politique pour les clients.
alter table public.scans enable row level security;
alter table public.scan_calls enable row level security;
revoke all on public.scans, public.scan_calls from anon, authenticated;

-- Réserve la relance d'un scan de façon atomique : une seule par scan, scan récent,
-- même utilisateur et même photo.
create or replace function public.claim_follow_up(p_scan_id uuid, p_user_id uuid, p_image_sha256 text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.scans
    set follow_up_used = true
    where id = p_scan_id
      and user_id = p_user_id
      and image_sha256 = p_image_sha256
      and not follow_up_used
      and created_at > now() - interval '30 minutes'
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Rend la relance si l'analyse a échoué.
create or replace function public.release_follow_up(p_scan_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.scans set follow_up_used = false where id = p_scan_id;
$$;

revoke execute on function public.claim_follow_up(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.release_follow_up(uuid) from public, anon, authenticated;
grant execute on function public.claim_follow_up(uuid, uuid, text) to service_role;
grant execute on function public.release_follow_up(uuid) to service_role;

-- Coût par utilisateur et par jour (heure du Bénin), pour le suivi dans le SQL Editor.
create view public.scan_costs_daily
with (security_invoker = true)
as
select
  user_id,
  (created_at at time zone 'Africa/Porto-Novo')::date as day,
  count(*) as calls,
  count(*) filter (where not ok) as failed_calls,
  sum(prompt_tokens) as prompt_tokens,
  sum(output_tokens) as output_tokens,
  sum(thoughts_tokens) as thoughts_tokens,
  sum(total_tokens) as total_tokens
from public.scan_calls
group by 1, 2;

revoke all on public.scan_costs_daily from anon, authenticated;
