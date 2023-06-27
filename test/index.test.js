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

/* eslint-env mocha */
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

  it('many refs', async () => {
    await testMD('gt-many-refs');
  });
});
