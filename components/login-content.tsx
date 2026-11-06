"use client"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GitHubIcon } from "@/components/icons/github-icon"
import { PatLoginForm } from "@/components/pat-login-form"
import { APP_NAME } from "@/lib/brand"
import { useI18n } from "@/components/i18n-provider"

export function LoginContent({
  configured,
  connectHref,
  error,
  next,
}: {
  configured: boolean
  connectHref: string
  error?: string
  next: string
}) {
  const { t } = useI18n()
  const errors: Record<string, string> = {
    state: t("That sign-in link expired. Try again.", "登录链接已过期，请重试。"),
    manifest: t(
      "GitHub did not finish creating the app. Try again.",
      "GitHub 未完成应用创建，请重试。",
    ),
    access_denied: t("You cancelled the GitHub authorization.", "你取消了 GitHub 授权。"),
    owner: t(
      "This instance already has an owner. Sign in with their token first to connect GitHub.",
      "此实例已有所有者。请先使用所有者的令牌登录，再连接 GitHub。",
    ),
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GitHubIcon className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">
            {t(`Sign in to ${APP_NAME}`, `登录 ${APP_NAME}`)}
          </CardTitle>
          <CardDescription>
            {configured
              ? t("Authorize the GitHub App this instance owns.", "授权此实例拥有的 GitHub App。")
              : t(
                  `${APP_NAME} will create a GitHub App owned by you, on your account. No third party is ever in the loop.`,
                  `${APP_NAME} 将在你的账户中创建由你拥有的 GitHub App，无需第三方介入。`,
                )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {errors[error] ?? error}
            </p>
          )}
          <Button className="w-full" asChild>
            <a href={connectHref}>
              <GitHubIcon className="h-4 w-4" />
              {configured
                ? t("Continue with GitHub", "使用 GitHub 继续")
                : t("Connect GitHub", "连接 GitHub")}
            </a>
          </Button>
          <PatLoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  )
}
