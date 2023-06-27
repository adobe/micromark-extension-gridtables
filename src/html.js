/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable no-underscore-dangle */
import { micromark } from 'micromark';
import {
  TYPE_BODY, TYPE_CELL, TYPE_HEADER, TYPE_FOOTER, TYPE_TABLE, TYPE_ROW_LINE, TYPE_GRID_DIVIDER,
} from './types.js';

/**
 * @typedef {import('micromark-util-types').HtmlExtension} HtmlExtension
 * @typedef {import('./syntax.js').Align} Align
 */

function multiline(lines) {
  // remove empty trailing lines
  while (lines.length > 0 && lines[lines.length - 1].match(/^\s*$/)) {
    lines.pop();
  }

  // calculate common indent
  const prefixLen = lines
    .filter((line) => !line.match(/^\s*$/))
    .map((line) => line.match(/^ */)[0].length)
    .reduce((min, len) => Math.min(len, min), Infinity);

  // remove prefix
  return lines
    .map((line) => line.substring(prefixLen).trimEnd());
}

function getColSpan(info, token) {
  const i0 = info.cols.indexOf(token._colStart);
  const i1 = info.cols.indexOf(token._colEnd);
  return i1 - i0;
}

function enterTable(token) {
  this.lineEndingIfNeeded();
  this.tag('<table>');
  this.buffer();
  this.setData('tableInfo', {
    // the column positions of the table
    cols: token._cols,
    // the current column
    colPos: 0,
    // list of all cells
    allCells: [],
    // cells that are still open via rowSpan
    pendingCells: [],
    // the current cells of a row
    cells: [],
    // the grid dividers use for align the cells
    dividers: [],
    // the link/image reference definitions
    definitions: token._definitions,
    // the tables rows
    rows: [],
    // the current section type (header, body, footer)
    type: 'tbody',
  });
}

/**
 * Extension that unescapes pipes and plusses in inine and block code
 * @type HtmlExtension
 */
const unescapeCodeExtension = {
  exit: {
    codeTextData(token) {
      let value = this.sliceSerialize(token);
      value = value.replace(/\\([+|])/gm, '$1');
      this.raw(this.encode(value));
    },
    codeFlowValue(token) {
      unescapeCodeExtension.exit.codeTextData.call(this, token);
      this.setData('flowCodeSeenData', true);
    },
  },
};

function exitTable() {
  // render cells
  this.resume();
  const info = this.getData('tableInfo');
  for (const cell of info.allCells) {
    const sanitizedLines = multiline(cell.lines);

    // add the definitions from the main document maybe they could be injected dynamically...
    const definitions = this.getData('definitions');
    if (definitions) {
      for (const def of Object.values(definitions)) {
        const key = `[${def.labelId}]`;
        if (sanitizedLines.find((line) => line.indexOf(key) >= 0)) {
          const title = def.title ? ` ${JSON.stringify(def.title)}` : '';
          sanitizedLines.push('');
          sanitizedLines.push(`${key}: ${def.destination}${title}`);
        }
      }
    }
    const cellContent = sanitizedLines.join('\n');

    // add extension to unescape pipes and plusses since the content is considered in a table
    let { htmlExtensions } = this.options;
    if (htmlExtensions.indexOf(unescapeCodeExtension) < 0) {
      htmlExtensions = [
        ...this.options.htmlExtensions,
        unescapeCodeExtension,
      ];
    }

    let html = micromark(cellContent, {
      ...this.options,
      htmlExtensions,
    }).trim();

    // remove surrounding <p> if it's the only one
    const first = html.lastIndexOf('<p>');
    const last = html.indexOf('</p>');
    if (first === 0 && last === html.length - 4) {
      html = html.substring(3, last);
    }
    cell.html = html;
  }
  let type = '';
  let indent = 4;
  for (const row of info.rows) {
    if (type !== row.type) {
      if (type) {
        indent -= 4;
        this.lineEndingIfNeeded();
        this.raw(' '.repeat(indent));
        this.tag(`</${type}>`);
      }
      type = row.type;
      this.lineEndingIfNeeded();
      this.raw(' '.repeat(indent));
      this.tag(`<${type}>`);
      indent += 4;
    }
    this.lineEndingIfNeeded();
    this.raw(' '.repeat(indent));
    this.tag('<tr>');
    indent += 4;
    const tag = row.type === 'thead' ? 'th' : 'td';
    for (const cell of row.cells) {
      const {
        colSpan, rowSpan, align, valign,
      } = cell;
      const attrs = [];
      if (colSpan > 1) {
        attrs.push(`colspan="${colSpan}"`);
      }
      if (rowSpan > 1) {
        attrs.push(`rowspan="${rowSpan}"`);
      }
      if (align) {
        attrs.push(`align="${align}"`);
      }
      if (valign) {
        attrs.push(`valign="${valign}"`);
      }
      const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
      this.lineEndingIfNeeded();
      this.raw(' '.repeat(indent));
      this.tag(`<${tag}${attrStr}>`);
      if (cell.html.startsWith('<') && cell.html.indexOf('<pre>') < 0) {
        // indent all html
        const html = cell.html.split('\n').join(`\n${' '.repeat(indent + 4)}`);
        this.lineEndingIfNeeded();
        this.raw(' '.repeat(indent + 4));
        this.raw(html);
        this.lineEndingIfNeeded();
        this.raw(' '.repeat(indent));
      } else {
        this.raw(cell.html);
      }
      this.tag(`</${tag}>`);
    }
    this.lineEndingIfNeeded();
    indent -= 4;
    this.raw(' '.repeat(indent));
    this.tag('</tr>');
  }
  // this.exit(token);
  if (type) {
    this.lineEndingIfNeeded();
    indent -= 4;
    this.raw(' '.repeat(indent));
    this.tag(`</${type}>`);
  }
  this.lineEndingIfNeeded();
  this.tag('</table>');
}

