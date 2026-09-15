create table if not exists agent_ticks (
  id serial primary key,
  address text not null,
  symbol text not null,
  stage text not null,
  progress real not null default 0,
  market_cap real not null default 0,
  buy_ratio real not null default 0,
  ch5m real not null default 0,
  smart_degen integer not null default 0,
  kind text not null default 'tick',
  score real not null default 0,
  seen_at timestamptz not null default now()
);
create index if not exists agent_ticks_addr_seen on agent_ticks (address, seen_at desc);

create table if not exists agent_signals (
  id serial primary key,
  kind text not null,
  address text not null,
  symbol text not null,
  reason text not null,
  score real not null default 0,
  stage text not null,
  seen_at timestamptz not null default now()
);
create index if not exists agent_signals_seen on agent_signals (seen_at desc);

create table if not exists agent_weights (
  id integer primary key,
  curve real not null default 1,
  sm real not null default 1,
  migrate real not null default 1,
  updated_at timestamptz not null default now()
);
insert into agent_weights (id) values (1) on conflict (id) do nothing;
