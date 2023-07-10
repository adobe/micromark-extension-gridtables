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
/* eslint-disable no-use-before-define,no-underscore-dangle,no-param-reassign */
import { codes, types } from 'micromark-util-symbol';
import {
  markdownLineEnding,
  markdownSpace,
} from 'micromark-util-character';
import {
  TYPE_BODY, TYPE_CELL, TYPE_HEADER, TYPE_FOOTER, TYPE_TABLE, TYPE_GRID_DIVIDER, TYPE_ROW_LINE,
} from './types.js';

// the cell divider: | or +
const TYPE_CELL_DIVIDER = 'cellDivider';

const V_ALIGN_CODES = {
  [codes.lowercaseV]: 'bottom',
  [codes.lowercaseX]: 'middle',
  [codes.caret]: 'top',
};

function parse() {
  return {
    tokenize: tokenizeTable,
    resolve: resolveTable,
    resolveAll: resolveAllTable,
    concrete: true,
  };

  function tokenizeTable(effects, ok, nok) {
    // positions of columns
    const cols = [0];
    let numRows = 0;
    let numCols = 0;
    let colPos = 0;
    let rowLine = null;
    let align = '';
    let valign = '';
    return start;

    function start(code) {
      effects.enter(TYPE_TABLE)._cols = cols;
      effects.enter(TYPE_BODY);
      return lineStart(code);
    }

    function lineStart(code) {
      if (code === codes.plusSign || code === codes.verticalBar) {
        rowLine = effects.enter(TYPE_ROW_LINE);
        effects.enter(TYPE_CELL_DIVIDER);
        effects.consume(code);
        effects.exit(TYPE_CELL_DIVIDER);
        colPos = 0;
        numCols = 0;
        return cellOrGridStart;
      }
      if (numRows < 3) {
        return nok(code);
      }
      effects.exit(TYPE_BODY);
      effects.exit(TYPE_TABLE);
      return ok(code);
    }

    function cellOrGridStart(code) {
      align = '';
      valign = '';
      if (code === codes.dash || code === codes.equalsTo
        || code === codes.colon || code === codes.greaterThan) {
        effects.enter(TYPE_GRID_DIVIDER)._colStart = colPos;
        colPos += 1;
        if (code === codes.colon) {
          align = 'left';
        } else if (code === codes.greaterThan) {
          align = 'justify';
        }
        effects.consume(code);
        return gridDivider;
      }

      if (code === codes.eof || markdownLineEnding(code)) {
        return lineEnd(code);
      }

      effects.enter(TYPE_CELL)._colStart = colPos;
      colPos += 1;
      effects.consume(code);

      if (markdownSpace(code)) {
        return cellSpace;
      }
      return cell;
    }

    function cellSpace(code) {
      if (code === codes.eof || markdownLineEnding(code)) {
        // mark as discarded, will be filtered out in transform
        effects.exit(TYPE_CELL)._discard = true;
        return lineEnd(code);
      }
      if (markdownSpace(code)) {
        colPos += 1;
        effects.consume(code);
        return cellSpace;
      }
      return cell(code);
    }

    function lineEnd(code) {
      if (numCols === 0) {
        return nok(code);
      }
      if (markdownLineEnding(code)) {
        effects.enter(types.lineEnding);
        effects.consume(code);
        effects.exit(types.lineEnding);
      }
      effects.exit(TYPE_ROW_LINE);
      if (code === codes.eof) {
        effects.exit(TYPE_BODY);
        effects.exit(TYPE_TABLE);
        return ok(code);
      }
      numRows += 1;
      return lineStart;
    }

    function gridDivider(code) {
      colPos += 1;
      if (code === codes.dash || code === codes.equalsTo) {
        if (!rowLine._type) {
          rowLine._type = code;
        }
        effects.consume(code);
        return gridDivider;
      }
      if (code === codes.colon) {
        if (!align) {
          align = 'right';
        } else if (align === 'left') {
          align = 'center';
        } else {
          return nok(code);
        }
        effects.consume(code);
        return gridDividerEnd;
      }
      if (code === codes.lessThan) {
        if (align !== 'justify') {
          return nok(code);
        }
        effects.consume(code);
        return gridDividerEnd;
      }

      if (V_ALIGN_CODES[code]) {
        if (valign) {
          return nok(code);
        }
        valign = V_ALIGN_CODES[code];
        effects.consume(code);
        return gridDivider;
      }
      if (code === codes.plusSign || code === codes.verticalBar) {
        colPos -= 1;
        return gridDividerEnd(code);
      }
      return nok(code);
    }

    function gridDividerEnd(code) {
      if (code !== codes.plusSign && code !== codes.verticalBar) {
        return nok(code);
      }
      // for a super small column, assume dash
      if (!rowLine._type) {
        rowLine._type = code.dash;
      }
      colPos += 1;
      // remember cols
      const idx = cols.indexOf(colPos);
      if (idx < 0) {
        cols.push(colPos);
        cols.sort((c0, c1) => c0 - c1);
      }
      const token = effects.exit(TYPE_GRID_DIVIDER);
      token._colEnd = colPos;
      token._align = align;
      token._valign = valign;
      effects.enter(TYPE_CELL_DIVIDER);
      effects.consume(code);
      effects.exit(TYPE_CELL_DIVIDER);
      numCols += 1;
      return cellOrGridStart;
    }

    function cell(code) {
      colPos += 1;
      // find existing col
      if (code === codes.verticalBar || code === codes.plusSign) {
        const idx = cols.indexOf(colPos);
        if (idx >= 0) {
          effects.exit(TYPE_CELL)._colEnd = colPos;
          effects.enter(TYPE_CELL_DIVIDER);
          effects.consume(code);
          effects.exit(TYPE_CELL_DIVIDER);
          numCols += 1;
          return cellOrGridStart;
        }
        effects.consume(code);
        return cell;
      }
      if (code === codes.eof) {
        // row with cells never terminate eof
        return nok(code);
      }

      effects.consume(code);
      return (code === codes.backslash)
        ? cellEscaped
        : cell;
    }

    function cellEscaped(code) {
      if (code === codes.backslash || code === codes.verticalBar || code === codes.plusSign) {
        colPos += 1;
        effects.consume(code);
        return cell;
      }
      return cell(code);
    }
  }

  function resolveHeaderAndFooter(events, context) {
    // detect headers:
    // no `=` lines -> only body
    // 1 `=` line -> header + body
    // 2 `=` lines -> header + body + footer
    const fatLines = [];
    let bodyStart = -1; // should default to 1. but just be sure

    for (let idx = 0; idx < events.length; idx += 1) {
      const [e, node] = events[idx];
      const { type } = node;
      if (type === TYPE_BODY) {
        if (e === 'enter') {
          bodyStart = idx;
        } else {
          // eslint-disable-next-line prefer-const
          let [hdrIdx, ftrIdx] = fatLines;
          const bdy = node;
          if (hdrIdx > bodyStart + 1) {
            // insert header above body
            const hdr = {
              type: TYPE_HEADER,
              start: bdy.start,
              end: events[hdrIdx][1].end,
            };
            bdy.start = hdr.end;
            events[bodyStart][1] = hdr;
            events.splice(
              hdrIdx,
              0,
              ['exit', hdr, context],
              ['enter', bdy, context],
            );
            idx += 2;
            ftrIdx += 2;
          }

          if (ftrIdx) {
            // insert footer below body
            const ftr = {
              type: TYPE_FOOTER,
              start: events[ftrIdx][1].start,
              end: bdy.end,
            };
            bdy.end = ftr.start;
            events.splice(
              ftrIdx,
              0,
              ['exit', bdy, context],
              ['enter', ftr, context],
            );
            idx += 2;
            events[idx][1] = ftr;
          }
        }
      } else if (type === TYPE_ROW_LINE && e === 'enter' && node._type === codes.equalsTo) {
        fatLines.push(idx);
      }
    }
    return events;
  }

  function resolveTable(events, context) {
    // remove discarded
    events = events.filter(([, node]) => !node._discard);
    events = resolveHeaderAndFooter(events, context);
    return events;
  }

  function resolveAllTable(events, context) {
    // since we create a detached parser for each cell content later (in from-markdown.js)
    // we need to remember the definitions of the overall document. otherwise the cell parsers
    // would not detect the image and link references.
    const { defined } = context.parser;

    // find all grid tables and remember the definitions
    for (const [evt, node] of events) {
      if (evt === 'enter' && node.type === TYPE_TABLE) {
        node._definitions = defined;
      }
    }
    return events;
  }
}

export const gridTables = {
  flow: {
    [codes.plusSign]: parse(),
  },
};
