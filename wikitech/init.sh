#!/bin/sh
# 本檔案原初版本放置於 program/wiki/init.sh

echo "Initialize wiki bot works environment..."


SP="\n-----------------------------------------------------------"


echo "$SP\nClone CeJS..."

cd ~

# 若有更新，得自己刪除 ~/CeJS。
#rm -rf ~/CeJS
#/usr/bin/git clone https://github.com/kanasimi/CeJS.git

# update CeJS
[ -d "node_modules" ] || md node_modules
cd node_modules


# method 1:
#rm -rf cejs
#/usr/bin/git clone https://github.com/kanasimi/CeJS.git cejs

# method 2:
/usr/bin/wget -O CeJS.zip https://github.com/kanasimi/CeJS/archive/master.zip && [ -d cejs ] && /usr/bin/diff CeJS.zip CeJS.zip.old && mv -f CeJS.zip CeJS.zip.old && echo "CeJS: No news." || ( echo "Extracting CeJS..." && time /usr/bin/unzip CeJS.zip > /dev/null && mv -f CeJS.zip CeJS.zip.old && rm -rf cejs && mv CeJS-master cejs && (cp -f "cejs/_for include/_CeL.loader.nodejs.js" ~/wikibot) && ( [ -d OpenCC ] && cp OpenCC/* cejs/extension/zh_conversion/OpenCC/ || echo "No OpenCC." ) || echo "Failed to get CeJS" )

# ---------------------------------------------------------

echo "$SP\nCopy task programs..."

cd ~

#if [ -d "wikibot" ]; then
 # extract all files, but don't touch files that are not in the branch.
 # Do not clean. 不清理。

 # method 1:
 #cd wikibot
 #rm -rf .git
 #/usr/bin/git clone --bare https://github.com/kanasimi/wikibot.git .git
 #/usr/bin/git init
 #/usr/bin/git checkout -f master

#else
 # rebuild a new one.
 #/usr/bin/git clone https://github.com/kanasimi/wikibot.git wikibot
 #cd wikibot
#fi

# method 2:
/usr/bin/wget -O wikibot.zip https://github.com/kanasimi/wikibot/archive/master.zip && [ -d wikibot ] && /usr/bin/diff wikibot.zip wikibot.zip.old && mv -f wikibot.zip wikibot.zip.old && echo "wikibot: No news." || ( echo "Extracting wikibot..." && time /usr/bin/unzip wikibot.zip > /dev/null && mv -f wikibot.zip wikibot.zip.old && rsync -a --remove-source-files wikibot-master/ wikibot && rm -rf wikibot-master || echo "Failed to get wikibot" )

# ---------------------------------------------------------

#echo "$SP\n作必要的 link..."

#cd ~/wikibot

#[ -s "20150503.js" ] || ln -s 20150503.提報關注度不足過期提醒.js 20150503.js

# ---------------------------------------------------------

echo "$SP\nCopy config data..."

cd ~/wikibot

# upload data
# cd /home/kanashimi/www/cgi-bin/program && cp "wiki/wiki loder.js" . && chmod o+r "wiki loder.js"

# 不再用此招
#	mv -f "wiki loder.js" "wiki loder.js.old"
#	#/usr/bin/curl -o "wiki loder.js" http://lyrics.meicho.com.tw/program/wiki%20loder.js
#	/usr/bin/wget http://lyrics.meicho.com.tw/program/wiki%20loder.js || mv "wiki loder.js.old" "wiki loder.js" && echo "Please copy 'wiki loder.js' yourself."
echo pass

# ---------------------------------------------------------

#cd ~/wikibot

#ln -s ../node_modules/cejs/application/net/wiki.js js.js

# rm "wiki loder.js" archive

[ -f README.md ] && /bin/rm README.md

#chmod 700 *.sh

#ls -alFi

/bin/date "+%Y/%m/%d %H:%M:%S"
