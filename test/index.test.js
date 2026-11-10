/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import assert from 'assert';
import { readFile } from 'fs/promises';
import { micromark } from 'micromark';
import { gridTables, gridTablesHtml } from '../src/index.js';

async function testMD(spec) {
  const expected = await readFile(new URL(`./fixtures/${spec}.html`, import.meta.url), 'utf-8');
  const source = await readFile(new URL(`./fixtures/${spec}.md`, import.meta.url), 'utf-8');

  const actual = micromark(source, {
    extensions: [gridTables],
    htmlExtensions: [gridTablesHtml],
  });

  assert.strictEqual(actual.trim(), expected.trim());
}

describe('Micromark Extension Tests', () => {
  it('table with spans', async () => {
    await testMD('gt-spans');
  });

  it('table with align', async () => {
    await testMD('gt-with-align');
  });

  it('large table', async () => {
    await testMD('gt-large');
  });

  it('table with references', async () => {
    // note that this one is not correct yet, as the inner micromark parse doesn't know about
    // the outer definitions
    await testMD('gt-with-references');
  });

  it('tables in tables', async () => {
    await testMD('gt-tables-in-tables');
  });

  it('nested column boundaries aligned with outer columns', async () => {
    await testMD('gt-nested-column-boundary');
  });

  it('nested left border aligned with an outer column', async () => {
    await testMD('gt-nested-left-boundary');
  });

  it('nested rowspan with a partial divider', async () => {
    await testMD('gt-nested-rowspan');
  });

  it('side-by-side nested tables keep independent boundaries', () => {
    const actual = micromark([
      '+-----+-----+-----+-----+',
      '| a   | b   | c   | d   |',
      '+-----+-----+-----+-----+',
      '| +---+---+ | +---+---+ |',
      '| | e | f | | | g | h | |',
      '| +---+---+ | +---+---+ |',
      '+-----------+-----------+',
    ].join('\n'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 3);
    assert.strictEqual((actual.match(/<td colspan="2">/g) || []).length, 2);
    assert.match(actual, /<td>e<\/td>\s*<td>f<\/td>/);
    assert.match(actual, /<td>g<\/td>\s*<td>h<\/td>/);
  });

  it('consecutive nested tables in one cell can have different widths', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-column-boundary.md', import.meta.url), 'utf-8');
    const actual = micromark(source.replace('+-----------+', [
      '|           |',
      '| +-----+   |',
      '| | g   |   |',
      '| +-----+   |',
      '+-----------+',
    ].join('\n')), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 3);
    assert.match(actual, /<td>c<\/td>\s*<td>d<\/td>/);
    assert.match(actual, /<td>g<\/td>/);
  });

  it('column collisions are handled at each of three nesting levels', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-column-boundary.md', import.meta.url), 'utf-8');
    const actual = micromark([
      '+-------+-------+',
      '| e     | f     |',
      '+-------+-------+',
      ...source.trimEnd().split('\n').map((line) => `| ${line} |`),
      '+---------------+',
    ].join('\n'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 3);
    assert.match(actual, /<td>a<\/td>\s*<td>b<\/td>/);
    assert.match(actual, /<td>c<\/td>\s*<td>d<\/td>/);
    assert.match(actual, /<td>e<\/td>\s*<td>f<\/td>/);
  });

  it('eight nesting levels preserve content aligned with ancestor column markers', async () => {
    // Ancestor dividers align with literal and escaped '+'/'|' in the deepest cell.
    await testMD('gt-deep-nested-column-boundaries');
  });

  it('a neighboring outer row divider does not clear a nested table continuation', () => {
    const actual = micromark([
      '+-----+-----+---+',
      '| a   | b   | c |',
      '+-----+-----+---+',
      '| +---+---+ | d |',
      '| | e | f | +---+',
      '| +---+---+ | g |',
      '+-----------+---+',
    ].join('\n'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 2);
    assert.match(actual, /<td colspan="2" rowspan="2">/);
    assert.match(actual, /<td>e<\/td>\s*<td>f<\/td>/);
    assert.match(actual, /<td>d<\/td>/);
    assert.match(actual, /<td>g<\/td>/);
  });

  it('table-shaped content in a fenced code block stays literal', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-column-boundary.md', import.meta.url), 'utf-8');
    const lines = source.trimEnd().split('\n');
    lines.splice(6, 0, '| ```       |');
    lines.splice(3, 0, '| ```       |');
    const actual = micromark(lines.join('\n'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 1);
    assert.match(actual, /<pre><code>\+---\+---\+\n\| c \| d \|\n\+---\+---\+\n<\/code><\/pre>/);
  });

  it('nested partial dividers can start with a plus and end with a pipe', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-rowspan.md', import.meta.url), 'utf-8');
    const actual = micromark(source
      .replace('| |   +---+ |', '| +---+   | |')
      .replace('| |   | e | |', '| | e |   | |'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 2);
    assert.match(actual, /<td rowspan="2">d<\/td>/);
    assert.match(actual, /<td>e<\/td>/);
  });

  it('nested rowspans also work when the left border aligns with an outer column', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-left-boundary.md', import.meta.url), 'utf-8');
    const actual = micromark(source.replace('|   | c | d | |', [
      '|   | c | d | |',
      '|   |   +---+ |',
      '|   |   | e | |',
    ].join('\n')), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 2);
    assert.match(actual, /<td rowspan="2">c<\/td>/);
    assert.match(actual, /<td>e<\/td>/);
  });

  it('aligned nested borders preserve alignment and section markers', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-left-boundary.md', import.meta.url), 'utf-8');
    for (const border of ['+:--+--:+', '+:-:+>-<+', '+-^-+-v-+', '+-x-+---+', '+===+===+']) {
      const actual = micromark(source.replaceAll('+---+---+', border), {
        extensions: [gridTables],
        htmlExtensions: [gridTablesHtml],
      });
      assert.strictEqual((actual.match(/<table>/g) || []).length, 2, border);
      assert.match(actual, />c<\/t[dh]>/);
      assert.match(actual, />d<\/t[dh]>/);
    }
  });

  it('partial outer dividers are not mistaken for an aligned nested table', () => {
    const actual = micromark([
      '+---+---+---+---+',
      '| a | b | c | d |',
      '|   +---+---+   |',
      '|   | e | f |   |',
      '+---+---+---+---+',
    ].join('\n'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 1);
    assert.match(actual, /<td rowspan="2">a<\/td>/);
    assert.match(actual, /<td rowspan="2">d<\/td>/);
    assert.match(actual, /<td>e<\/td>\s*<td>f<\/td>/);
  });

  it('incomplete aligned grids fall back without swallowing outer content', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-left-boundary.md', import.meta.url), 'utf-8');
    const opening = source.split('\n').slice(0, 4).join('\n');
    for (const [suffix, expectedTables] of [
      ['', 1],
      ['\n|', 0],
      ['\n\nAfter.', 1],
      ['\n|   text      |\n+-------------+', 1],
      ['\n|   | c | d   |\n+-------------+', 1],
      ['\n|   | c', 0],
      ['\n|   | c\n+-------------+', 0],
      ['\nAfter.', 1],
    ]) {
      const markdown = opening + suffix;
      const actual = micromark(markdown, {
        extensions: [gridTables],
        htmlExtensions: [gridTablesHtml],
      });
      assert.strictEqual((actual.match(/<table>/g) || []).length, expectedTables, suffix);
      if (expectedTables === 0) {
        assert.strictEqual(actual, micromark(markdown));
      } else {
        assert.match(actual, /<td>a<\/td>\s*<td[^>]*>b<\/td>/);
      }
      if (suffix.includes('After.')) {
        assert.match(actual, /<p>After\.<\/p>/);
      }
    }
  });

  it('aligned nested lookalikes cannot change their enclosing cell boundary', () => {
    const actual = micromark([
      '+---+---------+---+',
      '| a | b       | c |',
      '+---+---------+---+',
      '|   +---+---+ | d |',
      '|   | e | f |     |',
      '+-----------------+',
    ].join('\n'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 1);
    assert.match(actual, /<td>e<\/td>\s*<td>f<\/td>/);
  });

  it('literal pipe text following a nested table remains in the parent cell', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-column-boundary.md', import.meta.url), 'utf-8');
    const actual = micromark(source.replace('+-----------+', '|           |\n| | text    |\n+-----------+'), {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.strictEqual((actual.match(/<table>/g) || []).length, 2);
    assert.match(actual, /<\/table>\s*<p>\| text<\/p>/);
  });

  it('a literal grid fragment does not hide an outer cell boundary', () => {
    const actual = micromark('+-----+-----+\n| +---+ x   |\n+-----+-----+', {
      extensions: [gridTables],
      htmlExtensions: [gridTablesHtml],
    });
    assert.match(actual, /<td>\+---<\/td>\s*<td>x<\/td>/);
  });

  it('malformed nested continuations fall back to ordinary outer cells', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-column-boundary.md', import.meta.url), 'utf-8');
    for (const [row, expectedCells] of [
      ['| | text    |', /\| text<\/td>/],
      ['| | c | d |x|', /\| c<\/td>\s*<td>d \|x<\/td>/],
    ]) {
      const actual = micromark(source.replace('+-----------+\n', `${row}\n+-----------+\n`), {
        extensions: [gridTables],
        htmlExtensions: [gridTablesHtml],
      });
      assert.strictEqual((actual.match(/<table>/g) || []).length, 1);
      assert.match(actual, expectedCells);
    }
  });

  it('unterminated nested rows do not consume line endings or EOF', async () => {
    const source = await readFile(new URL('./fixtures/gt-nested-column-boundary.md', import.meta.url), 'utf-8');
    for (const ending of ['', '\n']) {
      const actual = micromark(source.replace('+-----------+\n', `| |${ending}`), {
        extensions: [gridTables],
        htmlExtensions: [gridTablesHtml],
      });
      assert.doesNotMatch(actual, /<table>/);
      assert.match(actual, /\| \|/);
    }
  });

  it('test no tables', async () => {
    await testMD('gt-no-tables');
  });

  it('test wrong tables', async () => {
    await testMD('gt-double-divider');
  });

  it('simple table', async () => {
    await testMD('gt-simple');
  });

  it('single-cell table', async () => {
    await testMD('gt-single-cell');
  });

  it('footer no header table', async () => {
    await testMD('gt-footer-no-header');
  });

  it('header no footer table', async () => {
    await testMD('gt-header-no-footer');
  });

  it('table with divider in content', async () => {
    await testMD('gt-divider-in-content');
  });

  it('text with breaks', async () => {
    await testMD('gt-with-breaks');
  });

  it('text with lonely breaks', async () => {
    await testMD('gt-with-lonely-breaks');
  });

  it('many refs', async () => {
    await testMD('gt-many-refs');
  });

  it('table in list', async () => {
    await testMD('gt-table-in-list');
  });

  it('table after list item starting with plus', async () => {
    await testMD('gt-table-after-plus-list-item');
  });
});
