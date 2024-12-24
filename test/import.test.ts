import { strict as assert } from 'node:assert';
import { importResolve, importModule } from '../src/index.js';
import { getFilepath } from './helper.js';

describe('test/import.test.ts', () => {
  describe('importResolve()', () => {
    it('should work on cjs', () => {
      assert.equal(importResolve(getFilepath('cjs')), getFilepath('cjs/index.js'));
      assert.equal(importResolve(getFilepath('cjs/exports')), getFilepath('cjs/exports.js'));
    });

    it('should work on esm', () => {
      assert.equal(importResolve(getFilepath('esm')), getFilepath('esm/index.js'));
    });

    it('should work on ts-module', () => {
      assert.equal(importResolve(getFilepath('ts-module')), getFilepath('ts-module/index.ts'));
    });

    it('should work on typescript without dist', () => {
      assert.equal(importResolve(getFilepath('tshy')), getFilepath('tshy/src/index.ts'));
    });

    it('should work on typescript with dist', () => {
      assert.equal(importResolve(getFilepath('tshy-dist')), getFilepath('tshy-dist/dist2/esm/index.js'));
    });
  });

  describe('importModule()', () => {
    it('should work on cjs', async () => {
      let obj = await importModule(getFilepath('cjs'));
      if (process.version.startsWith('v23.')) {
        // support `module.exports` on Node.js >=23
        assert.deepEqual(Object.keys(obj), [ 'default', 'module.exports', 'one' ]);
      } else {
        assert.deepEqual(Object.keys(obj), [ 'default', 'one' ]);
      }
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar', one: 1 });

      obj = await importModule(getFilepath('cjs'), { importDefaultOnly: true });
      assert.deepEqual(obj, { foo: 'bar', one: 1 });

      obj = await importModule(getFilepath('cjs/exports'));
      if (process.version.startsWith('v23.')) {
        // support `module.exports` on Node.js >=23
        assert.deepEqual(Object.keys(obj), [ 'default', 'foo', 'module.exports', 'one' ]);
      } else {
        assert.deepEqual(Object.keys(obj), [ 'default', 'foo', 'one' ]);
      }
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar', one: 1 });

      obj = await importModule(getFilepath('cjs/exports.js'));
      if (process.version.startsWith('v23.')) {
        // support `module.exports` on Node.js >=23
        assert.deepEqual(Object.keys(obj), [ 'default', 'foo', 'module.exports', 'one' ]);
      } else {
        assert.deepEqual(Object.keys(obj), [ 'default', 'foo', 'one' ]);
      }
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar', one: 1 });

      obj = await importModule(getFilepath('cjs/exports.cjs'));
      if (process.version.startsWith('v23.')) {
        // support `module.exports` on Node.js >=23
        assert.deepEqual(Object.keys(obj), [ 'default', 'foo', 'module.exports', 'one' ]);
      } else {
        assert.deepEqual(Object.keys(obj), [ 'default', 'foo', 'one' ]);
      }
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar', one: 1 });

      obj = await importModule(getFilepath('cjs/es-module-default.js'));
      assert.deepEqual(Object.keys(obj), [ '__esModule', 'default' ]);
      assert.equal(obj.default.foo, 'bar');
      assert.equal(obj.default.one, 1);
      assert.equal(typeof obj.default.fn, 'function');

      obj = await importModule(getFilepath('cjs/es-module-default.js'), { importDefaultOnly: true });
      assert.deepEqual(Object.keys(obj), [ 'fn', 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);
      assert.equal(typeof obj.fn, 'function');
    });

    it('should work on esm', async () => {
      let obj = await importModule(getFilepath('esm'));
      assert.deepEqual(Object.keys(obj), [ 'default', 'one' ]);
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar' });

      obj = await importModule(getFilepath('esm'), { importDefaultOnly: true });
      assert.deepEqual(obj, { foo: 'bar' });

      obj = await importModule(getFilepath('esm/exports'));
      assert.deepEqual(Object.keys(obj), [ 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);

      obj = await importModule(getFilepath('esm/exports'), { importDefaultOnly: true });
      assert.deepEqual(Object.keys(obj), [ 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);

      obj = await importModule(getFilepath('esm/exports.js'));
      assert.deepEqual(Object.keys(obj), [ 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);

      obj = await importModule(getFilepath('esm/exports.mjs'));
      assert.deepEqual(Object.keys(obj), [ 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);
    });

    it('should work on tshy without dist', async () => {
      let obj = await importModule(getFilepath('tshy'));
      assert.deepEqual(Object.keys(obj), [
        'default',
        'one',
      ]);
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar' });

      obj = await importModule(getFilepath('tshy'), { importDefaultOnly: true });
      assert.deepEqual(obj, { foo: 'bar' });
    });

    it('should work on tshy with dist', async () => {
      const obj = await importModule(getFilepath('tshy-dist'));
      assert.equal(obj.one, 2);
    });

    it('should work on ts-module', async () => {
      let obj = await importModule(getFilepath('ts-module'));
      assert.deepEqual(Object.keys(obj), [ 'one', 'default' ]);
      assert.equal(obj.one, 1);
      assert.deepEqual(obj.default, { foo: 'bar' });

      obj = await importModule(getFilepath('ts-module'), { importDefaultOnly: true });
      assert.deepEqual(obj, { foo: 'bar' });

      obj = await importModule(getFilepath('ts-module/exports'));
      assert.deepEqual(Object.keys(obj), [ 'default' ]);
      assert.equal(obj.default.foo, 'bar');
      assert.equal(obj.default.one, 1);

      obj = await importModule(getFilepath('ts-module/exports'), { importDefaultOnly: true });
      assert.deepEqual(Object.keys(obj), [ 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);

      obj = await importModule(getFilepath('ts-module/exports.ts'), { importDefaultOnly: true });
      assert.deepEqual(Object.keys(obj), [ 'foo', 'one' ]);
      assert.equal(obj.foo, 'bar');
      assert.equal(obj.one, 1);

      obj = await importModule(getFilepath('ts-module/mod'));
      assert.deepEqual(Object.keys(obj), [ 'default' ]);
      assert.equal(typeof obj.default, 'function');

      obj = await importModule(getFilepath('ts-module/mod.ts'), {
        importDefaultOnly: true,
      });
      assert.equal(typeof obj, 'function');
    });

    it('should support module.exports = null', async () => {
      assert.equal(await importModule(getFilepath('cjs/module-exports-null.js'), {
        importDefaultOnly: true,
      }), null);
      assert.equal(await importModule(getFilepath('cjs/module-exports-null'), {
        importDefaultOnly: true,
      }), null);
      assert.equal((await importModule(getFilepath('cjs/module-exports-null'), {
        importDefaultOnly: false,
      })).default, null);
    });

    it('should support export default null', async () => {
      assert.equal(await importModule(getFilepath('esm/export-default-null.js'), {
        importDefaultOnly: true,
      }), null);
      assert.equal(await importModule(getFilepath('esm/export-default-null'), {
        importDefaultOnly: true,
      }), null);
      assert.equal((await importModule(getFilepath('esm/export-default-null.js'), {
        importDefaultOnly: false,
      })).default, null);
    });
  });
});
