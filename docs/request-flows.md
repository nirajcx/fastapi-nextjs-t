# Personal todo flow

Register → hash password → save user.
Login → verify password → save token digest/expiry → return raw token once.
Authenticated request → verify token/session/user → user quota → handler.
Create todo → validate title → use authenticated user ID as owner_id → insert → commit.
Logout → revoke exact session; logout-all/password change revoke every user session.

No workspace is created or selected. X-Tenant-ID is not required and never grants access. Clients cannot choose an owner in the create body.

Only create is implemented. Your future list query must filter owner_id; read/update/delete must filter both todo ID and owner_id. Test separate Niraj/Rohan accounts. Do not interpret an existing ID as proof of access.

Authentication checks happen before business access. Revocation blocks subsequent authentication; it does not cancel requests already authorized and in flight. Database read transactions close before separate quota transactions so a small connection pool does not deadlock.
