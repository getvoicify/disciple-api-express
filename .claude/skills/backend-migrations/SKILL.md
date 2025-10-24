---
name: Backend Migrations
description: Create and manage database schema migrations with proper rollback strategies, focused changes, and zero-downtime deployment considerations. Use this skill when creating new database migration files, modifying database schemas, adding or removing tables, altering table columns, creating or dropping indexes, implementing database schema changes, writing migration up/down methods, planning database deployments, or working with any database migration files in `/migrations/` or `/db/migrations/` directories.
---

# Backend Migrations

This Skill provides Claude Code with specific guidance on how to adhere to coding standards as they relate to how it should handle backend migrations.

## When to use this skill

- When creating new database migration files
- When modifying database schemas (adding/removing/altering tables or columns)
- When adding or dropping database indexes
- When implementing rollback/down methods for migrations
- When planning zero-downtime database deployments
- When separating schema changes from data migrations
- When working with migration files in `/migrations/` or `/db/migrations/` directories
- When renaming tables or columns with backwards compatibility concerns
- When adding database constraints (foreign keys, unique constraints, NOT NULL)

## Instructions

For details, refer to the information provided in this file:
[backend migrations](../../../agent-os/standards/backend/migrations.md)
