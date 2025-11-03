#!/bin/bash

##############################################################################
# End-to-End Church Creation Flow Test Script
#
# This script tests the complete church lifecycle:
# 1. Authenticate with Keycloak
# 2. Create a new church
# 3. Retrieve church details
# 4. List churches
# 5. Update church
# 6. Optional cleanup (delete)
##############################################################################

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the authentication library
source "${SCRIPT_DIR}/lib/auth.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
#STAGING_BASE_API_URL="https://staging.infra.api.pottersville.church"
: "${STAGING_BASE_API_URL:=http://localhost:3001}"

# Test user credentials
USERNAME="testmod@test.com"
PASSWORD="test"

# Check if jq is available for pretty printing
if command -v jq &> /dev/null; then
    HAS_JQ=true
else
    HAS_JQ=false
    echo -e "${YELLOW}Note: Install 'jq' for pretty-printed JSON output${NC}\n"
fi

# Helper function to print section headers
print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Helper function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Helper function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Helper function to format JSON output
format_json() {
    if [ "$HAS_JQ" = true ]; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

##############################################################################
# STEP 1: Authenticate with Keycloak
##############################################################################
get_access_token "$USERNAME" "$PASSWORD" || exit 1

##############################################################################
# STEP 2: Create a new church
##############################################################################
print_section "STEP 2: Creating a new church"

# Generate unique name for the test church
TIMESTAMP=$(date +%s)
CHURCH_NAME="Test Church ${TIMESTAMP}"

CREATE_PAYLOAD=$(cat <<EOF
{
  "name": "${CHURCH_NAME}",
  "description": "This is a test church created via curl for end-to-end testing",
  "address": {
    "street": "123 Test Street",
    "city": "Test City",
    "state": "CA",
    "postalCode": "90210",
    "country": "USA"
  },
  "contactInfo": {
    "email": "test@testchurch.com",
    "phone": "+1-555-0123"
  },
  "socialLinks": {
    "website": "https://testchurch.example.com",
    "facebook": "https://facebook.com/testchurch"
  },
  "logos": {
    "primary": "https://example.com/logo.png"
  }
}
EOF
)

CREATE_RESPONSE=$(curl -s -X POST \
    "${STAGING_BASE_API_URL}/api/churches" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d "$CREATE_PAYLOAD")

# Extract church ID (response is wrapped in { "success": true, "church": {...} })
if [ "$HAS_JQ" = true ]; then
    CHURCH_ID=$(echo "$CREATE_RESPONSE" | jq -r '.church.id')
    CHURCH_SLUG=$(echo "$CREATE_RESPONSE" | jq -r '.church.slug')
    APPROVAL_STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.church.approvalStatus')
    VERSION=$(echo "$CREATE_RESPONSE" | jq -r '.church.version')
else
    CHURCH_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    CHURCH_SLUG=$(echo "$CREATE_RESPONSE" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)
    APPROVAL_STATUS=$(echo "$CREATE_RESPONSE" | grep -o '"approvalStatus":"[^"]*"' | cut -d'"' -f4)
    VERSION=$(echo "$CREATE_RESPONSE" | grep -o '"version":[0-9]*' | grep -o '[0-9]*')
fi

if [ -z "$CHURCH_ID" ] || [ "$CHURCH_ID" = "null" ]; then
    print_error "Failed to create church"
    echo "Response:"
    format_json "$CREATE_RESPONSE"
    exit 1
fi

print_success "Church created successfully"
echo "Church ID: ${CHURCH_ID}"
echo "Church Slug: ${CHURCH_SLUG}"
echo "Approval Status: ${APPROVAL_STATUS}"
echo "Version: ${VERSION}"
echo ""
echo "Full Response:"
format_json "$CREATE_RESPONSE"

##############################################################################
# STEP 3: Retrieve church details by ID
##############################################################################
print_section "STEP 3: Retrieving church details"

GET_RESPONSE=$(curl -s -X GET \
    "${STAGING_BASE_API_URL}/api/churches/${CHURCH_ID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$HAS_JQ" = true ]; then
    RETRIEVED_NAME=$(echo "$GET_RESPONSE" | jq -r '.church.name')
else
    RETRIEVED_NAME=$(echo "$GET_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ "$RETRIEVED_NAME" = "$CHURCH_NAME" ]; then
    print_success "Church retrieved successfully"
    echo "Retrieved church: ${RETRIEVED_NAME}"
    echo ""
    echo "Full Response:"
    format_json "$GET_RESPONSE"
else
    print_error "Failed to retrieve church or name mismatch"
    echo "Response:"
    format_json "$GET_RESPONSE"
fi

##############################################################################
# STEP 4: List churches
##############################################################################
print_section "STEP 4: Listing churches"

LIST_RESPONSE=$(curl -s -X GET \
    "${STAGING_BASE_API_URL}/api/churches?pageSize=10" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$HAS_JQ" = true ]; then
    TOTAL_COUNT=$(echo "$LIST_RESPONSE" | jq -r '.total // .count // 0')
    echo "Total churches: ${TOTAL_COUNT}"
else
    echo "Response:"
fi

print_success "Churches listed successfully"
echo ""
echo "Full Response:"
format_json "$LIST_RESPONSE"

##############################################################################
# STEP 5: Update church
##############################################################################
print_section "STEP 5: Updating church"

UPDATED_DESCRIPTION="Updated description for test church - modified at $(date)"

UPDATE_PAYLOAD=$(cat <<EOF
{
  "name": "${CHURCH_NAME}",
  "description": "${UPDATED_DESCRIPTION}",
  "version": ${VERSION},
  "address": {
    "street": "456 Updated Avenue",
    "city": "New Test City",
    "state": "CA",
    "postalCode": "90211",
    "country": "USA"
  },
  "contactInfo": {
    "email": "updated@testchurch.com",
    "phone": "+1-555-9999"
  }
}
EOF
)

UPDATE_RESPONSE=$(curl -s -X PUT \
    "${STAGING_BASE_API_URL}/api/churches/${CHURCH_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d "$UPDATE_PAYLOAD")

if [ "$HAS_JQ" = true ]; then
    UPDATED_DESC=$(echo "$UPDATE_RESPONSE" | jq -r '.church.description')
    NEW_VERSION=$(echo "$UPDATE_RESPONSE" | jq -r '.church.version')
else
    UPDATED_DESC=$(echo "$UPDATE_RESPONSE" | grep -o '"description":"[^"]*"' | cut -d'"' -f4)
    NEW_VERSION=$(echo "$UPDATE_RESPONSE" | grep -o '"version":[0-9]*' | grep -o '[0-9]*')
fi

if [ ! -z "$UPDATED_DESC" ] && [ "$UPDATED_DESC" != "null" ]; then
    print_success "Church updated successfully"
    echo "New Version: ${NEW_VERSION}"
    echo ""
    echo "Full Response:"
    format_json "$UPDATE_RESPONSE"
else
    print_error "Failed to update church"
    echo "Response:"
    format_json "$UPDATE_RESPONSE"
fi

##############################################################################
# STEP 6: Optional Cleanup (Delete Church)
##############################################################################
print_section "STEP 6: Cleanup - Delete test church"

echo -e "${YELLOW}Do you want to delete the test church? (y/n)${NC}"
read -r DELETE_CONFIRM

if [ "$DELETE_CONFIRM" = "y" ] || [ "$DELETE_CONFIRM" = "Y" ]; then
    DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE \
        "${STAGING_BASE_API_URL}/api/churches/${CHURCH_ID}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

    if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
        print_success "Church deleted successfully"
    else
        print_error "Failed to delete church (HTTP ${HTTP_STATUS})"
        echo "Response:"
        echo "$DELETE_RESPONSE" | grep -v "HTTP_STATUS:"
    fi
else
    echo -e "${YELLOW}Skipping deletion. Church remains at:${NC}"
    echo "${STAGING_BASE_API_URL}/api/churches/${CHURCH_ID}"
fi

##############################################################################
# Summary
##############################################################################
print_section "Test Summary"

echo "Test User: ${USERNAME}"
echo "Church ID: ${CHURCH_ID}"
echo "Church Slug: ${CHURCH_SLUG}"
echo "Church Name: ${CHURCH_NAME}"
echo ""
print_success "End-to-end test completed successfully!"
