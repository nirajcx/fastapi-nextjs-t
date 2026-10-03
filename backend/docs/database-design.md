# Personal todo PostgreSQL schema

| Table | Why it exists |
| --- | --- |
| users | Account, email, password hash, display name, active status |
| todos | Task content and owner_id referencing users.id |
| auth_sessions | Hashed random login tokens, expiry and revocation |
| rate_limit_buckets | Shared request counters across server workers |

Example: Niraj has user ID U1; Rohan has U2. Niraj's todo stores owner_id=U1. Rohan's todo stores owner_id=U2. The server derives this value from the verified bearer session, never from the request body.

The todo foreign key ensures the owner exists. The `(owner_id, created_at, id)` index supports owner-filtered chronological lists. Neither an index nor a foreign key automatically enforces read authorization: your list/read/update/delete exercises must include the logged-in owner's ID in every query. Those operations remain unimplemented.

UUIDs identify users/todos/sessions; aware timestamps avoid ambiguous expiry comparisons. Unique email and token-digest constraints prevent duplicates. User deletion is restricted while todos reference it; there is no account deletion API.

Services commit; repositories query/flush. Login and password changes coordinate with a user-row lock. Authentication read connections are released before limiter queries. PostgreSQL RLS is not enabled; owner authorization belongs in application queries.

## Upgrade from the old design

`0001_initial` remains historical. `0002_personal_todos` preserves existing todos and owner IDs, adds a direct users foreign key, removes tenant_id, and drops memberships/tenants. Former workspace groupings cannot be reconstructed by downgrade; restore a backup if that historical grouping is needed. Your regular database has not been migrated automatically.
