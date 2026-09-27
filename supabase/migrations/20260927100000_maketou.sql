-- Paiements Premium via Maketou (remplace CinetPay, jamais mis en service).
-- Chaque paiement est préparé par le serveur (offre, montant, utilisateur) et enregistré ici avant
-- l'ouverture de la page Maketou. Maketou n'envoyant pas de notification, le panier est relu
-- (retour du navigateur ou action « confirm » de l'app) : seul le statut « completed » crédite.

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('chariow', 'cinetpay', 'maketou'));
alter table public.payments alter column provider set default 'maketou';

drop table if exists public.payment_intents;

create table public.payment_intents (
  -- Identifiant interne, placé dans l'adresse de retour et les métadonnées du panier.
  id uuid primary key,
  -- Panier Maketou (renseigné juste après sa création).
  cart_id uuid unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'maketou' check (provider = 'maketou'),
  offer text not null check (offer in ('monthly', 'yearly')),
  amount integer not null check (amount > 0),
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index payment_intents_user_pending on public.payment_intents (user_id, created_at desc) where status = 'pending';

-- Réservé au service role (Edge Functions) : RLS sans politique pour les clients.
alter table public.payment_intents enable row level security;
revoke all on public.payment_intents from anon, authenticated;
