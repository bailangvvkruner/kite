// Package serve renders a site per request instead of building it to disk.
//
// This is the file-backed half of the serve runtime. Nothing here renders
// anything itself: a request is resolved to the output a build would have
// written for that URL, and the build engine produces it. The two runtimes
// share a read model, a renderer and a URL resolver, so a preview cannot
// quietly disagree with the deployed site.
package serve

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	_ "net/http/pprof" // rides the default mux, served only under --pprof

	"github.com/kite-plus/kite/internal/api"
	"github.com/kite-plus/kite/internal/apps"
	"github.com/kite-plus/kite/internal/auth"
	"github.com/kite-plus/kite/internal/build"
	"github.com/kite-plus/kite/internal/buildinfo"
	"github.com/kite-plus/kite/internal/config"
	"github.com/kite-plus/kite/internal/content"
	"github.com/kite-plus/kite/internal/kitew"
	"github.com/kite-plus/kite/internal/lock"
	"github.com/kite-plus/kite/internal/plugin"
	"github.com/kite-plus/kite/internal/render"
	"github.com/kite-plus/kite/internal/render/img"
	"github.com/kite-plus/kite/internal/render/theme"
	"github.com/kite-plus/kite/internal/setup"
	"github.com/kite-plus/kite/internal/site"
	"github.com/kite-plus/kite/web"
)

// Options configures a server.
type Options struct {
	Addr string

	// LiveReload injects a script that reloads open pages after a change.
	//
	// It is the one thing a served page carries that a built one does not, so
	// it is switchable: with it off the response is the built file, byte for
	// byte, which is what the parity test relies on.
	LiveReload bool

	// Watch reindexes and replans when the project changes.
	Watch bool

	// CachePages keeps what a page answered and hands the next asking of
	// the same address the same bytes, until a change empties it. It is
	// what a server standing in front of a site wants — one rendering per
	// change rather than one per visitor — and off by default, because a
	// server of one's own writing rarely asks for the same page twice.
	CachePages bool

	// CacheQuery settles how a query string weighs into a cached page's key.
	// A query a site never renders with is noise at best and a lever at
	// worst: a flood of one-shot addresses could fill the cache and evict
	// every real page. "ignore" folds any query into the page's path;
	// "a,b" keeps only those parameters, folded into one spelling, so a
	// reordered or padded asking shares one entry; "strict" — the
	// default — keeps a page only when it was asked for plainly, without
	// a query at all.
	CacheQuery string

	// Pprof serves Go's own instruments on a port of the loopback, for the
	// one running the server to look at the heat of the work: the heap,
	// the goroutines, the minutes of the CPU. It is off unless asked for,
	// for the same door it opens for the operator it would open for
	// whoever else found the port.
	Pprof bool

	// Drafts renders unpublished content, which a preview usually wants and a
	// deployment never does.
	Drafts bool

	// Admin mounts the read model API.
	//
	// It is off unless asked for. The API reports drafts, paths on the host
	// and files the index refused, none of which a publicly reachable server
	// should hand out; local authoring turns it on deliberately.
	Admin bool

	// Auth is who may use the admin. A nil guard, or one with no account
	// behind it, is an open server -- which is why a server that would put
	// one on a public address comes up in setup instead, answering nothing
	// else until it has an owner.
	Auth *auth.Guard

	// Write lets the API change the project.
	//
	// Separate from Admin, and off unless asked for, because reading a
	// repository over HTTP and letting anyone who can reach the port rewrite
	// it are not the same decision.
	Write bool

	Logger *slog.Logger
}

