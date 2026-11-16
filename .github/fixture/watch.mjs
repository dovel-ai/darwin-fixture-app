// Watches Darwin on this repository: every change the fixture made (a darwin-fixture-geo release, a dependency the
// simulated developer added) must be handled within DEADLINE_HOURS: proposed in a Darwin pull request (a breaking
// release with its call sites migrated and CI passing), merged, or held with a reason Darwin shows. It also checks
// that Darwin never marks a pull request ready while its CI fails, that no run is stuck, and that the console (Darwin's
// API, with a read-only agent token) agrees with GitHub about Darwin's pull requests.
//
// Env: GH_TOKEN, REPO (owner/name), LIB (owner/name of the library), DEADLINE_HOURS (default 30), and for the console
// DARWIN_API, DARWIN_TOKEN, DARWIN_WORKSPACE. Writes the report to REPORT (markdown) and STATE (json); exits 1 on a
// failure, so a scheduled run that finds one fails visibly.
import { readFileSync, writeFileSync } from 'node:fs'

const env = name => process.env[name] ?? ''
const REPO = env('REPO')
const LIB = env('LIB')
const LIB_MODULE = `github.com/${LIB}`
const DEADLINE_MS = Number(env('DEADLINE_HOURS') || 30) * 3600_000
const STUCK_MS = 6 * 3600_000
const now = Date.now()

async function gh(path, accept = 'application/vnd.github+json') {
  const response = await fetch(`https://api.github.com/${path}`, { headers: { authorization: `Bearer ${env('GH_TOKEN')}`, accept, 'x-github-api-version': '2022-11-28' } })
  if (!response.ok) throw new Error(`GitHub ${path}: ${response.status} ${(await response.text()).slice(0, 200)}`)
  return accept.includes('json') ? response.json() : response.text()
}
async function ghAll(path) {
  const items = []
  for (let page = 1; page <= 10; page += 1) {
    const batch = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    items.push(...batch)
    if (batch.length < 100) break
  }
  return items
}
async function darwin(path) {
  const response = await fetch(`${env('DARWIN_API').replace(/\/$/u, '')}${path}`, { headers: { authorization: `Bearer ${env('DARWIN_TOKEN')}` } })
  if (!response.ok) throw new Error(`Darwin ${path}: ${response.status} ${(await response.text()).slice(0, 200)}`)
  return response.json()
}

// Go versions: v0.3.1 -> [0,3,1]; a pseudo-version or anything else compares as unknown (null).
const parse = version => { const m = /^v(\d+)\.(\d+)\.(\d+)$/u.exec(String(version ?? '')); return m === null ? null : m.slice(1).map(Number) }
const atLeast = (version, target) => {
  const [a, b] = [parse(version), parse(target)]
  if (a === null || b === null) return false
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}
const requires = goMod => Object.fromEntries([...goMod.matchAll(/^\s*(?:require\s+)?([a-z0-9.\-_/]+\.[a-z]+\/[^\s]+)\s+(v[^\s]+)/gmu)].map(m => [m[1], m[2]]))

// What each Darwin pull request moves, from the marker every Darwin PR body carries.
const movesOf = body => {
  const marker = /<!-- dovel:update \S+ \S+ moves=([^\s]+) -->/u.exec(String(body ?? ''))?.[1]
  if (marker === undefined) return {}
  return Object.fromEntries(marker.split(',').map(item => { const at = item.lastIndexOf('@'); return [item.slice(0, at), item.slice(at + 1)] }))
}

const failures = []
const fail = (what, detail) => failures.push({ what, detail })

// 1. The changes the fixture made.
const releases = (await ghAll(`repos/${LIB}/releases`)).map(release => ({
  kind: 'release', module: LIB_MODULE, version: release.tag_name, at: Date.parse(release.created_at), url: release.html_url,
  change: JSON.parse(/<!-- darwin-fixture (\{.*\}) -->/u.exec(release.body ?? '')?.[1] ?? '{}'),
})).filter(release => parse(release.version) !== null).sort((a, b) => a.at - b.at)
const commits = await ghAll(`repos/${REPO}/commits?sha=main`)
const additions = commits.flatMap(commit => {
  const m = /^fixture: add dependency (\S+) (\S+)/u.exec(commit.commit.message)
  return m === null ? [] : [{ kind: 'dependency', module: m[1], version: m[2], at: Date.parse(commit.commit.committer.date), url: commit.html_url, change: {} }]
})
const goMod = await gh(`repos/${REPO}/contents/go.mod?ref=main`, 'application/vnd.github.raw')
const declared = requires(goMod)

// 2. Darwin's pull requests, their changes and CI.
const pulls = (await ghAll(`repos/${REPO}/pulls?state=all`)).filter(pull => /darwin/u.test(pull.user.login) && pull.user.type === 'Bot')
for (const pull of pulls) {
  pull.moves = movesOf(pull.body)
  if (pull.state !== 'open') continue
  pull.files = await ghAll(`repos/${REPO}/pulls/${pull.number}/files`)
  const runs = (await gh(`repos/${REPO}/commits/${pull.head.sha}/check-runs?per_page=100`)).check_runs.filter(run => !/darwin/iu.test(run.name))
  pull.ci = runs.length === 0 ? 'none' : runs.some(run => run.status !== 'completed') ? 'pending'
    : runs.every(run => ['success', 'skipped', 'neutral'].includes(run.conclusion)) ? 'passed' : 'failed'
  if (!pull.draft && pull.ci === 'failed') fail(`#${pull.number} is ready for review with failing CI`, pull.html_url)
}

