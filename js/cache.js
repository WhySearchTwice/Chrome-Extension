/*
This file contains the code to interact with the local cache and Web SQL
It's also owned by Matt so check with him before you mess with it.
Ok fine you can mess with it but just tell him.
*/

var dbName = 'aphid';
var dbVersion = '0.0';
var dbDescription = 'cache of web usage';
var dbSize = 5 * 1024 * 1024 + ''; //2 Megabytes

var db = openDatabase(dbName,
		      dbVersion,
		      dbDescription,
		      dbSize);

function initializeDatabase() {
    dropDatabase();
    //console.warn('initializingDatabase');
    var views = 'CREATE TABLE IF NOT EXISTS views (' +
                     'id INT NOT NULL, ' +
                     'url TEXT NOT NULL, ' +
	             'parentId INT NOT NULL , ' +
	             'openTime TIMESTAMP NOT NULL, ' +
	             'closeTime TIMESTAMP NOT NULL, ' +
	             'PRIMARY KEY (id)' +
                ')';
    var focus = 'CREATE TABLE IF NOT EXISTS focus (' +
                     'page_id INT NOT NULL, ' +
                     'time TIMESTAMP NOT NULL, ' +
                     'FOREIGN KEY (page_id) REFERENCES pages (page_id)' +
                ')';
    db.transaction(function (tx) {
	tx.executeSql(views, null, undefined, errorHandle);
	//tx.executeSql(focus, null, undefined, errorHandle);
    });
}

function validateSendPage(page, id) {
    if (page &&
	id &&
        page.pageOpenTime &&
	page.pageUrl &&
	page.parentId) {
	return true;
    }
    return false;
}

//todo, figure out exactly how to process page and insert into db
function cacheSendPage(page, id) {
    console.log("cacheSendPage " + id);
    console.log(page);
    if (typeof(page.parentId) == 'undefined') {
	console.log("setting parentId");
	page.parentId = -1;
    }

    if (validateSendPage(page, id)) {
	db.transaction(function (tx) {
	    tx.executeSql('INSERT INTO views (id, url, parentId, ' +
			                     'openTime, closeTime) ' +
			  'VALUES (?, ?, ?, ?, ?)',
			  [id,
			   page.pageUrl,
			   page.parentId,
			   page.pageOpenTime,
			   -1], undefined, errorHandle);
	});
    } else {
	console.log("invalid page");
    }
    /*
      page:
      clientVersion: "0.0.8"
      deviceGuid: (undefined)
      pageOpenTime: 1362964843783
      pageUrl: "blah blah"
      parentId: (undefined)
      tabId: 204
      type: pageView
      userGuid: (undefined)
      windowId: 203
     */
}

//todo, figure out exactly how to process page and update into db
function cacheUpdatePage(page) {
    console.log("cacheUpdatePage");
    console.log(page);

    db.transaction(function (tx) {
	tx.executeSql('UPDATE views ' +
		      'SET closeTime=\'' + page.pageCloseTime + '\' ' +
		      'WHERE id=\'' + page.id + '\' ', [], undefined, errorHandle); 
    });
    /*
      page:
      clientVersion: "0.0.8"
      focusHistory: (undefined)
      pageCloseTime: 13629666011196
      id: (undefined)
     */
}

function errorHandle(tx, error) {
    console.log('ERROR FOR MATT:');
    console.log(error);
    return true; //should rollback any transaction, not tested
}

function dropDatabase() {
    //console.warn('dropDatabase');
    db.transaction(function (tx) {
	tx.executeSql('DROP TABLE views', null, undefined, errorHandle);
    });
}

function dumpDatabase() {
    db.transaction(function (tx) {
	tx.executeSql('SELECT * FROM views', null, function (tx, results) {
	    var len = results.rows.length, i;
	    for (i = 0; i < len; i++) {
		console.log(results.rows.item(i).id + ", " +
			    results.rows.item(i).url + ", " +
			    results.rows.item(i).parentId + ", " +
			    results.rows.item(i).openTime + ", " +
			    results.rows.item(i).closeTime);
	    }
	}, errorHandle);
    });
}

function basicTest() {
    initializeDatabase();
    page = {pageOpenTime: 1362964843783, pageUrl: "blah blah", parentId: undefined};
    cacheSendPage(page, 4);
    page.pageCloseTime = 1362964843784;
    page.id = 4;
    cacheUpdatePage(page);
    dumpDatabase();
}

console.log('cache.js loaded');
basicTest();
