-- Supabase-hosted deployment only; the disposable test DB calls tick explicitly.
begin;
create extension if not exists pg_cron;
select cron.schedule('qyrova-crm-reminders','* * * * *','select crm_private.tick();');
commit;
