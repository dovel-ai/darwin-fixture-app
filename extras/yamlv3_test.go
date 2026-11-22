package extras

import "testing"

func TestExtraYamlv3(t *testing.T) {
	if v := ExtraYamlv3(); v != "legs: 2\n" {
		t.Fatalf("ExtraYamlv3: %v", v)
	}
}
