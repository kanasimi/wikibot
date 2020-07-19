'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'insource:"[[森けい二{{!}}森雞二]]"': '[[森雞二]]',
	'insource:"[[森けい二|森雞二]]"': '[[森雞二]]',
});
