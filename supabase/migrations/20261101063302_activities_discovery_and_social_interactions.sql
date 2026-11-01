create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  sport_id text not null,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text not null,
  city text not null,
  capacity smallint not null,
  required_skill_level text,
  visibility text not null default 'public',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_sport_id_format check (sport_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint activities_title_length check (
    char_length(btrim(title)) between 3 and 120
    and title ~ '[^[:space:]]'
  ),
  constraint activities_description_length check (char_length(description) <= 2000),
  constraint activities_venue_name_length check (
    char_length(btrim(venue_name)) between 1 and 160
  ),
  constraint activities_city_length check (char_length(btrim(city)) between 1 and 80),
  constraint activities_capacity_range check (capacity between 2 and 200),
  constraint activities_skill_level_check check (
    required_skill_level is null
    or required_skill_level in ('beginner', 'intermediate', 'advanced', 'professional')
  ),
  constraint activities_visibility_check check (visibility in ('public', 'private')),
  constraint activities_status_check check (status in ('published', 'cancelled')),
  constraint activities_end_after_start check (ends_at is null or ends_at > starts_at)
);

create table public.activity_participants (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activities_discovery_idx
  on public.activities (starts_at, id)
  where status = 'published' and visibility = 'public';
create index activities_organizer_idx
  on public.activities (organizer_id, starts_at desc);
create index activities_sport_city_idx
  on public.activities (sport_id, city, starts_at)
  where status = 'published' and visibility = 'public';
create index activity_participants_user_idx
  on public.activity_participants (user_id, joined_at desc);

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;

revoke all on table public.activities, public.activity_participants
  from public, anon, authenticated;
grant select on table public.activities, public.activity_participants to authenticated;

create policy "Users can read published public activities or their own"
on public.activities for select to authenticated
using (
  (status = 'published' and visibility = 'public')
  or organizer_id = (select auth.uid())
);

create policy "Users can read participants in public activities or their own participation"
on public.activity_participants for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.activities as activity
    where activity.id = activity_participants.activity_id
      and (
        (activity.status = 'published' and activity.visibility = 'public')
        or activity.organizer_id = (select auth.uid())
      )
  )
);

create table public.player_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint player_follows_no_self check (follower_id <> followed_id)
);

create index player_follows_followed_idx
  on public.player_follows (followed_id, created_at desc);

alter table public.player_follows enable row level security;
revoke all on table public.player_follows from public, anon, authenticated;
grant select, insert, delete on table public.player_follows to authenticated;

create policy "Users can read their own follow relationships"
on public.player_follows for select to authenticated
using (
  follower_id = (select auth.uid())
  or followed_id = (select auth.uid())
);

create policy "Users can follow public profiles"
on public.player_follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and exists (
    select 1 from public.profiles as target
    where target.id = followed_id
      and target.visibility = 'public'
  )
);

create policy "Users can unfollow as themselves"
on public.player_follows for delete to authenticated
using (follower_id = (select auth.uid()));

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

alter table public.post_likes enable row level security;
revoke all on table public.post_likes from public, anon, authenticated;
grant select, insert, delete on table public.post_likes to authenticated;

create policy "Users can read likes on visible posts"
on public.post_likes for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.posts as post
    where post.id = post_likes.post_id
  )
);

create policy "Users can like visible posts"
on public.post_likes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.posts as post
    where post.id = post_likes.post_id
  )
);

create policy "Users can remove their own likes"
on public.post_likes for delete to authenticated
using (user_id = (select auth.uid()));

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_body_length check (
    char_length(btrim(body)) between 1 and 1000
    and body ~ '[^[:space:]]'
  )
);

create index post_comments_post_order_idx
  on public.post_comments (post_id, created_at, id);

create trigger post_comments_set_updated_at
before update on public.post_comments
for each row execute function public.set_updated_at();

alter table public.post_comments enable row level security;
revoke all on table public.post_comments from public, anon, authenticated;
grant select on table public.post_comments to authenticated;
grant insert (post_id, author_id, body) on table public.post_comments to authenticated;
grant update (body) on table public.post_comments to authenticated;
grant delete on table public.post_comments to authenticated;

create policy "Users can read comments on visible posts"
on public.post_comments for select to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.posts as post
    where post.id = post_comments.post_id
  )
);

create policy "Users can comment on visible posts as themselves"
on public.post_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.posts as post
    where post.id = post_comments.post_id
  )
);

