package extras

import (
	"github.com/shopspring/decimal"
)

// ExtraDecimal is a use of github.com/shopspring/decimal, added at v1.2.0.
func ExtraDecimal() string { return decimal.NewFromFloat(1.5).Add(decimal.NewFromFloat(2.25)).String() }
