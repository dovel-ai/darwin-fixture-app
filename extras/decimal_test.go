package extras

import "testing"

func TestExtraDecimal(t *testing.T) {
	if v := ExtraDecimal(); v != "3.75" {
		t.Fatalf("ExtraDecimal: %v", v)
	}
}
