import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';
import colourNames from 'color-name';

const namedColour = new RegExp(`(?<![\\w-])(?:${Object.keys(colourNames).join('|')})(?![\\w-])`, 'gi');
const decodeCss = value => value.replace(/\\([\da-f]{1,6})\s?|\\([^\n])/gi, (_, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16)) : char);

export const hash = value => createHash('sha256').update(value).digest('hex');
export const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.svg', '.html', '.json']);
export const productionRoots = ['app', 'components', 'features', 'lib', 'public', 'middleware.ts', 'middleware.js', 'instrumentation.ts', 'instrumentation.js', 'next.config.ts', 'next.config.js', 'next.config.mjs', 'postcss.config.mjs', 'tailwind.config.ts', 'tailwind.config.js'];

export function parseSource(file, text) {
  const entries = [], imports = [], hazards = [];
  const counts = new Map();
  function add(kind, value, context, offset, extra = {}) {
    const key = `${file}:${kind}:${hash(`${value}\n${context}`).slice(0, 20)}`;
    const ordinal = counts.get(key) ?? 0;
    counts.set(key, ordinal + 1);
    entries.push({ id: `${key}:${ordinal}`, file, line: text.slice(0, offset).split('\n').length, kind, value, context, ...extra });
  }
  function values(value, context, offset, extra = {}) {
    value = decodeCss(value);
    for (const m of value.matchAll(namedColour)) {
      if (!['white', 'black'].includes(m[0].toLowerCase())) add('colour', m[0], context, offset, extra);
    }
    // Input is a parsed declaration/AST literal, never comments or arbitrary source text.
    for (const m of value.matchAll(/(?<![\w-])--[a-zA-Z][\w-]*/g)) add('reference', m[0], context, offset, extra);
    // Tailwind arbitrary values separate CSS terms with underscores (a word
    // character), so a word boundary would miss shadow/gradient colour calls.
    for (const m of value.matchAll(/#[\da-fA-F]{3,8}(?![\da-fA-F])|(?<![a-zA-Z])(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|\b(?:white|black|transparent|currentColor)\b|(?:bg|text|border|ring|fill|stroke|outline|from|via|to|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?/g)) {
      add('colour', m[0], context, offset, extra);
    }
  }
  if (file.endsWith('.css')) {
    const root = postcss.parse(text, { from: file });
    root.walkAtRules('import', rule => imports.push(rule.params.replace(/^(?:url\()?['"]([^'"]+)['"].*$/, '$1')));
    root.walkDecls(decl => {
      const ancestors = [];
      for (let p = decl.parent; p && p.type !== 'root'; p = p.parent) ancestors.unshift(p.type === 'rule' ? p.selector : `@${p.name} ${p.params}`);
      const scope = ancestors.join(' > ');
      const context = `${scope} | ${decl.prop}: ${decl.value}`;
      const offset = decl.source.start.offset;
      if (decl.prop.startsWith('--')) add('definition', decodeCss(decl.prop), context, offset, { expression: decodeCss(decl.value), scope });
      values(decl.value, context, offset, { definition: decl.prop.startsWith('--') ? decl.prop : null, scope });
    });
    return { entries, imports, hazards };
  }
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') || /\.(svg|html)$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS);
  const literal = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  function contextOf(node) {
    const owner = [];
    for (let p = node.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isJsxAttribute(p)) && p.name) owner.unshift(p.name.getText(ast));
      if (ts.isJsxElement(p)) owner.push(p.openingElement.tagName.getText(ast));
      if (ts.isJsxSelfClosingElement(p)) owner.push(p.tagName.getText(ast));
    }
    return `${owner.join('/')} | ${node.getText(ast)}`;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && literal(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast);
      if (/\.style\[|\[['"](?:setProperty|insertRule|replaceSync)['"]\]|\.setAttribute$/.test(name) && (!name.endsWith('.setAttribute') || node.arguments[0]?.text === 'style')) hazards.push({ file, reason: 'computed CSSOM/style attribute write', source: node.getText(ast) });
      if (name === 'require' || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments[0] && literal(node.arguments[0])) imports.push(node.arguments[0].text);
        else hazards.push({ file, line: ast.getLineAndCharacterOfPosition(node.pos).line + 1, reason: 'dynamic import', source: node.getText(ast) });
      }
      if (/(?:setProperty|getPropertyValue|insertRule|replaceSync|addRule|createElement)$/.test(name) && (name.includes('Property') || !node.arguments[0] || !literal(node.arguments[0]) || node.arguments[0].text === 'style' || name !== 'document.createElement')) {
        if (!name.endsWith('createElement') || node.arguments[0]?.text === 'style') hazards.push({ file, line: ast.getLineAndCharacterOfPosition(node.pos).line + 1, reason: 'CSSOM requires an exact reviewed contract', source: node.getText(ast) });
      }
    }
    if (ts.isBinaryExpression(node) && /(?:cssText|\.style\[)/.test(node.left.getText(ast))) hazards.push({ file, reason: 'dynamic style assignment', source: node.getText(ast) });
    // Complete class/role literals in conditional branches are enumerated by the AST.
    // Interpolation *inside* a custom-property name or colour function is unresolved.
    if (ts.isTemplateExpression(node) && [node.head.text, ...node.templateSpans.slice(0, -1).map(s => s.literal.text)].some(part => /(?<![\w-])--[\w-]*$|(?:var|rgba?|hsla?|oklch)\([^)]*$/.test(part))) hazards.push({ file, reason: 'dynamic theme template', source: node.getText(ast) });
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && /['"`]--|var\(|(?:rgb|hsl|oklch)\(/.test(node.getText(ast))) hazards.push({ file, reason: 'constructed theme string', source: node.getText(ast) });
    if (literal(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const value = node.text;
      const context = contextOf(node);
      const parent = node.parent;
      const isFont = ts.isPropertyAssignment(parent) && parent.name.getText(ast) === 'variable' && /^--/.test(value);
      const isCustomProperty = ts.isPropertyAssignment(parent) && parent.name === node && /^--/.test(value);
      if (isFont || isCustomProperty) add('definition', value, context, node.getStart(ast), { expression: isFont ? 'next/font/local' : parent.initializer.getText(ast), scope: isFont ? 'next/font/local' : 'inline' });
      else values(value, context, node.getStart(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { entries, imports, hazards };
}

export function scanProduction(root) {
  const files = new Map(), entries = [], imports = [], hazards = [];
  function scan(file) {
    if (files.has(file)) return;
    const absolute = path.join(root, file);
    const text = readFileSync(absolute, 'utf8');
    files.set(file, hash(text));
    const parsed = parseSource(file, text);
    entries.push(...parsed.entries); hazards.push(...parsed.hazards);
    for (const specifier of parsed.imports) {
      const local = specifier.startsWith('.') || specifier.startsWith('@/');
      if (!local) { imports.push({ from: file, specifier, kind: 'package' }); continue; }
      const base = specifier.startsWith('@/') ? specifier.slice(2) : path.normalize(path.join(path.dirname(file), specifier));
      const target = [base, ...[...sourceExtensions].map(ext => base + ext), ...[...sourceExtensions].map(ext => `${base}/index${ext}`)].find(p => existsSync(path.join(root, p)) && !readdirIsDirectory(path.join(root, p)));
      if (!target || target.startsWith('..') || /^(tests|scripts|docs|node_modules)\//.test(target)) {
        hazards.push({ file, reason: 'unresolved or non-production local import', source: specifier });
      } else {
        imports.push({ from: file, specifier, target, kind: 'local' });
        if (sourceExtensions.has(path.extname(target))) scan(target);
        else files.set(target, hash(readFileSync(path.join(root, target))));
      }
    }
  }
  function walk(dir) {
    if (!existsSync(path.join(root, dir))) return;
    if (!readdirIsDirectory(path.join(root, dir))) { scan(dir); return; }
    for (const item of readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${dir}/${item.name}`;
      if (item.isSymbolicLink()) throw new Error(`Unreviewed production symlink: ${file}`);
      if (item.isDirectory()) walk(file);
      else if (sourceExtensions.has(path.extname(file))) scan(file);
      else files.set(file, hash(readFileSync(path.join(root, file))));
    }
  }
  productionRoots.forEach(walk);
  return { files: Object.fromEntries([...files].sort()), entries, imports, hazards };
}

function readdirIsDirectory(file) {
  try { readdirSync(file); return true; } catch { return false; }
}
