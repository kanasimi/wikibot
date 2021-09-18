/*

2021/9/15 15:53:17	初版試營運。
	完成。正式運用。

TODO:

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

login_options.API_URL = 'commons';

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// ----------------------------------------------------------------------------

const Gallery_list = `Category:Political maps of the United States, Category:Election maps | User:Magog the Ogre/Political maps | DAYS_PER_GALLERY(11)| Category:Maps of countries visited by US presidents‎ | Category:International relations maps of the United States | Category:Political maps of Ohio as of the 2000 United States Census | Category:Fictitious U.S. presidential election maps
Category:Rail transport in the United Kingdom(depth=10) | User:Mattbuck/Railways | 250x250 DAYS_PER_GALLERY(31) | Category:London Transport Museum | Category:English Electric locomotives | Category:Archer M. Huntington | Category:Jawaharlal Nehru | Category:Photographs by Geof Sheppard | Category:Shropshire Union Canal | Category:Amsterdam Central station | Category:Rotterdam Central station | Category:Thomas the Tank Engine and Friends | Category:People associated with rail transport in the United Kingdom
Category:Maps of Iowa | User:Philosopher/Maps of Iowa | 300x300
Category:Politicians of Iowa | User:Philosopher/Politicians of Iowa | 150x150
Category:Mittelhessen | User:Emha/Mittelhessen | 150x150 NO_INDEX, SHOW_FILENAME | Category:Photos taken with Leica | Category:Photographs taken with Leica lenses | Category:Mikhail Lomonosov | Category:Grimm's Fairy Tales | Category:Leica cameras | Category:S6 (S-Bahn Rhein-Main) | Category:Photographs taken with Leitz lenses | Category:Alumni of Philipps-Universität Marburg | Category:Georg Büchner | Category:Things named after Elisabeth of Hungary | Category:Cameras with built-in Leica lenses | Category:Geheimes Staatsarchiv Preußischer Kulturbesitz
Category:Mittelhessen | User:Sir James/Mittelhessen | 150x150 DAYS_PER_GALLERY(1), NO_INDEX | Category:Brothers Grimm | Category:Alumni of Philipps-Universität Marburg | Category:Photos taken with Leica | Category:Photographs taken with Leica lenses | Category:Mikhail Lomonosov | Category:Grimm's Fairy Tales | Category:Leica cameras | Category:S6 (S-Bahn Rhein-Main) | Category:Photographs taken with Leitz lenses | Category:Georg Büchner | Category:Things named after Elisabeth of Hungary | Category:Cameras with built-in Leica lenses | Category:Geheimes Staatsarchiv Preußischer Kulturbesitz
Category:Museums in Japan‎ | User:Nightingale/Museums in Japan‎ | 150x150
Category:Landkreis Freising | User:Vuxi/Neue Bilder in Freising | 150x150 DAYS_PER_GALLERY(31) | Category:Roman Catholic Archdiocese of Munich and Freising
Category:Gambia | User:Atamari/BotGallery/Gambia | 150x150
Category:Pigeons | User:PigeonIP/Tauben | 150x150 | Category:Deutsche Pute | Category:Duck breeds with EE-Standard | Category:Pigeons in heraldry | Category:Holy Spirit in heraldry
Category:Poultry | User:PigeonIP/Geflügel | 150x150 | Category:Pigeon breeds by EE Breed Groups‎ | Category:Chicken restaurants
Category:St. Pölten | User:AleXXw/St. Pölten | 150x150 DAYS_PER_GALLERY(31) | Category:Churches in the Roman Catholic Diocese of Sankt Pölten
Category:South Tyrol | User:Mai-Sachme/South Tyrol | 150x150
Category:Equestrian sports | User:Nordlicht8/Equestriansports | 150x150 | Category:Male equestrians | Category:Horsewomen | Category:Postillions | Category:Horse riders in art | Category:Racing silks | Category:Temples of Athena | Category:Knights in art | Category:Horse riding in Christian art
Category:East Timor | User:J. Patrick Fischer | 150x150
Category:Landkreis Unterallgäu, Category:Landkreis Oberallgäu, Category:Memmingen | User:Mogadir/BotGallery | 150x150
Category:Heilbronn, Category:Landkreis Heilbronn, Category:Hohenlohekreis, Category:Main-Tauber-Kreis, Category:Landkreis Schwäbisch Hall, Category:Photographs by Wilhelm Kratt, Category:Photographs by Willy Pragher | User:Rosenzweig/NewFiles | 150x150 | Category:Geschwister-Scholl-Weg Ruhland | Category:Heuss squares
Category:Landkreis Breisgau-Hochschwarzwald | User:Flominator/LKBH | 150x150
Category:Landkreis Emmendingen | User:Flominator/EM | 150x150
Category:Firearms | user:sanandros/ogre/firearms | 150x150 | Category:Anti-tank rifles | Category:Firearms in art | Category:Collections of firearms by museum | Category:Aircraft guns | Category:Caplock firearms | Category:Designers of firearms | Category:Defense Distributed | Category:Early firearms | Category:Externally powered firearms | Category:Cannon barrels | Category:Thermal sleeve (artillery) | Category:Bore evacuators | Category:Flintlock mechanisms | Category:Gun cameras | Category:Miquelet lock | Category:Gunblades | Category:Wheellock | Category:Gunsmithing | Category:Multiple barrel firearms | Category:Externally powered machine guns | Category:Rotating barrel machine guns | Category:Anti-aircraft machine guns | Category:Browning M2 | Category:World War I machine guns | Category:World War II machine guns | Category:Browning wz. 1928 | Category:Furrer M25 | Category:Maxim machine gun | Category:Muzzle-loaders | Category:10.5 cm Leichtgeschütz 42 | Category:Volley guns | Category:Colt revolvers | Category:Chain operated cannon | Category:Pindad Komodo | Category:Revolvers | Category:Clay pigeon shooting | Category:Lever-action rifles | Category:MG08 | Category:Schwarzlose MG | Category:Breda (Milan) | Category:Vickers .50 machine gun | Category:MG 34 | Category:Bren light machine guns | Category:MG08 | category:Tanegashima (Teppo) | Category:Samurai firearms | Category:Socimi vehicles | Category:Replicas of firearms | Category:Deaths by gunshot
Category:Special forces|user:sanandros/ogre/special forces|150x150 | Category:Christopher Cassidy | Category:Colin Powell
Category:Police tactical units|user:sanandros/ogre/Police tactical units|150x150
Category:Secret intelligence|user:sanandros/ogre/secret intelligence|150x150 | Category:George H. W. Bush | Category:Vladimir Putin | Category:PD CIA | Category:Joseph Stalin | Category:Perpetrators of the Great Purge | Category:Victims of the Great Purge | Category:CIA World Factbook maps | Category:Actresses who played the role of Mata Hari | Category:Mata Hari biographers | Category:Homes of Mata Hari | Category:Mata Hari (1931 film) | Category:Mata Hari look-alikes | Category:Fictional spies | Category:Richard-Sorge-Straße (Berlin) | Category:People of 1953 Iranian coup | Category:Russian Federal Security Service designated terrorist organizations | Category:Leon Panetta | Category:Anwar Sadat
Category:Landkreis Ravensburg | User:AndreasPraefcke/Landkreis_Ravensburg_new_files | 150x150 | Category:Mauser
Category:Bodenseekreis | User:AndreasPraefcke/Bodenseekreis_new_files | 150x150 | Category:Populated places on Lake Constance
Category:Wuppertal | User:Atamari/BotGallery/Wuppertal | 200x200
Category:Solingen | User:Atamari/BotGallery/Solingen | 200x200
Category:Kreis Mettmann | User:Atamari/BotGallery/Kreis Mettmann | 200x200
Category:Northern Ostrobothnia | User:Apalsola/recent uploads/Northern Ostrobothnia | 200x200
Category:Aviation in Finland | User:Apalsola/recent uploads/Aviation in Finland | 200x200 | Category:Aircraft registered in Finland
Category:Aircraft registered in Finland | User:Apalsola/recent uploads/Aircraft registered in Finland | 200x200 |
Category:Roads in Finland(depth=5) | User:Apalsola/recent uploads/Roads in Finland | 200x200
Category:Churches in Finland | User:Apalsola/recent uploads/Churches in Finland | 200x200 | Category:Lutherans from Finland
Category:Kainuu | User:Apalsola/recent uploads/Kainuu | 200x200
Category:Lapland, Finland | User:Apalsola/recent uploads/Lapland, Finland | 200x200
Category:Wiesbaden | User:SBT/Wiesbaden | 200x200
Category:Railway coaches of Germany, Category:Multiple units, motor coaches and railcars of Germany, Category:Locomotives of Germany, Category:Trains at train stations in Germany, Category:Rail transport companies of Germany | User:Nordlicht8/Rail Germany | 200x200
Category:São Paulo, Category:São Paulo (city) | User:Jcornelius/São Paulo | 200x200
Category:Public transport in Portugal | User:Jcornelius/Portugal Public Transport | 200x200
Category:Files from the European Parliament Flickr stream | User:Jcornelius/EP | 200x200
Category:Files from GUE/NGL Flickr stream | User:Jcornelius/GUENGL | 200x200
Category:Berlin U-Bahn | User:Jcornelius/Berlin U-Bahn | 200x200
Category:Rail transport in Brazil(depth=7) | User:Jcornelius/Rail transport in Brazil | 200x200
Category:Mittelrhein | User:Christian1985/Mittelrhein | 200x200 | Category:Friedrich von Gärtner
Category:Festivalsommer | User:Achim_Raschka/Festivalsommer/OgreBot/gallery | 200x200
Category:Mainz, Category:Rhenish Hesse | User:Symposiarch/Mainz | 150x150
Category:Military of Finland | User:MKFI/Military of Finland | 200x200 | Category:Siege of Leningrad | Category:Things named after Carl Gustaf Emil Mannerheim
Category:Umgebinde | User:WikiAnika/Umgebinde | 150x150 | Category:Tornow-Klenica group | Category:Nazism | Category:Slavic nationalism | Category:Wendish Crusade
Category:Transport in Vienna | User:Tokfo/novaj interesaj fotoj | 200x200 NO_INDEX | Category:Burials at Imperial Crypt | Category:Wikimedia Austria | Category:International Atomic Energy Agency
Category:Tram transport | User:Tokfo/Tram transport | 200x200 NO_INDEX
Category:Transport in Austria | User:Tokfo/Transport in Austria | 200x200 NO_INDEX | Category:Wikimedia Austria | Category:Szent Jakab-út, Magyarország
Category:Vienna | User:Tokfo/Vienna | 200x200 DAYS_PER_GALLERY(3), NO_INDEX | Category:Monuments and memorials to Tomáš Garrigue Masaryk | Category:Psychoanalysis | Category:Things named after Maria Theresa of Austria | Category:Maria Theresa of Austria | Category:Wikimedia Austria | Category:Films scored by Max Steiner | Category:Eyes Wide Shut | Category:István Széchenyi | Category:Companies listed on the Vienna Stock Exchange | Category:Alcide De Gasperi | Category:Honorary doctorates of the University of Vienna | Category:Gyula Rimanóczy | Category:Honorary citizens of Vienna | Category:Ferenc Nopcsa | Category:Faculty of the University of Vienna | Category:Österreichische Bundesbahnen | Category:Józef Antoni Poniatowski | Category:Things named after Theodor Herzl | Category:Recipients of the Order of Franz Joseph | Category:National and Kapodistrian University of Athens
Category:Antarctica | User:4ing/Antarctica | 150x150 NO_SUBPAGE | Category:Tierra del Fuego | Category:Weather and climate of the Arctic | Category:Cap Horniers | Category:Falkland Islands | Category:James Cook | Category:Polar research | Category:Maps of the world without Antarctica
Category:Hamburg Metal Dayz | User:Huhu Uet/Festivals/Hamburg Metal Dayz | 200x200
Category:Ackerfestival | User:Huhu Uet/Festivals/Ackerfestival | 200x200
Category:Wake Up Pi | User:Huhu Uet/Festivals/Wake Up Pi | 200x200
Category:Tower-Festival Heist | User:Huhu Uet/Festivals/Tower-Festival Heist | 200x200
Category:Rock 'N' Rose Festival | User:Huhu Uet/Festivals/Rock 'N' Rose Festival | 200x200
Category:Deichpiraten Festival | User:Huhu Uet/Festivals/Deichpiraten Festival | 200x200
Category:Medieval festivals in Uetersen | User:Huhu Uet/Festivals/Medieval festivals in Uetersen | 200x200
Category:Historical images of Uetersen | User:Huhu Uet/Uetersen/Historical images of Uetersen | 200x200
Category:Postcards of Uetersen | User:Huhu Uet/Uetersen/Postcards of Uetersen | 200x200
Category:Monuments and memorials in Uetersen | User:Huhu Uet/Uetersen/Monuments and memorials in Uetersen | 200x200
Category:Parks in Uetersen | User:Huhu Uet/Uetersen/Parks in Uetersen | 200x200
Category:Buildings in Uetersen | User:Huhu Uet/Uetersen/Buildings in Uetersen | 200x200
Category:Festivalsommer 2014 | User:Huhu Uet/Festivalsommer/Festivalsommer 2014 | 200x200
Category:Heathen Rock Festival 2014 | User:Huhu Uet/Festivals/Heathen Rock Festival 2014 | 200x200
Category:2014 at Hamburg Airport | User:Huhu Uet/2014 at Hamburg Airport | 200x200
Category:Wilwarin Festival 2014 | User:Huhu Uet/Festivals/Wilwarin Festival 2014 | 200x200
Category:Festivalsommer 2015 | User:Huhu Uet/Festivalsommer/Festivalsommer 2015 | 235x235
Category:Festivalsommer 2016 | User:Huhu Uet/Festivalsommer/Festivalsommer 2016 | 235x235
Category:Festivalsommer 2017 | User:Huhu Uet/Festivalsommer/Festivalsommer 2017 | 235x235
Category:Festivalsommer 2018 | User:Huhu Uet/Festivalsommer/Festivalsommer 2018 | 235x235
Category:Festivalsommer 2019 | User:Huhu Uet/Festivalsommer/Festivalsommer 2019 | 235x235
Category:Festivalsommer 2020 | User:Huhu Uet/Festivalsommer/Festivalsommer 2020 | 235x235
Category:Falkland Islands | User:4ing/Falkland Islands | 150x150 NO_SUBPAGE | Category:Animals of the Falkland Islands
Category:Vorarlberg | User:Plani/Vorarlberg new files | 150x150 | Category:Lake Constance | Category:Allgäuer Alpen
Category:Konrad Stürtzel von Buchheim | User:HeinrichStuerzl/Konrad Stürtzel von Buchheim | 150x150 NO_SUBPAGE
Category:Mobile upload | User:Didym/Mobile upload | 150x150 DAYS_PER_GALLERY(5)
Category:Bundeswehr | User:Indeedous/Recent Uploads/Bundeswehr | 150x150 NO_SUBPAGE | Category:Enigma machine
Category:Jena | User:Indeedous/Recent Uploads/Jena | 150x150 NO_SUBPAGE | Category:Carl Zeiss lenses | Category:Carl Zeiss microscopes | Category:Karl Marx | Category:Lafayette Street (Manhattan) | Category:Things named after Jena
Category:Schöneiche bei Berlin | User:Indeedous/Recent Uploads/Schöneiche | 150x150 NO_SUBPAGE
Category:Cottbus | User:Indeedous/Recent Uploads/Cottbus | 150x150 NO_SUBPAGE
Category:Hennigsdorf | User:Indeedous/Recent Uploads/Hennigsdorf | 150x150 NO_SUBPAGE
Category:Train stations in Thuringia | User:Indeedous/Recent Uploads/Bahnhöfe Thüringen | 150x150 NO_SUBPAGE
Category:Ambulances in Germany | User:Indeedous/Recent Uploads/Rettungsdienst | 150x150 NO_SUBPAGE
Category:Canton of Thurgau | User:Pingelig/Recent uploads/Canton of Thurgau | 200x200 | Category:Stadler Rail | Category:Carl Gustav Jung | Category:Stadler Rail | Category:Carl Gustav Jung
Category:Heilbronn, Category:Landkreis Heilbronn, Category:Hohenlohekreis, Category:Rhein-Neckar-Kreis, Category:Neckar-Odenwald-Kreis, Category:Lucas Cranach d. Ä., Category:Lucas Cranach the Younger | User:TRXX-TRXX/NewFiles | 150x150 | Category:Flora of Rhein-Neckar-Kreis | Category:Flora of Rhein-Neckar-Kreis by month
Category:Ennepe-Ruhr-Kreis | User:Holger1959/EN | NO_SUBPAGE
Category:Rail transport in South Korea | User:-revi/Korail | 150x150 DAYS_PER_GALLERY(31), NO_INDEX, SHOW_FILENAME
Category:History of Georgia, Category:Culture of Georgia | User:Kober/Georgia | 200x200 NO_SUBPAGE | Category:Stalinism | Category:Saint George churches | Category:Things named after Joseph Stalin | Category:Armenian language | Category:Colchis | Category:Saint George | Category:Recipients of St. George's Order of Victory | Category:Soviet Union | Category:Joseph Stalin | Category:Black Sea | Category:Recipients of the Presidential Order of Excellence
Category:Rail transport infrastructure in Japan | User:콩가루/일본철도 | 200x200 DAYS_PER_GALLERY(31), NO_INDEX
Category:Sugar factories | User:Sevku/Sugar factories | 200x200 DAYS_PER_GALLERY(31)
Category:Schongau | User:Karl432/Schongau | 200x200 NO_SUBPAGE
Category:Appen musiziert | User:Huhu Uet/Festivals/Appen musiziert | 200x200 DAYS_PER_GALLERY(31), NO_INDEX
Category:Appen musiziert 2014 | User:Huhu Uet/Festivals/Appen musiziert 2014 | 200x200 DAYS_PER_GALLERY(31), NO_INDEX
Category:Alaska | User:Aconcagua/Alaska_new | x150 NO_INDEX, DAYS_PER_GALLERY(31) | Category:Inuit | Category:Franklin Expedition | Category:Northwest Passage | Category:Pacific Ranges | Category:Athabaskan | Category:People associated with William Duncan (missionary)
Category:Public transport in Ontario | User:*Youngjin/GTA transit | 150x150 DAYS_PER_GALLERY(31)
Category:Police of Austria | User:Plani/Austrian Police new files | 150x150 NO_SUBPAGE | Category:Mirnesa Becirovic‎ | Category:Mirneta Becirovic‎ | Category:Christoph Sumann‎
Category:Mozambique, Category:Maputo | User:Jcornelius/Mozambique | 200x200 | Category:Portuguese language
Category:Guinea-Bissau | User:Jcornelius/Guinea-Bissau | 200x200 | Category:Portuguese language
Category:Angola | User:Jcornelius/Angola | 200x200 | Category:Portuguese language
Category:Hörnerfest 2014 | User:Huhu Uet/Festivals/Hörnerfest 2014 | 220x220
Category:Pipe organs in Germany | User:Wikiwal/Category:Pipe organs in Germany |
Category:Maps of wars, Category:Maps of the world showing ongoing conflicts | User:Magog the Ogre/Maps of conflicts | DAYS_PER_GALLERY(31)
Category:Black Way Open Air 2014 | User:Huhu Uet/Festivals/Black Way Open Air 2014 | 220x220
Category:Live action role-playing games|User:RalfHuels/LARP| 150x150 NO_SUBPAGE
Category:Agricultural chemistry | User:Kopiersperre/Agrochem | DAYS_PER_GALLERY(31) | Category:Dry toilets | Category:Milk processing | Category:Agricultural chemists | Category:Compost
Category:Langeln Open Air 2014 | User:Huhu Uet/Festivals/Langeln Open Air 2014 | 220x220
Category:Powiat kamieński, Category:Gmina Dygowo, Category:Kołobrzeg, Category:Rhein-Neckar-Kreis, Category:Heidelberg | User:Zwiadowca21/NewFiles | 150x150 | Category:Honorary citizens of Heidelberg | Category:Spectroscopy
Category:Headbangers Open Air 2014 | User:Huhu Uet/Festivals/Headbangers Open Air 2014 | 230x230
Category:Rail transport in Finland | User:Apalsola/recent uploads/Rail transport in Finland | 200x200
Category:2014 Wacken Open Air | User:Huhu Uet/Festivals/Wacken Open Air 2014 | 230x230
Category:Landkreis Straubing-Bogen | User:Gomera-b/BotGallery/Straubing-Bogen | 230x230
Category:Ackerfestival 2014 | User:Huhu Uet/Festivals/Ackerfestival 2014 | 230x230
Category:Wake Up Pi 2014 | User:Huhu Uet/Festivals/Wake Up Pi 2014 | 230x230
Category:Tower-Festival Heist 2014 | User:Huhu Uet/Festivals/Tower-Festival Heist 2014 | 230x230
Category:Rock 'N' Rose Festival 2014 | User:Huhu Uet/Festivals/Rock 'N' Rose Festival 2014 | 230x230
Category:Media from the Israeli Police | User:geagea/Media from the Israeli Police/New files | 200x200 DAYS_PER_GALLERY(1)
Category:Transport maps | User:Chumwa/OgreBot/Transport Maps | 200x200 WARNING | Category:SVG BSicons | Category:BSicon
Category:Public transport information, Category:Public transport signs, Category:Public transport lines | User:Chumwa/OgreBot/Public transport information | 200x200 WARNING | Category:SVG BSicons | Category:BSicon
Category:Elbriot 2014| User:Huhu Uet/Festivals/Elbriot 2014 | 230x230
Category:Karlsruhe | User:ireas/OgreBot/Karlsruhe | 230x230 NO_INDEX
Category:Clocks | User:Tokfo/Clocks | 200x200 NO_INDEX | Category:Rolex Sports Car Series | Category:GPS receivers | Category:Jubilee Medal "50 Years of Victory in the Great Patriotic War 1941–1945" | Category:Apple Inc. | Category:Healy Hall
Category:Hamburg Metal Dayz 2014 | User:Huhu Uet/Festivals/Hamburg Metal Dayz 2014 | 230x230
Category:Trier(depth=10) | User:Berthold_Werner/OgreBot| NO_SUBPAGE, WARNING | Category:Karl Marx
Category:East Frisia | User:Matthias_Süßen/East Frisia | 150x150 DAYS_PER_GALLERY(31), MODE("packed")
Category:PD KoreaGov, Category:PD-South Korea | User:-revi/PD-대한민국 | 150x150 NO_INDEX, DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:Uetersener Hafennacht 2014 | User:Huhu Uet/Festivals/Uetersener Hafennacht 2014 | 230x230
Category:Streets in Paris | User:Paris 16/Recent uploads | 200x200 DAYS_PER_GALLERY(3) | Category:Musée du Louvre | Category:Institut de France | Category:Ministère de la Culture (France) | Category:Events at Hôtel du ministre des Affaires étrangères | Category:Burials at Père Lachaise Cemetery | Category:European Space Agency | Category:Senate of France | Category:People buried at the Panthéon | Category:Alumni of the Académie Carmen | Category:People associated with Eiffel Tower | Category:French Open tennis champions | Category:Louis Figuier | Category:Zoo de Vincennes | Category:Collections of Musée national de la Marine | Category:Burials at the Père-Lachaise Cemetery | Category:Copies of Nike of Samothrace | Category:Architects of the Palais du Louvre | Category:Storming of the Bastille, 14 July 1789 | Category:Moulin Rouge | Category:Gilbert du Motier, Marquis de La Fayette
Category:National Museum of Korea | User:-revi/국립중앙박물관 | 150x150 NO_INDEX, DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:Wacken Roadshow 2014 | User:Huhu Uet/Festivals/Wacken Roadshow 2014 | 230x230
Category:Elmshorner Eisvergnügen 2014 | User:Huhu Uet/Festivals/Elmshorner Eisvergnügen 2014 | 230x230
Category:Wikimedia Sverige | Commons:Wikimedia Sverige/recent uploads | 150x150 DAYS_PER_GALLERY(31), MODE("packed") | Category:Content made available through Wikimedia Sverige partnerships‎ | Category:Content made available through Wikimaps Nordic | Category:Wikipedians in Sweden‎ | Category:Members of Wikimedia Sverige
Category:Unser Song für Österreich | User:Huhu Uet/Festivalsommer/Unser Song für Österreich | 235x235
Category:Heathen Rock Festival 2015 | User:Huhu Uet/Festivalsommer/Heathen Rock Festival 2015 | 235x235
Category:Heathen Rock Festival Warm-Up Party 2015 | User:Huhu Uet/Festivalsommer/Heathen Rock Festival Warm-Up Party 2015 | 235x235
Category:Bürgerschaftswahl in Hamburg 2015 | User:Huhu Uet/Festivalsommer/Bürgerschaftswahl in Hamburg 2015 | 235x235
Category:Ravenna | User:AlessioMela/Ravenna | 150x150 DAYS_PER_GALLERY(31)
Category:Hamburger Motorrad Tage 2015 | User:Huhu Uet/Festivalsommer/Hamburger Motorrad Tage 2015 | 235x235
Category:ESC Clubkonzert 2015 | User:Huhu Uet/Festivalsommer/ESC Clubkonzert 2015 | 235x235
Category:Asti | User:Incola/Asti | 150x150 DAYS_PER_GALLERY(31)
Category:Landkreis Oberallgäu, Category:Kempten (Allgäu), Category:Škoda, Category:Tatra (company), Category:Vehicles of the Czech Republic by brand | User:Hilarmont/BotGallery | 150x150
Category:Hafenklang | User:Huhu Uet/Festivalsommer/Hafenklang | 240x240
Category:Dreamshade/Tenside Tour 2015 | User:Huhu Uet/Festivalsommer/Dreamshade/Tenside Tour 2015 | 240x240
Category:Holsten Brauereifest 2015 | User:Huhu Uet/Festivals/Holsten Brauereifest 2015 | 230x230
Category:Bonn | User:Sir James/Bonn | 150x150 DAYS_PER_GALLERY(1), NO_INDEX | Category:Karl Marx
Category:Pirate Satellite Festival 2015 | User:Huhu Uet/Festivals/Pirate Satellite Festival 2015 | 230x230
Category:Hafengeburtstag 2015 | User:Huhu Uet/Festivals/Hamburger Hafengeburtstag 2015 | 230x230
Category:Ilm-Kreis | User:Aschroet/Uploads/Ilm-Kreis | 150x150
Category:Hafen Rock 2015 | User:Huhu Uet/Festivals/Hafen Rock 2015 | 230x230
Category:Nordhausen | User:Vincent Eisfeld/Uploads/Nordhausen | 150x150
Category:NDR Hafengeburtstag 2015 | User:Huhu Uet/Festivals/NDR Hafengeburtstag 2015 | 230x230
Category:Discomove Hamburg 2015 | User:Huhu Uet/Festivals/Discomove Hamburg 2015 | 230x230
Category:Wilwarin Festival 2015 | User:Huhu Uet/Festivals/Wilwarin Festival 2015 | 235x235
Category:Rock im Kranhaus 2015 | User:Huhu Uet/Festivals/Rock im Kranhaus 2015 | 235x235
Category:Jazz 'n Roses 2015 | User:Huhu Uet/Festivals/Jazz 'n Roses 2015 | 235x235
Category:Hamburg Harley Days 2015 | User:Huhu Uet/Festivals/Hamburg Harley Days 2015 | 235x235
Category:Schlagermove 2015 | User:Huhu Uet/Festivals/Schlagermove 2015 | 235x235
Category:Hörnerfest 2015 | User:Huhu Uet/Festivals/Hörnerfest 2015 | 235x235
Category:Straubing | User:Gomera-b/BotGallery/Straubing | 230x230
Category:Food packaging‎ | User:Josve05a/Packaging/Food | 150x150 DAYS_PER_GALLERY(1) | Category:Cling film‎ | Category:Foil cupcake liners | Category:Paper cupcake liners | Category:Health mark‎ | Category:Verkade model of Tsar Peter's House Zaandam‎ | Category:Packaged sushi
Category:2015 Wacken Open Air | User:Huhu Uet/Festivals/Wacken Open Air 2015 | 235x235
Category:Black and white photographs of Wacken Open Air 2015 | User:Huhu Uet/Festivals/Black and white photographs of Wacken Open Air 2015 | 235x235
Category:Reload Festival 2015 | User:Huhu Uet/Festivals/Reload Festival 2015 | 235x235
Category:Candy bars | User:Josve05a/Candy/Candy bars | 150x150 DAYS_PER_GALLERY(1) | Category:Halvah bars | Category:Museum Ritter (Waldenbuch)
Category:Candy of Sweden | User:Josve05a/Candy/Sweden | 150x150 DAYS_PER_GALLERY(1)
Category:Gummi candy | User:Josve05a/Candy/Gummi | 150x150 DAYS_PER_GALLERY(1)
Category:Wrapped candy | User:Josve05a/Packaging/Candy | 150x150 DAYS_PER_GALLERY(1)
Category:Elbriot 2015 | User:Huhu Uet/Festivals/Elbriot 2015 | 235x235
Category:Langeln Open Air 2015 | User:Huhu Uet/Festivals/Langeln Open Air 2015 | 235x235
Category:Villa Summer Bash 2015 | User:Huhu Uet/Festivals/Villa Summer Bash 2015 | 235x235
Category:Headbangers Open Air 2015 | User:Huhu Uet/Festivals/Headbangers Open Air 2015 | 235x235
Category:Appen musiziert 2015 | User:Huhu Uet/Festivals/Appen musiziert 2015 | 235x235
Category:Dresden | User:derbrauni/NeuesDresden | 150x150 DAYS_PER_GALLERY(1) | Category:August II the Strong | Category:Coding da Vinci: Ost 2022
Category:SoFiE Festival 2015 | User:Huhu Uet/Festivals/SoFiE Festival 2015 | 235x235
Category:Louvre Pyramid | User:Josve05a/FOP/France | 150x150 DAYS_PER_GALLERY(1)
Category:Rock im Kranhaus IV | User:Huhu Uet/Festivals/Rock im Kranhaus IV | 235x235
Category:Hamburg Metal Dayz 2015 | User:Huhu Uet/Festivals/Hamburg Metal Dayz 2015 | 235x235
Category:Hawaii | User:Howcheng/Recent uploads/Hawaii | DAYS_PER_GALLERY(1), NO_INDEX, SHOW_FILENAME | Category:RIMPAC | Category:Barack Obama | Category:United States Forces Japan | Category:Russian-American Company | Category:Sun Yat-sen | Category:Starr Environmental | Category:Alumni of the University of Hawaii | Category:Recipients of the Royal Order of Kamehameha I | Category:Ukulele players | Category:Slide guitarists | Category:Pedal steel guitars | Category:Pearl Harbor attack - Japanese forces | Category:Attack on Pearl Harbor - Allied Forces | Category:Nicole Kidman | Category:Jason Scott Lee | Category:Native Hawaiians
Category:Conejo Valley | User:Howcheng/Recent uploads/Conejo Valley | NO_SUBPAGE, NO_INDEX, SHOW_FILENAME
Category:Country Special 2015 | User:Huhu Uet/Festivals/Country Special 2015 | 235x235
Category:Landkreis Bautzen | User:J budissin/Uploads/BZ | 235x235
Category:Luxembourg | User:Zinneke/Nei Biller iwwer Lëtzebuerg | 130x130 | Category:French language | Category:German language | Category:Philip II of Spain | Category:House of Nassau | Category:Things named after Luxembourg | Category:Philip V of Spain | Category:Ardennes | Category:Coats of arms of the Holy Roman Empire | Category:Cultural heritage monuments in Belgium | Category:Internal Schengen borders | Category:Things named after Charles IV, Holy Roman Emperor | Category:Saarland | Category:Euro | Category:Spanish Netherlands | Category:Benelux | Category:House of Luxembourg | Category:External Schengen borders | Category:Recipients of the Order of the Oak Crown | Category:Dukes of Luxembourg | Category:Orders, decorations and medals of Luxembourg | Category:United Kingdom of the Netherlands | Category:Counts of Luxembourg | Category:Nomenclature of Territorial Units for Statistics | Category:Things named after Joseph II, Holy Roman Emperor | Category:Names in Luxembourgish | Category:Maria Theresa of Austria
Category:Elmshorner Eisvergnügen 2015 | User:Huhu Uet/Festivals/Elmshorner Eisvergnügen 2015 | 235x235
Category:Waterkant X-Mas Bash 2015 | User:Huhu Uet/Festivals/Waterkant X-Mas Bash 2015 | 235x235
Category:Museu Nacional, Rio de Janeiro | User:-revi/MNRJ | DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:Philately, Category:Postal workers, Category:Mail, Category:Post in art, Category:Post boxes, Category:Customs Declaration, Category:Envelopes, Category:Postal flags, Category:Hauspost, Category:Instructional labels, Category:Letter bombs, Category:Letters (written messages), Category:Local posts, Category:Philatelic and postal maps, Category:Metered postage, Category:Parcel post, Category:Post offices, Category:Postal equipment, Category:Postal history, Category:Postal markings, Category:Postal orders, Category:Postal organizations, Category:Postal stationery, Category:Receipts of posting, Category:Postal signs, Category:Stamps, Category:Transport of post, Category:Postal cards by subject, Category:Postal vehicles by country | User:Ww2censor/Recent philatelic uploads | 150x150 DAYS_PER_GALLERY(5), NO_INDEX, SHOW_FILENAME | Category:Postcards | Category:Philatelists from Russia and Soviet Union | Category:People of Italy on stamps | Category:Franklin Delano Roosevelt | Category:London town postal districts | Category:Postcards by country | Category:London region postal towns | Category:E-mail | Category:Sealing stamps | Category:Letterheads | Category:Stadsarchief Amsterdam | Category:Feldpostbriefe von Hans | Category:Pauline epistles | Category:Telephone cards | Category:Photos by HiRISE | Category:Things named after George V of the United Kingdom‎ | Category:Delivery vehicles by country
Category:Travel maps, Category:Route maps , Category:Communication maps | User:Chumwa/OgreBot/Travel and communication maps | 200x200 WARNING | Category:Transport maps‎ | Category:Road maps‎ | Category:SVG BSicons | Category:BSicon
Category:Uploaded from Korean Wikipedia using UploadWizard | User:-revi/kowiki | 150x150 NO_INDEX, DAYS_PER_GALLERY(7), SHOW_FILENAME
Category:Landkreis Görlitz | User:DCB/Landkreis Görlitz | 150x150
Category:S-Bahn Dresden | User:DCB/S-Bahn Dresden | 150x150
Category:Mountain (band), Category:Corky Laing, Category:Phil Parker, Category:Joe Venti | User:Huhu Uet/Festivals/Corky Laing's Mountain | 235x235
Category:Rock im Kranhaus Vol. 1/2016 | User:Huhu Uet/Festivals/Rock im Kranhaus Vol. 1/2016 | 235x235
Category:Primal Fear supp.: Brainstorm & Striker | User:Huhu Uet/Festivals/Primal Fear supp.: Brainstorm & Striker | 235x235
Category:Van Wolfen "Cigarbox-Experiment" Vol. 1 | User:Huhu Uet/Festivals/Van Wolfen "Cigarbox-Experiment" Vol. 1 | 235x235
Category:Uploaded with video2commons | User:Atlasowa/New video2commons | 200x200 SHOW_FILENAME
Category:Uploaded with videoconvert | User:Atlasowa/New videoconvert | 200x200 SHOW_FILENAME
Category:Logos(depth=0), Category:Unidentified logos‎(depth=0) | User:Josve05a/Logos | DAYS_PER_GALLERY(11)
Category:Heathen Rock Festival 2016 | User:Huhu Uet/Festivals/Heathen Rock Festival 2016 | 235x235
Category:CeBIT supported by Wikimedia Deutschland 2016 | User:Huhu Uet/Events/CeBIT 2016 | 235x235
Category:Featured pictures of project Festivalsommer, Category:Quality images of project Festivalsommer, Category:Valued images of project Festivalsommer | User:Atamari/BotGallery/Festivalsommer gallery of FI, QI and VI | 150x150 DAYS_PER_GALLERY(31)
Category:Pronunciation(depth=3) | Commons:WikiProject Pronunciation/recent uploads | 150x150 DAYS_PER_GALLERY(2)
Category:Kakival 2016 | User:Huhu Uet/Festivals/ Kakival 2016 | 235x235
Category:Nacht der Gix 2016 | User:Huhu Uet/Festivals/Nacht der Gix 2016 | 235x235
Category:Hafen Rock 2016 | User:Huhu Uet/Festivals/Hafen Rock 2016 | 235x235
Category:NDR Hafengeburtstag 2016 | User:Huhu Uet/Festivals/NDR Hafengeburtstag 2016 | 235x235
Category:Hafengeburtstag 2016 | User:Huhu Uet/Festivals/Hafengeburtstag 2016 | 235x235
Category:MPS Hohenwestedt 2016 | User:Huhu Uet/Festivals/MPS Hohenwestedt 2016 | 235x235
Category:Rabbis, Category:Synagogues, Category:Yeshivas | User:ביקורת/Rabbis | 200x200 DAYS_PER_GALLERY(1)
Category:Holsten Brauereifest 2016 | User:Huhu Uet/Festivals/Holsten Brauereifest 2016 | 235x235
Category:Naantali | User:Makele-90/recent uploads/Naantali | 350x350 DAYS_PER_GALLERY(31)
Category:Birds of Finland | User:Makele-90/recent uploads/Birds of Finland | 350x350 DAYS_PER_GALLERY(31)
Category:Finland Proper | User:Makele-90/recent uploads/Finland Proper | 350x350 DAYS_PER_GALLERY(31)
Category:Protected areas of Finland | User:Makele-90/recent uploads/Protected areas of Finland | 350x350 DAYS_PER_GALLERY(31)
Category:Archipelago Sea | User:Makele-90/recent uploads/Archipelago Sea | 350x350 DAYS_PER_GALLERY(31)
Category:Jurmo | User:Makele-90/recent uploads/Jurmo | 350x350 DAYS_PER_GALLERY(31)
Category:Images from Wiki Loves Earth 2016 in India | User:Yohannvt/daily uploads/Wiki Loves Earth 2016 in India | 350x350 DAYS_PER_GALLERY(1)
Category:Landkreis Oberspreewald-Lausitz | User:Z thomas/OSL | 150x150 DAYS_PER_GALLERY(31)
Category:Rawk Attack 2016 | User:Huhu Uet/Festivals/Rawk Attack 2016 | 235x235
Category:Hamburg Harley Days 2016 | User:Huhu Uet/Festivals/Hamburg Harley Days 2016 | 235x235
Category:Books from National Library of Korea | User:-revi/NL | 150x150 NO_INDEX, DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:RiK Open Air 2016 | User:Huhu Uet/Festivals/RiK Open Air 2016 | 235x235
Category:Hörnerfest 2016 | User:Huhu Uet/Festivals/Hörnerfest 2016 | 236x236
Category:Langeln Open Air 2016 | User:Huhu Uet/Festivals/Langeln Open Air 2016 | 236x236
Category:Headbangers Open Air 2016 | User:Huhu Uet/Festivals/Headbangers Open Air 2016 | 236x236
Category:Bikers Blood for Help 2016 | User:Huhu Uet/Festivals/Bikers Blood for Help 2016 | 236x236
Category:2016 Wacken Open Air | User:Huhu Uet/Festivals/Wacken Open Air 2016 | 236x236
Category:Elbriot 2016 | User:Huhu Uet/Festivals/Elbriot 2016 | 236x236
Category:Rock Spektakel 2016 | User:Huhu Uet/Festivals/Rock Spektakel 2016 | 236x236
Category:Reload Festival 2016 | User:Huhu Uet/Festivals/Reload Festival 2016 | 236x236
Category:Cultural monuments in the Czech Republic with known IDs(depth=0) | Commons:Cultural monuments in the Czech Republic/new uploads | DAYS_PER_GALLERY(7), SHOW_FILENAME
Category:Alstervergnügen 2016 | User:Huhu Uet/Festivals/Alstervergnügen 2016 | 236x236
Category:Tag der Legenden 2016 | User:Huhu Uet/Festivals/Tag der Legenden 2016 | 236x236
Category:Blues im Kranhaus 2016 | User:Huhu Uet/Festivals/Blues im Kranhaus 2016 | 236x236
Category:Taken with Sony DSC-HX50 | User:DCB/Taken with Sony DSC-HX50 | 200x200 DAYS_PER_GALLERY(31)
Category:Hamburg Metal Dayz 2016 | User:Huhu Uet/Festivals/Hamburg Metal Dayz 2016 | 237x237
Category:Deutscher Radiopreis 2016 | User:Huhu Uet/Festivals/Deutscher Radiopreis 2016 | 237x237
Category:Zöller & Konsorten - Flucht nach vorn Tour 2016 | User:Huhu Uet/Festivals/Zöller & Konsorten - Flucht nach vorn Tour 2016 | 238x238
Category:Jam-Session - Stadtteilcafé Elmshorn (Part 1) | User:Huhu Uet/Festivals/Jam-Session - Stadtteilcafé Elmshorn (Part 1) | 238x238
Category:Wacken Winter Nights 2017 | User:Huhu Uet/Festivals/Wacken Winter Nights 2017 | 238x238
Category:Heathen Rock Festival 2017 | User:Huhu Uet/Festivals/Heathen Rock Festival 2017 | 238x238
Category:CeBIT 2017 | User:Huhu Uet/Events/CeBIT 2017 | 238x238
Category:Hannover Messe 2017 | User:Huhu Uet/Events/Hannover Messe 2017 | 238x238
Category:Jam-Session - Stadtteilcafé Elmshorn (Part 2) | User:Huhu Uet/Festivals/Jam-Session - Stadtteilcafé Elmshorn (Part 2) | 238x238
Category:Jam-Session - Stadtteilcafé Elmshorn (Part 1) | User:Huhu Uet/Festivals/Jam-Session - Stadtteilcafé Elmshorn (Part 1) | 238x238
Category:Wacken Winter Nights 2017 | User:Huhu Uet/Festivals/Wacken Winter Nights 2017 | 238x238
Category:Heathen Rock Festival 2017 | User:Huhu Uet/Festivals/Heathen Rock Festival 2017 | 238x238
Category:CeBIT 2017 | User:Huhu Uet/Events/CeBIT 2017 | 238x238
Category:Hannover Messe 2017 | User:Huhu Uet/Events/Hannover Messe 2017 | 238x238
Category:Jam-Session - Stadtteilcafé Elmshorn (Part 2) | User:Huhu Uet/Festivals/Jam-Session - Stadtteilcafé Elmshorn (Part 2) | 238x238
Category:Passion Sports Convention 2017 | User:Huhu Uet/Events/Passion Sports Convention 2017 | 238x238
Category:Trinidad and Tobago | User:Grueslayer/News | 150x150 NO_SUBPAGE | Category:Viceroyalty of New Granada
Category:Images from Wiki Loves Earth 2017 in Ukraine | User:Holger1959/WLE17/UA | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-BB | User:Holger1959/WLE17/DE/BB | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-BE | User:Holger1959/WLE17/DE/BE | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-BW | User:Holger1959/WLE17/DE/BW | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-BY | User:Holger1959/WLE17/DE/BY | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-HB | User:Holger1959/WLE17/DE/HB | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-HE | User:Holger1959/WLE17/DE/HE | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-HH | User:Holger1959/WLE17/DE/HH | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-MV | User:Holger1959/WLE17/DE/MV | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-NI | User:Holger1959/WLE17/DE/NI | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-NW | User:Holger1959/WLE17/DE/NW | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-RP | User:Holger1959/WLE17/DE/RP | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-SH | User:Holger1959/WLE17/DE/SH | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-SL | User:Holger1959/WLE17/DE/SL | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-SN | User:Holger1959/WLE17/DE/SN | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-ST | User:Holger1959/WLE17/DE/ST | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2017, DE-TH | User:Holger1959/WLE17/DE/TH | DAYS_PER_GALLERY(1)
Category:Hafen Rock 2017 | User:Huhu Uet/Festivals/Hafen Rock 2017 | 238x238
Category:NDR Hafengeburtstag 2017 | User:Huhu Uet/Festivals/NDR Hafengeburtstag 2017 | 238x238
Category:Hafengeburtstag 2017 | User:Huhu Uet/Events/Hafengeburtstag 2017 | 238x238
Category:Holsten Brauereifest 2017 | User:Huhu Uet/Festivals/Holsten Brauereifest 2017 | 238x238
Category:Robotron | User:Stefan Kühn/Robotron | 150x150
Category:Images from Wiki Loves Earth 2017 in India | User:Jim Carter/daily uploads/Wiki Loves Earth 2017 in India | 350x350 DAYS_PER_GALLERY(1)
Category:Hamburg Harley Days 2017 | User:Huhu Uet/Festivals/Hamburg Harley Days 2017 | 238x238
Category:Hörnerfest 2017 | User:Huhu Uet/Festivals/Hörnerfest 2017 | 238x238
Category:NDR Sommertour 2017 | User:Huhu Uet/Festivals/NDR Sommertour 2017 | 238x238
Category:Headbangers Open Air 2017 | User:Huhu Uet/Festivals/Headbangers Open Air 2017 | 238x238
Category:Dresden | User:Frze/Category:Dresden uploads | 175x175 SHOW_FILENAME | Category:August II the Strong | Category:Coding da Vinci: Ost 2022
Category:Wacken Open Air 2017 photos by Huhu Uet | User:Huhu Uet/Festivals/Wacken Open Air 2017 | 238x238
Category:New York City Subway | User:Drabdullayev17/New York City Subway/recent uploads | 150x150 DAYS_PER_GALLERY(1)
Category:Elbriot 2017 | User:Huhu Uet/Festivals/Elbriot 2017 | 238x238
Category:Reload Festival 2017 | User:Huhu Uet/Festivals/Reload Festival 2017 | 238x238
Category:Rockspektakel 2017 | User:Huhu Uet/Festivals/Rockspektakel 2017 | 238x238
Category:Ackerfestival 2017 | User:Huhu Uet/Festivals/Ackerfestival 2017 | 238x238
Category:Hamburg Metal Dayz 2017 | User:Huhu Uet/Festivals/Hamburg Metel Dayz 2017 | 238x238
Category:Brno | Commons:WikiProject Brno/Uploads | 200x200 | Category:Churches in the Roman Catholic Diocese of Brno | Category:Mendelian inheritance | Category:Films scored by Erich Wolfgang Korngold | Category:Tomáš Garrigue Masaryk | Category:Edvard Beneš | Category:Ludvík Svoboda | Category:Gregor Mendel
Category:STL files | User:EugeneZelenko/STL files | DAYS_PER_GALLERY(31), NO_INDEX, SHOW_FILENAME
Category:Lottes Musiknacht | User:Huhu Uet/Festivals/Lottes Musiknacht | 238x238
Category:Heathen Rock Festival 2018 | User:Huhu Uet/Festivals/Heathen Rock Festival 2018 | 238x238
Category:Files with IMG-date-WA in filename | User:SchlurcherBot/WhatsApp | 238x238 DAYS_PER_GALLERY(7)
Category:Allgäu (depth=15) | User:Hilarmont/Allgäu | 100x100 DAYS_PER_GALLERY(3)
Category:Sports (depth=3) | User:Ytoyoda/botgalleries/Sports | 100x100 DAYS_PER_GALLERY(3)
Category:Ball games (depth=3) | User:Ytoyoda/botgalleries/Ballsports | 100x100 DAYS_PER_GALLERY(8)
Category:Association football (depth=2) | User:Ytoyoda/botgalleries/Associationfootball | 100x100 DAYS_PER_GALLERY(30)
Category:Warsaw (depth=10) | User:Cybularny/Warsaw | DAYS_PER_GALLERY(16) | Category:Honorary citizens of Warsaw | Category:Births in Warsaw
Category:Upper Austria | User:Luftschiffhafen/Upper Austria | 150x150 | Category:People of Upper Austria | Category:Adolf Hitler | Category:People of Upper Austria in art
Category:Wangen im Allgäu (depth=12) | User:Altsprachenfreund/Neue Wangener Bilder | NO_SUBPAGE
Category:Hafengeburtstag 2018 | User:Huhu Uet/Festivals/Hafengeburtstag 2018 | 240x240
Category:Hafen Rock 2018 | User:Huhu Uet/Festivals/Hafen Rock 2018 | 240x240
Category:Blues und Boogie-Woogie Open Air Uetersen 2018 | User:Huhu Uet/Festivals/Blues und Boogie-Woogie Open Air Uetersen 2018 | 240x240
Category:Axel Rudi Pell - Große Freiheit 36 2018 | User:Huhu Uet/Festivals/Axel Rudi Pell - Große Freiheit 36 | 240x240
Category:Crystal Ball - Große Freiheit 36 | User:Huhu Uet/Festivals/Axel Crystal Ball - Große Freiheit 36 | 240x240
Category:Photographs by Revi | User:-revi/BG | 150x150 NO_INDEX, DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:Wiki Loves Earth in South Korea, Category:Wiki Loves Monuments in South Korea | User:-revi/WLX | 150x150 NO_INDEX, DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:Holsten Brauereifest 2018 | User:Huhu Uet/Festivals/Holsten Brauereifest 2018 | 240x240
Category:Hamburg Harley Days 2018 | User:Huhu Uet/Festivals/Hamburg Harley Days 2018 | 240x240
Category:Hörnerfest 2018 | User:Huhu Uet/Festivals/Hörnerfest 2018 | 240x240
Category:Wacken Open Air 2018 photos by Huhu Uet | User:Huhu Uet/Festivals/Wacken Open Air 2018 | 240x240
Category:Wernigerode | User:Migebert/Gallery/Wernigerode | 150x150 DAYS_PER_GALLERY(31)
Category:Osterode am Harz | User:Migebert/Gallery/Osterode | 150x150 DAYS_PER_GALLERY(31)
Category:Landkreis Harz | User:Migebert/Gallery/LKHarz | 150x150 DAYS_PER_GALLERY(31) | Category:Wernigerode | Category:Counts of Ballenstedt
Category:Landkreis Göttingen | User:Migebert/Gallery/LKGöttingen | 150x150 DAYS_PER_GALLERY(31) | Category:Osterode am Harz | Category:Alumni of Georg-August University of Göttingen | Category:Faculty of Georg-August University of Göttingen | Category:Brothers Grimm
Category:Salzlandkreis | User:Migebert/Gallery/LKSalzland | 150x150 DAYS_PER_GALLERY(31)
Category:Wikimania 2019 | User:-revi/Wikimania/2019 | 200x200 DAYS_PER_GALLERY(31)
Category:Wikimania 2020 | User:-revi/Wikimania/2020 | 200x200 DAYS_PER_GALLERY(31)
Category:Wikimania 2021 | User:-revi/Wikimania/2021 | 200x200 DAYS_PER_GALLERY(31)
Category:Hammaburg Fest 2018 | User:Huhu Uet/Festivals/Hammaburg Fest 2018 | 240x240
Category:Elbriot 2018 | User:Huhu Uet/Festivals/Elbriot 2018 | 240x240
Category:Reload Festival 2018 | User:Huhu Uet/Festivals/Reload Festival 2018 | 240x240
Category:Werner - Das Rennen 2018 | User:Huhu Uet/Festivals/Werner - Das Rennen 2018 | 240x240
Category:Rockspektakel 2018 | User:Huhu Uet/Festivals/Rockspektakel 2018 | 240x240
Category:Hamburger Gitarrenfestival 2018 | User:Huhu Uet/Festivals/Hamburger Gitarrenfestival 2018 | 240x240
Category:Uploaded via Campaign:fa | User:OgreBot/fawiki | SHOW_FILENAME
Category:Coins | User:Donald Trung/OgreBot/Coins | 200x200 WARNING, DAYS_PER_GALLERY(1), SHOW_FILENAME | Category:Medals by century | Category:Wollaston Medal | Category:Coin-operated devices | Category:World War I Victory Medal recipients
Category:Banknotes | User:Donald Trung/OgreBot/Banknotes | 200x200 WARNING, DAYS_PER_GALLERY(1), SHOW_FILENAME | Category:Places illustrated on banknotes of Turkey
Category:Token coins | User:Donald Trung/OgreBot/Token coins and chips | 200x200 WARNING, DAYS_PER_GALLERY(3), SHOW_FILENAME
Category:PDF files | User:Donald Trung/OgreBot/PDF files | 200x200 WARNING, DAYS_PER_GALLERY(5), SHOW_FILENAME
Category:Artists from Denmark | User:Rsteen/Artists from Denmark | 200x200 DAYS_PER_GALLERY(11), SHOW_FILENAME | Category:Films starring Giancarlo Esposito
Category:Rock im Kranhaus 2018 | User:Huhu Uet/Festivals/Rock im Kranhaus 2018 | 240x240
Category:Sankt Hell 2018 | User:Huhu Uet/Festivals/Sankt Hell 2018 | 240x240
Category:The Rock n Roll Wrestling Bash 2019 | User:Huhu Uet/Festivals/The Rock n Roll Wrestling Bash 2019 | 240x240
Category:Rapid transit in Germany, Category:Trams in Germany | User:Clic/Nahverkehr in Deutschland | 150x150 SHOW_FILENAME
Category:PD-Germany-§134, Category:PD-Germany-§134-KUG | User:Rosenzweig/134 | 150x150 DAYS_PER_GALLERY(31)
Category:Uploaded from Arabic Wikipedia using UploadWizard, Category:Uploaded via Campaign:ar | User:OgreBot/arwiki | SHOW_FILENAME
Category:Guangzhou | User:Roy17/Canton | DAYS_PER_GALLERY(31) | Category:People of Guangzhou | Category:Companies based in Guangzhou
Category:Jurong, Category:Jurong East, Category:Jurong West | User:Roy17/Jurong | DAYS_PER_GALLERY(31)
Category:Potong Pasir | User:Roy17/Potong Pasir | NO_SUBPAGE
Category:Mannheim | User:Roy17/Mannheim | DAYS_PER_GALLERY(31) | Category:People of Mannheim | Category:Companies based in Mannheim
Category:Leipzig | User:Roy17/Leipzig | DAYS_PER_GALLERY(31) | Category:People of Leipzig | Category:Companies based in Leipzig
Category:Images_from_Wiki_Loves_Love_2019 | User:Tiven2240/Wll | DAYS_PER_GALLERY(1)
Category:Echinodermata | User:FredD/Echinoderm news | 240x240 DAYS_PER_GALLERY(16) | Category:Patrick Star
Category:Charleroi | User:Jmh2o/recent uploads/Charleroi | DAYS_PER_GALLERY(11)
Category:Cultural heritage monuments in Wallonia | User:Jmh2o/recent uploads/Wallonia | DAYS_PER_GALLERY(11) | Category:Battle of Waterloo
Category:Images from Wiki Loves Earth 2019, DE-BB | User:Tsungam/WLE19/DE/BB | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-BE | User:Tsungam/WLE19/DE/BE | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-BW | User:Tsungam/WLE19/DE/BW | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-BY | User:Tsungam/WLE19/DE/BY | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-HB | User:Tsungam/WLE19/DE/HB | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-HE | User:Tsungam/WLE19/DE/HE | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-HH | User:Tsungam/WLE19/DE/HH | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-MV | User:Tsungam/WLE19/DE/MV | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-NI | User:Tsungam/WLE19/DE/NI | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-NW | User:Tsungam/WLE19/DE/NW | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-RP | User:Tsungam/WLE19/DE/RP | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-SH | User:Tsungam/WLE19/DE/SH | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-SL | User:Tsungam/WLE19/DE/SL | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-SN | User:Tsungam/WLE19/DE/SN | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-ST | User:Tsungam/WLE19/DE/ST | DAYS_PER_GALLERY(1)
Category:Images from Wiki Loves Earth 2019, DE-TH | User:Tsungam/WLE19/DE/TH | DAYS_PER_GALLERY(1)
Category:Hafen Rock 2019 | User:Huhu Uet/Festivals/Hafen Rock 2019 | 240x240
Category:Openair Frauenfeld 2019 | User:Huhu Uet/Festivals/Openair Frauenfeld 2019 | 240x240
Category:Demonstrations and protests in Hong Kong | User:Roy17/香港示威 | DAYS_PER_GALLERY(31)
Category:Demonstrations and protests in Guangdong | User:Roy17/廣東示威 | DAYS_PER_GALLERY(31)
Category:2019 in Hong Kong(depth=15) | User:Minorax/Hong Kong | DAYS_PER_GALLERY(1)
Category:Text logos | User:Minorax/PD textlogo | DAYS_PER_GALLERY(1) | Category:SVG text logos | Category:Recipients of the Golden Party Badge
Category:SVG text logos | User:Minorax/PD textlogo (SVG) | DAYS_PER_GALLERY(3)
Category:Vector version available | User:Minorax/SVG available | DAYS_PER_GALLERY(7)
Category:Images by the language of legend | User:Magog the Ogre/Multilingual legend | DAYS_PER_GALLERY(11) | Category:ISO 3166 | Category:Blank maps | Category:Maps from Ordnance Survey | Category:SVG language-neutral maps | Category:Symbols and flags from the Catalan Atlas
Category:Landkreis Emsland | User:Ies/Emsland | 200x200
Category:Postcards | Commons:WikiProject Postcards/new files | 150x150 DAYS_PER_GALLERY(1)
Category:Begoniaceae | User:Salix/Begoniaceae news | 240x240 DAYS_PER_GALLERY(16)
Category:Anarchism(depth=5) | User:Czar/Anarchism | DAYS_PER_GALLERY(31), WARNING, NO_INDEX, MODE("packed-hover") | Category:Hackerspaces | Category:Socialist Party of America | Category:May Day | Category:People of the Paris Commune | Category:Anarcho-capitalism | Category:Members of the Industrial Workers of the World | Category:Opposition to the Industrial Workers of the World | Category:Novels by Leo Tolstoy‎ | Category:People associated with Fabrizio De André | Category:Sacco and Vanzetti streets
Category:Chemnitz | User:Kleeblatt187/Chemnitz | DAYS_PER_GALLERY(31)
Category:Stanford University(depth=0) | User:King of Hearts/Recent uploads/Stanford University | DAYS_PER_GALLERY(31), NO_SUBPAGE, SHOW_FILENAME
Category:Lublin | User:PiotrekD/Lublin | | Category:People of Lublin | Category:History of Lublin | Category:Clergy of the Roman Catholic Archdiocese of Lublin | Category:Jerzy Kmieciński | Category:Andrzej Kokowski
Category:Israel Defense Forces | User:Geagea/IDF | 200x200 DAYS_PER_GALLERY(1), SHOW_FILENAME | Category:City walls in Israel
Category:Typewriters | User:PiotrekD/Typewriters | DAYS_PER_GALLERY(31) | Category:Typewriter manufacturers | Category:Typing
Category:Landkreis Nienburg/Weser | User:Clic/Landkreis Nienburg/Weser | 150x150 SHOW_FILENAME
Category:Main-Tauber-Kreis | User:Triplec85/Main-Tauber-Kreis | DAYS_PER_GALLERY(31), SHOW_FILENAME
Category:Stolpersteine | User:GeorgDerReisende/Stolpersteine | DAYS_PER_GALLERY(31), NO_INDEX, SHOW_FILENAME
Category:Tyrol (state) | User:Luftschiffhafen/Tyrol | 150x150`.split('\n');

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	//await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	CeL.info(Gallery_list.length + ' galleries');
	const Subscribers = Gallery_list.map(parse_gallery);
	const file_name = '20210901.gallery_configuration.txt';
	//CeL.remove_file(file_name);
	CeL.write_file(file_name, Subscribers.map(subscriber => {
		return `|-
| ${CeL.wiki.title_link_of(subscriber[0])} || <syntaxhighlight lang="JSON">
${JSON.stringify(subscriber[1], null, '\t')}
</syntaxhighlight>`;
	}).join('\n'));
}

function parse_gallery(gallery_line) {
	gallery_line = gallery_line.trim().split(/\s*\|\s*/);
	const base_page_title = gallery_line[1];
	const options = Object.create(null);

	let base_category = gallery_line[0].split(/,?\s*Category:/).filter(c => !!c)
		.map(category => {
			let max_depth;
			category = category.replace(/ *\(depth=(\d{1,2})\) *$/, (all, depth) => { max_depth = +depth; return ''; });
			if (max_depth >= 0)
				return [category, max_depth];
			return category;
		});
	if (base_category.length < 2 && typeof base_category[0] === 'string')
		base_category = base_category[0];
	options.base_category = base_category;

	let exclude_categories = gallery_line.slice(3);
	if (exclude_categories.length > 0)
		options.exclude_categories = exclude_categories.map(category => category.replace(/^Category:/, ''));

	const gallery_attributes = [];
	let gallery_options = ' ' + gallery_line[2];
	gallery_options = gallery_options
		.replace(/ NO_SUBPAGE *,?/, all => { options.subpage = ''; return ''; })
		.replace(/ DAYS_PER_GALLERY\((\d{1,2})\) *,?/, (all, days) => {
			days = +days;
			if (days >= 28);
			else if (!(options.gallery_per_month = { '16': 2, '11': 3, '8': 4, '7': 4, '5': 5, '3': 10, '2': 15, '1': 31 }[days])) throw new Error(`Cannot parse DAYS_PER_GALLERY ${gallery_options}`);
			return '';
		})
		.replace(/ SHOW_FILENAME *,?/, all => { return ''; })
		.replace(/ NO_INDEX *,?/, all => { options.NOINDEX = true; return ''; })
		.replace(/ WARNING *,?/, all => { options.WARNING = true; return ''; })
		.replace(/ (\d+)?x(\d+)?(?: |$)/, (all, width, height) => { if (width) gallery_attributes.push(`widths="${width}px"`); if (height) gallery_attributes.push(`heights="${height}px"`); return ' '; })
		.replace(/ MODE\((.+?)\) *,?/, (all, mode) => { gallery_attributes.push(`mode="${mode.replace(/"/g, '')}"`); return ''; })
		;

	if (gallery_options.trim())
		throw new Error(`Cannot parse ${JSON.stringify(gallery_options)} @
	${gallery_line.join('\n\t')}`);

	if (gallery_attributes.length > 0)
		options.gallery_attributes = gallery_attributes.join(' ');

	return [base_page_title, options];
}