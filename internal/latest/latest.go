// Package latest finds out whether Kite has a release newer than the one
// running, asking GitHub at most once a day, so that the server's log and the
// studio can say so. It only tells: replacing the binary, and moving the
// release kite.lock pins, stay the author's to do.
package latest

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kite-plus/kite/internal/buildinfo"
	"github.com/kite-plus/kite/internal/kitew"
)

// URL redirects to the page of Kite's newest release. The redirect is read
// rather than GitHub's API, which limits how often one address may ask.
const URL = "https://github.com/kite-plus/kite/releases/latest"

// Image is the container image a release is published as.
const Image = "ghcr.io/kite-plus/kite"

// Off says the checks are turned off, as KITE_NO_UPDATE_CHECK does.
func Off() bool {
	switch strings.ToLower(os.Getenv("KITE_NO_UPDATE_CHECK")) {
	case "", "0", "false", "no", "off":
		return false
	}
	return true
}

// InContainer says this Kite runs in a container, where a newer one comes as
// a new image rather than a download.
func InContainer() bool {
	for _, marker := range []string{"/.dockerenv", "/run/.containerenv"} {
		if _, err := os.Stat(marker); err == nil {
			return true
		}
	}
	return false
}

// Release is a release of Kite.
type Release struct {
	// Version is without the v of its tag.
	Version string `json:"version"`
	// URL is its page, with its notes.
	URL string `json:"url"`
	// Checked is when it was found to be the newest.
	Checked time.Time `json:"checked"`
}

// Checker asks for the newest release, and remembers the answer.
type Checker struct {
	URL string
	// CacheFile keeps the last answer across runs; nothing is kept when it
	// is empty.
	CacheFile string
	// MaxAge is how long an answer is used before asking again.
	MaxAge time.Duration
	HTTP   *http.Client
	Now    func() time.Time

	mu     sync.Mutex
	loaded bool
	known  *Release
}

// New returns a checker that keeps its answer in the user's cache, shared
// by every site on the machine.
func New() *Checker {
	file := ""
	if dir, err := os.UserCacheDir(); err == nil {
		file = filepath.Join(dir, "kite", "latest.json")
	}
	return &Checker{
		URL:       URL,
		CacheFile: file,
		MaxAge:    24 * time.Hour,
		HTTP:      &http.Client{Timeout: 15 * time.Second},
		Now:       time.Now,
	}
}

// Known is the newest release the last answer named, however old, or nil
// when there has been none. It never asks.
func (c *Checker) Known() *Release {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.loaded {
		c.loaded = true
		c.known = c.read()
	}
	if c.known == nil {
		return nil
	}
	r := *c.known
	return &r
}

// Check returns the newest release: the answer given within MaxAge, or else
// GitHub's.
func (c *Checker) Check(ctx context.Context) (*Release, error) {
	if r := c.Known(); r != nil {
		if age := c.Now().Sub(r.Checked); age >= 0 && age < c.MaxAge {
			return r, nil
		}
	}
	r, err := c.ask(ctx)
	if err != nil {
		return nil, err
	}
	c.keep(r)
	return r, nil
}

// Watch checks now and then every MaxAge until ctx ends, and calls found
// when a check names a release newer than running that was not known when
// it began, nor named before.
func (c *Checker) Watch(ctx context.Context, running string, found func(Release)) {
	told := ""
	if r := c.Known(); r != nil && Newer(r.Version, running) {
		told = r.Version
	}
	for {
		if r, err := c.Check(ctx); err == nil && Newer(r.Version, running) && r.Version != told {
			told = r.Version
			found(*r)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(c.MaxAge):
		}
	}
}

func (c *Checker) ask(ctx context.Context) (*Release, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, c.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", buildinfo.Generator())
	client := *c.HTTP
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("latest release: %w", err)
	}
	_ = resp.Body.Close()
	where := resp.Header.Get("Location")
	if resp.StatusCode/100 != 3 || where == "" {
		return nil, fmt.Errorf("latest release: %s answered %s, not a redirect to a release", c.URL, resp.Status)
	}
	page, err := resp.Request.URL.Parse(where)
	if err != nil {
		return nil, fmt.Errorf("latest release: %w", err)
	}
	version, ok := kitew.Release(path.Base(page.Path))
	if !ok {
		return nil, fmt.Errorf("latest release: %s names no release", page)
	}
	return &Release{Version: version, URL: page.String(), Checked: c.Now().UTC()}, nil
}

func (c *Checker) read() *Release {
	if c.CacheFile == "" {
		return nil
	}
	data, err := os.ReadFile(c.CacheFile)
	if err != nil {
		return nil
	}
	var r Release
	if json.Unmarshal(data, &r) != nil || r.Version == "" {
		return nil
	}
	return &r
}

// keep remembers r, and writes it down for the next run. A cache that
// cannot be written only means asking again next time.
func (c *Checker) keep(r *Release) {
	c.mu.Lock()
	c.loaded, c.known = true, r
	c.mu.Unlock()
	if c.CacheFile == "" {
		return
	}
	data, err := json.Marshal(r)
	if err != nil {
		return
	}
	dir := filepath.Dir(c.CacheFile)
	if os.MkdirAll(dir, 0o755) != nil {
		return
	}
	// Another Kite on the machine may be writing the same file.
	tmp, err := os.CreateTemp(dir, "latest-*.json")
	if err != nil {
		return
	}
	_, werr := tmp.Write(data)
	if cerr := tmp.Close(); werr != nil || cerr != nil || os.Rename(tmp.Name(), c.CacheFile) != nil {
		_ = os.Remove(tmp.Name())
	}
}

// Newer reports whether version is newer than than, both as a release names
// them, with or without the v of a tag: a higher number, or the release of
// the same number one of its prereleases leads to.
func Newer(version, than string) bool {
	return compare(version, than) > 0
}

func compare(a, b string) int {
	an, ap := split(a)
	bn, bp := split(b)
	for i := range an {
		if an[i] != bn[i] {
			return cmp.Compare(an[i], bn[i])
		}
	}
	switch {
	case ap == bp:
		return 0
	case ap == "":
		return 1
	case bp == "":
		return -1
	}
	return strings.Compare(ap, bp)
}

func split(v string) ([3]int, string) {
	core, pre, _ := strings.Cut(strings.TrimPrefix(v, "v"), "-")
	var n [3]int
	for i, part := range strings.SplitN(core, ".", 3) {
		n[i], _ = strconv.Atoi(part)
	}
	return n, pre
}
