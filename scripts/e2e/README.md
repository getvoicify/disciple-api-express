# E2E Test Scripts

End-to-end testing scripts for the Disciple API.

## Setup

These scripts require environment variables for authentication. **Never commit credentials to the repository.**

### Required Environment Variables

```bash
export IAM_CLIENT_SECRET="your-client-secret-here"
```

You can source these from your `.env` file:

```bash
# Load environment variables from .env
set -a
source ../../.env
set +a
```

### Optional Environment Variables

```bash
export IAM_ENDPOINT="https://keycloak.pottersville.church/realms"  # Default
export IAM_REALM="Pottersville"                                    # Default
export IAM_CLIENT_ID="iam"                                         # Default
```

## Available Scripts

### test-create-church.sh

Tests the church creation flow end-to-end.

**Usage:**
```bash
export IAM_CLIENT_SECRET="your-secret"
./test-create-church.sh
```

### approve-church.sh

Approves a church by ID (requires admin access).

**Usage:**
```bash
export IAM_CLIENT_SECRET="your-secret"
./approve-church.sh <church-id>
```

## Authentication Library

The `lib/auth.sh` library provides reusable authentication functions:

- `get_access_token <username> <password>` - Authenticates and sets `ACCESS_TOKEN` global variable
- `validate_token` - Checks if `ACCESS_TOKEN` is valid
- `refresh_token_if_needed <username> <password>` - Refreshes token if needed

**Example:**
```bash
source "$(dirname "$0")/lib/auth.sh"

export IAM_CLIENT_SECRET="your-secret"
get_access_token "user@example.com" "password" || exit 1

# ACCESS_TOKEN is now available
curl -H "Authorization: Bearer $ACCESS_TOKEN" ...
```

## Security Notes

- **Never hardcode credentials in scripts**
- **Never commit credentials to git**
- Use environment variables or `.env` files (which are gitignored)
- The `IAM_CLIENT_SECRET` is required and must be provided via environment variable
