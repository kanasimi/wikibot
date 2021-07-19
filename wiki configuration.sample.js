/**
 * @name CeJS wiki configuration for node.js.
 * @fileoverview ** This file is private. Please fill the data and rename this
 *               file to "wiki configuration.js".
 */

'use strict';

// Using [[Special:BotPasswords]] to create password.

// default for MediaWiki projects
login_options_for_project[DEFAULT_PROJECT_KEY] = {
	/** {String}user/bot owner name */
	owner_name : 'bot owner name',
	/** {String}user/bot name */
	user_name : 'bot name@bot name',
	password : 'password for user / bot'
};

// For special wiki projects.

// use_project=lingualibre
login_options_for_project.lingualibre = {
	API_URL : 'https://lingualibre.org/api.php',
	user_name : 'bot name@bot name',
	password : 'bot password given'
};

// use_project=zhmoegirl
login_options_for_project.zhmoegirl = {
	// API_URL : 'https://zh.moegirl.org.cn/api.php',
	// 移動端網址的防火牆允許的單位時間內請求數較多，故使用mzh.moegirl.org.cn運行機器人能夠降低撞上防火牆的機率。
	API_URL : 'https://mzh.moegirl.org.cn/api.php',
	language : 'zh',
	site_name : 'zhmoegirl',
	user_name : 'bot name@bot name',
	password : 'bot password given'
};