create policy "Authors can edit their own comments"
on public.post_comments for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "Authors can delete their own comments"
on public.post_comments for delete to authenticated
using (author_id = (select auth.uid()));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  notification_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_type_check check (
    notification_type in (
      'post_like', 'post_comment', 'new_follower',
      'connection_request', 'connection_accepted'
    )
  )
);

create index notifications_user_order_idx
  on public.notifications (user_id, created_at desc, id desc);

alter table public.notifications enable row level security;
revoke all on table public.notifications from public, anon, authenticated;
grant select, update (read_at) on table public.notifications to authenticated;

create policy "Users can read their own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can mark their own notifications as read"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.user_id <> (select auth.uid()) then
    raise exception 'Like actor must match the authenticated user';
  end if;

  select post.author_id into recipient_id
  from public.posts as post
  where post.id = new.post_id;

  if recipient_id is not null and recipient_id <> new.user_id then
    insert into public.notifications (user_id, actor_id, notification_type, entity_id)
    values (recipient_id, new.user_id, 'post_like', new.post_id);
  end if;
  return new;
end;
$$;

create function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
begin
  if new.author_id <> (select auth.uid()) then
    raise exception 'Comment author must match the authenticated user';
  end if;

  select post.author_id into recipient_id
  from public.posts as post
  where post.id = new.post_id;

  if recipient_id is not null and recipient_id <> new.author_id then
    insert into public.notifications (user_id, actor_id, notification_type, entity_id)
    values (recipient_id, new.author_id, 'post_comment', new.post_id);
  end if;
  return new;
end;
$$;

create function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.follower_id <> (select auth.uid()) then
    raise exception 'Follow actor must match the authenticated user';
  end if;

  insert into public.notifications (user_id, actor_id, notification_type, entity_id)
  values (new.followed_id, new.follower_id, 'new_follower', new.follower_id);
  return new;
end;
$$;

create function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requester_id <> (select auth.uid()) then
    raise exception 'Connection request actor must match the authenticated user';
  end if;

  insert into public.notifications (user_id, actor_id, notification_type, entity_id)
  values (new.recipient_id, new.requester_id, 'connection_request', new.id);
  return new;
end;
$$;

create function public.notify_connection_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    if new.recipient_id <> (select auth.uid()) then
      raise exception 'Connection response actor must match the authenticated user';
    end if;

    insert into public.notifications (user_id, actor_id, notification_type, entity_id)
    values (new.requester_id, new.recipient_id, 'connection_accepted', new.id);
  end if;
  return new;
end;
$$;

create trigger post_like_notification
after insert on public.post_likes
for each row execute function public.notify_post_like();

create trigger post_comment_notification
after insert on public.post_comments
for each row execute function public.notify_post_comment();

create trigger new_follower_notification
after insert on public.player_follows
for each row execute function public.notify_new_follower();

create trigger connection_request_notification
after insert on public.player_connections
for each row execute function public.notify_connection_request();

create trigger connection_accepted_notification
after update of status on public.player_connections
for each row execute function public.notify_connection_accepted();

revoke all on function public.notify_post_like() from public, anon, authenticated;
revoke all on function public.notify_post_comment() from public, anon, authenticated;
revoke all on function public.notify_new_follower() from public, anon, authenticated;
revoke all on function public.notify_connection_request() from public, anon, authenticated;
revoke all on function public.notify_connection_accepted() from public, anon, authenticated;

