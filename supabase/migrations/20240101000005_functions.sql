set search_path = public, extensions;

create or replace function match_items(
  query_embedding extensions.vector(1536),
  match_workspace_id uuid,
  match_threshold float default 0.7,
  match_count int default 8
)
returns table (id uuid, title text, ai_summary text, state text, entity_id uuid, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select items.id, items.title, items.ai_summary, items.state, items.entity_id,
    1 - (items.embedding <=> query_embedding) as similarity
  from items
  where items.workspace_id = match_workspace_id
    and items.deleted_at is null
    and items.embedding is not null
    and 1 - (items.embedding <=> query_embedding) > match_threshold
  order by items.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_emails(
  query_embedding extensions.vector(1536),
  match_workspace_id uuid,
  match_threshold float default 0.7,
  match_count int default 8
)
returns table (id uuid, subject text, ai_summary text, sender_email text, received_at timestamptz, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select emails.id, emails.subject, emails.ai_summary, emails.sender_email, emails.received_at,
    1 - (emails.embedding <=> query_embedding) as similarity
  from emails
  where emails.workspace_id = match_workspace_id
    and emails.deleted_at is null
    and emails.embedding is not null
    and 1 - (emails.embedding <=> query_embedding) > match_threshold
  order by emails.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_documents(
  query_embedding extensions.vector(1536),
  match_workspace_id uuid,
  match_threshold float default 0.7,
  match_count int default 8
)
returns table (id uuid, title text, ai_summary text, type text, entity_id uuid, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select documents.id, documents.title, documents.ai_summary, documents.type, documents.entity_id,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.workspace_id = match_workspace_id
    and documents.deleted_at is null
    and documents.embedding is not null
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
