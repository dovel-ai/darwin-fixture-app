// A developer's day: adds the next real dependency from the list below, at an old release, with a small use of it
// and a test, as a person adding a library they found in an old example would. Darwin should then find the newer
// release and propose it (or hold it, with the reason: x/text's newer releases need a newer Go than go.mod says).
//
//   node .github/fixture/add-dependency.mjs   -> writes the code, prints {"module","version"} or {} when the list is done
//
// The workflow runs `go get` and `go mod tidy` for it, tests, and commits.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DEPENDENCIES = [
  { module: 'github.com/google/uuid', version: 'v1.3.0', imports: ['github.com/google/uuid'], use: 'uuid.NewString()', returns: 'string', check: 'len(v) != 36' },
  { module: 'github.com/dustin/go-humanize', version: 'v1.0.0', imports: ['github.com/dustin/go-humanize'], use: 'humanize.Comma(1234567)', returns: 'string', check: 'v != "1,234,567"' },
  { module: 'github.com/cespare/xxhash/v2', version: 'v2.1.2', imports: ['github.com/cespare/xxhash/v2'], use: 'xxhash.Sum64String("darwin")', returns: 'uint64', check: 'v == 0' },
  { module: 'github.com/shopspring/decimal', version: 'v1.2.0', imports: ['github.com/shopspring/decimal'], use: 'decimal.NewFromFloat(1.5).Add(decimal.NewFromFloat(2.25)).String()', returns: 'string', check: 'v != "3.75"' },
  { module: 'github.com/mattn/go-runewidth', version: 'v0.0.9', imports: ['github.com/mattn/go-runewidth'], use: 'runewidth.StringWidth("route")', returns: 'int', check: 'v != 5' },
  { module: 'gopkg.in/yaml.v3', version: 'v3.0.0', imports: ['gopkg.in/yaml.v3'], use: 'mustYAML(map[string]int{"legs": 2})', returns: 'string', check: 'v != "legs: 2\\n"', helper: 'func mustYAML(v any) string {\n\tout, err := yaml.Marshal(v)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\treturn string(out)\n}\n' },
  { module: 'github.com/pkg/errors', version: 'v0.9.0', imports: ['github.com/pkg/errors'], use: 'errors.Wrap(errors.New("no route"), "plan").Error()', returns: 'string', check: 'v != "plan: no route"' },
  { module: 'golang.org/x/text', version: 'v0.14.0', imports: ['golang.org/x/text/cases', 'golang.org/x/text/language'], use: 'cases.Title(language.English).String("great circle")', returns: 'string', check: 'v != "Great Circle"' },
]

const goMod = readFileSync('go.mod', 'utf8')
const next = DEPENDENCIES.find(dep => !new RegExp(`^\\s*(require\\s+)?${dep.module.replace(/[.]/gu, '\\.')}\\s`, 'mu').test(goMod))
if (next === undefined) {
  process.stdout.write('{}')
  process.exit(0)
}
const name = next.module.split('/').filter(part => !/^v\d+$/u.test(part)).at(-1).replace(/[^A-Za-z0-9]/gu, '')
const fn = `Extra${name[0].toUpperCase()}${name.slice(1)}`
mkdirSync('extras', { recursive: true })
const imports = next.imports.map(path => `\t"${path}"`).join('\n')
writeFileSync(`extras/${name}.go`, `package extras\n\nimport (\n${imports}\n)\n\n// ${fn} is a use of ${next.module}, added at ${next.version}.\nfunc ${fn}() ${next.returns} { return ${next.use} }\n${next.helper === undefined ? '' : `\n${next.helper}`}`)
writeFileSync(`extras/${name}_test.go`, `package extras\n\nimport "testing"\n\nfunc Test${fn}(t *testing.T) {\n\tif v := ${fn}(); ${next.check} {\n\t\tt.Fatalf("${fn}: %v", v)\n\t}\n}\n`)
if (!existsSync('extras/doc.go')) writeFileSync('extras/doc.go', '// Package extras holds the small uses of libraries this fixture added over time.\npackage extras\n')
process.stdout.write(JSON.stringify({ module: next.module, version: next.version }))
