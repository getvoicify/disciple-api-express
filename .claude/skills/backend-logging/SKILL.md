---
name: Backend Logging
description: Implement structured logging using Pino with proper context, correlation IDs, and appropriate log levels. Use this skill when adding log statements to any backend code, replacing console.log/error/warn calls, implementing request-scoped logging in Express endpoints using req.log, adding application-wide logging in services/repositories/utilities, logging errors with full context objects, logging successful operations with relevant IDs, or ensuring sensitive data redaction. Use when working with Express middleware, service layer files, repository files, utility functions, error handlers, or any backend TypeScript files that need observability and debugging support.
---

# Backend Logging

This Skill provides Claude Code with specific guidance on how to adhere to coding standards as they relate to how it should handle backend logging.

## When to use this skill

- When adding logging statements to any backend code file
- When replacing `console.log`, `console.error`, or `console.warn` calls with structured logging
- When implementing request-scoped logging in Express endpoints (using `req.log`)
- When adding application-wide logging in services, repositories, or utility functions
- When logging errors with full error objects and context
- When logging successful operations with relevant resource IDs
- When working with error handler middleware that needs to log errors
- When debugging database operations, external API calls, or business logic
- When adding observability to any backend TypeScript file

## Instructions

For details, refer to the information provided in this file:
[backend logging](../../../agent-os/standards/backend/logging.md)
