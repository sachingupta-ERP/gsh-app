# GSH authentication flow

The current client uses a mobile-first login surface. The user enters a
registered mobile number, GSH loads the associated email, and the user then
enters their password. The authenticated user id is persisted locally, so the
app opens directly on the Dashboard until the user chooses **Settings → Log
out**.

## Owner and employees

- The first device bootstrap creates an owner account. Because the legacy local
  owner may not have a mobile number, the first valid mobile entered on that
  device registers the owner mobile before password authentication continues.
- An unknown mobile is rejected with **Authentication Required** and does not
  create an account.
- An owner creates employees from **Settings → Users**.
- Employee creation collects name, mobile, email, role, and active status.
- GSH generates a unique username and temporary password.
- The first employee login requires a password change.
- Admins can activate or deactivate employees without deleting their history.
- Passwords are stored as SHA-256 hashes in local storage for this current
  offline client. This is a compatibility layer until the authenticated server
  API is wired; production server authentication must use a slow salted password
  hash and must not trust client authorization.

## Password reset and email architecture

Forgot-password requests are recorded in `gsh:credentialRequests` with an
explicit `notification` object:

```json
{
  "channel": "email",
  "status": "queued",
  "provider": "not-configured"
}
```

No SMTP credentials or fake email integration are included. The future server
implementation should consume pending requests, authorize the owner, send
through a managed email provider, record delivery status, and expire reset
tokens.

## Version history

Admins can review the locally recorded release history from **Settings →
Version History**. The v1.1 OTA entry is seeded without changing business
data. The server-side `VersionHistory` model is additive and ready for the
future authenticated API to become the canonical release ledger.
