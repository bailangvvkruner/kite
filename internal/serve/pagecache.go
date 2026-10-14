package serve

import (
	"container/list"
	"sync"
)

// A page cache turns serving from rendering every request into rendering
// once per change: what a page answered is kept until the next reload
// empties the cache, and the next asking of the same address between two
// changes is handed the bytes the first one rendered.
//
// It is the server's own memory, never the browser's: the responses still
// say no-store, because what the browser must never be left holding is
// what the site currently is, and that is exactly what empties this.
type pageCache struct {
	mu sync.Mutex

	byKey map[string]*list.Element
	order *list.List // front is the least recently used
	bytes int
}

// A cachedPage is one rendered page as it will be written out, before the
// live-reload script is injected: the injection is of the moment, the
// page is of the build.
type cachedPage struct {
	status int
	body   []byte
}

// pageCacheBytes and pageCachePages bound the memory a walk through the
// whole of a site can price. Oldest out first, until both hold; the one
// page of a site whose rendering is larger than the budget is kept
// anyway, which serves it better than evicting it in a circle would.
// They are variables for the tests that shrink them.
var (
	pageCacheBytes = 64 << 20
	pageCachePages = 4096
)

func newPageCache() *pageCache {
	return &pageCache{byKey: make(map[string]*list.Element), order: list.New()}
}

// pageEntry is a cached page with its key, so the oldest can be found
// from the order alone.
type pageEntry struct {
	key  string
	page cachedPage
}

func (c *pageCache) get(key string) (cachedPage, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.byKey[key]
	if !ok {
		return cachedPage{}, false
	}
	c.order.MoveToBack(el)
	return el.Value.(*pageEntry).page, true
}

func (c *pageCache) put(key string, page cachedPage) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.byKey[key]; ok {
		entry := el.Value.(*pageEntry)
		c.bytes += len(page.body) - len(entry.page.body)
		entry.page = page
		c.order.MoveToBack(el)
	} else {
		c.byKey[key] = c.order.PushBack(&pageEntry{key: key, page: page})
		c.bytes += len(page.body)
	}
	for (c.bytes > pageCacheBytes || c.order.Len() > pageCachePages) && c.order.Len() > 1 {
		el := c.order.Front()
		entry := el.Value.(*pageEntry)
		c.order.Remove(el)
		delete(c.byKey, entry.key)
		c.bytes -= len(entry.page.body)
	}
}

// reset empties the cache, which a reload does: every page in it was
// rendered from the site as it stood.
func (c *pageCache) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.byKey = make(map[string]*list.Element)
	c.order.Init()
	c.bytes = 0
}
