import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-card">
        <Link href="/" className="about-back">← Back to Lumia</Link>
        <div className="about-mark"><span>✦</span></div>
        <h1>About Lumia AI Agent</h1>
        <p className="about-lead">
          Lumia AI Agent is a multi-agent AI coding platform built to help developers
          inspect projects, write code, run tools, review changes, and verify results.
        </p>
        <div className="about-section">
          <h2>Built for coding workflows</h2>
          <p>
            Lumia connects AI models with bounded project tools so coding tasks can
            move from a request to practical project changes and verification.
          </p>
        </div>
        <div className="about-section">
          <h2>Powered by BeeLimited and RwaCodex</h2>
          <p>
            Lumia brings together multi-agent coding workflows and provider-based AI
            model support in one focused workspace.
          </p>
        </div>
        <Link href="/" className="about-button">Open Lumia AI Agent</Link>
      </section>
    </main>
  );
}
