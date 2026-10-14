package serve_test

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/kite-plus/kite/internal/serve"
	"github.com/kite-plus/kite/internal/site"
	"github.com/klauspost/compress/zstd"
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

// A change does not leave its pages for the first visitor of each to
// pay for: the warming that follows a reload has rendered them by the
// time anyone asks, and the first asking is as cheap as the rest.
func TestTheWarmingAnswersTheFirstAsking(t *testing.T) {
	root := newProject(t, 2)
	handler := newServer(t, root, serve.Options{CachePages: true}).Handler()

	deadline := time.Now().Add(10 * time.Second)
	for {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/posts/post-00/", nil))
		if rec.Header().Get("X-Kite-Cache") == "hit" {
			if !strings.Contains(rec.Body.String(), "Post 00") {
				t.Fatal("a hit that is not the page")
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("the warming never answered the first asking")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// Asked for by many at once, a page is rendered once: every answer is the
// same and none is a failure.
func TestManyAtOnceAreAnsweredAlike(t *testing.T) {
	root := newProject(t, 2)
	handler := newServer(t, root, serve.Options{CachePages: true}).Handler()

	const askers = 8
	var wg sync.WaitGroup
	bodies := make([]string, askers)
	codes := make([]int, askers)
	for i := range askers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/posts/post-01/", nil))
			bodies[i] = rec.Body.String()
			codes[i] = rec.Code
		}()
	}
	wg.Wait()
	for i := range askers {
		if codes[i] != http.StatusOK {
			t.Fatalf("asker %d: status %d", i, codes[i])
		}
		if bodies[i] != bodies[0] {
			t.Fatalf("asker %d was answered differently", i)
		}
	}
}

// The browser is still told to store nothing, cached or not: what it must
// never be left holding is what the site currently is. It is, however,
// answered the way it asked to be carried: a browser that takes zstd or
// brotli gets it, one that takes nothing gets the page itself, and the
// Vary keeps any cache in between from mixing the two up.
func TestACachedPageIsAnsweredTheWayItWasAsked(t *testing.T) {
	root := newProject(t, 2)
	handler := newServer(t, root, serve.Options{LiveReload: false, CachePages: true}).Handler()

	built := openSite(t, root)
	outDir := filepath.Join(root, "public")
	if _, _, err := built.Build(t.Context(), site.BuildOptions{OutDir: outDir, Now: frozen}); err != nil {
		t.Fatalf("Build: %v", err)
	}
	want, err := os.ReadFile(filepath.Join(outDir, "posts", "post-00", "index.html"))
	if err != nil {
		t.Fatal(err)
	}

	decode := func(rec *httptest.ResponseRecorder, e string) string {
		t.Helper()
		switch e {
		case "zstd":
			r, err := zstd.NewReader(rec.Body)
			if err != nil {
				t.Fatal(err)
			}
			out, err := io.ReadAll(r)
			if err != nil {
				t.Fatal(err)
			}
			return string(out)
		case "br":
			out, err := io.ReadAll(brotli.NewReader(rec.Body))
			if err != nil {
				t.Fatal(err)
			}
			return string(out)
		case "gzip":
			r, err := gzip.NewReader(rec.Body)
			if err != nil {
				t.Fatal(err)
			}
			out, err := io.ReadAll(r)
			if err != nil {
				t.Fatal(err)
			}
			return string(out)
		}
		return rec.Body.String()
	}

	for _, c := range []struct{ accept, encoding string }{
		{"", ""},
		{"deflate", ""},
		{"gzip, deflate", "gzip"},
		{"gzip, deflate, br", "br"},
		{"gzip, deflate, br, zstd", "zstd"},
	} {
		for range 2 { // fresh and kept must answer alike
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/posts/post-00/", nil)
			if c.accept != "" {
				req.Header.Set("Accept-Encoding", c.accept)
			}
			handler.ServeHTTP(rec, req)

			if got := rec.Header().Get("Content-Encoding"); got != c.encoding {
				t.Errorf("%q: Content-Encoding = %q, want %q", c.accept, got, c.encoding)
				continue
			}
			if got := rec.Header().Get("Vary"); got != "Accept-Encoding" {
				t.Errorf("%q: Vary = %q, want Accept-Encoding", c.accept, got)
			}
			if got := rec.Header().Get("Cache-Control"); got != "no-store" {
				t.Errorf("%q: Cache-Control = %q, want no-store", c.accept, got)
			}
			if body := decode(rec, c.encoding); body != string(want) {
				t.Errorf("%q: the page came back different from the built file", c.accept)
			}
		}
	}
}
