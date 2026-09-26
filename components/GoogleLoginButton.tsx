"use client";

import Image from "next/image";
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
      <Image
        src="/google-g.svg"
        alt="Google"
        width={24}
        height={24}
      />
    </a>
  );
}
