import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  WarningCircleIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  ArrowCircleUpIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  FileZipIcon,
  GitBranchIcon,
  GithubLogoIcon,
  InfoIcon,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { FilterChips } from "@/components/filter-chips";
import { PasswordInput } from "@/components/password-input";
import { AppHeader } from "@/components/layout/app-header";
import { Main } from "@/components/layout/main";
import { PageTitle } from "@/components/layout/page-title";
import { SectionCard } from "@/components/section-card";
import { checkedAgo, DeliveryProgress, PublishProblems } from "@/components/publish/Delivery";
import { PublishDialog } from "@/components/publish/PublishDialog";
import { PublishBar } from "@/features/settings/components/publish-bar";

type Method = "push" | "export";

/**
 * Deploying is how a site written here gets online. A static site has two
 * ways: an archive uploaded by hand, which needs nothing but a place to put
 * files, and a push to a git repository, whose host then builds and serves it.
 * One way shows at a time, the one a site in git already uses first; what
 * either way needs before going live is checked beside it.
 */
export function Deploy() {
  const { t } = useI18n();
  useDocumentTitle(t("nav.deploy"));
  const delivery = useDelivery();
  const [chosen, setChosen] = useState<Method | null>(null);
  const inGit = canPublish(delivery.data);
  const method = chosen ?? (inGit ? "push" : "export");

  return (
    <>
      <AppHeader />
      <Main className="flex flex-1 flex-col gap-5">
        <PageTitle title={t("nav.deploy")} description={t("deploy.note")} />
        <PublishBar className="mb-0 lg:mb-0" />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid min-w-0 gap-4">
            <FilterChips
              label={t("deploy.methods")}
              value={method}
              onChange={setChosen}
              options={[
                { value: "push", label: t("deploy.methodPush"), icon: GitBranchIcon },
                { value: "export", label: t("deploy.methodExport"), icon: FileZipIcon },
              ]}
            />
            {delivery.isPending && !chosen ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : method === "export" ? (
              <ExportCard />
            ) : inGit ? (
              <>
                <DeliveryCard />
                <GitHubCard />
              </>
            ) : (
              <>
                <GitHubCard />
                <ManualCard />
              </>
            )}
          </div>
          <Checklist />
        </div>
      </Main>
    </>
  );
}

