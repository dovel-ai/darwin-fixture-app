// Command route prints the legs of a route given as "lat,lon;lat,lon;...".
package main

import (
	"fmt"
	"os"

	"github.com/dovel-ai/darwin-fixture-app/route"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, `usage: route "lat,lon;lat,lon;..."`)
		os.Exit(2)
	}
	stops, err := route.ParseStops(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	for _, leg := range route.Legs(stops) {
		fmt.Printf("%s -> %s: %.1f km, heading %.0f, halfway %s\n",
			route.Describe(leg.From), route.Describe(leg.To), leg.Length(), leg.Heading(), route.Describe(leg.Halfway()))
	}
}
