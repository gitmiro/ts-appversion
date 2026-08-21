# Contributing

Pull requests are welcome. Please keep the existing tests passing and add coverage for anything new.

## Setup

```shell
npm ci
npm test
```

Requires Node.js 20 or newer and a `git` binary on your PATH — the tests drive a real git
repository in your tmp directory.

Run a single test by name:

```shell
node --test --test-name-pattern="custom --match" test/*.test.js
```

Coverage:

```shell
npm run test:coverage
```

## A note on the layout

`src/` is hand-written JavaScript, not build output. There is no build step.

## Releasing

Releases are tagged, not automated from commit messages. Use `npm version` — it bumps
`package.json` and `package-lock.json`, commits, and creates the matching `v` tag in one step:

```shell
npm version patch     # or minor / major
git push && git push --tags
```

Do **not** create the tag by hand. The release workflow refuses to publish when the tag and
`package.json` disagree, so a hand-made tag on an unbumped manifest just fails the run.

The workflow then verifies the tag, runs the tests, and publishes to npm via trusted publishing.
