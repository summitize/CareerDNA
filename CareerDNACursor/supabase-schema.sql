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
  student_email text primary key references public.students(email) on delete cascade,
  student jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  current_index integer not null default 0 check (current_index >= 0),
  started_at timestamptz not null,
  updated_at timestamptz not null default now()
);