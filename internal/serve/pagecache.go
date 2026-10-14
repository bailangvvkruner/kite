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

	flightMu sync.Mutex
	flights  map[string]*inFlight
}

// An inFlight is the rendering of one address in progress: asked for by
// many at once, a page is rendered once and the answer handed to them
// all. The count says how many hold it or are waiting to, so the entry
// leaves the map when the last of them is done.
type inFlight struct {
	mu   sync.Mutex
	held int
}

// A cachedPage is one rendered page as it will be written out, before the
// live-reload script is injected: the injection is of the moment, the
// page is of the build. Each compression the page is asked for is made
// once and kept beside it, so the second visitor to ask the same way is
// handed the same bytes the first one was.
type cachedPage struct {
	status int
	body   []byte

	mu        sync.Mutex
	encodings map[Encoding][]byte
}

// encoded returns the page in the way asked, compressing it once if the
// way is one this server speaks and the page is large enough to be worth
// carrying compressed. The memory of the kept encodings is not counted
// against the cache's budget: it is a fraction of the body it came from,
// and the page count bounds it.
func (p *cachedPage) encoded(e Encoding) []byte {
	if e == EncodingIdentity || len(p.body) < worthCompressing {
		return p.body
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.encodings == nil {
		p.encodings = make(map[Encoding][]byte, len(wanted))
	}
	if kept, ok := p.encodings[e]; ok {
		return kept
	}
	kept := encode(p.body, e)
	p.encodings[e] = kept
	return kept
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
	return &pageCache{
		byKey:   make(map[string]*list.Element),
		order:   list.New(),
		flights: make(map[string]*inFlight),
	}
}

// pageEntry is a cached page with its key, so the oldest can be found
// from the order alone.
type pageEntry struct {
	key  string
	page *cachedPage
}

func (c *pageCache) get(key string) (*cachedPage, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.byKey[key]
	if !ok {
		return nil, false
	}
	c.order.MoveToBack(el)
	return el.Value.(*pageEntry).page, true
}

func (c *pageCache) put(key string, page *cachedPage) {
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
	c.byKey = make(map[string]*list.Element)
	c.order.Init()
	c.bytes = 0
	c.mu.Unlock()
}

// hold locks the rendering of one address, and reports how to let it go.
// The holder looks in the cache again once it holds: someone may have
// finished the same rendering while it waited.
func (c *pageCache) hold(key string) func() {
	c.flightMu.Lock()
	f, ok := c.flights[key]
	if !ok {
		f = &inFlight{}
		c.flights[key] = f
	}
	f.held++
	c.flightMu.Unlock()

	f.mu.Lock()
	return func() {
		f.mu.Unlock()
		c.flightMu.Lock()
		f.held--
		if f.held == 0 {
			delete(c.flights, key)
		}
		c.flightMu.Unlock()
	}
}
