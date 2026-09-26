-- Paiements Premium via CinetPay (remplace Chariow).
-- Chaque paiement est préparé par le serveur (montant, offre, utilisateur) et enregistré ici avant
-- l'ouverture de la page CinetPay : la notification ne sert qu'à déclencher la vérification.

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('chariow', 'cinetpay'));
alter table public.payments alter column provider set default 'cinetpay';

create table public.payment_intents (
  -- Identifiant marchand envoyé à CinetPay (unique, 30 caractères au plus).
  merchant_transaction_id text primary key check (char_length(merchant_transaction_id) between 1 and 30),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'cinetpay' check (provider in ('cinetpay')),
  offer text not null check (offer in ('monthly', 'yearly')),
  amount integer not null check (amount > 0),
  currency text not null check (currency in ('XOF', 'XAF', 'GNF', 'CDF')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- Jeton propre à la transaction, renvoyé par CinetPay dans la notification.
  notify_token text,
  transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index payment_intents_user_created on public.payment_intents (user_id, created_at desc);

-- Réservé au service role (Edge Functions) : RLS sans politique pour les clients.
alter table public.payment_intents enable row level security;
revoke all on public.payment_intents from anon, authenticated;
