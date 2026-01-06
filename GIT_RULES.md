# Git Workflow & Commit Convention

## 1. Branching Rules
- **Naming Pattern**: `feature/kebab-case-description` or `fix/kebab-case-issue`
- **Constraint**: NEVER push directly to `main` branch. Always work on a feature branch.

## 2. Commit Strategy
- **Frequency**: Commit frequently. Every logical change that compiles/runs should be a separate commit.
- **Granularity**: Do not bundle multiple unrelated features into one commit.

## 3. Commit Message Format
Follow the **Conventional Commits** structure: `type: description`

- **Types**:
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
  - `refactor`: A code change that neither fixes a bug nor adds a feature

- **Description Rules**:
  - Use the **imperative mood** (e.g., "Add feature" not "Added feature").
  - Be descriptive but concise.
  - No ending punctuation (no period at the end).

## Example Scenarios
- ✅ Good: `git commit -m "feat: add sidebar skeleton loader"`
- ✅ Good: `git commit -m "fix: resolve 429 rate limit error"`
- ❌ Bad: `git commit -m "update"`
- ❌ Bad: `git commit -m "fixed the login and added styles"` (Too many things in one commit)