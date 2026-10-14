package serve

import (
	"bytes"
	"compress/gzip"
	"io"
	"strings"
	"sync"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"
)

// Encoding is one of the compressions a browser and this server may agree
// on, named as the Content-Encoding that carries it.
type Encoding string

const (
	EncodingIdentity Encoding = ""
	EncodingZstd     Encoding = "zstd"
	EncodingBrotli   Encoding = "br"
	EncodingGzip     Encoding = "gzip"
)

// wanted lists the compressions in the order they are preferred. Every
// evergreen browser takes all three; an older one falls in somewhere down
// the list, and a client that asks for none is answered as it came.
var wanted = []Encoding{EncodingZstd, EncodingBrotli, EncodingGzip}

// negotiate picks the first compression the request says it will take.
// The asking is read plainly — a name in Accept-Encoding — which is what
// the browsers write; a q-value that weights one over another is a
// subtlety no page was ever served wrong for ignoring.
func negotiate(accept string) Encoding {
	accept = strings.ToLower(accept)
	for _, e := range wanted {
		if strings.Contains(accept, string(e)) {
			return e
		}
	}
	return EncodingIdentity
}

// worthCompressing is the floor beneath which compression costs more than
// it carries: the header of the encoding and the Vary it drags along are
// most of a page this small.
const worthCompressing = 1024

// encode compresses body the way asked, returning it as it came when the
// way is none.
func encode(body []byte, e Encoding) []byte {
	switch e {
	case EncodingGzip:
		var buf bytes.Buffer
		w := gzipPool.Get().(*gzip.Writer)
		w.Reset(&buf)
		_, _ = w.Write(body)
		_ = w.Close()
		gzipPool.Put(w)
		return buf.Bytes()
	case EncodingBrotli:
		var buf bytes.Buffer
		w := brotliPool.Get().(*brotli.Writer)
		w.Reset(&buf)
		_, _ = w.Write(body)
		_ = w.Close()
		brotliPool.Put(w)
		return buf.Bytes()
	case EncodingZstd:
		return zstdOne.EncodeAll(body, nil)
	default:
		return body
	}
}

// The writers are pooled, because a page handed to a visitor is compressed
// once and the pool is where the once is spent. The zstd encoder answers
// EncodeAll from as many goroutines as ask, and holds its own.
var (
	gzipPool = sync.Pool{New: func() any { return gzip.NewWriter(io.Discard) }}

	brotliPool = sync.Pool{New: func() any {
		return brotli.NewWriterLevel(io.Discard, 5)
	}}

	zstdOnce sync.Once
	zstdOne  *zstd.Encoder
)

func init() {
	// SpeedBetterCompression is the level a page of prose and code blocks
	// compresses nearly as small as the top of the scale at, while costing
	// a fraction of the time — and this runs while a visitor waits.
	var err error
	zstdOnce.Do(func() {
		zstdOne, err = zstd.NewWriter(nil,
			zstd.WithEncoderLevel(zstd.SpeedBetterCompression),
			zstd.WithEncoderCRC(false))
	})
	if err != nil {
		panic(err)
	}
}

// textLike says whether a file a build would copy is one compression is
// worth carrying. What is already compressed — a picture, a font — only
// gets larger.
func textLike(ext string) bool {
	switch strings.ToLower(ext) {
	case ".html", ".htm", ".css", ".js", ".mjs", ".svg", ".xml", ".json",
		".txt", ".md", ".webmanifest", ".map":
		return true
	}
	return false
}
