#!/usr/bin/env node
/**
 * Valida o GLSL das três cenas.
 * Sem navegador headless neste ambiente, um erro de sintaxe em shader só
 * apareceria como tela preta no browser do usuário. Este script faz o parse de
 * todas as strings glsl com um parser real e checa includes/uniforms/varyings.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parser } from '@shaderfrog/glsl-parser';

const ROOTS = ['src/scenes/01-terra','src/scenes/02-cogumelo','src/scenes/03-mao-boca','src/scenes/_shared'];

const THREE_PRELUDE = `
precision highp float;
vec4 gl_Position;
float gl_PointSize;
vec4 gl_FragColor;
vec2 gl_PointCoord;
vec4 gl_FragCoord;
bool gl_FrontFacing;
int gl_VertexID;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
vec4 linearToOutputTexel(vec4 value) { return value; }
`;

const OK_INCLUDES = new Set(['colorspace_fragment','tonemapping_fragment','fog_fragment','common','packing','dithering_pars_fragment']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Expande os placeholders de snippet usando os consts glsl do mesmo arquivo */
function expandSnippets(code, src) {
  return code.replace(/\$\{(\w+)\}/g, (whole, name) => {
    const re = new RegExp('const\\s+' + name + '\\s*=\\s*(?:/\\*[\\s\\S]*?\\*/\\s*)?`([\\s\\S]*?)`');
    const m = src.match(re);
    return m ? m[1] : whole;
  });
}

function extractShaders(src, file) {
  const shaders = [];
  const marked = /\/\*\s*glsl\s*\*\/\s*`([\s\S]*?)`/g;
  let m;
  while ((m = marked.exec(src))) shaders.push({ code: m[1], file, idx: m.index });
  if (shaders.length === 0) {
    const plain = /const\s+(\w*(?:VERT|FRAG))\s*=\s*(?:\/\*[\s\S]*?\*\/\s*)?`([\s\S]*?)`/g;
    while ((m = plain.exec(src))) shaders.push({ code: m[2], file, idx: m.index, name: m[1] });
  }
  return shaders;
}

const failures = [];
let checked = 0;

for (const root of ROOTS) {
  let files = [];
  try { files = walk(root); } catch { failures.push(`diretório ausente: ${root}`); continue; }
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const shader of extractShaders(src, file)) {
      checked++;
      const label = `${file}${shader.name ? ':' + shader.name : '@' + shader.idx}`;
      const body = expandSnippets(shader.code, src).replace(/#include\s*<[^>]+>/g, '');

      for (const inc of shader.code.matchAll(/#include\s*<([^>]+)>/g)) {
        if (!OK_INCLUDES.has(inc[1])) failures.push(`${label}: #include <${inc[1]}> desconhecido`);
      }

      const isVert = /gl_Position|gl_PointSize/.test(body);
      try {
        parser.parse((isVert ? '' : 'precision highp float;\n') + body, { failOnWarn: true });
      } catch {
        try {
          parser.parse(THREE_PRELUDE + '\n' + (isVert ? '' : 'precision highp float;\n') + body, { failOnWarn: true });
        } catch (err2) {
          failures.push(`${label}: ${String(err2.message).split('\n')[0]}`);
        }
      }

      // uniform declarado no GLSL precisa ser fornecido em algum lugar do arquivo
      for (const u of [...body.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((x) => x[1])) {
        if (!/\bunused\b/.test(u) && !new RegExp('\\b' + u + '\\b').test(src)) {
          failures.push(`${label}: uniform ${u} nunca fornecido`);
        }
      }
    }
  }
}

// uniforms fornecidos no JS precisam existir no GLSL (pega typo silencioso)
for (const file of walk('src/scenes').filter((f) => /mushroom\.ts$/.test(f))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^\s{6,}(u[A-Z]\w*):\s*\{\s*value/gm)) {
    const n = [...src.matchAll(new RegExp('\\b' + m[1] + '\\b', 'g'))].length;
    if (n < 2) failures.push(`${file}: uniform ${m[1]} fornecido mas nunca usado no GLSL`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problema(s) em ${checked} shader(s):\n`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log(`${checked}/${checked} shaders OK (sintaxe, includes, uniforms, varyings)`);
