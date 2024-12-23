import { debuglog } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const debug = debuglog('@eggjs/utils/import');

export interface ImportResolveOptions {
  paths?: string[];
}

export interface ImportModuleOptions extends ImportResolveOptions {
  // only import export default object
  importDefaultOnly?: boolean;
}

const isESM = typeof require === 'undefined';

let _customRequire: NodeRequire;
function getRequire() {
  if (!_customRequire) {
    if (typeof require !== 'undefined') {
      _customRequire = require;
    } else {
      _customRequire = createRequire(process.cwd());
    }
  }
  return _customRequire;
}

let _supportTypeScript: boolean | undefined;
function isSupportTypeScript() {
  if (_supportTypeScript === undefined) {
    const extensions = getRequire().extensions;
    _supportTypeScript = extensions['.ts'] !== undefined;
    debug('[isSupportTypeScript] %o, extensions: %j', _supportTypeScript, Object.keys(extensions));
  }
  return _supportTypeScript;
}

function tryToGetTypeScriptMainFile(pkg: any, baseDir: string): string | undefined {
  // try to read pkg.main or pkg.module first
  // "main": "./dist/commonjs/index.js",
  // "module": "./dist/esm/index.js"
  const defaultMainFile = isESM ? pkg.module ?? pkg.main : pkg.main;
  if (defaultMainFile) {
    const mainIndexFilePath = path.join(baseDir, defaultMainFile);
    if (fs.existsSync(mainIndexFilePath)) {
      debug('[tryToGetTypeScriptMainFile] %o, use pkg.main or pkg.module: %o, isESM: %s',
        mainIndexFilePath, defaultMainFile, isESM);
      return;
    }
  }

  // "tshy": {
  //   "exports": {
  //     "./package.json": "./package.json",
  //     ".": "./src/index.ts"
  //   }
  // }
  const mainIndexFile = pkg.tshy?.exports?.['.'];
  if (mainIndexFile) {
    const mainIndexFilePath = path.join(baseDir, mainIndexFile);
    if (fs.existsSync(mainIndexFilePath)) {
      return mainIndexFilePath;
    }
  }
}

export function importResolve(filepath: string, options?: ImportResolveOptions) {
  // support typescript import on absolute path
  if (path.isAbsolute(filepath) && isSupportTypeScript()) {
    const pkgFile = path.join(filepath, 'package.json');
    if (fs.existsSync(pkgFile)) {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
      const mainFile = tryToGetTypeScriptMainFile(pkg, filepath);
      if (mainFile) {
        debug('[importResolve] %o, use typescript main file: %o', filepath, mainFile);
        return mainFile;
      }
    }
  }
  const cwd = process.cwd();
  const paths = options?.paths ?? [ cwd ];
  const moduleFilePath = getRequire().resolve(filepath, {
    paths,
  });
  debug('[importResolve] %o, options: %o => %o', filepath, options, moduleFilePath);
  return moduleFilePath;
}

export async function importModule(filepath: string, options?: ImportModuleOptions) {
  const moduleFilePath = importResolve(filepath, options);
  let obj: any;
  if (typeof require === 'function') {
    // commonjs
    obj = require(moduleFilePath);
    debug('[importModule] require %o => %o', filepath, obj);
    if (obj?.__esModule === true && 'default' in obj) {
      // 兼容 cjs 模拟 esm 的导出格式
      // {
      //   __esModule: true,
      //   default: { fn: [Function: fn], foo: 'bar', one: 1 }
      // }
      obj = obj.default;
    }
  } else {
    // esm
    debug('[importModule] await import start: %o', filepath);
    const fileUrl = pathToFileURL(moduleFilePath).toString();
    obj = await import(fileUrl);
    debug('[importModule] await import end: %o => %o', filepath, obj);
    // {
    //   default: { foo: 'bar', one: 1 },
    //   foo: 'bar',
    //   one: 1,
    //   [Symbol(Symbol.toStringTag)]: 'Module'
    // }
    if (obj?.default?.__esModule === true && 'default' in obj?.default) {
      // 兼容 cjs 模拟 esm 的导出格式
      // {
      //   __esModule: true,
      //   default: {
      //     __esModule: true,
      //     default: {
      //       fn: [Function: fn] { [length]: 0, [name]: 'fn' },
      //       foo: 'bar',
      //       one: 1
      //     }
      //   },
      //   [Symbol(Symbol.toStringTag)]: 'Module'
      // }
      // 兼容 ts module
      // {
      //   default: {
      //     [__esModule]: true,
      //     default: <ref *1> [Function: default_1] {
      //       [length]: 0,
      //       [name]: 'default_1',
      //       [prototype]: { [constructor]: [Circular *1] }
      //     }
      //   },
      //   [Symbol(Symbol.toStringTag)]: 'Module'
      // }
      obj = obj.default;
    }
    if (options?.importDefaultOnly) {
      if ('default' in obj) {
        obj = obj.default;
      }
    }
  }
  debug('[importModule] return %o => %o', filepath, obj);
  return obj;
}
