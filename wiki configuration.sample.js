/**
 * @name CeJS wiki configuration for node.js.
 * @fileoverview ** This file is private. Please fill the data and rename this
 *               file to "wiki configuration.js".
 */

'use strict';

// only for node.js.
// default for MediaWiki projects
login_options_for_project[DEFAULT_PROJECT_KEY] = {
	/** {String}user/bot owner name */
	owner_name : 'bot owner name',
	/** {String}user/bot name */
	user_name : 'user name',
	password : 'password for user / bot'
};

// For special wiki projects.
// Visit [[Special:BotPasswords]]
login_options_for_project.lingualibre = {
	API_URL : 'https://lingualibre.org/api.php',
	user_name : 'bot@bot',
	password : 'bot password'
};
