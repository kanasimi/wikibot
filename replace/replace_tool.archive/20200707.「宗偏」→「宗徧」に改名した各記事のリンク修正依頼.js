// 2020/7/7 7:49:11

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'insource:"山田宗偏"': '山田宗徧',
	'insource:"宗偏流"': '宗徧流',
});
