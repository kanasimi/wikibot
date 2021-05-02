'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

// subst展開
function for_template(token, index, parent) {
	token[0] = 'subst:' + token[0];
}

replace_tool.replace(null, {
	'Template:Unsigned': { namespace: '*', for_template },
});
