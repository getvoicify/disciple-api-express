# Contributing to Disciple API

## Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification for automated semantic versioning and changelog generation.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature (triggers MINOR release)
- **fix**: A bug fix (triggers PATCH release)
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (white-space, formatting)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement (triggers PATCH release)
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies (triggers PATCH release)
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit (triggers PATCH release)

### Breaking Changes

To trigger a MAJOR release, include `BREAKING CHANGE:` in the commit body or footer, or append `!` after the type/scope:

```bash
feat!: remove support for Node 16

BREAKING CHANGE: Node 16 is no longer supported, minimum version is now Node 18
```

### Examples

#### Feature (Minor Release)
```bash
feat(notes): add ability to export notes as PDF

Added a new endpoint that allows users to export their notes
in PDF format with customizable formatting options.
```

#### Bug Fix (Patch Release)
```bash
fix(auth): correct token expiration validation

The JWT token expiration was not being properly validated
due to timezone issues. This fix ensures tokens expire
at the correct time.

Fixes #123
```

#### Breaking Change (Major Release)
```bash
feat(api)!: change authentication from JWT to OAuth2

BREAKING CHANGE: All endpoints now require OAuth2 authentication.
JWT tokens are no longer supported. See migration guide in docs.
```

## Version Release Process

1. **Automatic Versioning**: Based on commit messages, semantic-release automatically determines the version:
   - `fix:` commits trigger patch release (1.0.0 → 1.0.1)
   - `feat:` commits trigger minor release (1.0.1 → 1.1.0)
   - `BREAKING CHANGE:` triggers major release (1.1.0 → 2.0.0)

2. **Release Process**:
   - Push commits to `main` branch
   - GitHub Actions runs tests
   - If tests pass, semantic-release analyzes commits
   - Creates new version tag if needed
   - Updates CHANGELOG.md
   - Builds Docker image with version tag
   - Pushes to GitHub Container Registry

3. **Docker Image Tags**:
   - `latest` - Always points to the latest release
   - `X.Y.Z` - Specific version (e.g., `1.2.3`)
   - `X.Y` - Minor version (e.g., `1.2`)
   - `X` - Major version (e.g., `1`)

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the commit convention
3. Ensure all tests pass
4. Update documentation if needed
5. Create a Pull Request to `main`
6. Wait for code review and CI checks
7. Once approved and merged, the release process runs automatically

## Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/disciple-api.git
cd disciple-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run development environment
npm run docker:dev

# Run tests
npm test
```

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Run linting before committing: `npm run lint`
- Add tests for new features
- Update OpenAPI documentation for API changes