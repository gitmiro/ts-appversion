/**
 * @see https://github.com/angular/angular-cli/issues/5190
 */
const path = require('node:path');
const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { execFileSync } = require('node:child_process');
const pc = require('picocolors');

const { values: argv } = parseArgs({
    options: {
        root: { type: 'string' },
        file: { type: 'string' },
        git: { type: 'string' },
        'set-version': { type: 'string' },
        match: { type: 'string' },
    },
    // Unknown flags are ignored rather than fatal: this runs inside other people's
    // build scripts, where an unrecognised argument should not fail the build.
    strict: false,
    allowPositionals: true,
});

// parseArgs returns a null-prototype object, so argv.hasOwnProperty() is not available.
function hasArg(name) {
    return Object.hasOwn(argv, name);
}

/**
 * When this package is installed as a dependency, our own location always looks like
 * <project>/node_modules/.../<package>/dist -- regardless of the package name, the scope,
 * or whether npm, yarn or pnpm laid it out. The consuming project is therefore the
 * directory holding the OUTERMOST node_modules segment of our path. Deriving it that way
 * keeps this working if the package is ever renamed or re-scoped.
 */
function findConsumerRoot(dir) {
    const marker = path.sep + 'node_modules' + path.sep;
    const index = dir.indexOf(marker);
    return index === -1 ? null : dir.slice(0, index);
}

const rootPath = hasArg('root') ? argv.root : '.';

const projectLocations = [];

// If root path is absolute, ignore other paths
if (path.isAbsolute(rootPath)) {
    projectLocations.push(rootPath);
} else {
    // Installed as a dependency: resolve against the project that depends on us.
    const consumerRoot = findConsumerRoot(__dirname);
    if (consumerRoot !== null) {
        projectLocations.push(path.join(consumerRoot, rootPath));
    }
    // Run from an npm script: the working directory is the project root.
    projectLocations.push(path.resolve(process.cwd(), rootPath));
    // Run directly from a checkout of this repository.
    projectLocations.push(path.join(__dirname, rootPath));
}

// Find package.json
let packageFile = '';
let projectFolder = '';
for (const location of projectLocations) {
    packageFile = path.join(location, 'package.json');
    try {
        if (fs.existsSync(packageFile)) {
            projectFolder = location;
            break;
        }
    } catch (e) {
        // Ignore errors
    }
}

if (!projectFolder.length) {
    console.log('[TsAppVersion] ' + pc.yellow('Cannot find package.json in root path. Skipping...'));
    return;
}

const outputFile = hasArg('file') ? argv.file : path.join('src', '_versions.ts');
const versionFile = path.join(projectFolder, outputFile);

// pull version from package.json
const pkg = require(packageFile);
const appName = pkg.name || '';
const appDescription = pkg.description || '';

let appVersion = pkg.version || '';

console.log('[TsAppVersion] ' + pc.green('Application version (from package.json): ') + pc.yellow(appVersion));
console.log('[TsAppVersion] ' + pc.green('Application name (from package.json): ') + pc.yellow(appName));

if (hasArg('set-version')) {
    appVersion = argv['set-version']
    console.log('[TsAppVersion] Setting fixed version ' + appVersion + ' from command option.');
}

let src = `export interface TsAppVersion {
    version: string;
    name: string;
    description?: string;
    versionLong?: string;
    versionDate: string;
    gitCommitHash?: string;
    gitCommitDate?: string;
    gitTag?: string;
};
export const versions: TsAppVersion = {
    version: '${appVersion}',
    name: '${appName}',
    versionDate: '${new Date().toISOString()}',
`;
if (appDescription !== undefined && appDescription !== '') {
    console.log('[TsAppVersion] ' + pc.green('Application description (from package.json): ') + pc.yellow(appDescription));
    src += `    description: '${appDescription}',\n`;
}

let enableGit = false;
let gitFolder = projectFolder;
if (hasArg('git')) {
    gitFolder = path.resolve(projectFolder, argv.git);
    if (path.isAbsolute(argv.git)) {
        gitFolder = argv.git;
    }
}
if (fs.existsSync(path.join(gitFolder, '.git'))) {
    enableGit = true;
    console.log('[TsAppVersion] Git repository detected. Getting current commit information.');
}

if (enableGit) {

    let match = 'v[0-9]*';
    if (hasArg('match')) {
        match = argv['match']
        console.log('[TsAppVersion] Using ' + match + ' as a git-describe tag-matcher.');
    }
    const git = require('git-describe');
    try {
        const info = git.gitDescribeSync(gitFolder, { longSemver: true, match });
        let versionWithHash = appVersion;
        if (info.hasOwnProperty('hash')) {
            versionWithHash = versionWithHash + '-' + info.hash;
            src += `    gitCommitHash: '${info.hash}',\n`;
            console.log('[TsAppVersion] ' + pc.green('Git Commit hash: ') + pc.yellow(info.hash));

            // Get date of commit
            try {
                // git-describe prefixes the hash with 'g', but only when a tag matched.
                // Stripping the first character unconditionally corrupts the hash of an
                // untagged repository. Hashes are hex, so a leading 'g' is never data.
                const commit = info.hash.replace(/^g/, '');
                // %aI is the author date in strict ISO 8601 -- the same date the previous
                // implementation parsed out of `git show`.
                const authorDate = execFileSync('git', ['log', '-1', '--format=%aI', commit], {
                    cwd: gitFolder,
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'pipe'],
                }).trim();
                if (authorDate) {
                    const gitDateString = new Date(authorDate).toISOString();
                    console.log('[TsAppVersion] ' + pc.green('Git Commit date: ') + pc.yellow(gitDateString));
                    src += `    gitCommitDate: '${gitDateString}',\n`;
                }
            } catch (e) {
                console.log('[TsAppVersion] ' + pc.red('Could not read the commit date: ' + e.message));
            }
        }
        console.log('[TsAppVersion] ' + pc.green('Long Git version: ') + pc.yellow(versionWithHash));
        src += `    versionLong: '${versionWithHash}',\n`;
        if (info.hasOwnProperty('tag') && info.tag !== null) {
            console.log('[TsAppVersion] ' + pc.green('Git tag: ') + pc.yellow(info.tag));
            src += `    gitTag: '${info.tag}',\n`;
        }
    } catch(e) {
        if (new RegExp(/Not a git repository/).test(e.message)) {
            console.log('[TsAppVersion] ' + pc.red('Not a Git repository.'));
            return;
        }
        console.log('[TsAppVersion] ' + pc.red(e.message));
    }
}

src += `};
export default versions;
`;

console.log('[TsAppVersion] ' + pc.green('Writing version module to ') + pc.yellow(versionFile));
fs.writeFile(versionFile, src, function (err) {
    if (err) {
        return console.log('[TsAppVersion] ' + pc.red(err));
    }
    console.log('[TsAppVersion] ' + pc.green('File written.'));
});
