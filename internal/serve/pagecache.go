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
//
// The keeping is two pools. One holds the pages warmed from the plan —
// every page of the site, asked for or not — and nothing else may take a
// place in it. The other holds what the asking itself rendered, in a
// small budget of its own, so a flood of one-shot addresses — the ?x= of
// a scraper — churns that pool and never evicts a page of the site.
type pageCache struct {
	kept   pool
	asked pool

	flightMu sync.Mutex
	flights  map[string]*inFlight
}

// A pool is one LRU: the pages it holds, in the order they were last
// handed out, against the budgets that bound it.
type pool struct {
	mu sync.Mutex

	byKey map[string]*list.Element
	order *list.List // front is the least recently used
	bytes int
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

// The budgets. The warmed pool holds the whole of a site, so its bounds
// are set for a walk through one; the asked pool holds what visitors
// themselves brought to be rendered, so its bounds are set for a
// curiosity, not a site. They are variables for the tests that shrink
// them.
var (
	keptBytes  = 64 << 20
	keptPages  = 4096
	askedBytes = 8 << 20
	askedPages = 512
)

func newPageCache() *pageCache {
	return &pageCache{
		flights: make(map[string]*inFlight),
	}
}

func (p *pool) init() {
	p.byKey = make(map[string]*list.Element)
	p.order = list.New()
}

// pageEntry is a cached page with its key, so the oldest can be found
// from the order alone.
type pageEntry struct {
	key  string
	page *cachedPage
}

// get hands out the page a key names, kept first then asked — a page of
// the site is found before a page the asking rendered — and marks it
// recently used in the pool that holds it.
func (c *pageCache) get(key string) (*cachedPage, bool) {
	if page, ok := c.kept.get(key); ok {
		return page, true
	}
	return c.asked.get(key)
}

func (p *pool) get(key string) (*cachedPage, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	el, ok := p.byKey[key]
	if !ok {
		return nil, false
	}
	p.order.MoveToBack(el)
	return el.Value.(*pageEntry).page, true
}

// put keeps a page of the site, warmed from the plan.
func (c *pageCache) put(key string, page *cachedPage) {
	c.kept.set(key, page, keptBytes, keptPages)
}

// putAsked keeps a page the asking itself rendered, in the small pool
// where churn costs no page of the site.
func (c *pageCache) putAsked(key string, page *cachedPage) {
	c.asked.set(key, page, askedBytes, askedPages)
}

func (p *pool) set(key string, page *cachedPage, maxBytes, maxPages int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.byKey == nil {
		p.init()
	}
	if el, ok := p.byKey[key]; ok {
		entry := el.Value.(*pageEntry)
		p.bytes += len(page.body) - len(entry.page.body)
		entry.page = page
		p.order.MoveToBack(el)
	} else {
		p.byKey[key] = p.order.PushBack(&pageEntry{key: key, page: page})
		p.bytes += len(page.body)
	}
	for (p.bytes > maxBytes || p.order.Len() > maxPages) && p.order.Len() > 1 {
		el := p.order.Front()
		entry := el.Value.(*pageEntry)
		p.order.Remove(el)
		delete(p.byKey, entry.key)
		p.bytes -= len(entry.page.body)
	}
}

// reset empties the cache, which a reload does: every page in it was
// rendered from the site as it stood.
func (c *pageCache) reset() {
	c.kept.mu.Lock()
	c.kept.init()
	c.kept.bytes = 0
	c.kept.mu.Unlock()

	c.asked.mu.Lock()
	c.asked.init()
	c.asked.bytes = 0
	c.asked.mu.Unlock()
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
