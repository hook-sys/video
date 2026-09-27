import Link from "next/link";

type Props = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  error?: string;
  message?: string;
  footer: { text: string; href: string; label: string };
};

export function AuthForm({ title, action, submitLabel, error, message, footer }: Props) {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form action={action} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-foreground/70">{message}</p>}
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          className="rounded-md border border-foreground/20 bg-transparent px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="rounded-md border border-foreground/20 bg-transparent px-3 py-2"
        />
        <button className="rounded-md bg-foreground px-3 py-2 font-medium text-background">
          {submitLabel}
        </button>
        <p className="text-sm text-foreground/70">
          {footer.text}{" "}
          <Link href={footer.href} className="underline">
            {footer.label}
          </Link>
        </p>
      </form>
    </main>
  );
}
