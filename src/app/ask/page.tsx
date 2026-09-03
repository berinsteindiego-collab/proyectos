import { redirect } from "next/navigation";

// "Preguntar" was merged into the unified search+chat box on the home page.
// Keep this route so old links/bookmarks still land somewhere useful.
export default function AskPageRedirect() {
  redirect("/");
}
