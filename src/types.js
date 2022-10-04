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

/**
 * token and mdast node type for the grid table
 * @type {string}
 */
export const TYPE_TABLE = 'gridTable';

/**
 * token and mdast node type for the grid table header
 * @type {string}
 */
export const TYPE_HEADER = 'gtHeader';

/**
 * token and mdast node type for the grid table body
 * @type {string}
 */
export const TYPE_BODY = 'gtBody';

/**
 * token and mdast node type for the grid table footer
 * @type {string}
 */
export const TYPE_FOOTER = 'gtFooter';

/**
 * mdast node type for a grid table row
 * @type {string}
 */
export const TYPE_ROW = 'gtRow';

/**
 * mdast node type for a grid table cell
 * @type {string}
 */
export const TYPE_CELL = 'gtCell';

/**
 * token type for a grid table row-line. The row line represents a line within a row.
 * It can have cells or dividers or both (in case of row spans).
 * @type {string}
 */
export const TYPE_ROW_LINE = 'gtRowLine';

/**
 * token type for a grid table grid-divider. The grid divider is the section of `-` and `=` of a
 * grid line between to grid delimiters `|`.
 *
 * @type {string}
 */
export const TYPE_GRID_DIVIDER = 'gtGridDivider';
