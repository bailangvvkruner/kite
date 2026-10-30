package serve

import (
	"bytes"
	"fmt"
	"testing"
	"time"
)

// The cache hands back the bytes that were put in, and the asking for it
// again does not change what they are.
func TestPageCachePutsAndGets(t *testing.T) {
	c := newPageCache()
	if _, ok := c.get("/posts/a/"); ok {
		t.Fatal("an empty cache handed out a page")
	}
	c.put("/posts/a/", &cachedPage{status: 200, body: []byte("<html>a")})

	page, ok := c.get("/posts/a/")
	if !ok || page.status != 200 || !bytes.Equal(page.body, []byte("<html>a")) {
		t.Fatalf("got status %d body %q, %v", page.status, page.body, ok)
	}

	c.put("/posts/a/", &cachedPage{status: 200, body: []byte("<html>a2")})
	if page, _ = c.get("/posts/a/"); string(page.body) != "<html>a2" {
		t.Fatalf("a page put again did not replace: %q", page.body)
	}
}

// The asking moves a page to the back of the order, so the one asked for
// least recently is the one dropped when the budget says so.
func TestPageCacheEvictsTheLeastRecentlyUsed(t *testing.T) {
	c := newPageCache()
	saved := keptPages
	defer func() { keptPages = saved }()
	keptPages = 3

	for _, key := range []string{"/a/", "/b/", "/c/"} {
		c.put(key, &cachedPage{status: 200, body: []byte("x")})
	}
	if _, ok := c.get("/a/"); !ok { // a is now the most recently used
		t.Fatal("a was not in the cache")
	}
	c.put("/d/", &cachedPage{status: 200, body: []byte("x")}) // b is the oldest now

	for gone, there := range map[string]bool{"/a/": true, "/b/": false, "/c/": true, "/d/": true} {
		if _, ok := c.get(gone); ok != there {
			t.Errorf("%s: in cache = %v, want %v", gone, ok, there)
		}
	}
}

// A reset empties it, which is what a reload does to the pages the site
// as it stood had rendered.
func TestPageCacheReset(t *testing.T) {
	c := newPageCache()
	c.put("/a/", &cachedPage{status: 200, body: []byte("x")})
	c.putAsked("/?x=1", &cachedPage{status: 200, body: []byte("y")})
	c.reset()
	if _, ok := c.get("/a/"); ok {
		t.Fatal("a page survived the reset")
	}
	if _, ok := c.get("/?x=1"); ok {
		t.Fatal("an asked page survived the reset")
	}
	c.kept.mu.Lock()
	keptLeft := len(c.kept.byKey) + c.kept.order.Len() + c.kept.bytes
	c.kept.mu.Unlock()
	c.asked.mu.Lock()
	askedLeft := len(c.asked.byKey) + c.asked.order.Len() + c.asked.bytes
	c.asked.mu.Unlock()
	if keptLeft != 0 || askedLeft != 0 {
		t.Fatalf("the reset left state behind: kept=%d asked=%d", keptLeft, askedLeft)
	}
}

// A single page larger than the whole budget is kept rather than dropped
// in a circle: one page that answers is worth more than none.
func TestPageCacheKeepsOneOversizePage(t *testing.T) {
	c := newPageCache()
	saved := keptBytes
	defer func() { keptBytes = saved }()
	keptBytes = 8

	c.put("/big/", &cachedPage{status: 200, body: []byte("0123456789")})
	if _, ok := c.get("/big/"); !ok {
		t.Fatal("the only page was evicted for being larger than the budget")
	}
}

// The pages of one build cannot be told apart by their asking alone.
func TestPageCacheKeysDifferByQuery(t *testing.T) {
	c := newPageCache()
	c.putAsked("/?page=2", &cachedPage{status: 200, body: []byte("two")})
	if page, ok := c.get("/"); ok {
		t.Fatalf("the first page got the second's bytes: %q", page.body)
	}
	if page, ok := c.get("/?page=2"); !ok || string(page.body) != "two" {
		t.Fatalf("got status %d body %q, %v", page.status, page.body, ok)
	}
}

