create table public.user_onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  selected_roles text[] not null default '{}',
  completed_roles text[] not null default '{}',
  active_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_onboarding_selected_roles_check
    check (selected_roles <@ array['athlete', 'business']::text[]),
  constraint user_onboarding_completed_roles_check
    check (completed_roles <@ array['athlete', 'business']::text[]),
  constraint user_onboarding_completed_subset_check
    check (completed_roles <@ selected_roles),
  constraint user_onboarding_active_role_check
    check (active_role is null or active_role = any (selected_roles))
);

create index user_onboarding_active_role_idx on public.user_onboarding (active_role);

alter table public.user_onboarding enable row level security;

create policy "Users can read their own onboarding preferences"
on public.user_onboarding for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own onboarding preferences"
on public.user_onboarding for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own onboarding preferences"
on public.user_onboarding for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update on public.user_onboarding to authenticated;
revoke all on public.user_onboarding from anon;

create trigger user_onboarding_set_updated_at
before update on public.user_onboarding
for each row execute function public.set_updated_at();
