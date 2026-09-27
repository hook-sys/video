import { CreateProjectForm } from "./create-project-form";

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Create Video</h1>
      <CreateProjectForm />
    </main>
  );
}
