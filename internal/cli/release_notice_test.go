package cli

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	"github.com/kite-plus/kite/internal/latest"
)

// noticeFrom is what a server starting as release running says, with the
// last check having found version.
func noticeFrom(t *testing.T, running, version string) string {
	t.Helper()
	asRelease(t, running)
	cache := filepath.Join(t.TempDir(), "latest.json")
	data, _ := json.Marshal(latest.Release{
		Version: version,
		URL:     "https://github.com/kite-plus/kite/releases/tag/v" + version,
		Checked: time.Now().Add(-48 * time.Hour),
	})
	if err := os.WriteFile(cache, data, 0o644); err != nil {
		t.Fatal(err)
	}
	c := latest.New()
	c.CacheFile = cache
	var out bytes.Buffer
	cmd := &cobra.Command{}
	cmd.SetErr(&out)
	releaseNotice(cmd, c)
	return out.String()
}

// A server starting says that a newer Kite is out from the last answer,
// however old, without waiting on a new one.
func TestAServerSaysANewerKiteIsOut(t *testing.T) {
	if got := noticeFrom(t, "0.1.12", "0.1.13"); !strings.HasPrefix(got, "note: Kite 0.1.13 is out, and this is 0.1.12") ||
		!strings.Contains(got, "releases/tag/v0.1.13") {
		t.Errorf("notice = %q", got)
	}
	for _, version := range []string{"0.1.12", "0.1.11"} {
		if got := noticeFrom(t, "0.1.12", version); got != "" {
			t.Errorf("with %s found, 0.1.12 said %q", version, got)
		}
	}
}

// A build from source has no release to be behind, and the checks can be
// turned off.
func TestReleaseChecksAreForReleasesThatAllowThem(t *testing.T) {
	asRelease(t, "0.1.12")
	if releaseChecker() == nil {
		t.Error("a release does not check")
	}
	t.Setenv("KITE_NO_UPDATE_CHECK", "1")
	if releaseChecker() != nil {
		t.Error("KITE_NO_UPDATE_CHECK=1 still checks")
	}
	t.Setenv("KITE_NO_UPDATE_CHECK", "")
	asRelease(t, "v0.1.12-3-gabc1234")
	if releaseChecker() != nil {
		t.Error("a build from source checks")
	}
}
