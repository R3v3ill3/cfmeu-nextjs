-- AI Help System with pgvector
-- Enable vector extension for semantic search

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Help documents table with vector embeddings
create table if not exists help_documents (
  id uuid primary key default gen_random_uuid(),
  doc_id text unique not null,
  title text not null,
  category text not null,
  content text not null,
  embedding vector(1536), -- OpenAI/Anthropic embeddings are 1536 dimensions
  roles text[] default array['all'],
  pages text[] default array['all'],
  keywords text[],
  related_docs text[],
  steps jsonb,
  screenshots text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Indexes for performance
create index help_documents_embedding_idx on help_documents 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index help_documents_doc_id_idx on help_documents(doc_id);
create index help_documents_category_idx on help_documents(category);
create index help_documents_roles_idx on help_documents using gin(roles);
create index help_documents_pages_idx on help_documents using gin(pages);

-- 4. RPC function for semantic similarity search
create or replace function match_help_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_roles text[] default array['all'],
  filter_page text default null
)
returns table (
  id uuid,
  doc_id text,
  title text,
  content text,
  similarity float,
  category text,
  steps jsonb,
  screenshots text[],
  related_docs text[]
)
language plpgsql
as $$
begin
  return query
  select
    help_documents.id,
    help_documents.doc_id,
    help_documents.title,
    help_documents.content,
    1 - (help_documents.embedding <=> query_embedding) as similarity,
    help_documents.category,
    help_documents.steps,
    help_documents.screenshots,
    help_documents.related_docs
  from help_documents
  where 
    -- Role filtering: match user role OR 'all' roles
    (help_documents.roles && filter_roles or 'all' = any(help_documents.roles))
    -- Page filtering: match current page OR 'all' pages
    and (filter_page is null or filter_page = any(help_documents.pages) or 'all' = any(help_documents.pages))
    -- Similarity threshold
    and 1 - (help_documents.embedding <=> query_embedding) > match_threshold
  order by help_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 5. Help interactions table for analytics
create table if not exists help_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  question text not null,
  answer text not null,
  confidence decimal(3,2),
  context jsonb,
  sources jsonb,
  feedback text check (feedback in ('positive', 'negative', null)),
  feedback_comment text,
  ai_provider text default 'claude',
  tokens_used integer,
  response_time_ms integer,
  created_at timestamptz default now()
);

create index help_interactions_user_id_idx on help_interactions(user_id);
create index help_interactions_created_at_idx on help_interactions(created_at);
create index help_interactions_confidence_idx on help_interactions(confidence);
create index help_interactions_feedback_idx on help_interactions(feedback);

-- 6. View for common questions analysis
create or replace view help_common_questions as
select 
  lower(trim(question)) as normalized_question,
  count(*) as ask_count,
  avg(confidence) as avg_confidence,
  count(case when feedback = 'positive' then 1 end) as positive_count,
  count(case when feedback = 'negative' then 1 end) as negative_count,
  round(100.0 * count(case when feedback = 'positive' then 1 end) / 
    nullif(count(case when feedback is not null then 1 end), 0), 1) as positive_rate
from help_interactions
where created_at > now() - interval '30 days'
group by lower(trim(question))
having count(*) >= 2
order by ask_count desc;

-- 7. View for low confidence questions (needs doc improvement)
create or replace view help_low_confidence_questions as
select 
  question,
  answer,
  confidence,
  context,
  sources,
  created_at
from help_interactions
where confidence < 0.7
  and created_at > now() - interval '7 days'
order by created_at desc;

-- 8. RLS policies for help_documents (public read for authenticated users)
alter table help_documents enable row level security;

create policy "Authenticated users can read help documents"
  on help_documents for select
  using (auth.role() = 'authenticated');

-- Admins can insert/update help documents
create policy "Admins can manage help documents"
  on help_documents for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 9. RLS policies for help_interactions
alter table help_interactions enable row level security;

-- Users can insert their own interactions
create policy "Users can insert their own help interactions"
  on help_interactions for insert
  with check (auth.uid() = user_id);

-- Users can read their own interactions
create policy "Users can read their own help interactions"
  on help_interactions for select
  using (auth.uid() = user_id);

-- Users can update feedback on their own interactions
create policy "Users can update feedback on their own interactions"
  on help_interactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can read all interactions
create policy "Admins can read all help interactions"
  on help_interactions for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 10. Trigger to update updated_at timestamp
create or replace function update_help_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_help_documents_updated_at
  before update on help_documents
  for each row
  execute function update_help_documents_updated_at();

-- Comments for documentation
comment on table help_documents is 'Embedded documentation for AI help system using pgvector for semantic search';
comment on column help_documents.embedding is 'Vector embedding (1536 dimensions) for semantic similarity search';
comment on function match_help_documents is 'Semantic search function - finds relevant help documents based on query embedding';
comment on table help_interactions is 'Tracks all user interactions with AI help for analytics and improvement';
comment on view help_common_questions is 'Analysis of frequently asked questions over last 30 days';
comment on view help_low_confidence_questions is 'Questions with low confidence scores - candidates for documentation improvement';
