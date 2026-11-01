create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint posts_body_length check (
    char_length(body) between 1 and 2000
    and body ~ '[^[:space:]]'
  )
);

create index posts_feed_order_idx on public.posts (created_at desc, id desc);
create index posts_author_created_idx on public.posts (author_id, created_at desc);

create table public.player_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_connections_no_self check (requester_id <> recipient_id),
  constraint player_connections_status check (status in ('pending', 'accepted', 'rejected'))
);

create unique index player_connections_active_pair_idx
  on public.player_connections (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  )
  where status in ('pending', 'accepted');
create index player_connections_requester_idx
  on public.player_connections (requester_id, created_at desc);
create index player_connections_recipient_pending_idx
  on public.player_connections (recipient_id, created_at desc)
  where status = 'pending';

create trigger player_connections_set_updated_at
before update on public.player_connections
for each row execute function public.set_updated_at();

alter table public.posts enable row level security;
alter table public.player_connections enable row level security;

create policy "Authenticated users can read posts from public profiles"
on public.posts for select to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles
    where profiles.id = posts.author_id
      and profiles.visibility = 'public'
  )
);

create policy "Users can create posts as themselves"
on public.posts for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
  )
);

create policy "Authors can edit their own posts"
on public.posts for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "Authors can delete their own posts"
on public.posts for delete to authenticated
using (author_id = (select auth.uid()));

create policy "Users can read their own connection requests"
on public.player_connections for select to authenticated
using (
  requester_id = (select auth.uid())
  or recipient_id = (select auth.uid())
);

create policy "Users can request a connection with a public player"
on public.player_connections for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = player_connections.recipient_id
      and profiles.visibility = 'public'
  )
);

create policy "Recipients can respond to pending connection requests"
on public.player_connections for update to authenticated
using (
  recipient_id = (select auth.uid())
  and status = 'pending'
)
with check (
  recipient_id = (select auth.uid())
  and status in ('accepted', 'rejected')
);

create policy "Requesters can cancel pending connection requests"
on public.player_connections for delete to authenticated
using (
  requester_id = (select auth.uid())
  and status = 'pending'
);

revoke all on table public.posts from public, anon, authenticated;
revoke all on table public.player_connections from public, anon, authenticated;

grant select on table public.posts to authenticated;
grant insert (author_id, body) on table public.posts to authenticated;
grant update (body) on table public.posts to authenticated;
grant delete on table public.posts to authenticated;

grant select on table public.player_connections to authenticated;
grant insert (requester_id, recipient_id) on table public.player_connections to authenticated;
grant update (status) on table public.player_connections to authenticated;
grant delete on table public.player_connections to authenticated;