// Server renders a project over HTTP.
type Server struct {
	opts   Options
	router *router
	hub    *reloadHub
	log    *slog.Logger

	// now is injected so that a test can compare a served page against a built
	// one. The clock is an input to rendering like any other, and the design
	// requires every input to be explicit.
	now func() time.Time

	// root never changes, so it is read without the lock.
	root string

	// setup is the first run this server is in the middle of, and nil for
	// every server that is not one.
	setup *setup.Flow

	// account changes the account the guard checks, and the profile of the
	// person using the studio.
	account *auth.Keeper

	// reloading lets one reload run at a time, whoever asked for it.
	reloading sync.Mutex

	mu       sync.RWMutex
	site     *site.Site
	builder  *build.Builder
	problems []string
	// due is when the next item dated later falls due and the plan with it
	// stops being current; zero when nothing is waiting.
	due    time.Time
	extras *extras
	// configHash detects a settings change, which needs more than a reindex.
	configHash string
	// templates fingerprints the templates the site draws with. The engine
	// keeps every template it has parsed, so an edited or replaced one needs
	// the site assembled again, as a settings change does.
	templates string

	pages *pageCache
	// cacheFold and cacheKeep are the CacheQuery policy as the asking meets
	// it: fold sends every query to the same page, keep names the only
	// parameters a key may carry.
	cacheFold bool
	cacheKeep []string

	previews *previews
}

// Setup is the first run this server is waiting on, or nil when it is not
// waiting on one. The command that started the server prints from it, so that
// whoever ran it is told where to finish.
func (s *Server) Setup() *setup.Flow { return s.setup }

// project is the site as it currently stands. Configuration can be reloaded
// while requests are in flight, so it is read rather than captured.
func (s *Server) project() *site.Site {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.site
}

// New prepares a server over an opened project.
func New(ctx context.Context, s *site.Site, opts Options) (*Server, error) {
	return NewWithClock(ctx, s, opts, time.Now)
}

