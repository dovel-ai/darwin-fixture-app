package extras

import "testing"

func TestExtraGorunewidth(t *testing.T) {
	if v := ExtraGorunewidth(); v != 5 {
		t.Fatalf("ExtraGorunewidth: %v", v)
	}
}
