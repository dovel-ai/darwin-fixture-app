package extras

import "testing"

func TestExtraErrors(t *testing.T) {
	if v := ExtraErrors(); v != "plan: no route" {
		t.Fatalf("ExtraErrors: %v", v)
	}
}
