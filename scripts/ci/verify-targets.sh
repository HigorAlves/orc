#!/usr/bin/env bash
# Fixture tests for bin/orc-targets — the named-target registry behind
# /orc:qa --target. Pins the registry shape and the credential-reference
# resolution (literal | op:// | env:) the Playwright config consumes.
# Run from the repo root.
# shellcheck disable=SC2015  # `A && ok || fail` is the fixture idiom; ok never fails
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cli="$repo_root/orc/bin/orc-targets"
status=0; pass_count=0
fail() { echo "verify-targets: FAIL — $1"; status=1; }
ok() { pass_count=$((pass_count + 1)); }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
export ORC_STATE_DIR="$tmp/.orc"

[ -x "$cli" ] || { echo "verify-targets: FAIL — $cli missing or not executable"; exit 1; }

# init: creates local, idempotent
bash "$cli" init >/dev/null
f="$ORC_STATE_DIR/targets.json"
[ -f "$f" ] && jq -e '.schema == 1 and .targets.local.kind == "local"' "$f" >/dev/null && ok || fail "init must create local target"
before="$(cat "$f")"; bash "$cli" init >/dev/null; [ "$before" = "$(cat "$f")" ] && ok || fail "init must be idempotent"

# set + get
bash "$cli" set staging --base-url https://staging.example.com --health-path /healthz --guard true >/dev/null
[ "$(bash "$cli" get staging | jq -r .guard)" = "true" ] && ok || fail "set/get guard"
[ "$(bash "$cli" get staging | jq -r .kind)" = "remote" ] && ok || fail "set defaults kind=remote when base-url given"
bash "$cli" get nope >/dev/null 2>&1 && fail "get unknown must exit non-zero" || ok

# list
bash "$cli" list | grep -q $'^staging\tremote\thttps://staging.example.com\ttrue$' && ok || fail "list row format"

# user + login
bash "$cli" user staging admin --username env:T_USER --password op://Eng/item/password >/dev/null
bash "$cli" login staging --path /login --username-field Email --password-field Password --submit "Sign in" --success-path /dashboard >/dev/null
[ "$(bash "$cli" get staging | jq -r .login.submit)" = "Sign in" ] && ok || fail "login recipe stored"

# resolve: env + op seam
cat > "$tmp/op" <<'OP'
#!/usr/bin/env bash
[ "$1" = "read" ] && [ "$2" = "op://Eng/item/password" ] && { printf 'hunter2'; exit 0; }
exit 1
OP
chmod +x "$tmp/op"
out="$(T_USER=alice ORC_TARGETS_OP_BIN="$tmp/op" bash "$cli" resolve staging)"
[ "$(printf '%s' "$out" | jq -r .users.admin.username)" = "alice" ] && ok || fail "resolve env: reference"
[ "$(printf '%s' "$out" | jq -r .users.admin.password)" = "hunter2" ] && ok || fail "resolve op:// reference"
[ "$(printf '%s' "$out" | jq -r .name)" = "staging" ] && ok || fail "resolved JSON carries name"
# unresolvable env → exit 3, names the var
set +e; err="$(ORC_TARGETS_OP_BIN="$tmp/op" bash "$cli" resolve staging 2>&1 >/dev/null)"; rc=$?; set -e
[ "$rc" -eq 3 ] && printf '%s' "$err" | grep -q 'T_USER' && ok || fail "unresolvable env must exit 3 naming the var (rc=$rc: $err)"
# missing op binary → exit 3
set +e; err="$(T_USER=a ORC_TARGETS_OP_BIN="$tmp/missing-op" bash "$cli" resolve staging 2>&1 >/dev/null)"; rc=$?; set -e
[ "$rc" -eq 3 ] && printf '%s' "$err" | grep -qi '1password' && ok || fail "missing op must exit 3 (rc=$rc)"
# malformed env reference → exit 3 before any indirect expansion
bash "$cli" user staging evil --username 'env:x[$(id)]' --password literal >/dev/null
set +e; err="$(T_USER=a ORC_TARGETS_OP_BIN="$tmp/op" bash "$cli" resolve staging 2>&1 >/dev/null)"; rc=$?; set -e
[ "$rc" -eq 3 ] && printf '%s' "$err" | grep -q 'invalid env reference' && ok || fail "malformed env ref must exit 3 (rc=$rc: $err)"
bash "$cli" get staging | jq 'del(.users.evil) | del(.name)' > "$tmp/t.json" && jq --slurpfile t "$tmp/t.json" '.targets.staging = $t[0]' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
# --base-url override (ad-hoc --web)
[ "$(bash "$cli" resolve local --base-url http://127.0.0.1:4000 | jq -r .baseUrl)" = "http://127.0.0.1:4000" ] && ok || fail "base-url override"
bash "$cli" user local dev --username devuser --password devpass >/dev/null
out="$(bash "$cli" resolve local --base-url https://localhost.evil.example)"
[ "$(printf '%s' "$out" | jq -r '.kind')" = "remote" ] && [ "$(printf '%s' "$out" | jq -c '.users')" = "{}" ] && ok || fail "ad-hoc remote override must drop local users (unanchored localhost match)"
[ "$(bash "$cli" resolve local --base-url http://localhost:3000 | jq -r '.users.dev.username')" = "devuser" ] && ok || fail "localhost override keeps local users"

# probe: closed port → exit 1
bash "$cli" probe http://127.0.0.1:1 >/dev/null 2>&1 && fail "probe must fail on closed port" || ok

[ "$status" -eq 0 ] && echo "verify-targets: OK ($pass_count cases)"
exit "$status"