function enterSection(type) {
  return function enter() {
    const info = this.getData('tableInfo');
    info.type = type;
  };
}

function exitCell(token) {
  // this.config.enter.data.call(this, token);
  // this.config.exit.data.call(this, token);
  const data = this.sliceSerialize(token); // this.resume();
  const info = this.getData('tableInfo');
  const colSpan = getColSpan(info, token);

  let cell = info.pendingCells[info.colPos];

  // open rowspan if we are on a divider line
  if (info.isDivider) {
    if (!cell) {
      cell = info.cells[info.colPos];
      info.pendingCells[info.colPos] = cell;
    }
    if (!cell) {
      // throw Error('no matching rowspan');
    } else {
      cell.rowSpan += 1;
    }
  }

  // if a rowspan is open, append to its cell
  if (cell) {
    cell.lines.push(data);
    info.colPos += colSpan;
    return;
  }

  // otherwise append to regular cell
  cell = info.cells[info.colPos];
  if (!cell) {
    const div = info.dividers[info.colPos];
    cell = {
      rowSpan: 1,
      colSpan,
      align: div?._align,
      valign: div?._valign,
      node: {
        type: TYPE_CELL,
      },
      lines: [],
    };
    info.cells[info.colPos] = cell;
    info.allCells.push(cell);
  }
  cell.lines.push(data);
  info.colPos += colSpan;
}

function enterGridDivider(token) {
  const info = this.getData('tableInfo');
  // clear pending rowspans and set divider info
  let colSpan = getColSpan(info, token);
  while (colSpan > 0) {
    colSpan -= 1;
    info.pendingCells[info.colPos] = null;
    info.dividers[info.colPos] = token;
    info.colPos += 1;
  }
}

function enterRowLine(token) {
  const info = this.getData('tableInfo');
  info.isDivider = token._type;
  info.colPos = 0;
  if (info.isDivider) {
    info.dividers = [];
  }
}

function commitRow(info) {
  const row = { type: info.type, cells: [] };

  // emit cells
  for (const cell of info.cells) {
    if (cell) {
      row.cells.push(cell);
    }
  }

  // this.exit(rowToken);
  this.getData('tableInfo').rows.push(row);
  // eslint-disable-next-line no-param-reassign
  info.cells = [];
}

function exitHeader() {
  const info = this.getData('tableInfo');
  // commit row  has some cells
  if (info.cells.length) {
    commitRow.call(this, info);
    // also close all rowspans.
    info.pendingCells = [];
  }
}

function exitRowLine() {
  const info = this.getData('tableInfo');
  // commit row if on a divider and has some cells
  if (info.isDivider && info.cells.length) {
    commitRow.call(this, info);
  }
}

export const gridTablesHtml = {
  enter: {
    [TYPE_TABLE]: enterTable,
    [TYPE_HEADER]: enterSection('thead'),
    [TYPE_BODY]: enterSection('tbody'),
    [TYPE_FOOTER]: enterSection('tfoot'),
    [TYPE_GRID_DIVIDER]: enterGridDivider,
    [TYPE_ROW_LINE]: enterRowLine,
  },
  exit: {
    [TYPE_TABLE]: exitTable,
    [TYPE_HEADER]: exitHeader,
    [TYPE_BODY]: exitHeader,
    [TYPE_FOOTER]: exitHeader,
    [TYPE_CELL]: exitCell,
    [TYPE_ROW_LINE]: exitRowLine,
  },
};
