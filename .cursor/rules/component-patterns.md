# React Component Patterns

## Client Component Template
```tsx
"use client";
import { useState, useEffect } from "react";
// All DaisyUI CSS vars, no hardcoded colors

interface Props {
  // explicit types always
}

export function ComponentName({ }: Props) {
  // hooks first
  // derived state second
  // handlers third
  // return JSX last
}
```

## Loading States
Always show loading skeleton, never blank screen:
```tsx
if (loading) return <SkeletonCard />;
if (error) return <ErrorState message={error} />;
if (!data) return <EmptyState />;
```

## DaisyUI Modal Pattern
```tsx
<dialog id="my_modal" className="modal">
  <div className="modal-box bg-base-200">
    <h3 className="font-bold text-lg text-base-content">Title</h3>
    <div className="modal-backdrop" onClick={closeModal} />
  </div>
</dialog>
```

## Toast Notifications
Always use react-hot-toast with DaisyUI-matching styles:
```tsx
import toast from "react-hot-toast";
toast.success("Saved!", { style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" } });
toast.error("Failed", { style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" } });
```