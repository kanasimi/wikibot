/**
 * @name Common setup for unit tests.
 * @fileoverview Loads the CeJS wiki library the same way the bot scripts do,
 *               without contacting any wiki. "wiki configuration.js" is
 *               required by "wiki loader.js"; create it from the sample when
 *               the working copy does not have one yet.
 */

'use strict';

const node_fs = require('fs');
const path = require('path');

const base_directory = path.join(__dirname, '..');
const configuration_file = path.join(base_directory, 'wiki configuration.js');

if (!node_fs.existsSync(configuration_file)) {
	node_fs.copyFileSync(path.join(base_directory,
			'wiki configuration.sample.js'), configuration_file);
}

globalThis.no_task_date_warning = true;

require(path.join(base_directory, 'wiki loader.js'));

module.exports = {
	base_directory,
	CeL: globalThis.CeL
};
