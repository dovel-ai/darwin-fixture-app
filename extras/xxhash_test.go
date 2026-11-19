package extras

import "testing"

func TestExtraXxhash(t *testing.T) {
	if v := ExtraXxhash(); v == 0 {
		t.Fatalf("ExtraXxhash: %v", v)
	}
}
