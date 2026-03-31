# midnight-carry-on

Moves overdue items to `carry-on` state every midnight.

## Deploy

```bash
supabase functions deploy midnight-carry-on --project-ref <project-ref>
```

## Required Supabase settings

1. Enable **pg_cron** and **pg_net** extensions in the Supabase dashboard (Database → Extensions).
2. Set database secrets used by the cron migration:
   ```sql
   ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';
   ALTER DATABASE postgres SET app.supabase_anon_key = '<anon-key>';
   ```
3. Run migration `20241120000010_cron_midnight_carry_on.sql` to register the cron job:
   ```bash
   supabase db push
   ```

## Logic

- Finds all items where `scheduled_date < today` AND `state NOT IN ('done', 'someday', 'carry-on', 'focus')` AND `deleted_at IS NULL`
- Updates them: `state = 'carry-on'`, `scheduled_time = NULL`
- Logs each run to `automation_runs` table with `affected_rows`, `status`, and `finished_at`