// NewWithClock is [New] with the clock supplied, for tests that need a
// rendering to be comparable rather than current.
func NewWithClock(ctx context.Context, s *site.Site, opts Options, now func() time.Time) (*Server, error) {
	if opts.Addr == "" {
		opts.Addr = "127.0.0.1:1717"
	}
	if opts.Logger == nil {
		opts.Logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	// One guard for the API to check and the account to change: two would
	// disagree the first time a password was set.
	if opts.Auth == nil {
		opts.Auth = auth.New(nil)
	}
	// A studio with no account on an address other than localhost used to be
	// refused outright. A container has no terminal to run
	// `kite auth set-password` in, so that left whoever deployed it with a
	// restart loop and a log line to read.
	//
	// It comes up in setup instead. Nothing but the first-run endpoints
	// answers, so an unconfigured server hands out no content, no drafts and
	// no settings; the form itself is open, and the first browser to reach it
	// gets the account. Giving the server an account before it is reachable
	// is what closes that window -- see [setup] for why it is left open.
	var flow *setup.Flow
	if opts.Admin && !opts.Auth.Required() && !auth.Loopback(opts.Addr) {
		// Setup writes an account and the site's own description, so a
		// read-only server has no way through it and is still refused.
		if !opts.Write {
			return nil, fmt.Errorf("serve: %s can be reached from outside this machine "+
				"and this project has no account, so the studio would be open to anyone;\n"+
				"       set one with `kite auth set-password`, with KITE_ADMIN_USER "+
				"and KITE_ADMIN_PASSWORD,\n"+
				"       or add --write to be guided through setup in a browser", opts.Addr)
		}
		var err error
		if flow, err = setup.New(s.Project.Root, opts.Auth); err != nil {
			return nil, err
		}
	}

	srv := &Server{
		opts:    opts,
		site:    s,
		root:    s.Project.Root,
		setup:   flow,
		account: auth.NewKeeper(s.Project.Root, opts.Auth, opts.Addr),
		router:  newRouter(),
		hub:     newReloadHub(),
		log:     opts.Logger,
		now:     now,
	}
	if opts.CachePages {
		srv.pages = newPageCache()
		switch {
		case opts.CacheQuery == "", opts.CacheQuery == "strict":
		case opts.CacheQuery == "ignore":
			srv.cacheFold = true
		default:
			for _, name := range strings.Split(opts.CacheQuery, ",") {
				if name = strings.TrimSpace(name); name != "" {
					srv.cacheKeep = append(srv.cacheKeep, name)
				}
			}
		}
	}
	srv.previews = newPreviews(srv)
	if opts.Pprof {
		go func() {
			ln, err := net.Listen("tcp", "127.0.0.1:6060")
			if err != nil {
				srv.log.Warn("pprof: no port", "err", err)
				return
			}
			srv.log.Info("pprof listening", "addr", ln.Addr().String())
			_ = http.Serve(ln, nil) // net/http/pprof rides the default mux
		}()
	}
	srv.configHash = srv.readConfigHash()
	srv.templates = srv.templatesStamp(s.Config)
	if err := srv.Reload(ctx); err != nil {
		return nil, err
	}
	return srv, nil
}

// Reload reindexes the project and rebuilds the routing table.
//
// The clock is read once here rather than per request, so every page rendered
// between two changes agrees about what time it is, the way every page in one
// build does.
func (s *Server) Reload(ctx context.Context) error {
	s.reloading.Lock()
	defer s.reloading.Unlock()
	return s.reload(ctx)
}

func (s *Server) reload(ctx context.Context) error {
	// Configuration first: a changed title or theme has to be in place before
	// anything derived from it is rebuilt.
	if err := s.reconfigureIfChanged(); err != nil {
		return err
	}
	current := s.project()

	// A file with no id, or one that will not parse, must not take the server
	// down: the rest of the site still previews, and the page says what was
	// skipped.
	var problems []string
	if _, err := current.Index.Reconcile(ctx); err != nil {
		problems = strings.Split(err.Error(), "\n")
		for _, p := range problems {
			s.log.Warn("not indexed", "detail", p)
		}
	}

	builder, err := current.Builder(site.BuildOptions{
		Drafts: s.opts.Drafts,
		Now:    s.now(),
	})
	if err != nil {
		return err
	}

	plan, err := builder.Plan(ctx)
	if err != nil {
		return err
	}
	due, err := builder.NextDue(ctx)
	if err != nil {
		return err
	}
	media, err := build.MediaFiles(plan, os.DirFS(s.root))
	if err != nil {
		return err
	}
	s.router.load(plan)
	s.router.loadMedia(media)

	s.mu.Lock()
	s.builder, s.problems, s.due = builder, problems, due
	s.extras = &extras{builder: builder, plan: plan, log: s.log}
	// Every cached page was rendered from the site as it stood, so the
	// change that swapped the builder empties them with it.
	if s.pages != nil {
		s.pages.reset()
	}
	s.mu.Unlock()

	// With the cache on, the pages are not left for the first visitor of
	// each to pay for: the plan is walked in the background and every
	// page rendered into the cache, so a change has already paid for the
	// next asking of every address by the time anyone asks.
	if s.pages != nil {
		go s.warm(context.WithoutCancel(ctx), builder, plan)
	}

	s.log.Info("site loaded", "routes", s.router.size())
	return nil
}

// warm renders every page of the plan into the cache. It is the same
// rendering a build does — no request is passed, so a page warmed is
// byte for byte what building it writes, and a template that branched
// on the live request could not be built either. It stops the moment a
// newer builder takes over, so two changes in a row warm once, for the
// second.
func (s *Server) warm(ctx context.Context, builder *build.Builder, plan *build.Plan) {
	started := time.Now()
	var done int
	for _, t := range plan.Targets {
		s.mu.RLock()
		current := s.builder
		s.mu.RUnlock()
		if current != builder {
			return
		}
		html, _, err := builder.Render(ctx, t, nil)
		if err != nil {
			s.log.Warn("warm: page not rendered", "url", t.URL, "err", err)
			continue
		}
		status := http.StatusOK
		if t.Kind == render.KindNotFound {
			status = http.StatusNotFound
		}
		s.pages.put(t.URL, &cachedPage{status: status, body: html})
		done++
	}
	s.log.Info("pages warmed", "count", done, "took", time.Since(started).Round(time.Millisecond))
}

// Handler returns the HTTP handler, which is also what the tests drive.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	if s.opts.LiveReload {
		mux.HandleFunc("GET "+ReloadPath, s.hub.handleReload)
	}
	if s.opts.Admin {
		api.New(api.Options{
			Site:    s.view,
			Logger:  s.log,
			Auth:    s.opts.Auth,
			Setup:   s.setup,
			Account: s.account,
		}).Mount(mux)
		mux.Handle(web.Path+"/", web.Handler())
		mux.Handle(web.Path, http.RedirectHandler(web.Path+"/", http.StatusMovedPermanently))
	}
	mux.HandleFunc("/", s.handle)
	return mux
}

