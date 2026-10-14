package serve

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"io"
	"testing"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"
)

// Every evergreen browser takes all three, and the newest of them is the
// one asked for first; an older one falls in down the list; a client that
// says nothing is answered as it came.
func TestNegotiate(t *testing.T) {
	for _, c := range []struct {
		accept string
		want   Encoding
	}{
		{"gzip, deflate, br, zstd", EncodingZstd},
		{"gzip, deflate, br", EncodingBrotli},
		{"gzip, deflate", EncodingGzip},
		{"br", EncodingBrotli},
		{"ZSTD, GZIP", EncodingZstd}, // the asking is read plainly
		{"deflate", EncodingIdentity},
		{"", EncodingIdentity},
	} {
		if got := negotiate(c.accept); got != c.want {
			t.Errorf("negotiate(%q) = %q, want %q", c.accept, got, c.want)
		}
	}
}

// What is encoded one way decodes back to what it was, for each of the
// three a page may be carried in.
func TestEncodeRoundTrips(t *testing.T) {
	body := bytes.Repeat([]byte("the same line of prose and code, again\n"), 64)
	for _, e := range wanted {
		encoded := encode(body, e)
		if bytes.Equal(encoded, body) {
			t.Fatalf("%s: the body went through unchanged", e)
		}
		var back []byte
		var err error
		switch e {
		case EncodingGzip:
			var r *gzip.Reader
			r, err = gzip.NewReader(bytes.NewReader(encoded))
			if err == nil {
				back, err = io.ReadAll(r)
			}
		case EncodingBrotli:
			back, err = io.ReadAll(brotli.NewReader(bytes.NewReader(encoded)))
		case EncodingZstd:
			var r *zstd.Decoder
			r, err = zstd.NewReader(bytes.NewReader(encoded))
			if err == nil {
				back, err = io.ReadAll(r)
			}
		}
		if err != nil {
			t.Fatalf("%s: %v", e, err)
		}
		if !bytes.Equal(back, body) {
			t.Errorf("%s: the body came back different", e)
		}
		if t.Failed() {
			t.FailNow()
		}
	}
}

// A page asked for a way it has already been compressed in is handed the
// same bytes it was handed before, and a way that is none hands back the
// page itself.
func TestACachedPageEncodesOnce(t *testing.T) {
	page := &cachedPage{status: 200, body: bytes.Repeat([]byte("x"), 4096)}
	first := page.encoded(EncodingBrotli)
	second := page.encoded(EncodingBrotli)
	if &first[0] != &second[0] {
		t.Error("the page was compressed a second time")
	}
	if got := page.encoded(EncodingIdentity); !bytes.Equal(got, page.body) {
		t.Error("no way of sending it returned the page changed")
	}
}

// A page too small to be worth carrying compressed goes out as it is,
// whichever way was agreed.
func TestASmallPageIsNotCompressed(t *testing.T) {
	page := &cachedPage{status: 200, body: []byte("<html>small</html>")}
	if got := page.encoded(EncodingZstd); !bytes.Equal(got, page.body) {
		t.Error("a small page came back compressed")
	}
}

// The kinds of file compression carries, and the kinds it does not: what
// is already compressed only gets larger.
func TestTextLike(t *testing.T) {
	for _, yes := range []string{".html", ".CSS", ".js", ".svg", ".xml", ".json"} {
		if !textLike(yes) {
			t.Errorf("%s should be carried compressed", yes)
		}
	}
	for _, no := range []string{".png", ".jpg", ".webp", ".woff2", ".zip"} {
		if textLike(no) {
			t.Errorf("%s should not be carried compressed", no)
		}
	}
}

// flate stays imported for the deflate name in the negotiate table above.
var _ = flate.NewReader
