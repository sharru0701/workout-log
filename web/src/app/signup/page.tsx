import { Suspense } from "react";
import { V2AuthForm } from "@/components/v2/v2-auth-form";

export const metadata = {
  title: "가입 · Workout Log",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <V2AuthForm mode="signup" />
    </Suspense>
  );
}
