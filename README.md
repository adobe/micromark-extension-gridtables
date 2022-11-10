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

## What is this?

This package contains extensions that add support for gridtables to [`micromark`][micromark].

## When to use this

These tools are all low-level.
In many cases, you want to use [`@adobe/remark-gridtables`][plugin] with remark instead.

When working with `mdast-util-from-markdown`, you must combine this package with
[`@adobe/mdast-util-gridtables`][util].


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

## Usage

### Parsing with unified

```js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkGridTable } from '@adobe/remark-gridtables';

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

### Generating HTML

```js
import {micromark} from 'micromark'
import {gridTables, gridTablesHtml} from '@adobe/micromark-extension-gridtables'

const html = micromark(markdown, {
  extensions: [gfmTable],
  htmlExtensions: [gfmTableHtml]
})

console.log(html)
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

[micromark]: https://github.com/micromark/micromark

[util]: https://github.com/adobe/mdast-util-gridtables

[plugin]: https://github.com/adobe/remark-gridtables
