'use strict';

/**
 * Derived from the test helper shipped with git-describe.
 * (C) Tim van der Staaij. Released under the MIT license.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

/**
 * Drives a real git binary against a throwaway repository, so the tests exercise
 * the same code path a consumer would.
 */
class TestRepo {
    constructor(dir) {
        this._dir = path.normalize(dir);
        this._dataCount = 0;
        this._commitCount = 0;
        this._dataFile = path.join(this._dir, 'count');
    }

    _git(...args) {
        return execFileSync('git', args, { cwd: this._dir });
    }

    /** Reset to an empty directory. Refuses to touch anything outside the tmp directory. */
    clean() {
        if (!this._dir.startsWith(os.tmpdir())) {
            throw new Error('Refusing to remove a directory outside ' + os.tmpdir());
        }
        fs.rmSync(this._dir, { recursive: true, force: true });
        fs.mkdirSync(this._dir, { recursive: true });
    }

    init() {
        this.clean();
        this._git('init');
        this._git('config', 'core.autocrlf', 'false');
        this._git('config', 'user.name', 'Test');
        this._git('config', 'user.email', 'test@example.org');
        this.changeData();
        this.commit();
    }

    changeData() {
        fs.writeFileSync(this._dataFile, String(++this._dataCount));
    }

    commit() {
        this._git('add', this._dataFile);
        this._git('commit', '--message', 'Commit #' + String(++this._commitCount));
    }

    tagLightweight(name) {
        this._git('tag', name);
    }
}

module.exports = TestRepo;
