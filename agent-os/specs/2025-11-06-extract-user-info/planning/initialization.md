# Extract User Info - Initial Feature Description

## Raw User Description

There are many entities that refer to a user by their id. For instance, the `daily devotionals` endpoint returns a list of daily devotionals with the author referenced by their id as authorId. This pattern continues throughout the application. While this is efficient for the backend, I may not be so for the consumers of these endpoints because this would mean that they'd have to make extra network calls. We'd need to address this issue by also saving the user information within these entities.

We recently implemented the user profile feature and we can leverage this to solve this issue. We may need to make some adjustments to it though as it doesn't store the user's information as is in Keycloak.

## Date Initiated
2025-11-06
