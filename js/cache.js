/**
 * This file contains the code to interact with the local cache and Web SQL
 * @author matt
 */

var dbName = 'caterpillar4';
var dbVersion = '0.24';
var dbDescription = 'cache of web usage';
var dbSize = 5 * 1024 * 1024 + '';  //5 Megabytes
var maxRows = 100000;               //the 'fuzzy' max views the database allows
var db = openDatabase(dbName,
                      dbVersion,
                      dbDescription,
                      dbSize);

/**
 * Initialization function
 * @author matt
 */
(function() {
    log('cache.js loaded');
    initializeDatabase();
})();

/**
 * Shortcut to console.log() with custom color
 * @author matt
 *
 * @param  {String} message Message to print to console
 */
function log(message) {
    console.log('%c' + message, 'background:#0c0; color:#000');
}

/**
 * Initialize the database
 * @author matt
 */
function initializeDatabase() {
    log('Initializing Database...');

    //NOTE: WEBSQL SUCKS AND DOESN'T ENFORCE FOREIGN KEYS
    var views = 'CREATE TABLE IF NOT EXISTS views (' +
                     'id INT NOT NULL, ' +
                     'url TEXT NOT NULL, ' +
                     'parentId INT NOT NULL, ' +
                     'predecessorId INT NOT NULL, ' +
                     'openTime TIMESTAMP NOT NULL, ' +
                     'closeTime TIMESTAMP NOT NULL, ' +
                     'insertTime TIMESTAMP NOT NULL, ' +
                     'tabId INT NOT NULL, ' +
                     'windowId INT NOT NULL, ' +
                     'deviceGuid INT NOT NULL, ' +
                     'userGuid INT NOT NULL, ' +
                     //hand waving because websql doesn't
                     //use PRIMARY KEYs well anyway
                     'PRIMARY KEY (id)' +
                ')';
    var focus = 'CREATE TABLE IF NOT EXISTS focus (' +
                     'viewId INT NOT NULL, ' +
                     'time TIMESTAMP NOT NULL, ' +
                     //note that websql doesn't enforce
                     //foreign key constraints
                     'FOREIGN KEY (viewId) REFERENCES pages (id) ' +
                     'ON DELETE CASCADE' +
                ')';
    db.transaction(function(tx) {
        tx.executeSql(views,
                      [],
                      undefined,
                      onError);
        tx.executeSql(focus,
                      [],
                      undefined,
                      onError);
    });
}

/**
 * Validate that all required information is present for send
 * @author matt
 *
 * @param  {Object} page PageView to send
 * @param  {Int}    id   Vertex ID
 */
function validateSendPage(page, id) {
    return page &&
           id &&
           page.pageOpenTime &&
           page.pageUrl &&
           page.parentId &&
           page.predecessorId &&
           page.tabId &&
           page.userGuid &&
           page.windowId;
}

/**
 * Send page to cache
 * @author matt
 *
 * @param  {Object} page     PageView to send
 * @param  {Object} response Server response
 */
function cacheSendPage(page, response) {
    log('Sending page to cache: ' + response.id);
    console.log(page);

    if (!page.parentId) {
        log('setting parentId...');
        page.parentId = -1;
    }

    if (!page.predecessorId) {
        log('setting predecessorId...');
        page.predecessorId = -1;
    }

    if (!validateSendPage(page, response.id)) {
        log('invalid page in cacheSendPge, page:');
        console.log(page);
    }

    db.transaction(function(tx) {
        tx.executeSql('SELECT * from views',
                      [],
                      function(tx, results) {
                          if (results.rows.length > maxRows) {
                              db.transaction(function(tx2) {
                                  tx2.executeSql('SELECT id FROM views ' +
                                                 'WHERE insertTime = (SELECT min(insertTime) FROM views)',
                                                 [],
                                                 function(tx3, results) {
                                                     tx3.executeSql('DELETE FROM views ' +
                                                                    'WHERE id = (?) ',
                                                                    [results.rows.item(0).id],
                                                                    undefined,
                                                                    onError);
                                                     tx3.executeSql('DELETE FROM focus ' +
                                                                    'WHERE viewId = (?) ',
                                                                    [results.rows.item(0).id],
                                                                    undefined,
                                                                    onError);
                                                 },
                                                 onError);
                              });
                          }
                          db.transaction(function(tx4) {
                              tx4.executeSql('INSERT INTO views (id, url, parentId, predecessorId, ' +
                                             'openTime, closeTime, insertTime, ' +
                                             'tabId, windowId, deviceGuid, userGuid)' +
                                             'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                             [
                                                 response.id,
                                                 page.pageUrl,
                                                 page.parentId,
                                                 page.predecessorId,
                                                 page.pageOpenTime,
                                                 -1,
                                                 (new Date()).getTime(),
                                                 page.tabId,
                                                 page.windowId,
                                                 page.deviceGuid,
                                                 page.userGuid
                                             ],
                                             undefined,
                                             onError);
                          });
                      },
                      onError);
    });
}

/**
 * Validate that all required information is present for update
 * @author matt
 *
 * @param  {Object} page PageView to update
 */
function validateUpdatePage(page) {
    return page &&
           page.id &&
           page.pageCloseTime;
}

/**
 * Update page in cache
 * @author matt
 *
 * @param  {Object} page     PageView to send
 */
