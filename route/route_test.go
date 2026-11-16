package route

import "testing"

func TestPlan(t *testing.T) {
	stops, err := ParseStops("52.52,13.405; 48.8566,2.3522")
	if err != nil {
		t.Fatal(err)
	}
	legs := Legs(stops)
	if len(legs) != 1 {
		t.Fatalf("legs: %d", len(legs))
	}
	leg := legs[0]
	if km := leg.Length(); km < 870 || km > 885 {
		t.Fatalf("length: %v", km)
	}
	if h := leg.Heading(); h < 240 || h > 250 {
		t.Fatalf("heading: %v", h)
	}
	mid := leg.Halfway()
	if mid.Lat < 50.5 || mid.Lat > 51 || mid.Lon < 7.5 || mid.Lon > 8.3 {
		t.Fatalf("halfway: %v", mid)
	}
	if s := Describe(stops[0]); s != "52.52000,13.40500" {
		t.Fatalf("describe: %q", s)
	}
}

func TestParseStopsRejectsGarbage(t *testing.T) {
	if _, err := ParseStops("52.52"); err == nil {
		t.Fatal("expected an error")
	}
}
