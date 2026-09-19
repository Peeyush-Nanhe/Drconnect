# Project Brain

## Purpose

This file is the persistent project context for AI-assisted development.

It contains important information about the project's architecture, technical decisions, conventions, integrations, constraints, and known behavior.

The AI must use this file as project context, but must always verify important details against the actual codebase before making changes.

---

# 1. Core Principles

* Understand the existing project before modifying code.
* Treat the actual codebase as the final source of truth.
* Reuse existing architecture, components, utilities, services, hooks, types, and patterns whenever possible.
* Prefer the smallest correct change over large rewrites.
* Do not modify unrelated functionality.
* Do not introduce unnecessary dependencies or abstractions.
* Preserve existing behavior unless the requirement explicitly changes it.
* Prioritize correctness, security, reliability, maintainability, and backward compatibility.

---

# 2. Project Understanding

Before making a significant change, identify:

* Application framework and language
* Main application entry points
* Important modules and features
* Frontend architecture
* Backend architecture
* Database
* Authentication
* API integrations
* State management
* Storage
* External services
* Build and deployment configuration
* Testing and validation strategy

Do not assume these technologies or structures. Verify them from the project.

---

# 3. Architecture Rules

Follow the existing project architecture.

Before creating a new:

* Component
* Service
* Hook
* Utility
* API
* Type
* Database table
* Abstraction
* Dependency

first check whether an existing implementation can be reused or extended.

Do not create duplicate functionality.

Do not introduce a new architectural pattern when an established project pattern already exists.

If an architectural change is genuinely required, keep it focused and document the important decision in this file.

---

# 4. Code Change Rules

For every task:

1. Understand the requirement.
2. Locate the relevant code.
3. Inspect direct dependencies only when necessary.
4. Identify the minimum files that need modification.
5. Implement the smallest safe change.
6. Preserve unrelated functionality.
7. Verify the result.

Avoid rewriting complete files when a targeted modification is sufficient.

Do not modify configuration, database schemas, APIs, dependencies, or infrastructure unless the task requires it.

---

# 5. Existing Patterns

The AI should discover and follow existing patterns for:

* Naming
* File organization
* Components
* Styling
* State management
* API calls
* Error handling
* Validation
* Authentication
* Database access
* Loading states
* Notifications
* Navigation
* Testing

When multiple approaches are possible, prefer the approach already used consistently in the project.

---

# 6. Database Rules

Before changing the database:

* Inspect the existing schema.
* Check relationships and constraints.
* Check existing migrations.
* Check how the application currently accesses the database.
* Preserve existing data and behavior.
* Avoid destructive schema changes unless explicitly required.

For schema changes, consider:

* Existing records
* Backward compatibility
* Validation
* Security
* Indexes
* Relationships
* Migration and rollback implications

Never assume the database structure without verifying it.

---

# 7. Authentication & Authorization

Authentication and authorization are security-sensitive.

Before changing authentication:

* Inspect the existing authentication flow.
* Reuse existing authentication utilities.
* Verify session handling.
* Verify authorization rules.
* Do not expose secrets or credentials.
* Do not bypass existing security controls.
* Validate permissions on the server/backend where applicable.

Never hardcode API keys, passwords, tokens, or private credentials.

---

# 8. API & External Services

Before modifying or adding an API integration:

* Check whether an existing integration already exists.
* Reuse existing API clients and utilities.
* Follow existing request and response patterns.
* Handle loading, errors, timeouts, and invalid responses appropriately.
* Avoid breaking existing consumers.
* Do not expose server-side secrets to the client.

---

# 9. Error Handling

Errors should be handled intentionally.

For user-facing functionality:

* Show useful error messages.
* Avoid exposing sensitive implementation details.
* Handle loading and failure states.
* Prevent duplicate requests where appropriate.
* Handle unexpected API/database responses safely.

For debugging:

* Identify the root cause.
* Do not hide errors merely to make the application appear functional.
* Fix the underlying issue whenever possible.

---