function cacheUpdatePage(page) {
    log('Updating page...');

    if (validateUpdatePage(page)) {
        db.transaction(function(tx) {
            tx.executeSql('UPDATE views ' +
                          'SET closeTime = (?) ' +
                          'WHERE id = (?)',
                          [page.pageCloseTime, page.id],
                          undefined,
                          onError);
            tx.executeSql('SELECT * FROM views ' +
                          'WHERE id = (?)',
                          [page.id],
                          function(tx2, results) {
                              if (results.rows.length === 1 && page.focusHistory) {
                                  for (var i = 0, l = page.focusHistory.length; i < l; i++) {
                                      tx.executeSql('INSERT INTO focus (viewId, time) ' +
                                                    'VALUES (?, ?)',
                                                    [page.id, page.focusHistory[i]],
                                                    undefined,
                                                    onError);
                                  }
                              }
                          },
                          onError);
        });
    } else {
        log('invalid page in cacheUpdatePage');
    }
}

/**
 * Search a give time range for pageViews
 * @author matt
 *
 * @param  {Int} openRange       start of range
 * @param  {Int} closeRange      end of range
 * @param  {Int} callback        callback function
 */
function cacheGetTimeRange(openRange, closeRange, params, successFunction) {
    log('Searching time range...');

    if (typeof params === 'function') {
        // handle omitted params object
        successFunction = params;
        params = {};
    }

    //make sure the params are there
    //openRange needs to be in the future relative to closeRange
    if (!openRange ||
        !closeRange ||
        !successFunction ||
        closeRange <= openRange) {
        return;
    }
    console.log("not currently using params:");
    console.log(params);

    db.transaction(function(tx) {
        tx.executeSql('SELECT * from views ' +
                      'WHERE (closeTime >= (?) OR closeTime = -1) ' +
                      'AND openTime <= (?)',
                      [openRange, closeRange],
                      function(tx, sqlResults) {
                          console.log(sqlResults.rows.length);
                          var results = [], item;
                          for (var i = 0, l = sqlResults.rows.length; i < l; i++) {
                              item = sqlResults.rows.item(i);
                              var result = {
                                  'tabId': item.tabId,
                                  'windowId': item.windowId,
                                  'pageOpenTime': item.openTime,
                                  'pageCloseTime': item.closeTime,
                                  'pageUrl': item.url,
                                  'type': 'pageView',
                                  'id': item.id,
                                  'deviceGuid': item.deviceGuid,
                                  'predecessorId': item.predecessorId
                              };
                              if (item.predecessorId && item.predecessorId !== -1) {
                                  result.predecessorId = item.predecessorId;
                              }
                              if (item.parentId && item.parentId !== -1) {
                                  result.parentId = item.parentId;
                              }
                              results.push(result);
                          }
                          chrome.extension.sendMessage({
                              action: 'callback',
                              func: successFunction,
                              args: [results]
                          });
                      },
                      onError);
    });
}

/**
 * Handles cache errors
 * @author matt
 *
 * @param  {Object} tx    Transaction
 * @param  {String} error Error message
 */
function onError(tx, error) {
    log('ERROR FOR MATT:');
    console.log(error);
    //shuld rollback any transaction,
    //oh wait, websql doesn't provide transactions
    //meaning we really can't handle an error
    return true;
}

/**
 * Drops cache DB
 * @author matt
 */
function dropDatabase() {
    log('Dropping DB...');
    db.transaction(function(tx) {
        tx.executeSql('DROP TABLE views', [], undefined, onError);
        tx.executeSql('DROP TABLE focus', [], undefined, onError);
    });
}

/**
 * Dumps cache DB
 * @author matt
 */
function dumpDatabase() {
    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM views', [], function(tx, results) {
            var l = results.rows.length, i, item;
            console.log('LEN = ' + l);
            for (i = 0; i < l; i++) {
                item = results.rows.item(i)
                log('view: ' + [
                        item.id,
                        item.url,
                        item.parentId,
                        item.predecessorId,
                        item.openTime,
                        item.closeTime,
                        item.insertTime,
                        item.tabId,
                        item.windowId,
                        item.deviceGuid,
                        item.userGuid
                    ].join(', ')
                );
            }
        }, onError);
    });

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM focus',
                      [],
                      function(tx, results) {
                          for (var i = 0, l = results.rows.length; i < l; i++) {
                              log('focus: ' +
                                  results.rows.item(i).viewId + ', ' +
                                  results.rows.item(i).time
                              );
                          }
                      },
                      onError);
    });
}

/**
 * Counts rows in cache DB
 * @author matt
 *
 * @return {Int} Number of rows
 */
function databaseRowCount() {
    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM views', [], function(tx, results) {
            return results.rows.length;
        }, onError);
    });
}

/**
 * Test a single insertion
 * @author matt
 *
 * @param  {Int}    id     Vertex ID
 * @param  {String} url    Page URL
 * @param  {Int}    parent Parent Vertex ID
 */
function singleTest(id, url, parentId) {
    var page = {
        'pageOpenTime': 1000000000000,
        'pageUrl': url,
        'parentId': parentId
    };
    cacheSendPage(page, id);
    page.pageCloseTime = 1000000000500;
    page.id = id;
    cacheUpdatePage(page);
}

/**
 * Test multiple insertions
 * @author matt
 *
 * @param  {Int} id Starting Vertex ID
 */
function basicTest(id) {
    singleTest(id, 'www.reddit.com/r/pics');
    singleTest(id + 1, 'www.imgur.com/blah', id);
    singleTest(id + 2, 'www.imgur.com/blah2', id);
    singleTest(id + 3, 'www.imgur.com/blah3', id);
}