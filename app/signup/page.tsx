import { AuthForm } from "@/components/auth-form";
import { signup } from "@/app/auth/actions";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { error } = await searchParams;
  return (
    <AuthForm
      title="Sign up"
      action={signup}
      submitLabel="Create account"
      error={typeof error === "string" ? error : undefined}
      footer={{ text: "Have an account?", href: "/login", label: "Log in" }}
    />
  );
}
