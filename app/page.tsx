import LumiaWorkspace from "@/components/LumiaWorkspace";
import AccountControl from "@/components/AccountControl";

export default function Home() {
  return <LumiaWorkspace accountControl={<AccountControl />} />;
}