# ts-appversion

Extracts version information from your `package.json` and Git (if configured) and writes it to a
TypeScript file your application can import, so you can display the running version in your app.

> **This is a maintained fork.** The original [saitho/ts-appversion](https://github.com/saitho/ts-appversion)
> was archived by its author. This fork continues it as `@gitmiro/ts-appversion`, adding the `--match`
> option and ongoing maintenance. It is MIT licensed like the original, and is neither affiliated with
> nor endorsed by the original author. See [LICENSE](LICENSE) for the full copyright notice.

> **Coming from `@saithodev/ts-appversion`?** This package restarts at `1.0.0`, which is a lower
> number than the original's last release (`2.2.0`) but strictly newer code. It is a drop-in
> replacement: same CLI, same generated file. Swap the dependency and the `ts-appversion` command
> keeps working.

Requires **Node.js 20 or newer**.

## Installation

```shell
npm install --save-dev @gitmiro/ts-appversion
```

The examples below use Angular, but the package works with any TypeScript project.

## Getting started

The package ships a command that runs before your application is built. Wire it into *prestart*
and *prebuild* in your package.json:

```json
{
  "scripts": {
    "prestart": "ts-appversion",
    "start": "ng serve",
    "prebuild": "ts-appversion",
    "build": "ng build"
  }
}
```

The version file is then regenerated whenever `npm start` or `npm run build` runs.

*Note:* calling `ng build` directly bypasses the pre-hook, so the version file will be stale.
Use `npm run build` instead.

## Command arguments

| Argument | Meaning | Default |
|---|---|---|
| `--root` | Root directory holding your package.json | the project that installed this package |
| `--file` | Output file location, relative to the root directory | `./src/_versions.ts` |
| `--git` | Location of the folder containing `.git`, relative to the root directory | `.` |
| `--set-version` | Override the version string taken from package.json | package.json `version` |
| `--match` | Override the tag pattern git-describe matches against | `v[0-9]*` |

Both `--flag value` and `--flag=value` work. Unknown flags are ignored rather than failing your build.

## Receiving the versions

The script generates a TypeScript file at the location `./src/_versions.ts` if you haven't provided a different location.
You'll be able to import the values just like any other package, if you want use just versions information, like in environment.ts example file:
```
import versions from '../_versions';
```
or you can import also TsAppVersion and use directly in your template, like in app.component.ts example file
```
import { TsAppVersion, versions } from 'src/_versions.ts';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent { 
  public readonly tsAppVersion: TsAppVersion;
  constructor() {
    this.tsAppVersion = versions;
  }
}
```

The file will export an object with following variables:

* **version** is the version from package.json (or value of `set-version` option if set)
* **name** is the name from the package.json (e.g. 'sample-app')
* **description** is the description from the package.json
* **versionDate** is the timestamp in ISO format when the compilation/package started.
* **versionLong** is the version from the package.json PLUS the Hash of the current Git-Commit (e.g. v1.0.0-g63962e3) - will only be generated if your repository is a Git Repository
* **gitTag** is the latest Git tag
* **gitCommitHash** is the short hash of the last commit
* **gitCommitDate** is the timestamp in ISO format of the last commit

_Note:_ The variables starting with "git" and the variable "versionLong" will only be available for Git repositories.

## Environment-related versions

In some cases it might be better to not display the version number or only the short notation.
You can use the environments to display different version informations.

In the following example:
- the dev environment will display the version timestamp
- the staging environemnt will diplay the long version (with the Commit hash)
- the production environment will display the simple notation

*environments/environment.ts*
```typescript
import versions from '../_versions';
export const environment = {
  production: false,
  version: versions.versionDate,
};
```

*environments/environment.staging.ts*
```typescript
import versions from '../_versions';
export const environment = {
  production: false,
  version: versions.versionLong,
};
```

*environments/environment.prod.ts*
```typescript
import versions from '../_versions';
export const environment = {
  production: true,
  version: versions.version,
};
```

From there you can access the version inside the Component which should display the version, e.g.:
```typescript
import { Component } from '@angular/core';
import { environment } from '../environments/environment';
@Component({
  selector: 'app-root',
  template: '{{title}} {{version}}'
})
export class AppComponent {
  title = 'app';
  version = environment.version ? 'v' + environment.version : '';
}
```


## License

MIT — see [LICENSE](LICENSE). Original work © 2017-2023 Mario Lubenka, fork © 2024-2026 Miroljub Zlatković.

