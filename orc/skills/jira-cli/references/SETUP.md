# acli setup — install + authentication

## Prerequisites

### Installation

```bash
# macOS
brew install --cask atlassian-acli

# Linux / Windows / other
# See https://developer.atlassian.com/cloud/acli/guides/how-to-get-started/

# Verify
acli --version          # acli version 1.3.18-stable
```

### Authentication (one-time per machine)

```bash
# Web/OAuth flow (recommended; opens browser)
acli jira auth login --web

# Token flow (for headless / CI)
echo "$ATLASSIAN_API_TOKEN" | acli jira auth login \
  --site "mysite.atlassian.net" \
  --email "you@example.com" \
  --token

# Verify
acli jira auth status

# Switch between accounts
acli jira auth switch

# Sign out
acli jira auth logout
```

If a `acli jira` command returns an auth error, re-run `acli jira auth login --web`. Don't try to debug 401s — just re-auth.