// 3. The console's view (optional: without a token the console is not checked).
let consoleUpdates = []
let consoleNote = 'not checked (no DARWIN_TOKEN)'
if (env('DARWIN_TOKEN') !== '') {
  const ws = env('DARWIN_WORKSPACE')
  const repository = (await darwin(`/v1/workspaces/${ws}/repositories?limit=100`)).data.find(repo => repo.fullName.toLowerCase() === REPO.toLowerCase())
  if (repository === undefined) fail('the console does not list this repository', REPO)
  else {
    const runs = (await darwin(`/v1/workspaces/${ws}/repositories/${repository.id}/runs?limit=20`)).data
    for (const run of runs) {
      const started = Date.parse(run.startedAt ?? run.dispatchedAt ?? run.queuedAt)
      if (['queued', 'dispatched', 'running', 'publishing'].includes(run.status) && now - started > STUCK_MS) fail(`run ${run.id} is stuck in ${run.status}`, `since ${new Date(started).toISOString()}`)
    }
    const lastFinished = runs.find(run => ['succeeded', 'failed', 'cancelled'].includes(run.status))
    if (lastFinished?.status === 'failed') fail(`the last run failed: ${String(lastFinished.failure).slice(0, 200)}`, lastFinished.githubRunUrl ?? lastFinished.id)
    const consolePulls = (await darwin(`/v1/workspaces/${ws}/pull-requests?repository=${repository.id}&state=all&limit=100`)).data
    const byNumber = new Map(consolePulls.map(pull => [pull.number, pull]))
    for (const pull of pulls) {
      const shown = byNumber.get(pull.number)
      const state = pull.merged_at !== null ? 'merged' : pull.state === 'closed' ? 'closed' : pull.draft ? 'draft' : 'open'
      const settled = now - Date.parse(pull.updated_at) > 3600_000
      if (shown === undefined) { if (settled) fail(`the console does not show #${pull.number}`, pull.html_url) }
      else if (shown.state !== state && settled) fail(`the console shows #${pull.number} as ${shown.state}, GitHub as ${state}`, pull.html_url)
    }
    consoleUpdates = (await darwin(`/v1/workspaces/${ws}/updates?repository=${repository.id}&view=all&limit=100`)).data
    consoleNote = `${runs.length} recent runs (last: ${runs[0]?.status ?? 'none'}${runs[0]?.catchUp ? ', catch-up' : ''}), ${consolePulls.length} pull requests, ${consoleUpdates.length} updates`
  }
}

// 4. Each change: handled, waiting, or missed.
const rows = []
for (const event of [...releases, ...additions].sort((a, b) => a.at - b.at)) {
  const present = declared[event.module]
  const proposal = pulls.filter(pull => pull.state === 'open' && atLeast(pull.moves[event.module], event.version))
    .sort((a, b) => b.number - a.number)[0]
  const update = consoleUpdates.find(item => item.name === event.module && item.ecosystem === 'gomod')
  let status
  if (atLeast(present, event.version)) status = 'merged'
  else if (proposal !== undefined) {
    const migrated = proposal.files.some(file => file.filename.endsWith('.go'))
    status = event.change.breaking ? (migrated ? `fixed in #${proposal.number}, CI ${proposal.ci}` : `proposed in #${proposal.number} WITHOUT a code migration, CI ${proposal.ci}`)
      : `proposed in #${proposal.number}, CI ${proposal.ci}`
    if (event.change.breaking && !migrated && proposal.ci === 'passed') fail(`#${proposal.number} moves ${event.module} past a breaking release without changing code, yet CI passed`, proposal.html_url)
  } else if (update?.held !== null && update?.held !== undefined) status = `held: ${String(update.held.reason).slice(0, 160)}`
  else if (event.kind === 'dependency' && present !== undefined && present !== event.version) status = `moved to ${present} by someone else`
  else if (now - event.at > DEADLINE_MS) { status = 'MISSED'; fail(`${event.module} ${event.version} (${event.kind}${event.change.op ? `, ${event.change.op}` : ''}) was not handled within ${DEADLINE_MS / 3600_000} hours`, event.url) }
  else status = `waiting (${Math.round((now - event.at) / 3600_000)} h old)`
  rows.push(`| ${new Date(event.at).toISOString().slice(0, 16)} | ${event.kind === 'release' ? `[${event.version}](${event.url}) ${event.change.op ?? ''}${event.change.breaking ? ' (breaking)' : ''}` : `added ${event.module} ${event.version}`} | ${status} |`)
}

const report = [
  `# Darwin fixture watch`, '',
  `Checked ${new Date(now).toISOString()}: ${failures.length === 0 ? 'everything handled or waiting' : `**${failures.length} failure(s)**`}.`, '',
  `- ${LIB_MODULE}: main declares ${declared[LIB_MODULE] ?? 'nothing'}; newest release ${releases.at(-1)?.version ?? 'none'}`,
  `- Darwin pull requests: ${pulls.filter(pull => pull.state === 'open').length} open, ${pulls.filter(pull => pull.merged_at !== null).length} merged, ${pulls.filter(pull => pull.state === 'closed' && pull.merged_at === null).length} closed`,
  `- Console: ${consoleNote}`, '',
  ...(failures.length === 0 ? [] : ['## Failures', '', ...failures.map(item => `- ${item.what} (${item.detail})`), '']),
  '## Changes', '', '| When (UTC) | Change | Darwin |', '|---|---|---|', ...rows.reverse(), '',
].join('\n')
writeFileSync(env('REPORT') || 'watch-report.md', report)
writeFileSync(env('STATE') || 'watch-state.json', JSON.stringify({ checkedAt: new Date(now).toISOString(), failures }, null, 2))
process.stdout.write(report)
process.exitCode = failures.length === 0 ? 0 : 1
