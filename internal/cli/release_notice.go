package cli

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/kite-plus/kite/internal/buildinfo"
	"github.com/kite-plus/kite/internal/kitew"
	"github.com/kite-plus/kite/internal/latest"
)

// releaseChecker checks for a newer Kite while a server runs, unless
// KITE_NO_UPDATE_CHECK turns it off or this is a build from source, which no
// release follows.
func releaseChecker() *latest.Checker {
	if latest.Off() {
		return nil
	}
	if _, ok := kitew.Release(buildinfo.Version); !ok {
		return nil
	}
	return latest.New()
}

// releaseNotice says, from what the last check found, that a newer Kite is
// out and where to get it. The check itself runs with the server, which logs
// a release this did not name.
func releaseNotice(cmd *cobra.Command, releases *latest.Checker) {
	if releases == nil {
		return
	}
	running, _ := kitew.Release(buildinfo.Version)
	r := releases.Known()
	if r == nil || !latest.Newer(r.Version, running) {
		return
	}
	if latest.InContainer() {
		_, _ = fmt.Fprintf(cmd.ErrOrStderr(), "note: Kite %s is out, and this is %s; pull %s:%s (%s)\n",
			r.Version, running, latest.Image, r.Version, r.URL)
		return
	}
	_, _ = fmt.Fprintf(cmd.ErrOrStderr(), "note: Kite %s is out, and this is %s: %s\n", r.Version, running, r.URL)
}
