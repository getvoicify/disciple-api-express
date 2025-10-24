---
name: Global Error Handling
description: Implement robust error handling using the safeExecute utility pattern, graceful degradation, specific error types, and user-friendly error messages. Use this skill when handling async operations (database calls, API requests, file operations), wrapping promises with safeExecute instead of try-catch blocks, handling errors from service calls or repository methods, implementing error responses in Express endpoints, validating input and failing fast with clear errors, implementing retry strategies for transient failures, cleaning up resources in error scenarios, providing user-friendly error messages, or working with any code that performs operations that can fail (API endpoints, services, repositories, utilities).
---

# Global Error Handling

This Skill provides Claude Code with specific guidance on how to adhere to coding standards as they relate to how it should handle global error handling.

## When to use this skill

- When handling async operations (database queries, API requests, file I/O, cloud operations)
- When wrapping promises or potentially failing operations with safeExecute
- When handling errors from service calls, repository methods, or external APIs
- When implementing error responses in Express endpoints
- When validating input and implementing fail-fast patterns
- When implementing retry strategies for transient failures
- When cleaning up resources (file handles, connections) after errors
- When providing user-friendly error messages without exposing technical details
- When working with any code that can throw errors or return rejected promises

## Instructions

For details, refer to the information provided in this file:
[global error handling](../../../agent-os/standards/global/error-handling.md)
