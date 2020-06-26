// 2020/6/26 18:49:6

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	藤原げん子: REDIRECT_TARGET,
	'insource:"藤原げん子"': '藤原嫄子',
});
