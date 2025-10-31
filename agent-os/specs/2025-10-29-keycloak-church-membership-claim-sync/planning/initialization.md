# Spec Initialization

## Feature Description

Keycloak user church_membership claim management

I want to be able to sync church membership as it currently exists with the user profile in Keycloak.
To do this, I want to react to changes to the user's church membership - whether they create a church, are being invited to a church
or have joined or leave a church. I want it to also react to when the church ownership changes.

This is going to be useful because I want a lot of the more advanced ACL features to be implemented on the Keycloak side. This
will simplify our code quite a bit.

Below is an example of the claims that are currently being issued for a user. It is important to note that some users
will not have the `church_membership` claim if they do not have associations with a church.

```json
{
  "exp": 1761695877,
  "iat": 1761695577,
  "jti": "onrtro:e53512d2-1597-cf90-80f7-a5cd1c3c7730",
  "iss": "https://keycloak.pottersville.church/realms/Pottersville",
  "aud": "account",
  "sub": "84376fb3-ab38-4a6c-ad55-986ff6f76c1f",
  "typ": "Bearer",
  "azp": "iam",
  "sid": "34f439b1-6b57-43ad-9a24-83726c756ee9",
  "acr": "1",
  "allowed-origins": [
    "/*"
  ],
  "realm_access": {
    "roles": [
      "media:delete",
      "note:create",
      "note:read",
      "note:manage",
      "media:update",
      "default-roles-pottersville",
      "moderator",
      "devotional:delete",
      "devotional:read",
      "post:create",
      "note:update",
      "devotional:manage",
      "media:create",
      "devotional:update",
      "note:delete",
      "offline_access",
      "devotional:create",
      "uma_authorization",
      "user"
    ]
  },
  "resource_access": {
    "account": {
      "roles": [
        "manage-account",
        "manage-account-links",
        "view-profile"
      ]
    }
  },
  "scope": "email profile church_membership",
  "email_verified": true,
  "name": "Thompson Edolo",
  "preferred_username": "testuser@test.com",
  "given_name": "Thompson",
  "family_name": "Edolo",
  "church_membership": [
    {
      "churchId": "test-church",
      "role": "Owner"
    },
    {
      "churchId": "test-church-2",
      "role": "Owner"
    }
  ],
  "email": "testuser@test.com"
}
```

## Spec Path

agent-os/specs/2025-10-29-keycloak-church-membership-claim-sync
