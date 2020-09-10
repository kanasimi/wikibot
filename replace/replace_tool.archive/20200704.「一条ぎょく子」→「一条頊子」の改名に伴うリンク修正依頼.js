/*
Usage:
node 20200704.「一条ぎょく子」→「一条頊子」の改名に伴うリンク修正依頼.js
node 20200704.「一条ぎょく子」→「一条頊子」の改名に伴うリンク修正依頼.js "「洞院いん子」→「洞院愔子」の改名に伴うリンク修正依頼"
node 20200704.「一条ぎょく子」→「一条頊子」の改名に伴うリンク修正依頼.js "「九条しゅん子」→「九条竴子」の改名に伴うリンク修正依頼"
*/

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({ diff_id: 78288409 });
