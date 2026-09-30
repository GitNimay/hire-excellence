import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center text-sm text-muted">
      Signing you in…
      <div id="clerk-captcha" />
      <AuthenticateWithRedirectCallback signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />
    </main>
  );
}
