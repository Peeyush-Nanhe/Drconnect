-- Rename only platform-branded hub display names. IDs and relationships stay stable.
UPDATE public.hubs
SET name = regexp_replace(name, '^(MedConnect|CareConnect|Care Connect)', 'MyDox', 'i')
WHERE name ~* '^(MedConnect|CareConnect|Care Connect)( |$)';
