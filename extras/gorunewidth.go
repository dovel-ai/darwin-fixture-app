package extras

import (
	"github.com/mattn/go-runewidth"
)

// ExtraGorunewidth is a use of github.com/mattn/go-runewidth, added at v0.0.9.
func ExtraGorunewidth() int { return runewidth.StringWidth("route") }
