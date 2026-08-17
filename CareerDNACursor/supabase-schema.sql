create table if not exists public.students (
  email text primary key,
  name text not null,
  picture text,
  google_sub text unique,
  mobile_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

alter table public.students add column if not exists grade text;
alter table public.students add column if not exists school text;

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  student_email text not null references public.students(email) on delete cascade,
  assessment_version text,
  completed_at timestamptz,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists assessment_results_student_email_created_at_idx
  on public.assessment_results (student_email, created_at desc);

create table if not exists public.assessment_progress (
  student_email text not null references public.students(email) on delete cascade,
  assessment_version text not null default '4' check (assessment_version in ('3', '4')),
  student jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  current_index integer not null default 0 check (current_index >= 0),
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (student_email, assessment_version)
);

-- Migration for databases created with the original one-progress-row-per-student schema.
alter table public.assessment_progress add column if not exists assessment_version text not null default '4';
update public.assessment_progress set assessment_version = '3' where assessment_version in ('1', '3.0-final');
alter table public.assessment_progress drop constraint if exists assessment_progress_pkey;
alter table public.assessment_progress add primary key (student_email, assessment_version);

-- Normalize legacy stored-result values so v3 users can retrieve earlier results.
update public.assessment_results set assessment_version = '3' where assessment_version in ('1', '3.0-final');