package serve

import (
	"bytes"
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
	saved := pageCachePages
	defer func() { pageCachePages = saved }()
	pageCachePages = 3

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
	c.reset()
	if _, ok := c.get("/a/"); ok {
		t.Fatal("a page survived the reset")
	}
	if c.bytes != 0 || len(c.byKey) != 0 || c.order.Len() != 0 {
		t.Fatalf("the reset left state behind: bytes=%d keys=%d order=%d", c.bytes, len(c.byKey), c.order.Len())
	}
}

// A single page larger than the whole budget is kept rather than dropped
// in a circle: one page that answers is worth more than none.
func TestPageCacheKeepsOneOversizePage(t *testing.T) {
	c := newPageCache()
	saved := pageCacheBytes
	defer func() { pageCacheBytes = saved }()
	pageCacheBytes = 8

	c.put("/big/", &cachedPage{status: 200, body: []byte("0123456789")})
	if _, ok := c.get("/big/"); !ok {
		t.Fatal("the only page was evicted for being larger than the budget")
	}
}

// The pages of one build cannot be told apart by their asking alone.
func TestPageCacheKeysDifferByQuery(t *testing.T) {
	c := newPageCache()
	c.put("/?page=2", &cachedPage{status: 200, body: []byte("two")})
	if page, ok := c.get("/"); ok {
		t.Fatalf("the first page got the second's bytes: %q", page.body)
	}
	if page, ok := c.get("/?page=2"); !ok || string(page.body) != "two" {
		t.Fatalf("got status %d body %q, %v", page.status, page.body, ok)
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
