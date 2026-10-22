import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GitHubIcon } from "@/components/icons/github-icon"
import { PatLoginForm } from "@/components/pat-login-form"
import { getGitHubApp } from "@/lib/github-app"

const ERRORS: Record<string, string> = {
  state: "That sign-in link expired. Try again.",
  manifest: "GitHub did not finish creating the app. Try again.",
  access_denied: "You cancelled the GitHub authorization.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next: rawNext, error } = await searchParams
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"
  const configured = Boolean(getGitHubApp())
  const connectHref = `/api/auth/github/${configured ? "start" : "setup"}?next=${encodeURIComponent(next)}`

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GitHubIcon className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Sign in to StarDash</CardTitle>
          <CardDescription>
            {configured
              ? "Authorize the GitHub App this instance owns."
              : "StarDash will create a GitHub App owned by you, on your account. No third party is ever in the loop."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {ERRORS[error] ?? error}
            </p>
          )}
          <Button className="w-full" asChild>
            <a href={connectHref}>
              <GitHubIcon className="h-4 w-4" />
              {configured ? "Continue with GitHub" : "Connect GitHub"}
            </a>
          </Button>
          <PatLoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  )
}
