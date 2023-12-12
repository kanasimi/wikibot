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
	user_name : 'Login name',
	password : 'password for user / bot'
};

// For special wiki projects.

// use_project=lingualibre
login_options_for_project.lingualibre = {
	language : 'en',
	API_URL : 'https://lingualibre.org/api.php',
	data_API_URL : 'https://lingualibre.org/api.php',
	SPARQL_API_URL : 'https://lingualibre.org/bigdata/namespace/wdq/sparql',
	user_name : 'Main account name@bot name',
	password : 'bot password given'
};

// use_project=zhmoegirl
login_options_for_project.zhmoegirl = {
	language : 'zh',
	// API_URL : 'https://zh.moegirl.org.cn/api.php',
	// 移動端網址的防火牆允許的單位時間內請求數較多，故使用mzh.moegirl.org.cn運行機器人能夠降低撞上防火牆的機率。
	API_URL : 'https://mzh.moegirl.org.cn/api.php',
	site_name : 'zhmoegirl',
	user_agent : 'customized user agent',
	user_name : 'Main account name@bot name',
	// 設定頁面與記錄頁面所參考的使用者名稱。 @see "wiki loader.js"
	// user_name_referenced : '',
	password : 'bot password given'
};

login_options_for_project.wikiapi = {
	// site_name : 'wikiapifandom',
	API_URL : 'https://wikiapi.fandom.com/api.php',
	user_name : 'Main account name@bot name',
	password : 'bot password given'
};
