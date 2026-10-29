package latest

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

// github stands in for the redirect GitHub answers releases/latest with,
// to the tag it holds, and counts what it was asked.
func github(t *testing.T, tag *atomic.Value) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var asked atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked.Add(1)
		if r.URL.Path != "/releases/latest" || r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		name := tag.Load().(string)
		if name == "" {
			w.WriteHeader(http.StatusOK)
			return
		}
		http.Redirect(w, r, "/releases/tag/"+name, http.StatusFound)
	}))
	t.Cleanup(srv.Close)
	return srv, &asked
}

func checker(srv *httptest.Server, cache string, now *time.Time) *Checker {
	return &Checker{
		URL:       srv.URL + "/releases/latest",
		CacheFile: cache,
		MaxAge:    24 * time.Hour,
		HTTP:      srv.Client(),
		Now:       func() time.Time { return *now },
	}
}

func TestTheNewestReleaseIsReadFromTheRedirect(t *testing.T) {
	var tag atomic.Value
	tag.Store("v0.2.0")
	srv, _ := github(t, &tag)
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	r, err := checker(srv, "", &now).Check(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if r.Version != "0.2.0" || r.URL != srv.URL+"/releases/tag/v0.2.0" || !r.Checked.Equal(now) {
		t.Errorf("release = %+v", r)
	}
}

// One answer serves a day, this run and the next; after that GitHub is asked
// again.
func TestAnAnswerIsKeptForADay(t *testing.T) {
	var tag atomic.Value
	tag.Store("v0.2.0")
	srv, asked := github(t, &tag)
	cache := filepath.Join(t.TempDir(), "kite", "latest.json")
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)

	if _, err := checker(srv, cache, &now).Check(context.Background()); err != nil {
		t.Fatal(err)
	}
	tag.Store("v0.3.0")
	now = now.Add(23 * time.Hour)
	next := checker(srv, cache, &now)
	if r, err := next.Check(context.Background()); err != nil || r.Version != "0.2.0" {
		t.Fatalf("within the day: %+v, %v", r, err)
	}
	if asked.Load() != 1 {
		t.Fatalf("asked %d times within the day, want 1", asked.Load())
	}

	now = now.Add(2 * time.Hour)
	if r, err := next.Check(context.Background()); err != nil || r.Version != "0.3.0" {
		t.Fatalf("a day on: %+v, %v", r, err)
	}
	if asked.Load() != 2 {
		t.Errorf("asked %d times, want 2", asked.Load())
	}
}

// Offline, or answered with anything but a release, a check fails and the
// last answer stays known, however old.
func TestAFailedCheckKeepsTheLastAnswer(t *testing.T) {
	var tag atomic.Value
	tag.Store("v0.2.0")
	srv, _ := github(t, &tag)
	cache := filepath.Join(t.TempDir(), "latest.json")
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	if _, err := checker(srv, cache, &now).Check(context.Background()); err != nil {
		t.Fatal(err)
	}

	now = now.Add(48 * time.Hour)
	for _, answer := range []string{"", "not-a-release"} {
		tag.Store(answer)
		c := checker(srv, cache, &now)
		if r, err := c.Check(context.Background()); err == nil {
			t.Errorf("answer %q: checked %+v without an error", answer, r)
		}
		if r := c.Known(); r == nil || r.Version != "0.2.0" {
			t.Errorf("answer %q: known = %+v, want 0.2.0", answer, r)
		}
	}
}

// Watch tells of a newer release once, and not of one a startup note
// already told from the last run's answer.
func TestWatchTellsOfEachNewerReleaseOnce(t *testing.T) {
	var tag atomic.Value
	tag.Store("v0.2.0")
	srv, _ := github(t, &tag)
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	c := checker(srv, "", &now)
	// On the real clock, so that a millisecond's answer goes stale.
	c.Now, c.MaxAge = time.Now, time.Millisecond

	found := make(chan string, 8)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		c.Watch(ctx, "0.1.12", func(r Release) { found <- r.Version })
	}()
	if got := <-found; got != "0.2.0" {
		t.Fatalf("found %q, want 0.2.0", got)
	}
	tag.Store("v0.3.0")
	if got := <-found; got != "0.3.0" {
		t.Fatalf("found %q, want 0.3.0", got)
	}
	cancel()
	<-done
	if len(found) != 0 {
		t.Errorf("told again: %d more", len(found))
	}

	told := checker(srv, "", &now)
	told.keep(&Release{Version: "0.3.0", Checked: now})
	told.MaxAge = time.Hour
	ctx, cancel = context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	told.Watch(ctx, "0.1.12", func(r Release) { t.Errorf("told %s, which was known when it began", r.Version) })
}

func TestNewerComparesReleaseNumbers(t *testing.T) {
	for _, c := range []struct {
		version, than string
		newer         bool
	}{
		{"0.1.12", "0.1.11", true},
		{"0.1.10", "0.1.9", true},
		{"v0.2.0", "0.1.12", true},
		{"1.0.0", "0.9.9", true},
		{"0.1.12", "0.1.12", false},
		{"0.1.11", "0.1.12", false},
		{"0.2.0", "0.2.0-rc.1", true},
		{"0.2.0-rc.1", "0.2.0", false},
		{"0.2.0-rc.2", "0.2.0-rc.1", true},
	} {
		if got := Newer(c.version, c.than); got != c.newer {
			t.Errorf("Newer(%q, %q) = %v, want %v", c.version, c.than, got, c.newer)
		}
	}
}

func TestTheChecksCanBeTurnedOff(t *testing.T) {
	for value, off := range map[string]bool{"": false, "0": false, "false": false, "1": true, "true": true, "yes": true} {
		t.Setenv("KITE_NO_UPDATE_CHECK", value)
		if Off() != off {
			t.Errorf("KITE_NO_UPDATE_CHECK=%q: off = %v, want %v", value, Off(), off)
		}
	}
}
