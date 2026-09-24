# Indexer migration maintenance

Migration filenames must begin with a unique three-digit prefix. Run
`pnpm --filter @nebgov/indexer run check:migrations` before committing a new
migration; CI runs the same check.

## Upgrading databases that ran a renamed migration

Migration `012_add_vote_escrow.sql` was renamed to
`023_add_vote_escrow.sql`, and `021_add_proposal_amendments.sql` was renamed to
`024_add_proposal_amendments.sql`, to remove duplicate numeric prefixes.

The SQL bodies did not change. If an existing database has already applied an
old filename, update only its node-pg-migrate bookkeeping name before running
new migrations so the same SQL is not executed twice:

```sql
BEGIN;

UPDATE pgmigrations_nebgov_indexer
SET name = regexp_replace(name, '^012_add_vote_escrow', '023_add_vote_escrow')
WHERE name LIKE '012_add_vote_escrow%';

UPDATE pgmigrations_nebgov_indexer
SET name = regexp_replace(
  name,
  '^021_add_proposal_amendments',
  '024_add_proposal_amendments'
)
WHERE name LIKE '021_add_proposal_amendments%';

COMMIT;
```

Confirm the affected row count before proceeding. A zero-row result means the
old migration was not recorded and the newly numbered migration should run
normally.
