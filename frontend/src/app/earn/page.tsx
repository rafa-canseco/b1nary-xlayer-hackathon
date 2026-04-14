import { redirect } from "next/navigation";
import { DEFAULT_ASSET } from "@/lib/assets";

export default function EarnPage() {
  redirect(`/earn/${DEFAULT_ASSET}`);
}
