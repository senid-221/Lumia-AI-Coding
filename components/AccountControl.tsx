import { auth, signOut } from "@/auth";
import Image from "next/image";
import GoogleLoginButton from "./GoogleLoginButton";

export default async function AccountControl() {
  const session = await auth();

  if (!session?.user) return <GoogleLoginButton />;

  return (
    <div className="account-control">
      {session.user.image ? (
        <Image className="avatar" src={session.user.image} alt="" width={28} height={28} />
      ) : (
        <div className="avatar fallback">{session.user.name?.slice(0, 1).toUpperCase() || "U"}</div>
      )}
      <span className="account-name">{session.user.name || session.user.email}</span>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
        <button className="logout-btn" type="submit">Sign out</button>
      </form>
    </div>
  );
}