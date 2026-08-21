'use strict';

/* Black-box tests: every case runs the real CLI against a throwaway project in the
 * tmp directory and asserts on stdout plus the generated file. Requires a git binary. */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const TestRepo = require('./lib/repo');

const execFileAsync = promisify(execFile);

const CLI = path.join(__dirname, '..', 'src', 'index.js');
const PACKAGE_DIR = path.join(__dirname, '..');
const repoDir = path.join(os.tmpdir(), 'test-repo');
const repo = new TestRepo(repoDir);

/** Run the CLI. Rejects on a non-zero exit; asserts nothing was written to stderr. */
async function run(args, options = {}) {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], options);
    assert.strictEqual(stderr, '', 'expected no stderr output, got: ' + stderr);
    return stdout;
}

// The generated module's exact shape is a contract for consumers importing it.
const INTERFACE_FIELDS = [
    'version: string;',
    'name: string;',
    'description?: string;',
    'versionLong?: string;',
    'versionDate: string;',
    'gitCommitHash?: string;',
    'gitCommitDate?: string;',
    'gitTag?: string;',
];

function readGeneratedFile(filePath) {
    assert.ok(fs.existsSync(filePath), 'expected ' + filePath + ' to exist');
    const contents = fs.readFileSync(filePath, 'utf8');

    assert.ok(contents.includes('export interface TsAppVersion {'), 'missing interface');
    for (const field of INTERFACE_FIELDS) {
        assert.ok(contents.includes(field), 'missing interface field: ' + field);
    }
    assert.ok(
        contents.includes('};\nexport const versions: TsAppVersion = {'),
        'interface must be followed by the versions object'
    );
    assert.ok(
        contents.includes('};\nexport default versions;\n'),
        'file must end with the default export'
    );
    return contents;
}

function assertHasField(contents, name, value) {
    assert.ok(
        contents.includes('    ' + name + ": '" + value + "',"),
        'expected field ' + name + " = '" + value + "'"
    );
}

function writePackageJson(dir, extra = '') {
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        '{"version": "1.0.0", "name": "test"' + extra + '}'
    );
}

