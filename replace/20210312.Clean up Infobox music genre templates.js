'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace(null, {
	'Template:Infobox music genre': {
		namespace: '*',
		replace_parameters: {
			color: "to_parameter",
			popularity:
		},
		parameter_name_only: true
	},
});
