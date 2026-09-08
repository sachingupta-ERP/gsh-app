# GSH authentication flow

The current client now uses a single username/password login surface. The
authenticated user id is persisted locally, so the app opens directly on the
Dashboard until the user chooses **Settings → Log out**.

## Owner and employees

- The first device bootstrap creates an owner account and shows its one-time
  temporary password on the login screen.
- An owner creates employees from **Settings → Users**.
- Employee creation collects name, mobile, email, and role.
- GSH generates a unique username and temporary password.
- The first employee login requires a password change.
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
