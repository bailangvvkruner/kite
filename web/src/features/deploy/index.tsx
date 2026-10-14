import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  WarningCircleIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  ArrowSquareOutIcon,
  FileZipIcon,
  GitBranchIcon,
  InfoIcon,
  PackageIcon,
  PushPinIcon,
  UploadSimpleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { ApiError } from "@/api/client";
import { useI18n, useProblem, type Key } from "@/i18n";
import { useSite, useWritable } from "@/hooks/useContents";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { saveFile, useExportSite } from "@/hooks/useExport";
import { GitHubRefusal, useConnectGitHub, useDisconnectGitHub, useGitHub } from "@/hooks/useGitHub";
import { usePinKite } from "@/hooks/useKite";
import { canPublish, useDelivery, usePublish } from "@/hooks/usePublish";
import { sizeOf } from "@/lib/bytes";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/password-input";
import { AppHeader } from "@/components/layout/app-header";
import { Main } from "@/components/layout/main";
import { PageTitle } from "@/components/layout/page-title";
import { SectionCard } from "@/components/section-card";
import { DeliveryProgress, PublishProblems } from "@/components/publish/Delivery";
import { PublishDialog } from "@/components/publish/PublishDialog";
import { PublishBar } from "@/features/settings/components/publish-bar";

/**
 * Deploying is how a site written here gets online. A static site has two
 * ways: an archive uploaded by hand, which needs nothing but a place to put
 * files, and a push to a git repository, whose host then builds and serves it.
 */
export function Deploy() {
  const { t } = useI18n();
  useDocumentTitle(t("nav.deploy"));

  return (
    <>
      <AppHeader />
      <Main className="flex flex-1 flex-col gap-5">
        <PageTitle title={t("nav.deploy")} description={t("deploy.note")} />
        <PublishBar className="mb-0 lg:mb-0" />
        {/* How far the last change has gone leads, across the sheet; the ways
            to set up and to export follow side by side. */}
        <PushCard />
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <GitHubCard />
          <div className="grid gap-5">
            <ExportCard />
            <KiteCard />
          </div>
        </div>
      </Main>
    </>
  );
}