// view is the project as the API should currently see it.
//
// It is read per request rather than captured once, because a reconcile
// replaces the problem list underneath a running server: an admin that held
// the startup copy would keep reporting a file the author has since fixed.
func (s *Server) view() api.View {
	s.mu.RLock()
	problems, current, configHash := s.problems, s.site, s.configHash
	s.mu.RUnlock()

	v := api.View{
		Reader:         current.Reader,
		Resolver:       current.Resolver,
		Types:          current.Project.Types,
		Site:           current.Config.Site,
		Build:          current.Config.Build,
		NewCategory:    current.Config.Content.NewCategory(current.Config.Site.Language),
		Store:          current.Config.Content.Store,
		Runtime:        "serve",
		Theme:          current.Config.Theme.Name,
		Version:        buildinfo.Version,
		ConfigRevision: content.Revision("sha256:" + configHash),
		Problems:       problems,

		ActiveTheme:   current.Theme,
		ThemeSettings: current.Config.Theme.Settings,
		Menus:         current.Config.Menus,
		Themes:        s.themes,
		Previews:      s.previews,

		Plugins:          current.Config.Plugins,
		InstalledPlugins: s.installedPlugins,

		Lock: func() (*lock.File, error) { return lock.Read(s.root) },
		PackageTree: func(kind, name string) (string, error) {
			return lock.TreeOf(filepath.Join(s.root, apps.Dir(kind, name)))
		},
		Kitew: func() (bool, string) { return kitew.Installed(s.root), kitew.Deploy(s.root) },
	}
	// The configuration was checked when it was read, key included, so a
	// client that cannot be made only leaves the app center out.
	if client, err := apps.ClientFor(s.root, current.Config.Apps.Index, current.Config.Apps.Key); err == nil {
		v.Apps = client
	} else {
		s.log.Error("index of themes and plugins", "err", err)
	}
	if s.opts.Write {
		v.Writer = current.Project.Writer()
		v.Refresh = s.refresh
		v.Publisher = current.Publisher()
	}
	v.Preview = s.preview
	v.WordCount = s.wordCount
	v.Export = s.export
	v.Bundle = s.bundle
	return v
}

// bundle lists the files an item keeps in its bundle.
func (s *Server) bundle(owner *content.Content) ([]api.BundleFile, bool, error) {
	s.mu.RLock()
	current := s.site
	s.mu.RUnlock()
	files, kept, err := current.Bundle(owner)
	out := make([]api.BundleFile, len(files))
	for i, f := range files {
		out[i] = api.BundleFile(f)
	}
	return out, kept, err
}

// installedPlugins lists the plugins in plugins/, each loaded afresh so that
// one just installed or edited is described as it is now.
func (s *Server) installedPlugins() []api.InstalledPlugin {
	ids, err := plugin.Installed(s.root)
	if err != nil {
		s.log.Error("list plugins", "err", err)
		return nil
	}
	out := make([]api.InstalledPlugin, 0, len(ids))
	for _, id := range ids {
		one := api.InstalledPlugin{ID: id}
		if p, err := plugin.Open(s.root, id); err == nil {
			one.Plugin, one.Manifest = p, &p.Manifest
		} else {
			one.Problem = err.Error()
			if m, err := plugin.ReadManifest(os.DirFS(filepath.Join(s.root, plugin.Dir, id))); err == nil {
				one.Manifest = m
			}
		}
		out = append(out, one)
	}
	return out
}

// export builds the site as a deployment gets it, whatever this server
// shows: a studio serving drafts still exports without them.
func (s *Server) export(ctx context.Context, dir string) error {
	s.mu.RLock()
	current, problems := s.site, s.problems
	s.mu.RUnlock()

	// The site's own list of what the index refused dates from when it was
	// opened; the server's is from its last reindex. The build is handed the
	// current one, and refuses a site it cannot fully see.
	snapshot := *current
	snapshot.Problems = problems
	_, _, err := snapshot.Build(ctx, site.BuildOptions{OutDir: dir, Now: s.now()})
	return err
}

