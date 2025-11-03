#!/bin/bash

##############################################################################
# Keycloak Authentication Library
#
# This library provides reusable authentication functions for E2E tests.
# It handles token retrieval and validation.
#
# Usage:
#   source "$(dirname "$0")/lib/auth.sh"
#   get_access_token "username" "password"
#   # ACCESS_TOKEN will be set as a global variable
##############################################################################

# Default configuration (can be overridden before sourcing)
# NOTE: IAM_CLIENT_SECRET must be provided via environment variable
: "${IAM_ENDPOINT:=https://keycloak.pottersville.church/realms}"
: "${IAM_REALM:=Pottersville}"
: "${IAM_CLIENT_ID:=iam}"
: "${IAM_CLIENT_SECRET:?IAM_CLIENT_SECRET environment variable is required}"

##############################################################################
# Function: get_access_token
#
# Authenticates with Keycloak and sets ACCESS_TOKEN global variable
#
# Arguments:
#   $1 - Username
#   $2 - Password
#
# Returns:
#   0 - Success (ACCESS_TOKEN is set)
#   1 - Failure (authentication failed)
#
# Globals Set:
#   ACCESS_TOKEN - The JWT access token from Keycloak
##############################################################################
get_access_token() {
    local username="$1"
    local password="$2"

    if [ -z "$username" ] || [ -z "$password" ]; then
        if type print_error &>/dev/null; then
            print_error "Username and password are required"
        else
            echo "Error: Username and password are required" >&2
        fi
        return 1
    fi

    if type print_section &>/dev/null; then
        print_section "Authenticating with Keycloak"
    fi

    local auth_response
    auth_response=$(curl -s -X POST \
        "${IAM_ENDPOINT}/${IAM_REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=${IAM_CLIENT_ID}" \
        -d "client_secret=${IAM_CLIENT_SECRET}" \
        -d "grant_type=password" \
        -d "username=${username}" \
        -d "password=${password}")

    # Extract access token (try jq first, fallback to grep)
    if command -v jq &> /dev/null; then
        ACCESS_TOKEN=$(echo "$auth_response" | jq -r '.access_token')
    else
        ACCESS_TOKEN=$(echo "$auth_response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    fi

    # Validate token
    if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
        if type print_error &>/dev/null; then
            print_error "Failed to authenticate"
            echo "Response:"
            if type format_json &>/dev/null; then
                format_json "$auth_response"
            else
                echo "$auth_response"
            fi
        else
            echo "Error: Failed to authenticate" >&2
            echo "Response: $auth_response" >&2
        fi
        return 1
    fi

    if type print_success &>/dev/null; then
        print_success "Authentication successful"
        echo "Access Token: ${ACCESS_TOKEN:0:50}..."
    fi

    return 0
}

##############################################################################
# Function: validate_token
#
# Checks if ACCESS_TOKEN is set and not empty
#
# Returns:
#   0 - Token is valid
#   1 - Token is invalid or not set
##############################################################################
validate_token() {
    if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
        if type print_error &>/dev/null; then
            print_error "No valid access token found"
        else
            echo "Error: No valid access token found" >&2
        fi
        return 1
    fi
    return 0
}

##############################################################################
# Function: refresh_token_if_needed
#
# Placeholder for future token refresh logic
# Currently just validates the existing token
#
# Arguments:
#   $1 - Username
#   $2 - Password
#
# Returns:
#   0 - Token is valid or was refreshed
#   1 - Failed to get valid token
##############################################################################
refresh_token_if_needed() {
    local username="$1"
    local password="$2"

    if ! validate_token; then
        get_access_token "$username" "$password"
        return $?
    fi
    return 0
}
