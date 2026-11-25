// Package route plans legs between stops. Every exported function of darwin-fixture-geo is used here, so each
// breaking release of that library breaks this package until its call sites are migrated.
package route

import (
	"fmt"
	"strings"

	geo "github.com/dovel-ai/darwin-fixture-geo"
)

// Leg is a straight great-circle leg between two stops.
type Leg struct {
	From geo.Point
	To   geo.Point
}

// Length is the leg's length in kilometres.
func (l Leg) Length() float64 { return geo.GreatCircleDistance(l.From, l.To) }

// Heading is the initial bearing of the leg in degrees.
func (l Leg) Heading() float64 { return geo.InitialBearing(l.From, l.To) }

// Halfway is the point halfway along the leg.
func (l Leg) Halfway() geo.Point { return geo.Slerp(l.From, l.To, 0.5) }

// Describe writes a stop as "lat,lon".
func Describe(p geo.Point) string { return geo.PointString(p) }

// ParseStops reads stops written as "lat,lon;lat,lon;...".
func ParseStops(s string) ([]geo.Point, error) {
	var stops []geo.Point
	for _, part := range strings.Split(s, ";") {
		p, err := geo.Parse(part)
		if err != nil {
			return nil, fmt.Errorf("stop %d: %w", len(stops)+1, err)
		}
		stops = append(stops, p)
	}
	return stops, nil
}

// Legs joins consecutive stops.
func Legs(stops []geo.Point) []Leg {
	var legs []Leg
	for i := 1; i < len(stops); i++ {
		legs = append(legs, Leg{From: stops[i-1], To: stops[i]})
	}
	return legs
}