// themes lists the themes the project could switch to.
func (s *Server) themes() []api.InstalledTheme {
	installed := site.Themes(s.root)
	out := make([]api.InstalledTheme, 0, len(installed))
	for _, one := range installed {
		out = append(out, api.InstalledTheme{
			Name:     one.Name,
			Builtin:  one.Builtin,
			Theme:    one.Theme,
			Manifest: one.Manifest,
			Problem:  one.Problem,
		})
	}
	return out
}

// preview renders an item that is not on disk.
//
// It goes through the builder rather than a renderer of its own, so an author
// is looking at the page the build would produce, not at an approximation of
// it that happens to live in the admin.
func (s *Server) preview(ctx context.Context, item *content.Content) ([]byte, error) {
	s.mu.RLock()
	builder, current := s.builder, s.site
	s.mu.RUnlock()

	// A draft is shown as it will be published, and the studio dates one that
	// has no date when it is published. A build draws a draft as it stands.
	if item.Status == content.StatusDraft && item.PublishedAt == nil {
		dated, now := *item, s.now().UTC()
		dated.PublishedAt = &now
		item = &dated
	}

	target := build.Target{
		Kind:   render.KindSingle,
		Type:   string(item.Kind),
		URL:    current.Resolver.For(item),
		Item:   item,
		Layout: build.LayoutOf(item),
	}
	// A saved item keeps the neighbors the plan gave it. They come from where
	// it sits among the others, which editing its text does not move; a draft
	// that changes its date sees the new ones once it is saved.
	if planned, ok := s.router.planned(item.ID); ok {
		target.Prev, target.Next = planned.Prev, planned.Next
	}
	html, _, err := builder.Render(ctx, target, nil)
	return html, err
}

// wordCount counts an item that is not on disk as its page will.
func (s *Server) wordCount(ctx context.Context, item *content.Content) (int, error) {
	s.mu.RLock()
	builder := s.builder
	s.mu.RUnlock()
	return builder.WordCount(ctx, item)
}

// reconfigureIfChanged rebuilds the configuration-derived half of the site
// when kite.yaml or a template has changed.
//
// The index is kept: nothing in it depends on configuration, and replacing it
// would pull the database out from under requests already in flight.
func (s *Server) reconfigureIfChanged() error {
	hash := s.readConfigHash()

	s.mu.RLock()
	current, known, stamp := s.site, s.configHash, s.templates
	s.mu.RUnlock()
	if hash == known && s.templatesStamp(current.Config) == stamp {
		return nil
	}

	next, err := current.Reconfigure()
	if err != nil {
		return err
	}
	stamp = s.templatesStamp(next.Config)

	s.mu.Lock()
	s.site, s.configHash, s.templates = next, hash, stamp
	s.mu.Unlock()

	s.log.Info("configuration reloaded")
	return nil
}

// templatesStamp fingerprints the site's own layouts and language packs, what
// an installed theme is assembled from, its manifest, layouts and language
// packs, and the directory of each enabled plugin, by path, size and
// modification time. A theme's static files are read on every request.
func (s *Server) templatesStamp(cfg *config.Config) string {
	themeName := cfg.Theme.Name
	paths := []string{filepath.Join(s.root, theme.LayoutsDir), filepath.Join(s.root, theme.PacksDir)}
	for _, id := range cfg.Plugins.Enabled {
		if config.ValidPluginID(id) {
			paths = append(paths, filepath.Join(s.root, plugin.Dir, id))
		}
	}
	if themeName != "" && themeName != site.BuiltinTheme && content.ValidThemeName(themeName) {
		dir := filepath.Join(s.root, site.ThemesDir, themeName)
		// A theme linked in from elsewhere is fingerprinted where it lives.
		if resolved, err := filepath.EvalSymlinks(dir); err == nil {
			dir = resolved
		}
		for _, name := range []string{theme.ManifestName, theme.LayoutsDir, theme.PacksDir} {
			paths = append(paths, filepath.Join(dir, name))
		}
	}
	sum := sha256.New()
	for _, path := range paths {
		_ = filepath.WalkDir(path, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			if info, err := d.Info(); err == nil {
				_, _ = fmt.Fprintf(sum, "%s %d %d\n", p, info.Size(), info.ModTime().UnixNano())
			}
			return nil
		})
	}
	return hex.EncodeToString(sum.Sum(nil))
}

