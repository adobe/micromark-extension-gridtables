# Micromark Extension Gridtables

> Micormark extension to parse markdown gridtables.

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/micromark-extension-gridtables.svg)](https://codecov.io/gh/adobe/micromark-extension-gridtables)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/micromark-extension-gridtables.svg)](https://circleci.com/gh/adobe/micromark-extension-gridtables)
[![GitHub license](https://img.shields.io/github/license/adobe/micromark-extension-gridtables.svg)](https://github.com/adobe/micromark-extension-gridtables/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/micromark-extension-gridtables.svg)](https://github.com/adobe/micromark-extension-gridtables/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/micromark-extension-gridtables.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/micromark-extension-gridtables)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

# Grid Tables

## Overview

GridTables look like this:

```
+-------------------+------+
| Table Headings    | Here |
+--------+----------+------+
| Sub    | Headings | Too  |
+========+=================+
| cell   | column spanning |
| spans  +---------:+------+
| rows   |   normal | cell |
+---v----+:---------------:+
|        | cells can be    |
|        | *formatted*     |
|        | **paragraphs**  |
|        | ```             |
| multi  | and contain     |
| line   | blocks          |
| cells  | ```             |
+========+=========<+======+
| footer |    cells |      |
+--------+----------+------+
```

- the top of a cell must be indicated by `+-` followed by some `-` or `+` and finished by `-+`.
- if the table contains a footer but no header, the top row should use `=` as grid line.
- col spans are indicated by missing column (`|`) delimiters
- row spans are indicated by missing row (`-`) delimiters
- cells can be left, center, right, or justify aligned; indicated by the placement of `:` or `><`
- cells can be top, middle, or bottom v-aligned; indicated by the placement of arrows (`v` `^` `x`)
- the header and footer sections are delimited by section delimiters (`=`).
- if no section delimiters are present, all cells are placed in the table body.
- if only 1 section delimiter is present, it delimits header from body.
- the content in cells can be a full Markdown document again. note, that the cell boundaries (`|`)
  need to exactly match with the column markers (`+`) in the row delimiters, if the cell content
  contains `|`, otherwise the correct layout of the table can't be guaranteed.

Layout
======

The table layout tries to keep the table within a certain width (default 120). For example,
if the table has 3 columns, each column will be max 40 characters wide. If all text in a column
is smaller, it will shrink the columns. However, cells have a minimum width (default 10) when
text needs to be broken. If the cell contents need more space, e.g. with a nested table or
code block, it will grow accordingly.

Align
=====

Horizontal align is indicated by placing markers at the grid line above the cell:

```
Justify     Center     Left       Right
+>-----<+  +:-----:+  +:------+  +------:+
| A b C |  |  ABC  |  | ABC   |  |   ABC |
+-------+  +-------+  +-------+  +-------+
```

Vertical align is indicated by placing markers at the center of the grid line above the cell:

```
Top        Middle     Bottom
+---^---+  +---x---+  +---v---+
| Larum |  |       |  |       |
| Ipsum |  | Larum |  |       |
|       |  | Ipsum |  | Larum |
|       |  |       |  | Ipsum |
+-------+  +-------+  +-------+
```

## Syntax

```ebfn

gridTable := gridLine cellLine+ gridLine;
gridLine := gridCell+ "+";
cellLine := ( gridCell | cellContent )+ ( "+" | "|" );   
gridCell := "+" alignMarkerStart? ("-" | "=")+ vAlignMarker? ("-" | "=")* alignMarkerEnd?;
cellContent := ( "+" | "|" ) " " content " " ;
alignMarkerStart := ":" | ">";
alignMarkerEnd   := ":" | "<";
vAlignMarker     := "^" | "v" | "x"
```

## MDAST Syntax tree

The following interfaces are added to **[mdast][]** by this utility.

### Nodes

#### `GridTable`

```idl
interface GridTable <: Parent {
  type: "gridTable"
  children: [GridTableHeader|GridTableBody|GridTableFooter]
}
```

#### `GridTableHeader`

```idl
interface GridTableHeader <: Parent {
  type: "gtHead"
  children: [GridTableRow]
}
```

#### `GridTableBody`

```idl
interface GridTableBody <: Parent {
  type: "gtBody"
  children: [GridTableRow]
}
```

#### `GridTableFoot`

```idl
interface GridTableFooter <: Parent {
  type: "gtFoot"
  children: [GridTableRow]
}
```

#### `GridTableRow`

```idl
interface GridTableRow <: Parent {
  type: "gtRow"
  children: [GridTableCell]
}
```

#### `GridTableCell`

```idl
interface GridTableCell <: Parent {
  type: "gtCell"
  colSpan: number >= 1
  rowSpan: number >= 1
  align: alignType
  valign: valignType
  children: [MdastContent]
}
```

**GridTableCell** ([**Parent**][dfn-parent]) represents a header cell in a
[**GridTable**][dfn-table], if its parent is a [*gridTableHead*][term-head], or a data
cell otherwise.

**GridTableCell** can be used where [**gridTableRow**][dfn-row-content] content is expected.
Its content model is [**mdast**][dfn-phrasing-content] content, allowing full mdast documents.

### Enumeration

#### `alignType`

```idl
enum alignType {
  "left" | "right" | "center" | "justify" | null
}
```

#### `valignType`

```idl
enum alignType {
  "top" | "bottom" | "middle" | null
}
```

## Usage

### Parsing with unified

```js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkGridTable } from '@adobe/helix-markdown-support/gridtable';

const mdast = unified()
  .use(remarkParse)
  .use(remarkGridTable)
  .parse(markdown);
```

### Generating HAST

```js
import { toHast, defaultHandlers } from 'mdast-util-to-hast';
import { mdast2hastGridTableHandler, TYPE_TABLE } from '@adobe/helix-markdown-support/gridtable';

const hast = toHast(mdast, {
  handlers: {
    ...defaultHandlers,
    [TYPE_TABLE]: mdast2hastGridTableHandler(),
  },
  allowDangerousHtml: true,
});
```



## Installation

```bash
$ npm install @adobe/micromark-extension-gridtables
```

## Development

### Build

```bash
$ npm install
```

### Test

```bash
$ npm test
```

### Lint

```bash
$ npm run lint
```
