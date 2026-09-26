import GoogleLoginButton from "@/components/GoogleLoginButton";

export default function Login() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark large">L</div>
        <h1>Lumia AI Agent</h1>
        <p>Sign in to access your projects and AI coding workspace.</p>
        <GoogleLoginButton />
      </section>
    </main>
  );
}