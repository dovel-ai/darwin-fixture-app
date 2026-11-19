package extras

import (
	"github.com/cespare/xxhash/v2"
)

// ExtraXxhash is a use of github.com/cespare/xxhash/v2, added at v2.1.2.
func ExtraXxhash() uint64 { return xxhash.Sum64String("darwin") }
