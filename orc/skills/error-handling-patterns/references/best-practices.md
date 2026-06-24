# Best Practices & Common Pitfalls

Cross-cutting rules that apply regardless of language or strategy.

## Best Practices

1. **Fail Fast**: Validate input early, fail quickly.
2. **Preserve Context**: Include stack traces, metadata, timestamps.
3. **Meaningful Messages**: Explain what happened and how to fix it.
4. **Log Appropriately**: Error = log, expected failure = don't spam logs.
5. **Handle at Right Level**: Catch where you can meaningfully handle.
6. **Clean Up Resources**: Use try-finally, context managers, defer.
7. **Don't Swallow Errors**: Log or re-throw, don't silently ignore.
8. **Type-Safe Errors**: Use typed errors when possible.

See `references/exceptions.md` for the comprehensive `process_order` example that
applies these rules end-to-end.

## Common Pitfalls

- **Catching Too Broadly**: `except Exception` hides bugs.
- **Empty Catch Blocks**: Silently swallowing errors.
- **Logging and Re-throwing**: Creates duplicate log entries.
- **Not Cleaning Up**: Forgetting to close files, connections.
- **Poor Error Messages**: "Error occurred" is not helpful.
- **Returning Error Codes**: Use exceptions or Result types.
- **Ignoring Async Errors**: Unhandled promise rejections.