func (s *Server) readConfigHash() string {
	data, err := os.ReadFile(filepath.Join(s.root, config.Name))
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// refresh reindexes, replans and tells open pages to reload.
//
// It runs before a write is answered rather than being left to the file
// watcher, so that reading back what was just written returns what is on disk
// rather than what the client sent.
func (s *Server) refresh(ctx context.Context) error {
	if err := s.Reload(ctx); err != nil {
		return err
	}
	s.hub.broadcast()
	return nil
}

// catchUp plans again once an item dated later has fallen due.
//
// A plan is made against a frozen clock, and nothing on disk changes when the
// moment a post was waiting for arrives. A server left running would go on
// hiding it until some unrelated edit, so the first request after that moment
// replans before it is answered.
func (s *Server) catchUp(ctx context.Context) {
	if !s.overdue() {
		return
	}
	s.reloading.Lock()
	defer s.reloading.Unlock()
	if !s.overdue() {
		return // a request that got here first has already replanned
	}
	// Every request queued behind this one needs the result, so the client
	// that asked first going away must not abandon it.
	if err := s.reload(context.WithoutCancel(ctx)); err != nil {
		s.log.Error("publishing scheduled content failed", "err", err)
		// Retrying on every request would replan once per page view until
		// someone fixed what broke.
		s.mu.Lock()
		s.due = s.now().Add(time.Minute)
		s.mu.Unlock()
		return
	}
	s.hub.broadcast()
}

func (s *Server) overdue() bool {
	s.mu.RLock()
	due := s.due
	s.mu.RUnlock()
	return !due.IsZero() && !s.now().Before(due)
}

// ListenAndServe runs until the context is canceled.
func (s *Server) ListenAndServe(ctx context.Context) error {
	listener, err := net.Listen("tcp", s.opts.Addr)
	if err != nil {
		return fmt.Errorf("serve: %w", err)
	}

	if s.opts.Watch {
		w, err := newWatcher(s.root, s.log)
		if err != nil {
			return err
		}
		defer func() { _ = w.Close() }()
		go w.run(ctx, func() {
			if err := s.Reload(ctx); err != nil {
				s.log.Error("reload failed", "err", err)
				return
			}
			s.hub.broadcast()
		})
	}

	httpSrv := &http.Server{
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutdown)
	}()

	s.log.Info("listening", "addr", "http://"+listener.Addr().String())
	if err := httpSrv.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// URL is the address the server listens on.
func (s *Server) URL() string { return "http://" + s.opts.Addr }

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	s.catchUp(r.Context())
	if target, ok := s.router.lookup(r.URL.Path); ok {
		s.renderTarget(w, r, target, http.StatusOK)
		return
	}

	// A site published under a path is served under it too, so a link that
	// forgot the path fails here rather than after it is deployed. A request
	// for the bare host is sent to the home page.
	current := s.project()
	if within, ok := current.Resolver.SitePath(r.URL.Path); ok {
		if s.serveExtra(w, r, within) || s.serveStatic(w, r, within) || serveMade(w, r, within, current.Images) {
			return
		}
	} else if r.URL.Path == "/" {
		http.Redirect(w, r, current.Resolver.ForHome(current.Config.Site.Language), http.StatusFound)
		return
	}

	if target, ok := s.router.notFoundTarget(); ok {
		s.renderTarget(w, r, target, http.StatusNotFound)
		return
	}
	http.NotFound(w, r)
}