# 10. Performance

Prefer simple and efficient implementations.

Avoid:

* Unnecessary API requests
* Unnecessary database queries
* Duplicate network calls
* Excessive re-renders
* Large dependencies for small functionality
* Premature optimization

Optimize only when there is a meaningful reason.

Do not sacrifice correctness for minor performance improvements.

---

# 11. UI & UX

When modifying UI:

* Reuse existing design patterns and components.
* Preserve responsive behavior.
* Preserve accessibility.
* Maintain consistent spacing, typography, colors, and interactions.
* Handle loading, empty, success, and error states where relevant.
* Do not redesign unrelated screens.

The existing application design system should be preferred over introducing a new one.

---

# 12. Testing & Verification

After making changes, run only relevant verification.

Depending on the project, this may include:

* Type checking
* Unit tests
* Integration tests
* Linting
* Build
* Relevant API checks
* Relevant manual verification

If verification cannot be performed, clearly state what was not verified.

Do not claim that something was tested if it was not actually tested.

---

# 13. Documentation Updates

Update this `project-brain.md` only when the project gains important long-term knowledge, such as:

* Major architectural decisions
* Important technical constraints
* New external integrations
* Significant database changes
* Important authentication/security behavior
* Stable project conventions
* Important deployment or infrastructure decisions
* Known limitations that future development must understand

Do NOT update this file for every small bug fix, UI change, refactor, or routine feature.

Do NOT turn this file into a changelog.

Do NOT duplicate information that can already be reliably discovered from the code.

---

# 14. Change Documentation Format

When adding important project knowledge, keep it concise.

Use this structure:

## Decision

What was decided.

## Reason

Why it was chosen.

## Impact

What future development needs to know.

Example:

## Authentication

### Decision

Supabase Auth is used for user authentication.

### Reason

The project already uses Supabase for database and authentication.

### Impact

New authenticated features should reuse the existing Supabase session and authorization flow instead of implementing a separate authentication system.

---

# 15. Token & Context Efficiency

Do not read the entire repository unnecessarily.

Start with:

1. Project structure
2. Relevant feature
3. Direct dependencies
4. Configuration only when required

Expand the context only when the current information is insufficient.

Do not repeatedly inspect the same files when the required information is already known.

Prefer targeted changes and concise responses.

Token efficiency must never compromise correctness, security, or necessary project understanding.

---

# 16. Safe Change Policy

Before making potentially destructive changes, carefully verify the impact.

Examples:

* Database deletion
* Data migration
* Removing dependencies
* Removing existing features
* Changing authentication
* Changing public APIs
* Changing production configuration
* Deleting files used by other modules

If a destructive action is not clearly required by the user's request, do not perform it.

---

# 17. Source of Truth

Use the following priority when information conflicts:

1. Explicit user requirement
2. Actual project code and runtime behavior
3. Current project configuration
4. This `project-brain.md`
5. Other documentation
6. AI assumptions

Never rely on assumptions when the project can be inspected to determine the answer.

---

# 18. Working Style

For every development task:

Understand
→ Inspect
→ Plan
→ Implement
→ Verify
→ Update project knowledge only if necessary
→ Report

Keep changes focused.

Avoid unnecessary refactoring.

Avoid unnecessary explanations.

Do not change things simply because a different approach appears theoretically better.

The goal is to improve the existing project safely, not to rebuild it according to personal preferences.

---

# 19. Final Response Format

After completing a task, report concisely:

### Changed

Files/components that were modified.

### What Changed

Short explanation of the implementation.

### Verification

Tests, build, lint, or other checks performed.

### Notes

Only important assumptions, risks, limitations, or follow-up items.

Do not provide a complete project summary unless explicitly requested.

---

# 20. Important Rule

This file is project memory, not permission to modify everything described here.

The AI must always inspect the actual code before making assumptions.

When uncertain about an implementation detail, investigate the relevant project files first.

When a critical requirement cannot be determined safely, ask one concise clarification rather than making a risky assumption.
