import { AuthForm } from "@/components/auth-form";
import { login } from "@/app/auth/actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, message } = await searchParams;
  return (
    <AuthForm
      title="Log in"
      action={login}
      submitLabel="Log in"
      error={typeof error === "string" ? error : undefined}
      message={typeof message === "string" ? message : undefined}
      footer={{ text: "No account?", href: "/signup", label: "Sign up" }}
    />
  );
}