function ExportCard() {
  const { t } = useI18n();
  const problem = useProblem();
  const site = useSite();
  const exporting = useExportSite();

  const address = site.data?.base_url ?? "";
  const unreadable = site.data?.problems?.length ?? 0;

  const start = () =>
    exporting.mutate(undefined, {
      onSuccess: ({ archive, name }) => {
        saveFile(archive, name);
        toast.success(t("deploy.exported", { name, size: sizeOf(archive.size) }));
      },
    });

  const failure = exporting.error;
  const said =
    failure instanceof ApiError
      ? problem(failure.code, failure.message)
      : failure
        ? { title: t("deploy.exportFailed"), detail: String(failure) }
        : null;

  return (
    <SectionCard icon={FileZipIcon} title={t("deploy.export")} description={t("deploy.exportNote")}>
      <div className="grid gap-4">
        {site.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <ul className="grid gap-2 text-sm">
            {isLocal(address) ? (
              <Check tone="warn">
                {t("deploy.addressLocal", { url: address || "—" })}{" "}
                <Link to="/settings" className="font-medium text-brand hover:underline">
                  {t("deploy.addressFix")}
                </Link>
              </Check>
            ) : (
              <Check tone="ok">{t("deploy.addressOK", { url: address })}</Check>
            )}
            <Check tone="info">{t("deploy.draftsNote")}</Check>
            {unreadable > 0 && <Check tone="bad">{t("deploy.problems", { count: unreadable })}</Check>}
          </ul>
        )}

        {said && (
          <Alert variant="destructive">
            <XCircleIcon />
            <AlertTitle>{said.title}</AlertTitle>
            {said.detail && <AlertDescription className="break-all">{said.detail}</AlertDescription>}
          </Alert>
        )}

        <div>
          <Button onClick={start} disabled={exporting.isPending}>
            {exporting.isPending ? <Spinner /> : <DownloadSimpleIcon />}
            {t(exporting.isPending ? "deploy.exporting" : "deploy.exportAction")}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * GitHubCard links the site to a repository on GitHub with a token for that
 * repository alone. Connecting does what the terminal steps would: starts
 * the repository and adds origin where needed, writes the deploy workflow,
 * pushes and turns GitHub Pages on.
 */
function GitHubCard() {
  const { t } = useI18n();
  const problem = useProblem();
  const writable = useWritable();
  const github = useGitHub();
  const connect = useConnectGitHub();
  const disconnect = useDisconnectGitHub();
  const [editing, setEditing] = useState(false);
  // Null until typed in, which takes the repository the remote points to.
  const [repo, setRepo] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [pages, setPages] = useState(true);

  // A server that publishes nothing has nothing to connect.
  if (github.isError) return null;
  const state = github.data;
  const fromEnv = state?.token === "environment";
  const connected = Boolean(state?.token && state.repo);
  const typed = repo ?? state?.repo ?? "";
  const done = connect.data;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    connect.mutate(
      { repo: typed.trim(), token: token.trim() || undefined, pages },
      {
        onSuccess: () => {
          setToken("");
          setEditing(false);
        },
      },
    );
  };

  const refusal = !connect.error
    ? null
    : connect.error instanceof GitHubRefusal
      ? problem(connect.error.problem.code, connect.error.problem.detail, connect.error.problem.fix)
      : problem(connect.error instanceof ApiError ? connect.error.code : undefined, connect.error.message);

  return (
    <SectionCard icon={GitBranchIcon} title={t("deploy.github")} description={t("deploy.githubNote")}>
      <div className="grid gap-4 text-sm">
        {!state ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {connected && (
              <ul className="grid gap-2">
                <Check tone="ok">{t("deploy.githubConnected", { login: state.login || "GitHub", repo: state.repo ?? "" })}</Check>
                <Check tone="info">{t(fromEnv ? "deploy.githubEnv" : "deploy.githubSaved")}</Check>
              </ul>
            )}
            {done?.done && done.done.length > 0 && (
              <ul className="grid gap-2">
                {done.done.map((step) => (
                  <Check key={step} tone="ok">
                    {t(`deploy.githubDone.${step}` as Key)}
                  </Check>
                ))}
                {done.warnings?.map((warning) => {
                  const said = problem(warning.code, warning.detail, warning.fix);
                  return (
                    <Check key={warning.code} tone="warn">
                      {[said.title, said.detail, said.fix].filter(Boolean).join(" ")}
                    </Check>
                  );
                })}
                {done.pages_url && <Check tone="info">{t("deploy.githubPagesAt", { url: done.pages_url })}</Check>}
              </ul>
            )}
            {writable && (!connected || editing) && (
              <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-2">
                  <Label htmlFor="github-repo">{t("deploy.githubRepo")}</Label>
                  <Input
                    id="github-repo"
                    value={typed}
                    placeholder="owner/name"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setRepo(event.target.value)}
                  />
                  <p className="text-muted-foreground">{t("deploy.githubRepoHint")}</p>
                </div>
                {fromEnv ? (
                  <p className="text-muted-foreground">{t("deploy.githubTokenFromEnv")}</p>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="github-token">{t("deploy.githubToken")}</Label>
                    <PasswordInput
                      id="github-token"
                      value={token}
                      placeholder="github_pat_…"
                      autoComplete="off"
                      onChange={(event) => setToken(event.target.value)}
                    />
                    <p className="text-muted-foreground">
                      {t("deploy.githubTokenHint")}{" "}
                      <a
                        href={newTokenURL(state.new_token_url, typed)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        {t("deploy.githubNewToken")}
                      </a>
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Checkbox id="github-pages" checked={pages} onCheckedChange={(checked) => setPages(checked === true)} />
                  <div className="grid gap-1">
                    <Label htmlFor="github-pages" className="font-normal">
                      {t("deploy.githubPages")}
                    </Label>
                    <p className="text-muted-foreground">{t("deploy.githubPagesHint")}</p>
                  </div>
                </div>
                {refusal && (
                  <Alert variant="destructive">
                    <XCircleIcon />
                    <AlertTitle>{refusal.title}</AlertTitle>
                    {(refusal.detail || refusal.fix) && (
                      <AlertDescription>
                        {refusal.detail && <p>{refusal.detail}</p>}
                        {refusal.fix && <p>{refusal.fix}</p>}
                      </AlertDescription>
                    )}
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={connect.isPending || !typed.trim() || (!fromEnv && !token.trim())}>
                    {connect.isPending ? <Spinner /> : <GitBranchIcon />}
                    {t(connect.isPending ? "deploy.githubConnecting" : "deploy.githubConnect")}
                  </Button>
                  {editing && (
                    <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                      {t("common.cancel")}
                    </Button>
                  )}
                </div>
              </form>
            )}
            {writable && connected && !editing && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  {t("deploy.githubReconnect")}
                </Button>
                {!fromEnv && (
                  <Button variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                    {t("deploy.githubDisconnect")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

/**
 * newTokenURL is GitHub's form for the token, named for the repository being
 * typed and owned by its owner, so the form needs only the repository chosen.
 */
function newTokenURL(base: string, repo: string): string {
  const [owner, name] = repo.trim().split("/");
  try {
    const url = new URL(base);
    if (owner && name) {
      url.searchParams.set("name", `Kite ${owner}/${name}`);
      url.searchParams.set("target_name", owner);
    }
    return url.toString();
  } catch {
    return base;
  }
}

/** hosts names the hosts the server can tell a deployment came from. */
const hosts: Record<string, string> = {
  "github-pages": "GitHub Pages",
  vercel: "Vercel",
  "cloudflare-pages": "Cloudflare Pages",
};

/**
 * PushCard follows a push to the site, whatever hosts it. Where the server
 * can tell which host that is, from what the host recorded on GitHub, it is
 * named; the steps for a site not yet in git are GitHub Pages', the host
 * that needs nothing but the repository.
 */
function PushCard() {
  const { t } = useI18n();
  const delivery = useDelivery();
  const publish = usePublish([]);
  const writable = useWritable();
  const [publishing, setPublishing] = useState(false);
  const dirty = delivery.data?.dirty ?? [];
  const host = hosts[delivery.data?.deploy_host ?? ""];

  return (
    <SectionCard icon={CloudArrowUpIcon} title={t("deploy.push")} description={t("deploy.pushNote")}>
      <div className="grid gap-4 text-sm">
        {delivery.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : canPublish(delivery.data) ? (
          <>
            <div className="rounded-xl bg-muted/50 px-2 pt-5 pb-4">
              <DeliveryProgress delivery={delivery.data} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="grid min-w-0 flex-1 gap-1 text-muted-foreground">
                <p>{t("deploy.pushReady")}</p>
                {host && <p>{t("deploy.host", { host })}</p>}
              </div>
              {writable && dirty.length > 0 ? (
                <Button onClick={() => setPublishing(true)}>
                  <UploadSimpleIcon />
                  {t("publish.publishAll", { count: dirty.length })}
                </Button>
              ) : writable && delivery.data?.ahead ? (
                <Button disabled={publish.pending} onClick={() => void publish.push()}>
                  {publish.pending ? <Spinner /> : <UploadSimpleIcon />}
                  {t("publish.pushCommits", { count: delivery.data.ahead })}
                </Button>
              ) : null}
              {delivery.data?.deployed === "done" && delivery.data.deployed_url && (
                <Button variant="outline" asChild>
                  <a href={delivery.data.deployed_url} target="_blank" rel="noreferrer">
                    <ArrowSquareOutIcon />
                    {t("publish.viewSite")}
                  </a>
                </Button>
              )}
            </div>
            <PublishProblems publish={publish} />
            <PublishDialog
              ids={[]}
              paths={dirty}
              open={publishing}
              onOpenChange={setPublishing}
              onDone={() => undefined}
              title={t("publish.allTitle")}
              description={t("publish.allNote", { paths: dirty.join(", ") })}
            />
          </>
        ) : (
          <>
            <p>{t("deploy.githubSteps")}</p>
            <ol className="grid list-decimal gap-3 ps-5 marker:text-muted-foreground">
              <li>{t("deploy.step1")}</li>
              <li>
                {t("deploy.step2")}
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
                  {[
                    "git init",
                    "git add .",
                    'git commit -m "first commit"',
                    "git branch -M main",
                    "git remote add origin https://github.com/<you>/<repo>.git",
                    "git push -u origin main",
                  ].join("\n")}
                </pre>
              </li>
              <li>{t("deploy.step3")}</li>
              <li>{t("deploy.step4")}</li>
            </ol>
          </>
        )}
      </div>
    </SectionCard>
  );
}

/**
 * KiteCard says which Kite release builds the site: the one kite.lock pins,
 * which kitew runs on this computer and in the deploy, against the one
 * serving the studio, and moves the pin when the two differ.
 */
function KiteCard() {
  const { t } = useI18n();
  const problem = useProblem();
  const site = useSite();
  const writable = useWritable();
  const pin = usePinKite();
  const kite = site.data?.kite;

  const pinNow = () =>
    pin.mutate(undefined, {
      onSuccess: (now) => toast.success(t("deploy.kitePinned", { version: now.pinned ?? "" })),
      onError: (err) => {
        const said = err instanceof ApiError ? problem(err.code, err.message) : { title: String(err), detail: undefined };
        toast.error(said.title, { description: said.detail });
      },
    });

  // A pin to move, or one to complete with the checksums it lacks.
  const action =
    kite?.running && kite.wrapper && writable
      ? !kite.pinned
        ? "deploy.kitePin"
        : kite.pinned !== kite.running
          ? "deploy.kiteUse"
          : !kite.checksums
            ? "deploy.kiteChecksums"
            : null
      : null;

  return (
    <SectionCard icon={PackageIcon} title={t("deploy.kite")} description={t("deploy.kiteNote")}>
      <div className="grid gap-4 text-sm">
        {!kite ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <ul className="grid gap-2">
              {!kite.pinned ? (
                <Check tone="warn">{t(kite.wrapper ? "deploy.kiteNoPin" : "deploy.kiteNone")}</Check>
              ) : kite.running && kite.running !== kite.pinned ? (
                <Check tone="warn">{t("deploy.kiteOther", { pinned: kite.pinned, running: kite.running })}</Check>
              ) : (
                <Check tone="ok">{t(kite.running ? "deploy.kiteSame" : "deploy.kitePinnedOnly", { pinned: kite.pinned })}</Check>
              )}
              {kite.pinned && !kite.wrapper && <Check tone="warn">{t("deploy.kiteNoWrapper")}</Check>}
              {kite.pinned && !kite.checksums && <Check tone="info">{t("deploy.kiteNoChecksums")}</Check>}
              {kite.deploy === "self" && <Check tone="warn">{t("deploy.kiteSelf")}</Check>}
            </ul>
            {!kite.wrapper && (
              <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">kite wrapper</pre>
            )}
            {action && (
              <div>
                <Button variant="outline" onClick={pinNow} disabled={pin.isPending}>
                  {pin.isPending ? <Spinner /> : <PushPinIcon />}
                  {t(action, { running: kite.running ?? "" })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

const checkTones = {
  ok: { icon: CheckCircleIcon, className: "text-success" },
  warn: { icon: WarningCircleIcon, className: "text-warning" },
  bad: { icon: XCircleIcon, className: "text-destructive" },
  info: { icon: InfoIcon, className: "text-muted-foreground" },
};

/** Check is one thing the export will do, and whether it is as it should be. */
function Check({ tone, children }: { tone: keyof typeof checkTones; children: ReactNode }) {
  const { icon: Icon, className } = checkTones[tone];
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
      <span>{children}</span>
    </li>
  );
}

/**
 * isLocal reports an address only this computer can reach, which an exported
 * site would still write into its feeds and sitemap.
 */
function isLocal(address: string): boolean {
  let host: string;
  try {
    host = new URL(address).hostname;
  } catch {
    return true;
  }
  return (
    host === "" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.startsWith("127.")
  );
}

