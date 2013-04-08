/*
This file contains the code to interact with the local cache and Web SQL
It's also owned by Matt so check with him before you mess with it.
Ok fine you can mess with it but just tell him.

Todo:
sproc to clear old rows
Read from cache
Database to cache
*/

var dbName = 'aphid';
var dbVersion = '0.0';
var dbDescription = 'cache of web usage';
var dbSize = 5 * 1024 * 1024 + ''; //5 Megabytes

var db = openDatabase(dbName,
                      dbVersion,
                      dbDescription,
                      dbSize);

function con(string) {
    console.log('%c' + string, 'background: #00CC00; color: #000000');
}

function initializeDatabase() {
    //dropDatabase();
    //con('initializingDatabase');
    var views = 'CREATE TABLE IF NOT EXISTS views (' +
                     'id INT NOT NULL, ' +
                     'url TEXT NOT NULL, ' +
                     'parentId INT NOT NULL , ' +
                     'openTime TIMESTAMP NOT NULL,' +
                     'closeTime TIMESTAMP NOT NULL, ' +
                     'PRIMARY KEY (id)' +
                ')';
    var focus = 'CREATE TABLE IF NOT EXISTS focus (' +
                     'viewId INT NOT NULL, ' +
                     'time TIMESTAMP NOT NULL, ' +
                     'FOREIGN KEY (viewId) REFERENCES pages (id)' +
                ')';
    db.transaction(function (tx) {
        tx.executeSql(views, null, undefined, errorHandle);
        tx.executeSql(focus, null, undefined, errorHandle);
    });
}

function validateSendPage(page, id) {
    return page &&
           id &&
           page.pageOpenTime &&
           page.pageUrl &&
           page.parentId;
}

function cacheSendPage(page, id) {
    con("cacheSendPage " + id);
    console.log(page);
    if (typeof(page.parentId) == 'undefined') {
        con("setting parentId");
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
        con("invalid page in cacheSendPage");
    }
}

function validateUpdatePage(page) {
    return typeof(page) != 'undefined' &&
           typeof(page.id) != 'undefined' &&
           typeof(page.pageCloseTime) != 'undefined';
}
    
function cacheUpdatePage(page) {
    con("cacheUpdatePage");
    console.log(page);
    
    if (validateUpdatePage(page)) {
        db.transaction(function (tx) {
            tx.executeSql('UPDATE views ' +
                          'SET closeTime=\'' + page.pageCloseTime + '\' ' +
                          'WHERE id=\'' + page.id + '\' ', [], undefined, errorHandle);
            if (typeof(page.focusHistory) != 'undefined') {
                for (var i = 0; i < page.focusHistory.length; i++) {
                    tx.executeSql('INSERT INTO focus (viewId, time) ' +
                                  'VALUES (?, ?)',
                                  [page.id, page.focusHistory[i]],
                                  undefined, errorHandle);
                }
            }
        });
    } else {
        con("invalid page in cacheUpdatePage");
    }
}
    
function errorHandle(tx, error) {
    con('ERROR FOR MATT:');
    console.log(error);
    return true; //should rollback any transaction, not tested
}

//to be removed
function dropDatabase() {
    //con('dropDatabase');
    db.transaction(function (tx) {
        tx.executeSql('DROP TABLE views', null, undefined, errorHandle);
        tx.executeSql('DROP TABLE focus', null, undefined, errorHandle);
    });
}

//to be removed
function dumpDatabase() {
    db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM views', null, function (tx, results) {
            var len = results.rows.length, i;
            console.log("LEN = " + len);
            for (i = 0; i < len; i++) {
                con(results.rows.item(i).id + ", " +
                    results.rows.item(i).url + ", " +
                    results.rows.item(i).parentId + ", " +
                    results.rows.item(i).openTime + ", " +
                    results.rows.item(i).closeTime);
            }
        }, errorHandle);
    });
}

function databaseRowCount() {
    db.transaction(function (tx) {
        tx.executeSql('SELECT count(*) from views', null, function (tx, results) {
            console.log(results.rowsAffected);
        }, errorHandle);
    });
}

function singleTest(id, url, parent) {
    page = {pageOpenTime: 1000000000000, pageUrl: url, parentId: parent};
    cacheSendPage(page, id);
    page.pageCloseTime = 1000000000500;
    page.id = id;
    cacheUpdatePage(page);
}


//to be removed
function basicTest(id) {
    singleTest(id, "www.reddit.com/r/pics", undefined);
    singleTest(id + 1, "www.imgur.com/blah", id);
    singleTest(id + 2, "www.imgur.com/blah2", id);
    singleTest(id + 3, "www.imgur.com/blah3", id);
}

con('cache.js loaded');
initializeDatabase();
