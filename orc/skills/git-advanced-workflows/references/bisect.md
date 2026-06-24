# Git Bisect

Binary search through commit history to find the commit that introduced a bug.

```bash
# Start bisect
git bisect start

# Mark current commit as bad
git bisect bad

# Mark known good commit
git bisect good v1.0.0

# Git will checkout middle commit - test it
# Then mark as good or bad
git bisect good  # or: git bisect bad

# Continue until bug found
# When done
git bisect reset
```

## Automated Bisect

```bash
# Use script to test automatically
git bisect start HEAD v1.0.0
git bisect run ./test.sh

# test.sh should exit 0 for good, 1-127 (except 125) for bad
```

## Workflow: Find Bug Introduction

```bash
# Start bisect
git bisect start
git bisect bad HEAD
git bisect good v2.1.0

# Git checks out middle commit - run tests
npm test

# If tests fail
git bisect bad

# If tests pass
git bisect good

# Git will automatically checkout next commit to test
# Repeat until bug found

# Automated version
git bisect start HEAD v2.1.0
git bisect run npm test
```

**Pitfall:** Do not bisect on a dirty working directory. Commit or stash before bisecting.
