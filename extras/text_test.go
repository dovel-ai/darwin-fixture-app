package extras

import "testing"

func TestExtraText(t *testing.T) {
	if v := ExtraText(); v != "Great Circle" {
		t.Fatalf("ExtraText: %v", v)
	}
}