/** Build a project that has this package installed under node_modules. */
function createConsumerProject(name) {
    const consumerDir = path.join(os.tmpdir(), name);
    assert.ok(consumerDir.startsWith(os.tmpdir()), 'consumer project must live in the tmp directory');
    fs.rmSync(consumerDir, { recursive: true, force: true });

    const installDir = path.join(consumerDir, 'node_modules', '@gitmiro', 'ts-appversion');
    fs.mkdirSync(installDir, { recursive: true });
    fs.mkdirSync(path.join(consumerDir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(consumerDir, 'package.json'),
        '{"version": "9.9.9", "name": "consumer-app"}'
    );
    fs.cpSync(path.join(PACKAGE_DIR, 'src'), path.join(installDir, 'src'), { recursive: true });
    // Let the copied package resolve its own runtime dependencies.
    fs.symlinkSync(
        path.join(PACKAGE_DIR, 'node_modules'),
        path.join(installDir, 'node_modules'),
        'dir'
    );
    return {
        consumerDir,
        entrypoint: path.join(installDir, 'src', 'index.js'),
        outputFile: path.join(consumerDir, 'src', '_versions.ts'),
    };
}

describe('ts-appversion', () => {
    before(() => repo.clean());

    it('skips when no package.json is found', async () => {
        const stdout = await run(['--root=' + repoDir, '--file=version-test.ts']);
        assert.match(stdout, /Cannot find package.json in root path. Skipping.../);
    });

    it('writes a version file without a git repository', async () => {
        fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
        writePackageJson(repoDir, ', "description": "test description"');

        const stdout = await run(['--root=' + repoDir]);
        assert.match(stdout, /Writing version module to/);

        const contents = readGeneratedFile(path.join(repoDir, 'src', '_versions.ts'));
        assertHasField(contents, 'version', '1.0.0');
        assertHasField(contents, 'name', 'test');
        assertHasField(contents, 'description', 'test description');
        assert.ok(!contents.includes('versionLong:'), 'must not emit git fields without a repository');
        assert.ok(!contents.includes('gitCommitHash:'), 'must not emit git fields without a repository');
    });

    it('includes git information for a git repository', async () => {
        repo.init();
        fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
        writePackageJson(repoDir, ', "description": "test description"');

        const stdout = await run(['--root=' + repoDir]);
        assert.match(stdout, /Writing version module to/);

        const contents = readGeneratedFile(path.join(repoDir, 'src', '_versions.ts'));
        assertHasField(contents, 'version', '1.0.0');
        assert.match(contents, /versionLong: '1\.0\.0-\w+',/);
        assert.match(contents, /gitCommitHash: '\w+',/);
        assert.match(contents, /gitCommitDate: '[^']+',/);
    });

    it('honours a custom --match tag matcher', async () => {
        repo.init();
        // Does not match git-describe's default v[0-9]* matcher.
        repo.tagLightweight('1.1.1');
        fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
        writePackageJson(repoDir, ', "description": "test description"');

        const stdout = await run(['--match=[0-9]*', '--root=' + repoDir]);
        assert.match(stdout, /Using \[0-9\]\* as a git-describe tag-matcher/);

        const contents = readGeneratedFile(path.join(repoDir, 'src', '_versions.ts'));
        assertHasField(contents, 'gitTag', '1.1.1');
        assert.match(contents, /versionLong: '1\.0\.0-\w+',/);
    });

    it('omits the description when package.json has none', async () => {
        repo.init();
        fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
        writePackageJson(repoDir);

        await run(['--root=' + repoDir]);

        const contents = readGeneratedFile(path.join(repoDir, 'src', '_versions.ts'));
        assertHasField(contents, 'version', '1.0.0');
        assert.ok(!contents.includes("description: '"), 'must not emit an empty description');
    });

    it('writes to a custom --file location', async () => {
        repo.init();
        writePackageJson(repoDir, ', "description": "test description"');

        await run(['--root=' + repoDir, '--file=version-test.ts']);

        const contents = readGeneratedFile(path.join(repoDir, 'version-test.ts'));
        assertHasField(contents, 'version', '1.0.0');
        assert.match(contents, /versionLong: '1\.0\.0-\w+',/);
    });

    it('finds the .git directory outside the project root', async () => {
        repo.init();
        const applicationDir = path.join(repoDir, 'application');
        fs.mkdirSync(path.join(applicationDir, 'src'), { recursive: true });
        writePackageJson(applicationDir, ', "description": "test description"');

        await run(['--root=' + applicationDir, '--git=..']);

        const contents = readGeneratedFile(path.join(applicationDir, 'src', '_versions.ts'));
        assertHasField(contents, 'name', 'test');
        assert.match(contents, /versionLong: '1\.0\.0-\w+',/);
    });

    it('honours --set-version and space-separated arguments', async () => {
        const projectDir = path.join(os.tmpdir(), 'test-setversion');
        fs.rmSync(projectDir, { recursive: true, force: true });
        fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
        writePackageJson(projectDir, ', "description": "test description"');

        // Both --flag=value and --flag value must parse, and an unknown flag must not fail.
        await run(['--root', projectDir, '--set-version', '9.9.9-rc1', '--an-unknown-flag']);

        const contents = readGeneratedFile(path.join(projectDir, 'src', '_versions.ts'));
        assertHasField(contents, 'version', '9.9.9-rc1');
        assertHasField(contents, 'name', 'test');
    });

    // Regression guards: project-root detection must work from inside node_modules
    // without the package knowing its own name or scope.
    it('finds the project root when installed as a dependency', async () => {
        const project = createConsumerProject('test-consumer');
        // cwd is deliberately not the consumer project, so only node_modules-based
        // detection can locate the package.json.
        const { stdout, stderr } = await execFileAsync(
            process.execPath, [project.entrypoint], { cwd: os.tmpdir() }
        );
        assert.strictEqual(stderr, '');
        assert.doesNotMatch(stdout, /Cannot find package.json/);

        const contents = readGeneratedFile(project.outputFile);
        assertHasField(contents, 'version', '9.9.9');
        assertHasField(contents, 'name', 'consumer-app');
    });

    it('resolves a relative --root against the consuming project', async () => {
        const project = createConsumerProject('test-consumer-relative');
        const { stdout, stderr } = await execFileAsync(
            process.execPath, [project.entrypoint, '--root=.'], { cwd: os.tmpdir() }
        );
        assert.strictEqual(stderr, '');
        assert.doesNotMatch(stdout, /Cannot find package.json/);

        const contents = readGeneratedFile(project.outputFile);
        assertHasField(contents, 'name', 'consumer-app');
    });

    it('handles a tag containing dashes', async () => {
        repo.init();
        // Pins the describe parser: the tag name itself contains the '-<n>-g<hash>'
        // separator, so a non-greedy match would truncate it.
        repo.tagLightweight('v2.0.0-rc1');
        fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
        writePackageJson(repoDir, ', "description": "test description"');

        await run(['--root=' + repoDir]);

        const contents = readGeneratedFile(path.join(repoDir, 'src', '_versions.ts'));
        assertHasField(contents, 'gitTag', 'v2.0.0-rc1');
        assert.match(contents, /gitCommitHash: 'g\w+',/);
        assert.match(contents, /gitCommitDate: '[^']+',/);
    });
});
