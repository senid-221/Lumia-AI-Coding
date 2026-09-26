"use client";

import { signIn } from "next-auth/react";

export default function GoogleLoginButton() {
  return (
    <a
      className="google-login-icon"
      href="/api/auth/signin/google?callbackUrl=%2F"
      onClick={(event) => {
        event.preventDefault();
        void signIn("google", { callbackUrl: "/" });
      }}
      aria-label="Continue with Google"
      title="Continue with Google"
    >
      <svg
        className="google-logo"
        viewBox="0 0 48 48"
        width="24"
        height="24"
        aria-hidden="true"
        focusable="false"
      >
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.6l6.84-6.84C35.9 2.34 30.47 0 24 0 14.61 0 6.51 5.38 2.56 13.22l7.96 6.18C12.43 13.15 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.64-.15-3.21-.44-4.73H24v9.02h12.94c-.56 3-2.24 5.54-4.77 7.25l7.73 6c4.51-4.16 7.08-10.28 7.08-17.54z"/>
        <path fill="#FBBC05" d="M10.52 28.6A14.4 14.4 0 0 1 9.76 24c0-1.6.28-3.15.76-4.6l-7.96-6.18A24 24 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.96-6.18z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.92-2.14 15.9-5.82l-7.73-6C30.03 37.54 27.25 38.5 24 38.5c-6.26 0-11.57-3.65-13.48-8.82l-7.96 6.18C6.51 43.62 14.61 48 24 48z"/>
      </svg>
    </a>
  );
}
