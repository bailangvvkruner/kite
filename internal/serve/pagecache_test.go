package serve_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kite-plus/kite/internal/serve"
	"github.com/kite-plus/kite/internal/site"
)

// The second asking of a page between two changes is handed the bytes the
// first one rendered: the header says so, and the body says the same
// thing twice.
func TestACachedPageAnswersTwiceAlike(t *testing.T) {
	root := newProject(t, 2)
	handler := newServer(t, root, serve.Options{CachePages: true}).Handler()

	url := "/posts/post-00/"
	first := httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodGet, url, nil))
	second := httptest.NewRecorder()
	handler.ServeHTTP(second, httptest.NewRequest(http.MethodGet, url, nil))

	if got := second.Header().Get("X-Kite-Cache"); got != "hit" {
		t.Errorf("second asking: X-Kite-Cache = %q, want hit", got)
	}
	if got := first.Header().Get("X-Kite-Cache"); got != "miss" {
		t.Errorf("first asking: X-Kite-Cache = %q, want miss", got)
	}
	if first.Body.String() != second.Body.String() {
		t.Error("the two answers differ:\n" + firstDifference(second.Body.String(), first.Body.String()))
	}
}

// A cache that outlived a change would serve what the site no longer is.
// The change empties it, and the page is rendered again from what stands.
func TestACachedPageIsEmptiedByTheReload(t *testing.T) {
	root := newProject(t, 2)
	srv := newServer(t, root, serve.Options{CachePages: true})
	handler := srv.Handler()

	url := "/posts/post-00/"
	before := httptest.NewRecorder()
	handler.ServeHTTP(before, httptest.NewRequest(http.MethodGet, url, nil))
	if !strings.Contains(before.Body.String(), "Post 00") {
		t.Fatalf("unexpected initial body:\n%s", before.Body.String())
	}

	p := filepath.Join(root, "content", "posts", "post-00", "index.md")
	data, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	edited := strings.Replace(string(data), "title: Post 00", "title: Renamed", 1)
	if err := os.WriteFile(p, []byte(edited), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := srv.Reload(t.Context()); err != nil {
		t.Fatalf("Reload: %v", err)
	}

	after := httptest.NewRecorder()
	handler.ServeHTTP(after, httptest.NewRequest(http.MethodGet, url, nil))
	if got := after.Header().Get("X-Kite-Cache"); got != "miss" {
		t.Errorf("after the reload: X-Kite-Cache = %q, want miss", got)
	}
	if !strings.Contains(after.Body.String(), "Renamed") {
		t.Error("the edit was not picked up after the reload")
	}
}

// A not-found page is a page like any other, cached with its own status.
func TestTheNotFoundPageIsCachedWithItsStatus(t *testing.T) {
	root := newProject(t, 2)
	handler := newServer(t, root, serve.Options{CachePages: true}).Handler()

	for range 2 {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/nowhere/", nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status %d, want 404", rec.Code)
		}
		if got := rec.Header().Get("X-Kite-Cache"); got != "miss" && got != "hit" {
			t.Fatalf("X-Kite-Cache = %q", got)
		}
	}
}

// What is served with the cache on is still what a build would write,
// byte for byte, or the cache would be a second renderer.
func TestCachedServingIsByteIdenticalToBuilt(t *testing.T) {
	root := newProject(t, 5)

	built := openSite(t, root)
	outDir := filepath.Join(root, "public")
	if _, _, err := built.Build(t.Context(), site.BuildOptions{OutDir: outDir, Now: frozen}); err != nil {
		t.Fatalf("Build: %v", err)
	}

	handler := newServer(t, root, serve.Options{LiveReload: false, CachePages: true}).Handler()

	checked := 0
	err := filepath.WalkDir(outDir, func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, err := filepath.Rel(outDir, p)
		if err != nil {
			return err
		}
		if filepath.Ext(rel) != ".html" {
			return nil // the cache is of pages, not of the files a build copies
		}
		want, err := os.ReadFile(p)
		if err != nil {
			return err
		}

		// Asked twice: the first renders, the second is handed what the
		// first kept, and both have to be the built file.
		for range 2 {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/"+filepath.ToSlash(rel), nil))
			if rec.Code != statusFor(rel) {
				t.Errorf("%s: status %d, want %d", rel, rec.Code, statusFor(rel))
				return nil
			}
			if got := rec.Body.String(); got != string(want) {
				t.Errorf("%s differs from the built file\n%s", rel, firstDifference(string(want), got))
				return nil
			}
			checked++
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if checked < 10 {
		t.Fatalf("only %d pages compared; the fixture is not exercising enough of the site", checked)
	}
}

// The browser is still told to store nothing, cached or not: what it must
// never be left holding is what the site currently is.
func TestACachedPageStillSaysNoStore(t *testing.T) {
	root := newProject(t, 1)
	handler := newServer(t, root, serve.Options{CachePages: true}).Handler()

	for range 2 {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/posts/post-00/", nil))
		if got := rec.Header().Get("Cache-Control"); got != "no-store" {
			t.Errorf("Cache-Control = %q, want no-store", got)
		}
	}
}