function ExportCard() {
  const { t } = useI18n();
  const problem = useProblem();
  const exporting = useExportSite();

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
      <div className="grid gap-4 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          {t("deploy.draftsNote")}
        </p>
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

  // A form opened only on asking, so the card reads as one line until then.
  const opener =
    writable && state && !connected && !editing ? (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        {t("deploy.githubOpen")}
      </Button>
    ) : null;

  return (
    <SectionCard
      icon={GithubLogoIcon}
      title={t("deploy.github")}
      description={t("deploy.githubNote")}
      aside={opener}
    >
      {(!state || connected || editing || Boolean(done?.done?.length)) && (
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
            {writable && editing && (
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
      )}
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
 * DeliveryCard follows a push to the site, whatever hosts it. Where the
 * server can tell which host that is, from what the host recorded on GitHub,
 * it is named.
 */
function DeliveryCard() {
  const { t, locale } = useI18n();
  const delivery = useDelivery();
  const publish = usePublish([]);
  const writable = useWritable();
  const [publishing, setPublishing] = useState(false);
  const d = delivery.data;
  const dirty = d?.dirty ?? [];
  const host = hosts[d?.deploy_host ?? ""];
  const where = [d?.branch && `${d.remote ?? "origin"}/${d.branch}`, checkedAgo(d?.checked_at, locale, t)]
    .filter(Boolean)
    .join(" · ");

  return (
    <SectionCard
      icon={CloudArrowUpIcon}
      title={t("publish.delivery")}
      description={host ? `${t("deploy.pushReady")} ${t("deploy.host", { host })}` : t("deploy.pushReady")}
      aside={where && <span className="text-xs text-muted-foreground">{where}</span>}
    >
      <div className="grid gap-4 text-sm">
        <div className="rounded-xl bg-muted/50 px-2 pt-5 pb-4">
          <DeliveryProgress delivery={d} />
        </div>
        {((writable && (dirty.length > 0 || Boolean(d?.ahead))) || (d?.deployed === "done" && d.deployed_url)) && (
          <div className="flex flex-wrap gap-2">
            {writable && dirty.length > 0 ? (
              <Button onClick={() => setPublishing(true)}>
                <UploadSimpleIcon />
                {t("publish.publishAll", { count: dirty.length })}
              </Button>
            ) : writable && d?.ahead ? (
              <Button disabled={publish.pending} onClick={() => void publish.push()}>
                {publish.pending ? <Spinner /> : <UploadSimpleIcon />}
                {t("publish.pushCommits", { count: d.ahead })}
              </Button>
            ) : null}
            {d?.deployed === "done" && d.deployed_url && (
              <Button variant="outline" asChild>
                <a href={d.deployed_url} target="_blank" rel="noreferrer">
                  <ArrowSquareOutIcon />
                  {t("publish.viewSite")}
                </a>
              </Button>
            )}
          </div>
        )}
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
      </div>
    </SectionCard>
  );
}

/**
 * ManualCard is the way into git without a token: the terminal steps for
 * GitHub Pages, the host that needs nothing but the repository. Folded, as
 * connecting GitHub does them all.
 */
function ManualCard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section data-slot="card" className="rounded-xl border bg-card text-sm">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-5 py-4 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-6">
          <GitBranchIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{t("deploy.manual")}</span>
            <span className="text-muted-foreground"> · {t("deploy.manualNote")}</span>
          </span>
          <CaretDownIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="CollapsibleContent">
          <ol className="grid list-decimal gap-3 border-t px-5 py-4 ps-10 marker:text-muted-foreground sm:px-6 sm:ps-11">
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
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/**
 * Checklist is what going live needs whichever way the site goes: an
 * address of its own, content that reads, a Kite release the deploy builds
 * with, and, for a site in git, what still waits to be published. Each line
 * opens to say why and how to fix it.
 */
function Checklist() {
  const { t } = useI18n();
  const site = useSite();
  const delivery = useDelivery();
  const address = site.data?.base_url ?? "";
  const unreadable = site.data?.problems?.length ?? 0;
  const d = delivery.data;

  return (
    <section aria-labelledby="deploy-checks" className="grid gap-2">
      <h2 id="deploy-checks" className="px-1 text-xs font-medium text-muted-foreground">
        {t("deploy.checks")}
      </h2>
      {site.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <ul className="rounded-xl border bg-card px-4 py-1">
          {isLocal(address) ? (
            <CheckRow
              tone="warn"
              label={t("deploy.addressLocal", { url: address || "—" })}
              action={
                <Link to="/settings" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                  {t("deploy.addressFix")}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              }
            >
              {t("deploy.addressLocalWhy")}
            </CheckRow>
          ) : (
            <CheckRow tone="ok" label={t("deploy.addressOK", { url: address })} />
          )}
          {unreadable > 0 ? (
            <CheckRow tone="bad" label={t("deploy.problems", { count: unreadable })}>
              {t("deploy.problemsWhy")}
            </CheckRow>
          ) : (
            <CheckRow tone="ok" label={t("deploy.contentOK")} />
          )}
          <KiteCheck />
          <ReleaseCheck />
          {canPublish(d) &&
            (d?.dirty?.length ? (
              <CheckRow tone="pending" label={t("publish.pending", { count: d.dirty.length })} />
            ) : d?.ahead ? (
              <CheckRow tone="pending" label={t("publish.toPush", { count: d.ahead })} />
            ) : (
              <CheckRow tone="ok" label={t("deploy.nothingPending")} />
            ))}
        </ul>
      )}
    </section>
  );
}

/**
 * KiteCheck says which Kite release builds the site: the one kite.lock pins,
 * which kitew runs on this computer and in the deploy, against the one
 * serving the studio, and moves the pin when the two differ.
 */
function KiteCheck() {
  const { t } = useI18n();
  const problem = useProblem();
  const site = useSite();
  const writable = useWritable();
  const pin = usePinKite();
  const kite = site.data?.kite;
  if (!kite) return null;

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
    kite.running && kite.wrapper && writable
      ? !kite.pinned
        ? "deploy.kitePin"
        : kite.pinned !== kite.running
          ? "deploy.kiteUse"
          : !kite.checksums
            ? "deploy.kiteChecksums"
            : null
      : null;

  const other = Boolean(kite.pinned && kite.running && kite.running !== kite.pinned);
  const label = !kite.pinned
    ? t(kite.wrapper ? "deploy.kiteNoPinShort" : "deploy.kiteNoneShort")
    : other
      ? t("deploy.kiteOtherShort", { pinned: kite.pinned })
      : !kite.wrapper
        ? t("deploy.kiteNoWrapperShort")
        : kite.deploy === "self"
          ? t("deploy.kiteSelfShort")
          : t("deploy.kiteOK", { pinned: kite.pinned });
  const warn = !kite.pinned || other || !kite.wrapper || kite.deploy === "self";

  return (
    <CheckRow tone={warn ? "warn" : "ok"} label={label}>
      {!kite.pinned ? (
        <p>{t(kite.wrapper ? "deploy.kiteNoPin" : "deploy.kiteNone")}</p>
      ) : other ? (
        <p>{t("deploy.kiteOther", { pinned: kite.pinned, running: kite.running ?? "" })}</p>
      ) : (
        <p>{t(kite.running ? "deploy.kiteSame" : "deploy.kitePinnedOnly", { pinned: kite.pinned })}</p>
      )}
      {kite.pinned && !kite.wrapper && <p>{t("deploy.kiteNoWrapper")}</p>}
      {kite.pinned && !kite.checksums && <p>{t("deploy.kiteNoChecksums")}</p>}
      {kite.deploy === "self" && <p>{t("deploy.kiteSelf")}</p>}
      {!kite.wrapper && (
        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">kite wrapper</pre>
      )}
      {action && (
        <div>
          <Button variant="outline" size="sm" onClick={pinNow} disabled={pin.isPending}>
            {pin.isPending ? <Spinner /> : <PushPinIcon />}
            {t(action, { running: kite.running ?? "" })}
          </Button>
        </div>
      )}
    </CheckRow>
  );
}

/**
 * ReleaseCheck says a Kite newer than this one is out, as the server's daily
 * check found, and how to move to it: a new binary, or a new image.
 */
function ReleaseCheck() {
  const { t } = useI18n();
  const kite = useSite().data?.kite;
  if (!kite?.latest || !kite.latest_url) return null;
  const running = kite.running ?? "";

  return (
    <CheckRow
      tone="news"
      label={t("release.out", { version: kite.latest })}
      action={
        <a
          href={kite.latest_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
        >
          {t("release.notes")}
          <ArrowUpRightIcon className="size-3.5" />
        </a>
      }
    >
      <p>
        {kite.container
          ? t("deploy.latestImage", { running, image: `ghcr.io/kite-plus/kite:${kite.latest}` })
          : t("deploy.latestDownload", { running })}
      </p>
      <p>{t("deploy.latestOff")}</p>
    </CheckRow>
  );
}

const checkTones = {
  ok: { icon: CheckCircleIcon, className: "text-success" },
  warn: { icon: WarningCircleIcon, className: "text-warning" },
  bad: { icon: XCircleIcon, className: "text-destructive" },
  info: { icon: InfoIcon, className: "text-muted-foreground" },
  pending: { icon: CloudArrowUpIcon, className: "text-string" },
  news: { icon: ArrowCircleUpIcon, className: "text-primary" },
};

/** Check is one line of a list of what is as it should be, and what is not. */
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
 * CheckRow is one line of the checklist: how it stands, a way to fix it
 * under it, and when there is more to say, the line opens to say it.
 */
function CheckRow({
  tone,
  label,
  action,
  children,
}: {
  tone: keyof typeof checkTones;
  label: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, className } = checkTones[tone];
  const head = (
    <>
      <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
      <span className="min-w-0 flex-1 break-words">{label}</span>
    </>
  );
  return (
    <li className="border-t py-2.5 text-sm first:border-t-0">
      {children ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="-mx-1 flex w-[calc(100%+0.5rem)] items-start gap-2 rounded-md px-1 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {head}
            <CaretDownIcon
              className={cn("mt-1 size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </CollapsibleTrigger>
          {action && <div className="ps-6 pt-1">{action}</div>}
          <CollapsibleContent className="CollapsibleContent">
            <div className="grid gap-2 ps-6 pt-2 pb-0.5 text-[13px] text-muted-foreground">{children}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="flex items-start gap-2">{head}</div>
          {action && <div className="ps-6 pt-1">{action}</div>}
        </>
      )}
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

