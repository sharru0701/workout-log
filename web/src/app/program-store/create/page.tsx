import { redirect } from "next/navigation";

export default function ProgramCreateRedirectPage() {
  redirect("/program-store?create=1");
}
