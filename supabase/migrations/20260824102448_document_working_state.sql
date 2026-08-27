-- Working state for native documents.
-- current_content is the mutable JSON; versions stay in a future table.
-- document_type_id is optional and not required to create a document.

alter table documents
  add column if not exists document_type_id uuid,
  add column if not exists current_content jsonb,
  add column if not exists current_content_hash text,
  add column if not exists archived_at timestamptz;

create index if not exists documents_workspace_working_idx
  on documents (workspace_id, updated_at desc)
  where archived_at is null and deleted_at is null;

-- Backfill working JSON from existing pages (stable page ids).
update documents d
set current_content = sub.content
from (
  select
    document_id,
    jsonb_build_object(
      'schema', 'embar.document/v1',
      'pages', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'title', coalesce(title, ''),
            'body', coalesce(body, ''),
            'level', coalesce(level, 0)
          )
          order by position
        ) filter (where deleted_at is null),
        '[]'::jsonb
      )
    ) as content
  from document_pages
  group by document_id
) sub
where d.id = sub.document_id
  and d.current_content is null;

-- Native docs with no pages: wrap the legacy text body in one page.
update documents
set current_content = jsonb_build_object(
  'schema', 'embar.document/v1',
  'pages', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'title', '',
      'body', coalesce(content, ''),
      'level', 0
    )
  )
)
where current_content is null
  and coalesce(type, 'native') = 'native';