create function public.discover_public_athletes(
  p_query text default null,
  p_city text default null,
  p_sport_id text default null,
  p_skill_level text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  city text,
  avatar_object_path text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_limit is null or p_limit not between 1 and 50
    or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'Invalid discovery page';
  end if;
  if p_skill_level is not null and p_skill_level not in ('beginner', 'intermediate', 'advanced', 'professional') then
    raise exception 'Invalid skill level';
  end if;
  if p_sport_id is not null and p_sport_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid sport';
  end if;
  if p_query is not null and char_length(btrim(p_query)) > 80 then
    raise exception 'Search query is too long';
  end if;
  if p_city is not null and char_length(btrim(p_city)) > 80 then
    raise exception 'City filter is too long';
  end if;

  return query
  select profile.id, profile.username, profile.display_name, profile.bio, profile.city, profile.avatar_object_path
  from public.profiles as profile
  where profile.visibility = 'public'
    and profile.id <> (select auth.uid())
    and (
      p_query is null
      or profile.username ilike '%' || btrim(p_query) || '%'
      or profile.display_name ilike '%' || btrim(p_query) || '%'
      or profile.bio ilike '%' || btrim(p_query) || '%'
    )
    and (p_city is null or profile.city ilike '%' || btrim(p_city) || '%')
    and (
      p_sport_id is null
      or exists (
        select 1
        from public.profile_sports_preferences as preference
        where preference.user_id = profile.id
          and preference.sport_id = p_sport_id
          and (p_skill_level is null or preference.skill_level = p_skill_level)
      )
    )
    and (
      p_sport_id is not null
      or p_skill_level is null
      or exists (
        select 1
        from public.profile_sports_preferences as preference
        where preference.user_id = profile.id
          and preference.skill_level = p_skill_level
      )
    )
  order by profile.username, profile.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.discover_public_athletes(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.discover_public_athletes(text, text, text, text, integer, integer)
  to authenticated;

create function public.create_my_activity(
  p_sport_id text,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_name text,
  p_city text,
  p_capacity smallint,
  p_required_skill_level text,
  p_visibility text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  new_activity_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_sport_id is null or p_sport_id !~ '^[a-z0-9][a-z0-9-]{0,79}$'
    or p_title is null or char_length(btrim(p_title)) not between 3 and 120
    or p_description is null or char_length(p_description) > 2000
    or p_starts_at is null or p_starts_at <= now()
    or (p_ends_at is not null and p_ends_at <= p_starts_at)
    or p_venue_name is null or char_length(btrim(p_venue_name)) not between 1 and 160
    or p_city is null or char_length(btrim(p_city)) not between 1 and 80
    or p_capacity is null or p_capacity not between 2 and 200
    or (p_required_skill_level is not null and p_required_skill_level not in ('beginner', 'intermediate', 'advanced', 'professional'))
    or p_visibility is null or p_visibility not in ('public', 'private')
  then
    raise exception 'One or more activity details are invalid';
  end if;

  insert into public.activities (
    organizer_id, sport_id, title, description, starts_at, ends_at,
    venue_name, city, capacity, required_skill_level, visibility
  )
  values (
    owner_id, p_sport_id, btrim(p_title), btrim(p_description), p_starts_at, p_ends_at,
    btrim(p_venue_name), btrim(p_city), p_capacity, p_required_skill_level, p_visibility
  )
  returning id into new_activity_id;

  insert into public.activity_participants (activity_id, user_id)
  values (new_activity_id, owner_id);

  return new_activity_id;
end;
$$;

create function public.update_my_activity(
  p_activity_id uuid,
  p_sport_id text,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue_name text,
  p_city text,
  p_capacity smallint,
  p_required_skill_level text,
  p_visibility text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  current_status text;
  current_participants integer;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_activity_id is null then
    raise exception 'Activity not found or access denied';
  end if;
  select activity.status into current_status
  from public.activities as activity
  where activity.id = p_activity_id and activity.organizer_id = owner_id
  for update;
  if not found then
    raise exception 'Activity not found or access denied';
  end if;
  if current_status <> 'published' then
    raise exception 'Only published activities can be edited';
  end if;

  select count(*) into current_participants
  from public.activity_participants as participant
  where participant.activity_id = p_activity_id;
  if p_capacity is null or p_capacity not between 2 and 200 or p_capacity < current_participants then
    raise exception 'Capacity cannot be lower than the current participant count';
  end if;
  if p_visibility = 'private' and current_participants > 1 then
    raise exception 'Activities with participants cannot be made private';
  end if;
  if p_sport_id is null or p_sport_id !~ '^[a-z0-9][a-z0-9-]{0,79}$'
    or p_title is null or char_length(btrim(p_title)) not between 3 and 120
    or p_description is null or char_length(p_description) > 2000
    or p_starts_at is null or p_starts_at <= now()
    or (p_ends_at is not null and p_ends_at <= p_starts_at)
    or p_venue_name is null or char_length(btrim(p_venue_name)) not between 1 and 160
    or p_city is null or char_length(btrim(p_city)) not between 1 and 80
    or (p_required_skill_level is not null and p_required_skill_level not in ('beginner', 'intermediate', 'advanced', 'professional'))
    or p_visibility is null or p_visibility not in ('public', 'private')
  then
    raise exception 'One or more activity details are invalid';
  end if;

  update public.activities
  set sport_id = p_sport_id,
      title = btrim(p_title),
      description = btrim(p_description),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      venue_name = btrim(p_venue_name),
      city = btrim(p_city),
      capacity = p_capacity,
      required_skill_level = p_required_skill_level,
      visibility = p_visibility
  where id = p_activity_id and organizer_id = owner_id;
end;
$$;

create function public.cancel_my_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  update public.activities
  set status = 'cancelled'
  where id = p_activity_id
    and organizer_id = owner_id
    and status = 'published';
  if not found then
    raise exception 'Activity not found or access denied';
  end if;
end;
$$;

create function public.join_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  target public.activities%rowtype;
  participant_count integer;
  player_skill text;
  skill_rank integer;
  required_rank integer;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_activity_id is null then
    raise exception 'Activity not found';
  end if;

  select activity.* into target
  from public.activities as activity
  where activity.id = p_activity_id
  for update;
  if not found then
    raise exception 'Activity not found';
  end if;
  if target.status <> 'published' or target.visibility <> 'public' or target.starts_at <= now() then
    raise exception 'This activity is not open for joining';
  end if;
  if exists (
    select 1 from public.activity_participants as participant
    where participant.activity_id = p_activity_id and participant.user_id = owner_id
  ) then
    raise exception 'You have already joined this activity';
  end if;

  if target.required_skill_level is not null then
    select preference.skill_level into player_skill
    from public.profile_sports_preferences as preference
    where preference.user_id = owner_id
      and preference.sport_id = target.sport_id;
    skill_rank := case player_skill
      when 'beginner' then 1
      when 'intermediate' then 2
      when 'advanced' then 3
      when 'professional' then 4
      else 0
    end;
    required_rank := case target.required_skill_level
      when 'beginner' then 1
      when 'intermediate' then 2
      when 'advanced' then 3
      when 'professional' then 4
      else 0
    end;
    if skill_rank < required_rank then
      raise exception 'Your saved skill level does not meet this activity requirement';
    end if;
  end if;

  select count(*) into participant_count
  from public.activity_participants as participant
  where participant.activity_id = p_activity_id;
  if participant_count >= target.capacity then
    raise exception 'This activity is full';
  end if;

  insert into public.activity_participants (activity_id, user_id)
  values (p_activity_id, owner_id);
end;
$$;

create function public.leave_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  organizer uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  select activity.organizer_id into organizer
  from public.activities as activity
  where activity.id = p_activity_id
  for update;
  if not found then
    raise exception 'Activity not found';
  end if;
  if organizer = owner_id then
    raise exception 'The organizer cannot leave; cancel the activity instead';
  end if;
  delete from public.activity_participants
  where activity_id = p_activity_id and user_id = owner_id;
  if not found then
    raise exception 'You have not joined this activity';
  end if;
end;
$$;

create function public.list_my_activities(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  organizer_id uuid,
  sport_id text,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text,
  city text,
  capacity smallint,
  required_skill_level text,
  visibility text,
  status text,
  participant_count bigint,
  current_user_joined boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_limit is null or p_limit not between 1 and 100
    or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'Invalid activity page';
  end if;

  return query
  select
    activity.id,
    activity.organizer_id,
    activity.sport_id,
    activity.title,
    activity.description,
    activity.starts_at,
    activity.ends_at,
    activity.venue_name,
    activity.city,
    activity.capacity,
    activity.required_skill_level,
    activity.visibility,
    activity.status,
    (select count(*) from public.activity_participants as participant
      where participant.activity_id = activity.id),
    exists (
      select 1 from public.activity_participants as participant
      where participant.activity_id = activity.id and participant.user_id = owner_id
    )
  from public.activities as activity
  where activity.organizer_id = owner_id
    or exists (
      select 1 from public.activity_participants as participant
      where participant.activity_id = activity.id and participant.user_id = owner_id
    )
  order by activity.starts_at desc, activity.id desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.create_my_activity(text, text, text, timestamptz, timestamptz, text, text, smallint, text, text)
  from public, anon;
revoke all on function public.update_my_activity(uuid, text, text, text, timestamptz, timestamptz, text, text, smallint, text, text)
  from public, anon;
revoke all on function public.cancel_my_activity(uuid) from public, anon;
revoke all on function public.join_activity(uuid) from public, anon;
revoke all on function public.leave_activity(uuid) from public, anon;
revoke all on function public.list_my_activities(integer, integer) from public, anon;
grant execute on function public.create_my_activity(text, text, text, timestamptz, timestamptz, text, text, smallint, text, text)
  to authenticated;
grant execute on function public.update_my_activity(uuid, text, text, text, timestamptz, timestamptz, text, text, smallint, text, text)
  to authenticated;
grant execute on function public.cancel_my_activity(uuid) to authenticated;
grant execute on function public.join_activity(uuid) to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;
grant execute on function public.list_my_activities(integer, integer) to authenticated;