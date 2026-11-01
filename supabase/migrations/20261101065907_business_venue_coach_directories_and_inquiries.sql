create function public.is_valid_directory_sport_ids(ids text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    pg_catalog.cardinality(ids) <= 20
    and pg_catalog.cardinality(ids) = (
      select pg_catalog.count(distinct sport_id)
      from pg_catalog.unnest(ids) as item(sport_id)
    )
    and not exists (
      select 1
      from pg_catalog.unnest(ids) as item(sport_id)
      where sport_id is null
        or sport_id !~ '^[a-z0-9][a-z0-9-]{0,79}$'
    ),
    false
  );
$$;

create function public.is_valid_directory_specialties(specialties text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    pg_catalog.cardinality(specialties) <= 20
    and pg_catalog.cardinality(specialties) = (
      select pg_catalog.count(distinct pg_catalog.lower(specialty))
      from pg_catalog.unnest(specialties) as item(specialty)
    )
    and not exists (
      select 1
      from pg_catalog.unnest(specialties) as item(specialty)
      where specialty is null
        or char_length(btrim(specialty)) not between 1 and 80
    ),
    false
  );
$$;

revoke all on function public.is_valid_directory_sport_ids(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_directory_specialties(text[]) from public, anon, authenticated;
grant execute on function public.is_valid_directory_sport_ids(text[]) to authenticated;
grant execute on function public.is_valid_directory_specialties(text[]) to authenticated;
grant execute on function public.is_valid_directory_sport_ids(text[]) to service_role;
grant execute on function public.is_valid_directory_specialties(text[]) to service_role;

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  business_type text not null,
  city text not null,
  area text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint business_profiles_type_check check (business_type in ('venue', 'gym', 'club', 'academy')),
  constraint business_profiles_city_length check (char_length(btrim(city)) between 1 and 80),
  constraint business_profiles_area_length check (char_length(area) <= 80),
  constraint business_profiles_status_check check (status in ('draft', 'published'))
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  city text not null,
  area text not null default '',
  sport_ids text[] not null default '{}',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint venues_description_length check (char_length(description) <= 2000),
  constraint venues_city_length check (char_length(btrim(city)) between 1 and 80),
  constraint venues_area_length check (char_length(area) <= 80),
  constraint venues_sport_ids_valid check (public.is_valid_directory_sport_ids(sport_ids)),
  constraint venues_status_check check (status in ('draft', 'published'))
);

create table public.coach_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  city text not null,
  area text not null default '',
  sport_ids text[] not null default '{}',
  specialties text[] not null default '{}',
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint coach_profiles_headline_length check (char_length(headline) <= 120),
  constraint coach_profiles_bio_length check (char_length(bio) <= 2000),
  constraint coach_profiles_city_length check (char_length(btrim(city)) between 1 and 80),
  constraint coach_profiles_area_length check (char_length(area) <= 80),
  constraint coach_profiles_sport_ids_valid check (public.is_valid_directory_sport_ids(sport_ids)),
  constraint coach_profiles_specialties_valid check (public.is_valid_directory_specialties(specialties))
);

create table public.venue_inquiries (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_inquiries_message_length check (char_length(btrim(message)) between 1 and 2000),
  constraint venue_inquiries_status_check check (status in ('new', 'responded', 'closed'))
);

create table public.coach_inquiries (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_inquiries_not_self check (coach_id <> requester_id),
  constraint coach_inquiries_message_length check (char_length(btrim(message)) between 1 and 2000),
  constraint coach_inquiries_status_check check (status in ('new', 'responded', 'closed'))
);

create index business_profiles_owner_idx on public.business_profiles (owner_id, created_at desc);
create index business_profiles_published_idx on public.business_profiles (city, name) where status = 'published';
create index venues_business_idx on public.venues (business_id, created_at desc);
create index venues_discovery_idx on public.venues (city, name) where status = 'published';
create index venues_sport_ids_idx on public.venues using gin (sport_ids);
create index coach_profiles_discovery_idx on public.coach_profiles (city, user_id) where is_published;
create index coach_profiles_sport_ids_idx on public.coach_profiles using gin (sport_ids);
create index venue_inquiries_venue_idx on public.venue_inquiries (venue_id, created_at desc);
create index venue_inquiries_requester_idx on public.venue_inquiries (requester_id, created_at desc);
create unique index venue_inquiries_one_open_per_requester_idx
  on public.venue_inquiries (venue_id, requester_id) where status = 'new';
create index coach_inquiries_coach_idx on public.coach_inquiries (coach_id, created_at desc);
create index coach_inquiries_requester_idx on public.coach_inquiries (requester_id, created_at desc);
create unique index coach_inquiries_one_open_per_requester_idx
  on public.coach_inquiries (coach_id, requester_id) where status = 'new';

