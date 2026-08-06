-- 0001_foundation: profiles, organizations, workspaces, members, invitations, audit logs
-- Tenancy root + RLS helpers. See docs/02-database.md.

create schema if not exists private;

create type public.org_role as enum (
  'org_admin', 'marketing_manager', 'designer', 'copywriter', 'viewer'
);

-- ---------------------------------------------------------------- utilities

create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------------ tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  logo_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.org_role not null default 'viewer',
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- indexes

create index workspaces_organization_id_idx on public.workspaces (organization_id);
create index organization_members_user_id_idx on public.organization_members (user_id);
create index invitations_organization_id_idx on public.invitations (organization_id);
create unique index invitations_pending_unique_idx
  on public.invitations (organization_id, lower(email))
  where accepted_at is null;
create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------- triggers

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();

-- Mirror auth.users into profiles.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Only the service role (or direct SQL) may change is_super_admin.
create or replace function private.protect_super_admin_flag()
returns trigger language plpgsql as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'is_super_admin cannot be modified';
  end if;
  return new;
end $$;

create trigger protect_super_admin before update on public.profiles
  for each row execute function private.protect_super_admin_flag();

-- ------------------------------------------------------------- RLS helpers
-- security definer so policies on organization_members do not recurse.

create or replace function private.is_org_member(org uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org and user_id = auth.uid()
  );
$$;

create or replace function private.org_role(org uuid)
returns public.org_role language sql security definer stable set search_path = '' as $$
  select role from public.organization_members
  where organization_id = org and user_id = auth.uid();
$$;

create or replace function private.shares_org_with(other uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them
      on me.organization_id = them.organization_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;

-- ---------------------------------------------------------------- policies

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: own row + colleagues; update own row only.
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or private.shares_org_with(id));
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members read; admins update/delete.
-- Insert is intentionally unpoliced: org creation (org + admin membership +
-- default workspace) is a service-role transaction in the application layer.
create policy "organizations_select" on public.organizations for select
  using (private.is_org_member(id));
create policy "organizations_update" on public.organizations for update
  using (private.org_role(id) = 'org_admin')
  with check (private.org_role(id) = 'org_admin');
create policy "organizations_delete" on public.organizations for delete
  using (private.org_role(id) = 'org_admin');

-- workspaces: members read; admins manage.
create policy "workspaces_select" on public.workspaces for select
  using (private.is_org_member(organization_id));
create policy "workspaces_insert" on public.workspaces for insert
  with check (private.org_role(organization_id) = 'org_admin');
create policy "workspaces_update" on public.workspaces for update
  using (private.org_role(organization_id) = 'org_admin')
  with check (private.org_role(organization_id) = 'org_admin');
create policy "workspaces_delete" on public.workspaces for delete
  using (private.org_role(organization_id) = 'org_admin');

-- members: members read; admins manage (bootstrap + accept run as service role).
create policy "members_select" on public.organization_members for select
  using (private.is_org_member(organization_id));
create policy "members_update" on public.organization_members for update
  using (private.org_role(organization_id) = 'org_admin')
  with check (private.org_role(organization_id) = 'org_admin');
create policy "members_delete" on public.organization_members for delete
  using (
    private.org_role(organization_id) = 'org_admin'
    or user_id = auth.uid()  -- leave org
  );

-- invitations: admin-only (invitee resolves token via service role).
create policy "invitations_select" on public.invitations for select
  using (private.org_role(organization_id) = 'org_admin');
create policy "invitations_insert" on public.invitations for insert
  with check (
    private.org_role(organization_id) = 'org_admin'
    and invited_by = auth.uid()
  );
create policy "invitations_delete" on public.invitations for delete
  using (private.org_role(organization_id) = 'org_admin');

-- audit logs: append-only; actor writes own entries; admins read.
create policy "audit_logs_select" on public.audit_logs for select
  using (private.org_role(organization_id) = 'org_admin');
create policy "audit_logs_insert" on public.audit_logs for insert
  with check (
    private.is_org_member(organization_id) and actor_id = auth.uid()
  );

-- -------------------------------------------------------------------- RPCs
-- Atomic multi-table flows run as SECURITY DEFINER functions instead of
-- service-role writes from the application: transactional, and the service
-- key never enters the request path.

-- Create an org with its first admin membership + default workspace.
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into public.organizations (name, slug, created_by)
  values (p_name, p_slug, v_uid)
  returning * into v_org;
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, v_uid, 'org_admin');
  insert into public.workspaces (organization_id, name, slug)
  values (v_org.id, 'Default', 'default');
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
  values (v_org.id, v_uid, 'organization.created', 'organization', v_org.id::text);
  return v_org;
end $$;

-- Public (token-scoped) preview of an invitation, for the accept page.
create or replace function public.invitation_details(p_token uuid)
returns table (
  organization_name text,
  email text,
  role public.org_role,
  expires_at timestamptz,
  accepted boolean
)
language sql security definer stable set search_path = '' as $$
  select o.name, i.email, i.role, i.expires_at, i.accepted_at is not null
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;

-- Accept an invitation as the signed-in user (email must match).
create or replace function public.accept_invitation(p_token uuid)
returns public.organization_members
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_email text;
  v_member public.organization_members;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into v_inv from public.invitations
  where token = p_token and accepted_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'INVITE_INVALID';
  end if;
  select p.email into v_email from public.profiles p where p.id = v_uid;
  if lower(v_email) is distinct from lower(v_inv.email) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;
  if exists (
    select 1 from public.organization_members
    where organization_id = v_inv.organization_id and user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;
  insert into public.organization_members (organization_id, user_id, role)
  values (v_inv.organization_id, v_uid, v_inv.role)
  returning * into v_member;
  update public.invitations set accepted_at = now() where id = v_inv.id;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
  values (v_inv.organization_id, v_uid, 'member.joined', 'user', v_uid::text);
  return v_member;
end $$;