// A flood of one-shot addresses churns the asked pool alone: not a page
// of the site is evicted for it, and the flood's own pages stay bounded
// by that pool's budget.
func TestPageCacheFloodChurnsOnlyTheAskedPool(t *testing.T) {
	c := newPageCache()
	savedPages, savedBytes := askedPages, askedBytes
	defer func() { askedPages, askedBytes = savedPages, savedBytes }()
	askedPages, askedBytes = 4, 1<<30

	for _, key := range []string{"/a/", "/b/", "/c/"} {
		c.put(key, &cachedPage{status: 200, body: []byte("site")})
	}
	for i := 0; i < 50; i++ {
		c.putAsked(fmt.Sprintf("/flood/?x=%d", i), &cachedPage{status: 200, body: []byte("junk")})
		c.get("/a/") // the site's pages stay asked for too
	}
	for _, key := range []string{"/a/", "/b/", "/c/"} {
		if _, ok := c.get(key); !ok {
			t.Fatalf("%s was evicted by the flood", key)
		}
	}
	c.asked.mu.Lock()
	held := c.asked.order.Len()
	c.asked.mu.Unlock()
	if held > askedPages {
		t.Fatalf("the flood held %d pages, past the asked pool's bound of %d", held, askedPages)
	}
}

// The hold of one address is one at a time, and the map of holds empties
// when the last of them lets go.
func TestPageCacheHoldSerializesOneAddress(t *testing.T) {
	c := newPageCache()
	letGo := c.hold("/posts/a/")
	in := make(chan struct{})
	go func() {
		c.hold("/posts/a/")() // waits for the first to let go
		close(in)
	}()
	select {
	case <-in:
		t.Fatal("a second hold of one address did not wait")
	case <-time.After(50 * time.Millisecond):
	}
	letGo()
	select {
	case <-in:
	case <-time.After(5 * time.Second):
		t.Fatal("the second hold was not let in after the first let go")
	}
	c.flightMu.Lock()
	held := len(c.flights)
	c.flightMu.Unlock()
	if held != 0 {
		t.Fatalf("holds left behind: %d", held)
	}
}

// cacheKey folds an asking into the key its page may live under: a query
// is folded away, kept in one spelling, or refused to the keeping.
func TestCacheKey(t *testing.T) {
	for _, tt := range []struct {
		name     string
		path     string
		query    string
		fold     bool
		keep     []string
		key      string
		keepable bool
	}{
		{name: "plain", path: "/a/", query: "", key: "/a/", keepable: true},
		{name: "fold", path: "/a/", query: "x=1", fold: true, key: "/a/", keepable: true},
		{name: "strict refuses", path: "/a/", query: "x=1", key: "/a/", keepable: false},
		{name: "kept", path: "/a/", query: "page=2", keep: []string{"page"}, key: "/a/?page=2", keepable: true},
		{name: "reordered to one spelling", path: "/a/", query: "page=2&tab=x", keep: []string{"page", "tab"}, key: "/a/?page=2&tab=x", keepable: true},
		{name: "tab first reorders", path: "/a/", query: "tab=x&page=2", keep: []string{"page", "tab"}, key: "/a/?page=2&tab=x", keepable: true},
		{name: "stranger refused", path: "/a/", query: "page=2&x=9", keep: []string{"page"}, key: "/a/", keepable: false},
		{name: "unparseable refused", path: "/a/", query: "%zz", keep: []string{"page"}, key: "/a/", keepable: false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			key, keepable := cacheKey(tt.path, tt.query, tt.fold, tt.keep)
			if key != tt.key || keepable != tt.keepable {
				t.Fatalf("got %q, %v; want %q, %v", key, keepable, tt.key, tt.keepable)
			}
		})
	}
}
