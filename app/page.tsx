export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-16 text-center sm:items-start sm:text-left">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight">
            stardash
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            To get started, send a prompt or modify this page directly.
          </p>
        </div>
      </main>
    </div>
  );
}