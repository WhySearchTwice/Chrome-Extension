/*
This file contains the code to interact with the local cache and Web SQL
It's also owned by Matt so check with him before you mess with it.
Ok fine you can mess with it but just tell him.

Todo:
Read from cache
Database to cache
*/

var dbName = 'beetle';
var dbVersion = '0.1';
var dbDescription = 'cache of web usage';
var dbSize = 5 * 1024 * 1024 + ''; //5 Megabytes

var db = openDatabase(dbName,
                      dbVersion,
                      dbDescription,
                      dbSize);

//the 'fuzzy' max views the database allows
var maxRows = 1000;

function con(string) {
    console.log('%c' + string, 'background: #00CC00; color: #000000');
}

function initializeDatabase() {
    //con('initializingDatabase');

    //NOTE: WEBSQL SUCKS AND DOESN'T ENFORCE FOREIGN KEYS
    var views = 'CREATE TABLE IF NOT EXISTS views (' +
                     'id INT NOT NULL, ' +
                     'url TEXT NOT NULL, ' +
                     'parentId INT NOT NULL, ' +
                     'openTime TIMESTAMP NOT NULL, ' +
                     'closeTime TIMESTAMP NOT NULL, ' +
                     'insertTime TIMESTAMP NOT NULL, ' +
                     'PRIMARY KEY (id)' +
                ')';
    var focus = 'CREATE TABLE IF NOT EXISTS focus (' +
                     'viewId INT NOT NULL, ' +
                     'time TIMESTAMP NOT NULL, ' +
                     'FOREIGN KEY (viewId) REFERENCES pages (id) ' +
                     'ON DELETE CASCADE' +
                ')';
    db.transaction(function (tx) {
        tx.executeSql(views,
                      [],
                      undefined,
                      errorHandle);
        tx.executeSql(focus,
                      [],
                      undefined,
                      errorHandle);
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

    if (typeof(page.parentId) == 'undefined') {
        con("setting parentId");
        page.parentId = -1;
    }

    if (!validateSendPage(page, id)) {
        con("invalid page in cacheSendPge");
    }

    db.transaction(function (tx) {
        tx.executeSql('SELECT * from views',
                      [],
                      function (tx, results) {
                          if (results.rows.length > maxRows) {
                              db.transaction(function (tx2) {
                                  tx2.executeSql('SELECT id FROM views ' +
                                                 'WHERE insertTime = (SELECT min(insertTime) FROM views)',
                                                 [],
                                                 function (tx3, results) {
                                                     tx3.executeSql('DELETE FROM views ' +
                                                                    'WHERE id = (?) ',
                                                                    [results.rows.item(0).id],
                                                                    undefined,
                                                                    errorHandle);
                                                     tx3.executeSql('DELETE FROM focus ' +
                                                                    'WHERE viewId = (?) ',
                                                                    [results.rows.item(0).id],
                                                                    undefined,
                                                                    errorHandle);
                                                 },
                                                 errorHandle);
                              });
                          }
                          db.transaction(function (tx4) {                              
                              tx4.executeSql('INSERT INTO views (id, url, parentId, ' +
                                             'openTime, closeTime, insertTime) ' +
                                             'VALUES (?, ?, ?, ?, ?, ?)',
                                             [id,
                                              page.pageUrl,
                                              page.parentId,
                                              page.pageOpenTime,
                                              -1,
                                              (new Date()).getTime()],
                                             undefined,
                                             errorHandle);
                          });                      
                      },
                      errorHandle);
    });
}

function validateUpdatePage(page) {
    return typeof(page) != 'undefined' &&
           typeof(page.id) != 'undefined' &&
           typeof(page.pageCloseTime) != 'undefined';
}

function cacheUpdatePage(page) {
    con("cacheUpdatePage");
    
    if (validateUpdatePage(page)) {
        db.transaction(function (tx) {
            tx.executeSql('UPDATE views ' +
                          'SET closeTime=\'' + page.pageCloseTime + '\' ' +
                          'WHERE id = (?)',
                          [page.id],
                          function (tx2, results) {
                              
                          },
                          errorHandle);
            tx.executeSql('SELECT * FROM views ' +
                          'WHERE id = (?)',
                          [page.id],
                          function (tx2, results) {
                              if (results.rows.length == 1 && typeof(page.focusHistory) != 'undefined') {
                                  for (var i = 0; i < page.focusHistory.length; i++) {
                                      tx.executeSql('INSERT INTO focus (viewId, time) ' +
                                                    'VALUES (?, ?)',
                                                    [page.id, page.focusHistory[i]],
                                                    undefined,
                                                    errorHandle);
                                  }
                              }
                          },
                          errorHandle);
        });
    } else {
        con("invalid page in cacheUpdatePage");
    }
}

function cacheGetTimeRange(openRange, closeRange, successFunction) {
  con("cacheGetTimeRange");

  //make sure the params are there
  //openRange needs to be in the future relative to closeRange
  if (!successFunction ||
      !(typeof(successFunction) === 'function')
      !openRange ||
      !closeRange ||
      !(closeRange > openRange)) {
    return;
  }

  db.transaction(function (tx) {
    tx.executeSql('SELECT * from views ' +
                  'WHERE closeTime >= (?) ' +
                  'AND openTime <= (?) ',
                  [openRange, closeRange],
                  function (tx, results, successFunction) {
                    //TODO: put results in a form that ansel can deal with, call successFunction
                  },
                  errorHandle);
  });
}
  
function errorHandle(tx, error) {
    con('ERROR FOR MATT:');
    console.log(error);
    //shuld rollback any transaction,
    //oh wait, websql doesn't provide transactions
    //meaning we really can't handle an error
    return true;
}

//to be removed
function dropDatabase() {
    //con('dropDatabase');
    db.transaction(function (tx) {
        tx.executeSql('DROP TABLE views',
                      [],
                      undefined,
                      errorHandle);
        tx.executeSql('DROP TABLE focus',
                      [],
                      undefined,
                      errorHandle);
    });
}

//to be removed
function dumpDatabase() {
    db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM views',
                      [],
                      function (tx, results) {
                          var len = results.rows.length, i;
                          console.log("LEN = " + len);
                          for (i = 0; i < len; i++) {
                              con("view: " + results.rows.item(i).id + ", " +
                                  results.rows.item(i).url + ", " +
                                  results.rows.item(i).parentId + ", " +
                                  results.rows.item(i).openTime + ", " +
                                  results.rows.item(i).closeTime + ", " +
                                  results.rows.item(i).insertTime);
                          }
                      },
                      errorHandle);
    });

    db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM focus',
                      [],
                      function (tx, results) {
                          for (var i = 0; i < results.rows.length; i++) {
                              con("focus: " + results.rows.item(i).viewId + ", " +
                                  results.rows.item(i).time);
                          }
                      },
                      errorHandle);
    });
}

//to be removed
function databaseRowCount() {
    db.transaction(function (tx) {
        tx.executeSql('SELECT * FROM views',
                      [],
                      function (tx, results) {
                          return results.rows.length;
                      },
                      errorHandle);
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
