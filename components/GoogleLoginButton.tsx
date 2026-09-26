"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export default function GoogleLoginButton() {
  return (
    <button className="google-login" onClick={() => signIn("google", { callbackUrl: "/" })} type="button">
      <Image src="/google-g.svg" alt="" width={18} height={18} aria-hidden="true" />
      <span>Login with Google</span>
    </button>
  );
}