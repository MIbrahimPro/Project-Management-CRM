import { redirect } from "next/navigation";

// Root route — authenticated users go to dashboard; middleware sends unauthenticated to /login before this runs.
export default function Home() {
  redirect("/dashboard");
}