create trigger business_profiles_set_updated_at
before update on public.business_profiles
for each row execute function public.set_updated_at();

create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

create trigger coach_profiles_set_updated_at
before update on public.coach_profiles
for each row execute function public.set_updated_at();

create trigger venue_inquiries_set_updated_at
before update on public.venue_inquiries
for each row execute function public.set_updated_at();

create trigger coach_inquiries_set_updated_at
before update on public.coach_inquiries
for each row execute function public.set_updated_at();

alter table public.business_profiles enable row level security;
alter table public.venues enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.venue_inquiries enable row level security;
alter table public.coach_inquiries enable row level security;

revoke all on table public.business_profiles, public.venues, public.coach_profiles,
  public.venue_inquiries, public.coach_inquiries from public, anon, authenticated;

grant select on public.business_profiles, public.venues, public.coach_profiles to authenticated;
grant insert (owner_id, name, business_type, city, area, status)
  on public.business_profiles to authenticated;
grant update (name, business_type, city, area, status)
  on public.business_profiles to authenticated;
grant insert (business_id, name, description, city, area, sport_ids, status)
  on public.venues to authenticated;
grant update (business_id, name, description, city, area, sport_ids, status)
  on public.venues to authenticated;
grant insert (user_id, headline, bio, city, area, sport_ids, specialties, is_published)
  on public.coach_profiles to authenticated;
grant update (headline, bio, city, area, sport_ids, specialties, is_published)
  on public.coach_profiles to authenticated;
grant select on public.venue_inquiries, public.coach_inquiries to authenticated;
grant insert (venue_id, requester_id, message) on public.venue_inquiries to authenticated;
grant update (status) on public.venue_inquiries to authenticated;
grant insert (coach_id, requester_id, message) on public.coach_inquiries to authenticated;
grant update (status) on public.coach_inquiries to authenticated;

create policy "Owners and public business listings are readable"
on public.business_profiles for select to authenticated
using (owner_id = (select auth.uid()) or status = 'published');

create policy "Users can create their own business profile"
on public.business_profiles for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can update their business profiles"
on public.business_profiles for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners and published venues are readable"
on public.venues for select to authenticated
using (
  exists (
    select 1 from public.business_profiles as business
    where business.id = venues.business_id
      and (
        business.owner_id = (select auth.uid())
        or (business.status = 'published' and venues.status = 'published')
      )
  )
);

create policy "Business owners can create venue listings"
on public.venues for insert to authenticated
with check (
  exists (
    select 1 from public.business_profiles as business
    where business.id = venues.business_id
      and business.owner_id = (select auth.uid())
  )
);

create policy "Business owners can update venue listings"
on public.venues for update to authenticated
using (
  exists (
    select 1 from public.business_profiles as business
    where business.id = venues.business_id
      and business.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.business_profiles as business
    where business.id = venues.business_id
      and business.owner_id = (select auth.uid())
  )
);

create policy "Coaches can read own profiles and athletes can discover published coaches"
on public.coach_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    is_published
    and exists (
      select 1 from public.profiles as profile
      where profile.id = coach_profiles.user_id
        and profile.visibility = 'public'
    )
  )
);

create policy "Users can create their own coach profile"
on public.coach_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own coach profile"
on public.coach_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Inquirers and venue owners can read venue inquiries"
on public.venue_inquiries for select to authenticated
using (
  requester_id = (select auth.uid())
  or exists (
    select 1
    from public.venues as venue
    join public.business_profiles as business on business.id = venue.business_id
    where venue.id = venue_inquiries.venue_id
      and business.owner_id = (select auth.uid())
  )
);

create policy "Signed-in users can inquire about published venues"
on public.venue_inquiries for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and exists (
    select 1
    from public.venues as venue
    join public.business_profiles as business on business.id = venue.business_id
    where venue.id = venue_inquiries.venue_id
      and venue.status = 'published'
      and business.status = 'published'
      and business.owner_id <> (select auth.uid())
  )
);

create policy "Venue owners can update inquiry status"
on public.venue_inquiries for update to authenticated
using (
  exists (
    select 1
    from public.venues as venue
    join public.business_profiles as business on business.id = venue.business_id
    where venue.id = venue_inquiries.venue_id
      and business.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.venues as venue
    join public.business_profiles as business on business.id = venue.business_id
    where venue.id = venue_inquiries.venue_id
      and business.owner_id = (select auth.uid())
  )
);

create policy "Inquirers and coaches can read coach inquiries"
on public.coach_inquiries for select to authenticated
using (requester_id = (select auth.uid()) or coach_id = (select auth.uid()));

create policy "Signed-in users can inquire about published coaches"
on public.coach_inquiries for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and coach_id <> (select auth.uid())
  and exists (
    select 1 from public.coach_profiles as coach
    where coach.user_id = coach_inquiries.coach_id
      and coach.is_published
  )
);

