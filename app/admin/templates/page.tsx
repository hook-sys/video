import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "../_components/ui";
import { TemplateGallery } from "./gallery";

export const metadata = { title: "Templates" };

// The simple engine's templates (docs/video-spec.md), every one in every
// variant, on sample words — what a video made by it can look like.
export default async function TemplatesPage() {
  await requireAdmin("settings");
  return (
    <>
      <PageHeader title="Templates" sub="The simple engine plays every beat of the voice with one of these. Pick a ground, a type pair, a way between scenes and a pace to see them as a video would. Taste lives here: to change how videos look, change a template." />
      <TemplateGallery />
    </>
  );
}
