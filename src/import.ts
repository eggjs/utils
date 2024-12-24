import { debuglog } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
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
const nodeMajorVersion = parseInt(process.versions.node.split('.', 1)[0], 10);
const supportImportMetaResolve = nodeMajorVersion >= 18;

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

function tryToResolveFromFile(filepath: string): string | undefined {
  // "type": "module", try index.mjs then index.js
  const type = isESM ? 'module' : 'commonjs';
  let mainIndexFile = '';
  if (type === 'module') {
    mainIndexFile = filepath + '.mjs';
    if (fs.existsSync(mainIndexFile)) {
      debug('[tryToResolveFromFile] %o, use index.mjs, type: %o', mainIndexFile, type);
      return mainIndexFile;
    }
    mainIndexFile = filepath + '.js';
    if (fs.existsSync(mainIndexFile)) {
      debug('[tryToResolveFromFile] %o, use index.js, type: %o', mainIndexFile, type);
      return mainIndexFile;
    }
  } else {
    // "type": "commonjs", try index.js then index.cjs
    mainIndexFile = filepath + '.cjs';
    if (fs.existsSync(mainIndexFile)) {
      debug('[tryToResolveFromFile] %o, use index.cjs, type: %o', mainIndexFile, type);
      return mainIndexFile;
    }
    mainIndexFile = filepath + '.js';
    if (fs.existsSync(mainIndexFile)) {
      debug('[tryToResolveFromFile] %o, use index.js, type: %o', mainIndexFile, type);
      return mainIndexFile;
    }
  }

  if (!isSupportTypeScript()) {
    return;
  }

  // for the module under development
  mainIndexFile = filepath + '.ts';
  if (fs.existsSync(mainIndexFile)) {
    debug('[tryToResolveFromFile] %o, use index.ts, type: %o', mainIndexFile, type);
    return mainIndexFile;
  }
}

function tryToResolveByDirnameFromPackage(dirname: string, pkg: any): string | undefined {
  // try to read pkg.main or pkg.module first
  // "main": "./dist/commonjs/index.js",
  // "module": "./dist/esm/index.js"
  const defaultMainFile = isESM ? pkg.module ?? pkg.main : pkg.main;
  if (defaultMainFile) {
    const mainIndexFilePath = path.join(dirname, defaultMainFile);
    if (fs.existsSync(mainIndexFilePath)) {
      debug('[tryToResolveByDirnameFromPackage] %o, use pkg.main or pkg.module: %o, isESM: %s',
        mainIndexFilePath, defaultMainFile, isESM);
      return mainIndexFilePath;
    }
  }

  // "type": "module", try index.mjs then index.js
  const type = pkg?.type ?? (isESM ? 'module' : 'commonjs');
  if (type === 'module') {
    const mainIndexFilePath = path.join(dirname, 'index.mjs');
    if (fs.existsSync(mainIndexFilePath)) {
      debug('[tryToResolveByDirnameFromPackage] %o, use index.mjs, pkg.type: %o', mainIndexFilePath, type);
      return mainIndexFilePath;
    }
    const mainIndexMjsFilePath = path.join(dirname, 'index.js');
    if (fs.existsSync(mainIndexMjsFilePath)) {
      debug('[tryToResolveByDirnameFromPackage] %o, use index.js, pkg.type: %o', mainIndexMjsFilePath, type);
      return mainIndexMjsFilePath;
    }
  } else {
    // "type": "commonjs", try index.cjs then index.js
    const mainIndexFilePath = path.join(dirname, 'index.cjs');
    if (fs.existsSync(mainIndexFilePath)) {
      debug('[tryToResolveByDirnameFromPackage] %o, use index.cjs, pkg.type: %o', mainIndexFilePath, type);
      return mainIndexFilePath;
    }
    const mainIndexCjsFilePath = path.join(dirname, 'index.js');
    if (fs.existsSync(mainIndexCjsFilePath)) {
      debug('[tryToResolveByDirnameFromPackage] %o, use index.js, pkg.type: %o', mainIndexCjsFilePath, type);
      return mainIndexCjsFilePath;
    }
  }

  if (!isSupportTypeScript()) {
    return;
  }

  // for the module under development
  // "tshy": {
  //   "exports": {
  //     "./package.json": "./package.json",
  //     ".": "./src/index.ts"
  //   }
  // }
  const mainIndexFile = pkg.tshy?.exports?.['.'] ?? 'index.ts';
  const mainIndexFilePath = path.join(dirname, mainIndexFile);
  if (fs.existsSync(mainIndexFilePath)) {
    return mainIndexFilePath;
  }
}

function tryToResolveByDirname(dirname: string): string | undefined {
  const pkgFile = path.join(dirname, 'package.json');
  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
    return tryToResolveByDirnameFromPackage(dirname, pkg);
  }
}

export function importResolve(filepath: string, options?: ImportResolveOptions) {
  let moduleFilePath: string | undefined;
  if (path.isAbsolute(filepath)) {
    const stat = fs.statSync(filepath, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      moduleFilePath = tryToResolveByDirname(filepath);
      if (moduleFilePath) {
        debug('[importResolve] %o => %o', filepath, moduleFilePath);
        return moduleFilePath;
      }
    }
    if (!stat) {
      moduleFilePath = tryToResolveFromFile(filepath);
      if (moduleFilePath) {
        debug('[importResolve] %o => %o', filepath, moduleFilePath);
        return moduleFilePath;
      }
    }
  }

  if (isESM) {
    if (supportImportMetaResolve) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      moduleFilePath = fileURLToPath(import.meta.resolve(filepath));
    } else {
      moduleFilePath = getRequire().resolve(filepath);
    }
  } else {
    const cwd = process.cwd();
    const paths = options?.paths ?? [ cwd ];
    moduleFilePath = require.resolve(filepath, {
      paths,
    });
  }
  debug('[importResolve] %o, options: %o => %o', filepath, options, moduleFilePath);
  return moduleFilePath;
}

export async function importModule(filepath: string, options?: ImportModuleOptions) {
  const moduleFilePath = importResolve(filepath, options);
  let obj: any;
  if (isESM) {
    // esm
    const fileUrl = pathToFileURL(moduleFilePath).toString();
    debug('[importModule] await import start: %o', fileUrl);
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
  } else {
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
  }
  debug('[importModule] return %o => %o', filepath, obj);
  return obj;
}