func (s *Server) renderTarget(w http.ResponseWriter, r *http.Request, t build.Target, status int) {
	s.mu.RLock()
	builder, problems := s.builder, s.problems
	s.mu.RUnlock()

	// The cache sits before the rendering, not beside it: a page asked for
	// again between two changes is handed the bytes the first asking
	// rendered, and no rendering happens at all. Asked for by many at
	// once, it is rendered once — the first holds the address and the
	// rest are handed what that one kept.
	var key string
	var keepable bool
	if s.pages != nil {
		key, keepable = cacheKey(r.URL.Path, r.URL.RawQuery, s.cacheFold, s.cacheKeep)
		if page, ok := s.pages.get(key); ok {
			w.Header().Set("X-Kite-Cache", "hit")
			s.writePage(w, r, page, problems)
			return
		}
		// A page asked for with a query its key cannot stand for is rendered
		// for the asking alone: nothing of it is kept, so no flood of
		// one-shot addresses can take a real page's place.
		if keepable {
			letGo := s.pages.hold(key)
			defer letGo()
			if page, ok := s.pages.get(key); ok {
				w.Header().Set("X-Kite-Cache", "hit")
				s.writePage(w, r, page, problems)
				return
			}
		}
		w.Header().Set("X-Kite-Cache", "miss")
	}

	html, _, err := builder.Render(r.Context(), t, render.NewRequest(r))
	if err != nil {
		s.log.Error("render failed", "url", r.URL.Path, "err", err)
		http.Error(w, "render failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	// A page is kept only while the builder that rendered it is still the
	// server's: one that finished after a change must not slip into the
	// new cache as stale. It is kept in the asked pool, whose small budget
	// a flood of one-shot addresses churns without touching a page of the
	// site — those live in the warmed pool.
	if s.pages != nil && keepable {
		s.mu.RLock()
		current := s.builder
		s.mu.RUnlock()
		if current == builder {
			s.pages.putAsked(key, &cachedPage{status: status, body: html})
		}
	}
	s.writePage(w, r, &cachedPage{status: status, body: html}, problems)
}

// cacheKey folds an asking's address into the key its page may live
// under. A query a site never renders with is noise at best and a lever
// at worst, so it is either folded away — every variant of a page shares
// one entry — or narrowed to the parameters a site renders with, kept in
// one spelling, so a reordered or padded asking shares one entry too.
// A query that folds onto no key of its own does not refuse the page:
// only its keeping, so an address asked for once — the ?x= of a
// scraper — renders and leaves nothing behind.
func cacheKey(path, rawQuery string, fold bool, keep []string) (key string, keepable bool) {
	if rawQuery == "" || fold {
		return path, true
	}
	if len(keep) == 0 {
		return path, false
	}
	vals, err := url.ParseQuery(rawQuery)
	if err != nil {
		return path, false
	}
	for k := range vals {
		if !slices.Contains(keep, k) {
			return path, false
		}
	}
	var b strings.Builder
	for _, k := range keep {
		for _, v := range vals[k] {
			if b.Len() > 0 {
				b.WriteByte('&')
			}
			b.WriteString(url.QueryEscape(k))
			b.WriteByte('=')
			b.WriteString(url.QueryEscape(v))
		}
	}
	return path + "?" + b.String(), true
}

// writePage answers with a rendered page, fresh or kept. The live-reload
// script is of the moment, so it is injected here, after the keeping —
// and a page carrying it is sent as it is, for the same reason: what a
// reload must refresh is not a thing to compress once and hand out many
// times. Every other page is sent the way its asking takes, compressed
// once and kept beside it so.
func (s *Server) writePage(w http.ResponseWriter, r *http.Request, page *cachedPage, problems []string) {
	html := page.body
	e := EncodingIdentity
	if s.opts.LiveReload {
		html = inject(html, problems)
	} else {
		e = negotiate(r.Header.Get("Accept-Encoding"))
		html = page.encoded(e)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Length", contentLength(len(html)))
	// A preview that served a stale page from the browser cache would defeat
	// the point of watching the filesystem at all.
	w.Header().Set("Cache-Control", "no-store")
	// The answer depends on what the asking said it would take, so any
	// cache between this server and the browser must keep the askings
	// apart.
	w.Header().Add("Vary", "Accept-Encoding")
	if e != EncodingIdentity {
		w.Header().Set("Content-Encoding", string(e))
	}
	w.WriteHeader(page.status)

	if r.Method != http.MethodHead {
		_, _ = w.Write(html)
	}
}

// serveStatic answers for files a build would copy rather than render. within
// is the request's path inside the site.
func (s *Server) serveStatic(w http.ResponseWriter, r *http.Request, within string) bool {
	return serveFile(w, r, within, s.root, s.router, staticRoots(s.root, s.project()))
}

// serveFile answers for a file a build would copy rather than render: one a
// page bundle owns, or one from the roots in the order a build copies them.
func serveFile(w http.ResponseWriter, r *http.Request, within, root string, routes *router, roots []fs.FS) bool {
	rel := strings.TrimPrefix(path.Clean("/"+within), "/")
	if rel == "" || rel == "." || strings.HasPrefix(rel, "..") {
		return false
	}

	// A page bundle's own files are looked up first, because they are the
	// ones whose address depends on where the page went.
	if src, ok := routes.bundleFile(rel); ok {
		if data, modTime, found := readFile(os.DirFS(root), src); found {
			if ctype := mime.TypeByExtension(path.Ext(rel)); ctype != "" {
				w.Header().Set("Content-Type", ctype)
			}
			w.Header().Set("Cache-Control", "no-store")
			serveBytes(w, r, rel, modTime, data)
			return true
		}
	}

	for _, fsys := range roots {
		data, modTime, ok := readFile(fsys, rel)
		if !ok {
			continue
		}
		if ctype := mime.TypeByExtension(path.Ext(rel)); ctype != "" {
			w.Header().Set("Content-Type", ctype)
		}
		w.Header().Set("Cache-Control", "no-store")
		serveBytes(w, r, rel, modTime, data)
		return true
	}
	return false
}

// serveBytes writes a file a build would copy, compressed when it is one
// of the kinds compression carries and the asking takes it. A file sent
// compressed is sent whole: ranges belong to the answer that has them,
// and no browser asks a range of what it would have taken whole.
func serveBytes(w http.ResponseWriter, r *http.Request, name string, modTime time.Time, data []byte) {
	e := EncodingIdentity
	if textLike(path.Ext(name)) {
		e = negotiate(r.Header.Get("Accept-Encoding"))
	}
	w.Header().Add("Vary", "Accept-Encoding")
	if e == EncodingIdentity || len(data) < worthCompressing {
		e = EncodingIdentity
	} else {
		w.Header().Set("Content-Encoding", string(e))
		data = encode(data, e)
	}
	http.ServeContent(w, r, name, modTime, bytes.NewReader(data))
}

// serveMade answers for a picture a template had made, which a build writes
// beside the file it was made from and names by what went into it.
func serveMade(w http.ResponseWriter, r *http.Request, within string, images *img.Processor) bool {
	if images == nil {
		return false
	}
	made, ok := images.Lookup(within)
	if !ok {
		return false
	}
	data, err := made.Bytes()
	if err != nil {
		return false
	}
	w.Header().Set("Content-Type", made.MediaType())
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, path.Base(within), time.Time{}, bytes.NewReader(data))
	return true
}

// staticRoots lists where unprocessed files live, in the order a build copies
// them: the project's own static directory wins over the theme's.
func staticRoots(root string, current *site.Site) []fs.FS {
	roots := []fs.FS{os.DirFS(filepath.Join(root, "static"))}
	if current.Theme.Static != nil {
		roots = append(roots, current.Theme.Static)
	}
	if current.Theme.Assets != nil {
		roots = append(roots, prefixed{fsys: current.Theme.Assets, prefix: "assets/"})
	}
	for _, p := range current.Plugins {
		if p.Assets != nil {
			roots = append(roots, prefixed{fsys: p.Assets, prefix: path.Join(plugin.Dir, p.Manifest.ID) + "/"})
		}
	}
	return roots
}

// readFile loads a small file whole, which keeps the handler free of the type
// assertions a seekable fs.File would otherwise need.
func readFile(fsys fs.FS, name string) ([]byte, time.Time, bool) {
	f, err := fsys.Open(name)
	if err != nil {
		return nil, time.Time{}, false
	}
	defer func() { _ = f.Close() }()

	info, err := f.Stat()
	if err != nil || info.IsDir() {
		return nil, time.Time{}, false
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, time.Time{}, false
	}
	return data, info.ModTime(), true
}

// prefixed serves a filesystem under a URL prefix, mirroring where a build
// copies the theme's assets.
type prefixed struct {
	fsys   fs.FS
	prefix string
}

func (p prefixed) Open(name string) (fs.File, error) {
	rest, ok := strings.CutPrefix(name, p.prefix)
	if !ok {
		return nil, fs.ErrNotExist
	}
	return p.fsys.Open(rest)
}
