#!/bin/bash

##############################################################################
# Church Approval E2E Test Script
#
# This script allows an administrator to:
# 1. Authenticate as a system admin
# 2. List all pending churches
# 3. Select a church to approve
# 4. Confirm and approve the selected church
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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration - Using localhost instead of staging (can be overridden with environment variable)
: "${BASE_API_URL:=http://localhost:3001}"

# System admin credentials
USERNAME="test_sys_admin@test.com"
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

# Helper function to print info
print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
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
# STEP 1: Authenticate with Keycloak as system admin
##############################################################################
get_access_token "$USERNAME" "$PASSWORD" || exit 1

##############################################################################
# STEP 2: List all pending churches
##############################################################################
print_section "STEP 2: Listing Pending Churches"

LIST_RESPONSE=$(curl -s -X GET \
    "${BASE_API_URL}/api/churches?approvalStatus=Pending&pageSize=50" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")

# Extract churches array
if [ "$HAS_JQ" = true ]; then
    TOTAL_PENDING=$(echo "$LIST_RESPONSE" | jq -r '.total // 0')
    CHURCHES_JSON=$(echo "$LIST_RESPONSE" | jq -r '.churches')
else
    TOTAL_PENDING=$(echo "$LIST_RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' | head -1)
    CHURCHES_JSON=$(echo "$LIST_RESPONSE" | grep -o '"churches":\[.*\]' | cut -d':' -f2-)
fi

if [ -z "$TOTAL_PENDING" ] || [ "$TOTAL_PENDING" = "0" ]; then
    print_error "No pending churches found"
    exit 0
fi

print_success "Found ${TOTAL_PENDING} pending church(es)"
echo ""

# Display churches in a numbered list
echo -e "${CYAN}Pending Churches:${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"

if [ "$HAS_JQ" = true ]; then
    CHURCH_COUNT=0
    while IFS= read -r church; do
        CHURCH_COUNT=$((CHURCH_COUNT + 1))
        CHURCH_ID=$(echo "$church" | jq -r '.id')
        CHURCH_NAME=$(echo "$church" | jq -r '.name')
        CHURCH_SLUG=$(echo "$church" | jq -r '.slug')
        CREATED_AT=$(echo "$church" | jq -r '.createdAt')

        echo -e "${GREEN}[$CHURCH_COUNT]${NC} ${CHURCH_NAME}"
        echo "    ID: ${CHURCH_ID}"
        echo "    Slug: ${CHURCH_SLUG}"
        echo "    Created: ${CREATED_AT}"
        echo ""

        # Store church IDs in an array-like pattern using variables
        eval "CHURCH_ID_${CHURCH_COUNT}='${CHURCH_ID}'"
        eval "CHURCH_NAME_${CHURCH_COUNT}='${CHURCH_NAME}'"
    done < <(echo "$LIST_RESPONSE" | jq -c '.churches[]')

    TOTAL_CHURCHES=$CHURCH_COUNT
else
    print_error "jq is required for church selection. Please install jq."
    exit 1
fi

if [ "$TOTAL_CHURCHES" = "0" ]; then
    print_error "No churches to display"
    exit 0
fi

##############################################################################
# STEP 3: Church Selection
##############################################################################
print_section "STEP 3: Select Church to Approve"

echo -e "${YELLOW}Enter the number of the church you want to approve [1-${TOTAL_CHURCHES}]:${NC}"
read -r SELECTION

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt "$TOTAL_CHURCHES" ]; then
    print_error "Invalid selection. Please enter a number between 1 and ${TOTAL_CHURCHES}"
    exit 1
fi

# Get selected church details
eval "SELECTED_CHURCH_ID=\$CHURCH_ID_${SELECTION}"
eval "SELECTED_CHURCH_NAME=\$CHURCH_NAME_${SELECTION}"

print_info "Selected: ${SELECTED_CHURCH_NAME}"
echo "Church ID: ${SELECTED_CHURCH_ID}"

##############################################################################
# STEP 4: Confirmation
##############################################################################
print_section "STEP 4: Confirmation"

echo -e "${YELLOW}Are you sure you want to approve \"${SELECTED_CHURCH_NAME}\"? (y/n)${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    print_info "Approval cancelled"
    exit 0
fi

##############################################################################
# STEP 5: Approve Church
##############################################################################
print_section "STEP 5: Approving Church"

# Optional: Add approval reason
echo -e "${YELLOW}Enter approval reason (optional, press Enter to skip):${NC}"
read -r APPROVAL_REASON

if [ -z "$APPROVAL_REASON" ]; then
    APPROVAL_PAYLOAD="{}"
else
    APPROVAL_PAYLOAD=$(cat <<EOF
{
  "reason": "${APPROVAL_REASON}"
}
EOF
    )
fi

APPROVAL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
    "${BASE_API_URL}/api/churches/${SELECTED_CHURCH_ID}/approve" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d "$APPROVAL_PAYLOAD")

HTTP_STATUS=$(echo "$APPROVAL_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$APPROVAL_RESPONSE" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS" = "200" ]; then
    print_success "Church approved successfully!"

    if [ "$HAS_JQ" = true ]; then
        NEW_STATUS=$(echo "$RESPONSE_BODY" | jq -r '.church.approvalStatus')
        APPROVED_BY=$(echo "$RESPONSE_BODY" | jq -r '.church.approvedBy')
        APPROVED_AT=$(echo "$RESPONSE_BODY" | jq -r '.church.approvedAt')
        VISIBILITY=$(echo "$RESPONSE_BODY" | jq -r '.church.visibility')

        echo ""
        echo "Updated Church Details:"
        echo "  Status: ${NEW_STATUS}"
        echo "  Approved By: ${APPROVED_BY}"
        echo "  Approved At: ${APPROVED_AT}"
        echo "  Visibility: ${VISIBILITY}"
    fi

    echo ""
    echo "Full Response:"
    format_json "$RESPONSE_BODY"
else
    print_error "Failed to approve church (HTTP ${HTTP_STATUS})"
    echo ""
    echo "Response:"
    format_json "$RESPONSE_BODY"
    exit 1
fi

##############################################################################
# Summary
##############################################################################
print_section "Approval Summary"

echo "Church: ${SELECTED_CHURCH_NAME}"
echo "Church ID: ${SELECTED_CHURCH_ID}"
echo "Admin: ${USERNAME}"
if [ ! -z "$APPROVAL_REASON" ]; then
    echo "Reason: ${APPROVAL_REASON}"
fi
echo ""
print_success "Church approval process completed!"
