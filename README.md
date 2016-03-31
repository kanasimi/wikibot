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
require('cejs');

// Load module.
CeL.run('application.net.wiki');

// Set default language. 改變預設之語言。
CeL.wiki.set_language('en');

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
	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);
	// append new section
	return content + '\n== New section ==\n: text to add.';
}, {
	summary : 'summary'
});
```


## Screenshot
Screenshot of [WPCHECK.js](https://github.com/kanasimi/wikibot/blob/master/20151002.WPCHECK.js) (fix_16 only):

* Output on console:
* ![On console](https://upload.wikimedia.org/wikipedia/commons/7/7c/20151002.WPCHECK.console.c.png)

* Log page:
* ![Log page](https://upload.wikimedia.org/wikipedia/commons/d/da/20151002.WPCHECK.log.c.png)

* The contributions:
* ![Contributions](https://upload.wikimedia.org/wikipedia/commons/f/f1/20151002.WPCHECK.contributions.c.png)


## Features
* Batch processing.
* Support [Flow](https://www.mediawiki.org/wiki/Flow) page: Using the same way adding section to normal page and Flow page.
* Support <code>{{[bots](https://meta.wikimedia.org/wiki/Template:Bots)}}</code> detection.
* Query [list](https://www.mediawiki.org/wiki/API:Lists) of backlinks, embeddedin, imageusage, linkshere, fileusage, ...
* Parse [wikitext](https://www.mediawiki.org/wiki/Wikitext).
* Parse XML file of [Wikimedia database backup dumps](http://dumps.wikimedia.org/backup-index.html).
* Import [Wikimedia database backup dumps](http://dumps.wikimedia.org/backup-index.html) data to user-created database on [Tool Labs](http://tools.wmflabs.org/). (See [process_dump.js](https://github.com/kanasimi/wikibot/blob/master/process_dump.js))
* 12分鐘遍歷所有 zhwiki 頁面。（於 Tool Labs，需先下載 xml dump file。） (See [traversal_pages.js](https://github.com/kanasimi/wikibot/blob/master/traversal_pages.js))