create policy "Coaches can update inquiry status"
on public.coach_inquiries for update to authenticated
using (coach_id = (select auth.uid()))
with check (coach_id = (select auth.uid()));

create function public.discover_public_venues(
  p_query text default null,
  p_city text default null,
  p_sport_id text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  business_id uuid,
  name text,
  description text,
  city text,
  area text,
  sport_ids text[],
  business_name text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select venue.id, venue.business_id, venue.name, venue.description, venue.city,
    venue.area, venue.sport_ids, business.name, venue.created_at
  from public.venues as venue
  join public.business_profiles as business on business.id = venue.business_id
  where (select auth.uid()) is not null
    and venue.status = 'published'
    and business.status = 'published'
    and (
      nullif(btrim(p_query), '') is null
      or pg_catalog.strpos(
        pg_catalog.lower(pg_catalog.concat_ws(' ', venue.name, venue.description, venue.area, business.name)),
        pg_catalog.lower(btrim(p_query))
      ) > 0
    )
    and (
      nullif(btrim(p_city), '') is null
      or pg_catalog.strpos(pg_catalog.lower(venue.city), pg_catalog.lower(btrim(p_city))) > 0
    )
    and (p_sport_id is null or p_sport_id = any(venue.sport_ids))
  order by venue.created_at desc, venue.id
  limit case when p_limit between 1 and 50 then p_limit else 0 end
  offset case when p_offset between 0 and 10000 then p_offset else 0 end;
$$;

create function public.discover_public_coaches(
  p_query text default null,
  p_city text default null,
  p_sport_id text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  headline text,
  bio text,
  city text,
  area text,
  sport_ids text[],
  specialties text[],
  updated_at timestamptz,
  username text,
  display_name text,
  avatar_object_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select coach.user_id, coach.headline, coach.bio, coach.city, coach.area,
    coach.sport_ids, coach.specialties, coach.updated_at, profile.username,
    profile.display_name, profile.avatar_object_path
  from public.coach_profiles as coach
  join public.profiles as profile on profile.id = coach.user_id
  where (select auth.uid()) is not null
    and coach.is_published
    and profile.visibility = 'public'
    and (
      nullif(btrim(p_query), '') is null
      or pg_catalog.strpos(
        pg_catalog.lower(pg_catalog.concat_ws(' ',
          profile.username, profile.display_name, coach.headline, coach.bio,
          pg_catalog.array_to_string(coach.specialties, ' ')
        )),
        pg_catalog.lower(btrim(p_query))
      ) > 0
    )
    and (
      nullif(btrim(p_city), '') is null
      or pg_catalog.strpos(pg_catalog.lower(coach.city), pg_catalog.lower(btrim(p_city))) > 0
    )
    and (p_sport_id is null or p_sport_id = any(coach.sport_ids))
  order by coach.updated_at desc, coach.user_id
  limit case when p_limit between 1 and 50 then p_limit else 0 end
  offset case when p_offset between 0 and 10000 then p_offset else 0 end;
$$;

revoke all on function public.discover_public_venues(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.discover_public_coaches(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.discover_public_venues(text, text, text, integer, integer) to authenticated;
grant execute on function public.discover_public_coaches(text, text, text, integer, integer) to authenticated;

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    notification_type in (
      'post_like', 'post_comment', 'new_follower',
      'connection_request', 'connection_accepted',
      'venue_inquiry', 'coach_inquiry'
    )
  );

create function public.notify_venue_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.requester_id <> (select auth.uid()) then
    raise exception 'Inquiry actor must match the authenticated user';
  end if;

  select business.owner_id into recipient_id
  from public.venues as venue
  join public.business_profiles as business on business.id = venue.business_id
  where venue.id = new.venue_id;

  if recipient_id is not null and recipient_id <> new.requester_id then
    insert into public.notifications (user_id, actor_id, notification_type, entity_id)
    values (recipient_id, new.requester_id, 'venue_inquiry', new.id);
  end if;
  return new;
end;
$$;

create function public.notify_coach_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requester_id <> (select auth.uid()) then
    raise exception 'Inquiry actor must match the authenticated user';
  end if;

  insert into public.notifications (user_id, actor_id, notification_type, entity_id)
  values (new.coach_id, new.requester_id, 'coach_inquiry', new.id);
  return new;
end;
$$;

revoke all on function public.notify_venue_inquiry() from public, anon, authenticated;
revoke all on function public.notify_coach_inquiry() from public, anon, authenticated;

create trigger venue_inquiries_notify_owner
after insert on public.venue_inquiries
for each row execute function public.notify_venue_inquiry();

create trigger coach_inquiries_notify_coach
after insert on public.coach_inquiries
for each row execute function public.notify_coach_inquiry();