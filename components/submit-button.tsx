"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={disabled || pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
