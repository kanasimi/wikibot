# Wikipedia bots demo
The Wikipedia bot examples using [CeJS library](https://github.com/kanasimi/CeJS).
採用 CeJS [MediaWiki 自動化作業用程式庫](https://github.com/kanasimi/CeJS/blob/master/application/net/wiki.js)來製作維基百科機器人的範例。

## Node.js usage

### Installation
``` bash
$ npm install cejs
```

### Running
``` JavaScript
// 
require('cejs');

// Load module.
CeL.run('application.net.wiki');

// Set up wiki instance.
var wiki = CeL.wiki.login(user_name, password, 'en');

wiki
// Select page and get the content of page.
.page('Wikipedia:Sandbox')

// Add a new section to normal page or Flow page.
.edit('wikitext to replace', {
	section : 'new',
	sectiontitle : 'Sandbox test section',
	summary : 'Sandbox test edit (section)',
	nocreate : 1
})

// Modify the page content.
.edit(function(page_data) {
	var title = CeL.wiki.title_of(page_data),
	content = CeL.wiki.content_of(page_data);
	return content + '\n== New section ==\n: text to add.';
}, {
	summary : 'summary'
});
```

## Features
* Support Flow page: Using the same way adding section to normal page and Flow page.
* Support <code>{{bot}}</code>
* Query of backlinks, embeddedin, imageusage, linkshere, fileusage list.
* Parse wikitext.
