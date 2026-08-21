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

Releases are tagged, not automated from commit messages. Bump the version in `package.json`,
commit, then:

```shell
git tag v1.2.3
git push origin v1.2.3
```

The release workflow verifies the tag matches `package.json`, runs the tests, and publishes to npm.
