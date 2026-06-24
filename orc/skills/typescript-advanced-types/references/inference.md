# Type Inference

Techniques for extracting and inferring types from existing constructs.

## Infer Keyword

```typescript
// Extract array element type
type ElementType<T> = T extends (infer U)[] ? U : never;

type NumArray = number[];
type Num = ElementType<NumArray>; // number

// Extract promise type
type PromiseType<T> = T extends Promise<infer U> ? U : never;

type AsyncNum = PromiseType<Promise<number>>; // number

// Extract function parameters
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

function foo(a: string, b: number) {}
type FooParams = Parameters<typeof foo>; // [string, number]
```
