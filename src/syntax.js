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

  // special tokenizer to check for the line start. this is needed to we can avoid consuming
  // the line ending after the table
  function tokenizeLineStart(effects, ok, nok) {
    function lineStart(code) {
      if (code === codes.plusSign || code === codes.verticalBar) {
        return ok(code);
      }
      return nok(code);
    }
    function lineEnding(code) {
      // consume line ending
      effects.enter(types.lineEnding);
      effects.consume(code);
      effects.exit(types.lineEnding);
      return lineStart;
    }

    return lineEnding;
  }

  function tokenizeTable(effects, ok, nok) {
    // positions of columns
    const cols = [0];
    // Outer cell start -> nested table's left/right border positions. Remember these
    // across lines so a nested body row can reuse the width found in its grid line.
    const nestedTables = new Map();
    let numRows = 0;
    let numCols = 0;
    let colPos = 0;
    let rowLine = null;
    let align = '';
    let valign = '';
    let cellStart = 0;
    // Only this line's nested range is protected; -1 means normal outer-cell parsing.
    let nestedEnd = -1;
    let nestedCandidate;
    return start;

    function start(code) {
      effects.enter(TYPE_TABLE)._cols = cols;
      effects.enter(TYPE_BODY);
      return lineStart(code);
    }

    function lineStart(code) {
      rowLine = effects.enter(TYPE_ROW_LINE);
      effects.enter(TYPE_CELL_DIVIDER);
      effects.consume(code);
      effects.exit(TYPE_CELL_DIVIDER);
      colPos = 0;
      numCols = 0;
      return cellOrGridStart;
    }

    function cellOrGridStart(code) {
      align = '';
      valign = '';
      cellStart = colPos;
      nestedEnd = -1;
      if (code === codes.dash || code === codes.equalsTo
        || code === codes.colon || code === codes.greaterThan) {
        // An outer grid divider ends any nested-table continuation in this cell.
        nestedTables.delete(cellStart);
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
      // Both '+' and '|' can begin a continuation: rowspans mix grid dividers
      // with cell text. Try the remembered width before looking for a new grid.
      if ((code === codes.plusSign || code === codes.verticalBar)
        && nestedTables.get(cellStart)?.start === colPos + 1) {
        // check() rolls back its input and token events, even on success. Commit
        // only the detected range, then let cell() consume the original input.
        return effects.check(
          { tokenize: tokenizeNestedRow },
          useNestedLine,
          checkNestedGrid,
        )(code);
      }
      return checkNestedGrid(code);
    }

    function checkNestedGrid(code) {
      if (code === codes.plusSign) {
        return effects.check(
          { tokenize: tokenizeNestedGrid },
          useNestedLine,
          cell,
        )(code);
      }
      nestedTables.delete(cellStart);
      return cell(code);
    }

    function useNestedLine(code) {
      nestedTables.set(cellStart, nestedCandidate);
      nestedEnd = nestedCandidate.end;
      return cell(code);
    }

    function tokenizeNestedGrid(checkEffects, checkOk, checkNok) {
      return tokenizeNestedLine(checkEffects, checkOk, checkNok, true);
    }

    function tokenizeNestedRow(checkEffects, checkOk, checkNok) {
      return tokenizeNestedLine(checkEffects, checkOk, checkNok, false);
    }

    // Recognize one nested line without adding its columns to the outer table.
    // Cell contents are parsed recursively later by the mdast/HTML extensions,
    // so deeper nesting gets a fresh tokenizer rather than a column stack here.
    function tokenizeNestedLine(checkEffects, checkOk, checkNok, grid) {
      // cellSpace() has not consumed the first non-space character yet.
      const startColumn = colPos + 1;
      const previous = nestedTables.get(cellStart);
      let column = startColumn;
      let last;
      let hasDivider = false;
      let endColumn;
      let parentEnd;
      let confirming = false;
      let seenContent = false;
      let closingGrid = false;
      let confirmationGrid;
      let confirmationDivider;
      return nestedStart;

      function nestedStart(code) {
        checkEffects.enter(TYPE_CELL);
        checkEffects.consume(code);
        column += 1;
        return nestedContent;
      }

      function nestedContent(code) {
        if (grid) {
          // Find the right edge of a grid line, including alignment markers.
          if (code === codes.plusSign || code === codes.dash || code === codes.equalsTo
            || code === codes.colon || code === codes.greaterThan || code === codes.lessThan
            || V_ALIGN_CODES[code]) {
            hasDivider ||= code === codes.dash || code === codes.equalsTo;
            last = code;
            checkEffects.consume(code);
            column += 1;
            return nestedContent;
          }
          if (!hasDivider || last !== codes.plusSign) {
            return checkNok(code);
          }
          return nestedEndCheck(code);
        }
        // Body rows must close at the same position as the preceding nested grid.
        // Otherwise fall back to ordinary outer-cell parsing.
        if (column === previous.end) {
          if (code !== codes.verticalBar && code !== codes.plusSign) {
            return checkNok(code);
          }
          checkEffects.consume(code);
          column += 1;
          return nestedEndCheck;
        }
        if (code === codes.eof || markdownLineEnding(code)) {
          return checkNok(code);
        }
        checkEffects.consume(code);
        column += 1;
        return nestedContent;
      }

      function nestedEndCheck(code) {
        if (!markdownSpace(code)) {
          return checkNok(code);
        }
        endColumn = column - 1;
        return nestedPadding(code);
      }

      function nestedPadding(code) {
        if (markdownSpace(code)) {
          checkEffects.consume(code);
          column += 1;
          return nestedPadding;
        }
        // Require padding followed by a real outer delimiter. A literal fragment
        // such as "+---+ text" is not a complete nested grid line.
        if ((code !== codes.verticalBar && code !== codes.plusSign) || !cols.includes(column)) {
          return checkNok(code);
        }
        // A nested left border can coincide with an outer column, but so can
        // an ordinary partial outer divider. Require a body and closing grid
        // inside the same parent cell before choosing the nested interpretation.
        if (grid && cols.includes(startColumn)) {
          if (!confirming) {
            confirming = true;
            parentEnd = column;
          } else if (column !== parentEnd) {
            return checkNok(code);
          }
          if (!closingGrid) {
            return confirmationSuffix(code);
          }
        }
        nestedCandidate = { start: startColumn, end: endColumn };
        checkEffects.exit(TYPE_CELL);
        return checkOk(code);
      }

      function confirmationSuffix(code) {
        if (code === codes.eof) {
          return checkNok(code);
        }
        checkEffects.consume(code);
        if (markdownLineEnding(code)) {
          column = 0;
          return confirmationPrefix;
        }
        return confirmationSuffix;
      }

      function confirmationPrefix(code) {
        if (code === codes.eof || markdownLineEnding(code)) {
          return checkNok(code);
        }
        if (column < startColumn) {
          // Other outer cells may change rows, but this cell must keep its
          // enclosing border and the whitespace before the nested left edge.
          if ((column === cellStart && code !== codes.verticalBar && code !== codes.plusSign)
            || (column > cellStart && !markdownSpace(code))) {
            return checkNok(code);
          }
          checkEffects.consume(code);
          column += 1;
          return confirmationPrefix;
        }
        if (code !== codes.plusSign && code !== codes.verticalBar) {
          return checkNok(code);
        }
        confirmationGrid = code === codes.plusSign;
        confirmationDivider = false;
        checkEffects.consume(code);
        column += 1;
        return confirmationContent;
      }

      function confirmationContent(code) {
        if (column === endColumn) {
          if (code !== codes.plusSign && code !== codes.verticalBar) {
            return checkNok(code);
          }
          const fullGrid = confirmationGrid && confirmationDivider && code === codes.plusSign;
          closingGrid = fullGrid && seenContent;
          seenContent ||= !fullGrid;
          checkEffects.consume(code);
          column += 1;
          return nestedEndCheck;
        }
        if (code === codes.eof || markdownLineEnding(code)) {
          return checkNok(code);
        }
        confirmationGrid &&= code === codes.plusSign
          || code === codes.dash || code === codes.equalsTo
          || code === codes.colon || code === codes.greaterThan || code === codes.lessThan
          || Boolean(V_ALIGN_CODES[code]);
        confirmationDivider ||= code === codes.dash || code === codes.equalsTo;
        checkEffects.consume(code);
        column += 1;
        return confirmationContent;
      }
    }

    function endTable(code) {
      if (numRows < 3) {
        return nok(code);
      }
      effects.exit(TYPE_BODY);
      effects.exit(TYPE_TABLE);
      return ok(code);
    }

    function lineEnd(code) {
      if (numCols === 0) {
        return nok(code);
      }
      effects.exit(TYPE_ROW_LINE);
      numRows += 1;

      if (code === codes.eof) {
        return endTable(code);
      }

      // since this function is only called for lineEnding or EOF, we can assume EOL here

      // let's check if the grid table is finished and if not, go to line start
      // this is needed so that we don't consume the line ending after the table
      return effects.check(
        { tokenize: tokenizeLineStart },
        (cd) => {
          effects.enter(types.lineEnding);
          effects.consume(cd);
          effects.exit(types.lineEnding);
          return lineStart;
        },

        endTable,
      )(code);
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
        // An inner delimiter remains cell content even if it aligns with an
        // outer column. Resume recognizing outer delimiters after its right edge.
        if (idx >= 0 && colPos > nestedEnd) {
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
      if (code === codes.eof || markdownLineEnding(code)) {
        // row with cells never terminate eof,
        // and a cell must be terminated on the same line
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
