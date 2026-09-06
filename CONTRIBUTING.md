# Contributing to SignalForge

Thank you for your interest in contributing. The following guidelines keep the
project maintainable, testable, and consistent. By participating, you agree to
abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please review and follow our [Code of Conduct](CODE_OF_CONDUCT.md). Harassment
or disrespect of any contributor will not be tolerated.

## Getting Started

1. Fork the repository.
2. Clone your fork:

   ```bash
   git clone git@github.com:<your-username>/signalforge.git
   cd signalforge
   ```

3. Create a feature branch:

   ```bash
   git checkout -b feat/your-feature-name
   ```

4. Install dependencies and run the app locally. See the
   [README](README.md#getting-started).

## Development Workflow

- Branch from `main`. Never commit directly to `main`.
- Keep changes focused and atomic. One logical change per pull request.
- Write or update tests for any behavior change.
- Run the full lint, typecheck, and test suite before opening a pull request.

## Coding Standards

### Python (`api/`)

- Formatted with **Ruff**. Run:

  ```bash
  cd api
  ruff format .
  ruff check .
  ```

- Follow PEP 8. Prefer clear, descriptive names.
- Type hints are required on public functions.
- Avoid mutable defaults; use `dataclasses` and `field(default_factory=...)`.

### TypeScript / React (`web/`)

- TypeScript strict mode. Avoid `any` unless strictly necessary.
- Use the `cn()` utility (from `src/lib/utils.ts`) for conditional class names.
- Components follow the existing functional component style.
- Run lint and typecheck:

  ```bash
  cd web
  npm run lint
  npx tsc --noEmit
  ```

## Testing

- Backend tests use **pytest** and live in `tests/`.
- Run the suite:

  ```bash
  pytest tests
  ```

- Frontend builds must pass:

  ```bash
  cd web
  npm run build
  ```

- "Works on my machine" is not acceptable. If your change cannot be verified
  automatically, describe the manual verification steps in the pull request.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Examples:

```
feat(signals): add open-interest breakout signal
fix(api): correct position_size key in backtest trades
docs(readme): document API endpoints
test(strategies): add backtest determinism test
```

Keep the subject line under 70 characters and imperative.

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. Open a pull request with a clear title and description.
3. Reference any related issues (e.g. `Closes #12`).
4. The CI pipeline must pass: lint, typecheck, test, build.
5. Request a review. Address all feedback before merge.

## Reporting Issues

- Search existing issues before opening a new one.
- Provide a clear, minimal reproduction, expected behavior, and environment
  (OS, Python/Node versions).
- For security vulnerabilities, **do not** open a public issue. Follow the
  disclosure process in [SECURITY.md](SECURITY.md).
