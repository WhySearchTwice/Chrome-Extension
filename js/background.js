/**
 * Base URL of database API where all information is submitted.
 * @author ansel
 *
 * @type String
 */
var SERVER = 'http://' + (chrome.app.getDetails().id === 'heflehdnackihajkcgimpkmffacccegh' || localStorage.forceProd ? 'prod' : 'dev') + '.whysearchtwice.com:8182';

/**
 * Extension version number. Read from manifest at background page load.
 * @author ansel
 *
 * @type String
 */
var VERSION = chrome.app.getDetails().version;

/**
 * A library of all known windows and the tabs they contain. Will be persisted to
 * localStorage when chrome is closed. Load from localStorage or create new.
 * @author ansel
 *
 * @type Object
 */
var session = localStorage.session || { windows: {} };

/**
 * userGuid must be submitted with every request. Consists of email address of user
 * and is stored to localStorage after initial retrieval. Retrieve if missing.
 * @author ansel
 *
 * @type String
 */
var userGuid = localStorage.userGuid;

/**
 * deviceGuid uniquely identifies this device and will be stored to localStorage after
 * initial generation. Retrieve if missing.
 * @author ansel
 *
 * @type String
 */
var deviceGuid = localStorage.deviceGuid;

/**
 * requestQueue Keeps track of requestQueue and whether requests should be queued
 *
 * @type Object
 */
var requestQueue = {
    isActive: true,
    isDequeuing: false,
    queue: [],
    flush: function() {
        ajax('FLUSH');
    },
    ping: function() {
        ajax('PING');
    }
};

// create session
(function() {
    validateEnvironment();
    console.log('Updating session...');
    chrome.windows.getAll({populate: true}, function(windows) {
        for (var i = 0, l = windows.length; i < l; i++) {
            for (var j = 0, m = windows[i].tabs.length; j < m; j++) {
                addToSession(windows[i].tabs[j]);
            }
        }
        cleanDatastore();
    });
})();

/**
 * Listen for history button click, open history
 * @author  ansel
 */
chrome.browserAction.onClicked.addListener(openHistory);

/**
 * Listen for short-lived connections
 * @author ansel
 */
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.action) {

        case 'getGlobals':
            var globals = {};
            for (var i = 0, l = request.message.length; i < l; i++) {
                globals[request.message[i]] = window[request.message[i]];
            }
            sendResponse(globals);
            break;

        default:
            break;
        }
    }
);

/**
 * Listen for long-lived connections
 * @author ansel
 */
chrome.extension.onConnect.addListener(function(port) {
    if (port.name === 'history') {
        // long-lived connection request from history page
        port.onMessage.addListener(function(request) {
            console.log('Message from history:');
            console.log('    ' + request.toString());
            switch (request.action) {

            default:
                break;
            }
        });
    } else {
        // connection request from scout or other indev script
        port.onMessage.addListener(function(request) {
            console.log('Message from ' + port.name);
            switch (request.action) {

            case 'openHistory':
                openHistory();
                break;

            default:
                break;
            }
        });
    }
});

/**
 * Persist session data to localStorage if background page is unloaded.
 * @author ansel
 */
window.onUnload = function() {
    console.log('Background page unloading. Saving to localStorage...');
    localStorage.session = session;
};

/**
 * Event Listener - Window Closed
 * Update each tab that is contained in this window. Delete window from session
 * after complete.
 * @author ansel
 */
chrome.windows.onRemoved.addListener(function(windowId) {
    console.log('Window ' + windowId + ' closed.');
    // Check if window exists
    if (session.windows[windowId]) {
        // get all tabs in window
        console.log('Updating tabs...');
        for (var tabId in session.windows[windowId].tabs) {
            // Send this tab
            updatePage(windowId, tabId);
        }
        // Remove the window from the storage
        console.log('Removing window from session...');
        delete session.windows[windowId];
        endLogEvent();
    } else {
        console.warn('Window not in session, no action taken.');
        endLogEvent();
    }
});

/**
 * Event Listener - Tab Updated
 * Check if the tab is our storage, if so submit it. Create an entry for the
 * new page that has been loaded and store it in the session for its containing window.
 * @author tony
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading') {
        console.log('Tab loading: ' + changeInfo.url || tab.url);
        addToSession(tab);
    }
});

/**
 * Event Listener - Page loaded
 * Called whenever a navigation takes place. Will attempt to add information
 * to the session about what is loading in a tab and how it was started
 * @author tony
 */
chrome.webNavigation.onCommitted.addListener(function(details) {
    var windowId = findWindowId(details.tabId);
    if (windowId) { return; }

    // Verify that this commit was for the page that is actually being loaded,
    // not a background page
    if (details.url === session.windows[windowId].tabs[details.tabId].pageUrl) {
        // Append information to this page object
        console.log('Updating pageView object with onCommitted information');

        var page = session.windows[windowId].tabs[details.tabId];
        page.transitionType = details.transitionType;
        page.transitionQualifiers = details.transitionQualifiers;
    }
});

/**
 * Event Listener - Tab Focused
 * Called whenever a tab gains focus. Send an event with the tabID and windowId, and other
 * standard fields to write a trail of what the user is looking at.
 * @author ansel
 */
chrome.tabs.onActivated.addListener(function(activeInfo) {
    console.log('Tab focused.');
    console.log('Updating previous tab focus data...');
    var focusStart = (new Date()).getTime();
    // check if previous tab is in session
    if (!session.windows[activeInfo.windowId] ||
        !session.windows[activeInfo.windowId].focusedTab ||
        !session.windows[activeInfo.windowId].tabs[session.windows[activeInfo.windowId].focusedTab]
    ) {
        console.warn('Previous tab not in session. No action taken');
    } else {
        // blur previous page
        var previousTab = session.windows[activeInfo.windowId].tabs[session.windows[activeInfo.windowId].focusedTab];
        if (!previousTab.focusHistory) {
            previousTab.focusHistory = [];
        }
        previousTab.focusHistory.push(focusStart);
    }
    onTabFocused(activeInfo, focusStart);
});

function onTabFocused(activeInfo, focusStart) {
    console.log('Updating current tab focus data...');
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        console.log(tab.url);
        if (session.windows[activeInfo.windowId] &&
            session.windows[activeInfo.windowId].tabs[activeInfo.tabId]
        ) {
            // focus current page
            var currentTab = session.windows[activeInfo.windowId].tabs[activeInfo.tabId];
            if (!currentTab.focusHistory) {
                currentTab.focusHistory = [];
            }
            currentTab.focusHistory.push(focusStart);

            session.windows[activeInfo.windowId].focusedTab = currentTab.tabId;

            console.log('Updated focus data:');
            console.log(currentTab);
        } else {
            setTimeout((function(activeInfo, focusStart) {
                return function() {
                    onTabFocused(activeInfo, focusStart);
                };
            })(activeInfo, focusStart), 500);
        }
        endLogEvent();
    });
}

/**
 * Event Listener - Tab moved to new Window
 * Listen for tabs being attached to new windows. Create a new group for the window
 * in the session if it does not exist and add this tab to it. Remove the tab from the
 * old group.
 * @author tony
 */
chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
    var newWindowId = attachInfo.newWindowId;

    // Create a new window if necessary
    if (!session.windows[newWindowId]) {
        console.log('Creating a new window in session: window ' + newWindowId);
        session.windows[newWindowId] = { tabs: {} };
    }

    // Find the tab that is being moved
    for (var windowId in session.windows) {
        if (session.windows[windowId].tabs[tabId]) {
            console.log('Found the old tab location: window ' + windowId);

            // For some reason this method is called twice. Super weird
            if (windowId === newWindowId) {
                console.log('source windowId == destination windowId. Aborting move');
                endLogEvent();
                return;
            }

            var page = session.windows[windowId].tabs[tabId];
            page.windowId = newWindowId;

            console.log('Saving tab to new window location: window ' + newWindowId);
            session.windows[newWindowId].tabs[tabId] = page;
            session.windows[newWindowId].focused = tabId;
            delete session.windows[windowId].tabs[tabId];
        }
    }
    endLogEvent();
});

/**
 * Event Listener - Tab closed
 * Listen for tabs being closed. Submit the tab and remove from the session.
 * @author ansel
 */
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    // If a window is being closed, ignore this event
    if (removeInfo.isWindowClosing) { return; }

    // else
    console.log('Tab ' + tabId + ' closed.');
    for (var windowId in session.windows) {
        if (session.windows[windowId].tabs[tabId]) {
            // Send the page
            console.log('Updating tab before close...');
            updatePage(windowId, tabId);

            // Delete the page from storage
            console.log('Deleting the page from storage');
            delete session.windows[windowId].tabs[tabId];
            return;
        }
    }

    console.warn('Tab not in session, no action taken');
    endLogEvent();
});

/**
 * Adds page to session
 * @author ansel
 *
 * @param {Mixed} tab String tabId or Tab tab
 */
function addToSession(tab) {
    console.log('Creating new page object...');
    if (typeof tab === 'String') {
        console.log('Passed tabId, getting tab object...');
        chrome.tab.get(tab, function(tab) {
            addToSession(tab);
        });
        return;
    }

    // Create an object representing the page that was just opened
    var newPage = {
        type: 'pageView',
        tabId: tab.id,
        pageUrl: tab.url,
        windowId: tab.windowId,
        pageOpenTime: (new Date()).getTime()
    };

    if (tab.openerTabId) {
        newPage.parentId = session.windows[tab.windowId].tabs[tab.openerTabId].id;
    }

    // Check if there is a tab with this ID already. If so, update it
    if (session.windows[tab.windowId] &&
        session.windows[tab.windowId].tabs[tab.id]
    ) {
        if (session.windows[tab.windowId].tabs[tab.id].id) {
            newPage.predecessorId = session.windows[tab.windowId].tabs[tab.id].id;
        }
        console.log('Calling send page...');
        updatePage(tab.windowId, tab.id);
    } else {
        endLogEvent();
    }

    // Store this new page
    if (!session.windows[tab.windowId]) {
        session.windows[tab.windowId] = {
            tabs: {},
            focusedTab: tab.id
        };
    }
    session.windows[tab.windowId].tabs[tab.id] = newPage;
    console.log('Created page object:');
    console.log(newPage);
    endLogEvent();
    sendPage(tab.windowId, tab.id);
}

/**
 * Search through the session looking for a tab with the given tabId.
 * @author ansel
 *
 * @param {Int} tabId The id of a tab in question to search for
 * @return {Int} The windowId that contains the tabId. undefined if does not exist
 */
function findWindowId(tabId) {
    for (var windowId in session.windows) {
        if (session.windows[windowId].tabs[tabId]) {
            return windowId;
        }
    }
    return undefined;
}

/**
 * Encodes an object into query parameters
 * @author ansel
 *
 * @param {Object} object Object to be encoded
 * @return {String} Encoded object
 */
function buildQueryString(object) {
    var encoded = [];
    for (var key in object) {
        encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(object[key]));
    }
    return '?' + encoded.join('&');
}

/**
 * Complete missing fields in page object
 * @author ansel
 *
 * @param {Object} page The page to be validated
 */
function validatePage(page) {
    page.clientVersion = VERSION;
    if (page.type !== 'pageView') { return page; }

    console.log('Adding userGuid to page object...');
    page.userGuid = userGuid;
    console.log('Adding deviceGuid to page object...');
    page.deviceGuid = deviceGuid;

    if ((!userGuid || !deviceGuid) && !requestQueue.isActive) {
        console.log('userGuid or deviceGuid missing. Activating queuing');
        requestQueue.isActive = true;
    }

    return page;
}

/**
 * Send a pageView object. Creates a closure that encapsulates the scope of the page
 * object while passing it between various functions before sending it.
 * @author ansel
 *
 * @param {Int} windowId Chrome's window id
 * @param {Int} tabId Chrome's tab id
 */
function sendPage(windowId, tabId) {
    // Retrieve the page
    console.log('Retrieving the page to submit...');
    var page = session.windows[windowId].tabs[tabId];

    // Prepare the page
    page = validatePage(page);

    // Send the page (use closure to keep current state of page in local scope)
    console.log('Sending page...');
    (function(page) {
        return function() {
            post(SERVER + '/graphs/WhySearchTwice/parsley/pageView', page, function(response) {
                response = JSON.parse(response.response);
                if (response.userGuid || response.deviceGuid) {
                    if (response.userGuid) {
                        userGuid = localStorage.userGuid = response.userGuid;
                        chrome.storage.sync.set({'userGuid': response.userGuid});
                    }
                    if (response.deviceGuid) {
                        deviceGuid = localStorage.deviceGuid = response.deviceGuid;
                    }
                    // flush requests & remove fencepost
                    requestQueue.isActive = false;
                    requestQueue.queue.splice(0, 1);
                    requestQueue.flush();
                }
                cacheSendPage(page, response.id);

                if (session.windows[page.windowId] &&
                    session.windows[page.windowId].tabs[page.tabId]
                ) {
                    session.windows[page.windowId].tabs[page.tabId].id = response.id;
                }
            });
        };
    })(page)();
}

/**
 * Send update to an exisitng pageView object.
 * Creates a closure that encapsulates the scope of the page object
 * while passing it between various functions before sending it.
 * @author ansel
 *
 * @param {Int} windowId Chrome's window id
 * @param {Int} tabId Chrome's tab id
 */
function updatePage(windowId, tabId) {
    // Retrieve the page
    console.log('Retrieving the page to update...');
    var page = session.windows[windowId].tabs[tabId];
    var pageUpdate = {
        id: page.id,
        pageCloseTime: (new Date()).getTime(),
        focusHistory: page.focusHistory
    };

    // Prepare the page
    pageUpdate = validatePage(pageUpdate);

    // Send the page (use closure to keep current state of page in local scope)
    console.log('Sending page...');
    (function(page) {
        return function() {
            post(SERVER + '/graphs/WhySearchTwice/vertices/' + page.id + '/parsley/pageView', page);
            cacheUpdatePage(page);
        };
    })(pageUpdate)();
}

/**
 * POST data to the server. Wrapper for AJAX
 * Validates that the object contains a userGuid and is not a newtab page before sending.
 * @author ansel
 *
 * @param {String} url remote target of POST
 * @param {Mixed} data String or Object to be POSTed
 * @param {Function} callback a function to be called on success. Will be passed the request object
 */
function post(url, data, callback) {
    ajax('POST', url, data, callback);
}

/**
 * GET data from the server. Wrapper for AJAX
 * @author ansel
 *
 * @param {String} url remote target of POST
 * @param {Function} callback a function to be called on success. Will be passed the request object
 */
function get(url, callback) {
    ajax('GET', url, undefined, callback);
}

/**
 * AJAX helper function. Do not use this function directly
 * @author ansel
 *
 * @param {String} url remote target of POST
 * @param {Mixed} data String or Object to be POSTed
 * @param {Function} callback a function to be called on success. Will be passed the request object
 */
function ajax(method, url, data, callback) {
    if (requestQueue.isActive) {
        if (method === 'PING') {
            if (requestQueue.queue.length === 0) { return; }
            method = requestQueue.queue[0].method;
            url = requestQueue.queue[0].url;
            data = requestQueue.queue[0].data;
            data.userEmail = localStorage.userEmail;
            callback = requestQueue.queue[0].callback;
        } else {
            console.log('Queuing request:');
            var request = {
                method: method,
                url: url,
                data: data,
                callback: callback
            };
            console.log(request);
            requestQueue.queue.push(request);
            endLogEvent();
            return;
        }
    } else {
        if (requestQueue.queue.length > 0 && !requestQueue.isDequeuing) {
            while (requestQueue.queue.length > 0) {
                requestQueue.isDequeuing = true;
                console.log('Dequeuing: ');
                var request = requestQueue.queue[0];
                // revalidate data
                request.data = validatePage(request.data);
                console.log(request);
                if (request.data.pageUrl.indexOf('/graphs/WhySearchTwice/vertices/') > -1 && !request.data.id) {
                    console.log('Dirty data, skipping...');
                    requestQueue.queue.splice(0, 1);
                    endLogEvent();
                    continue;
                }
                ajax(request.method, request.url, request.data, request.callback);
                requestQueue.queue.splice(0, 1);
                endLogEvent();
            }
            requestQueue.isDequeuing = false;
        }
    }
    if (method === 'FLUSH') { return; }
    console.log('Sending: ');
    console.log(data || url);
    var request = new XMLHttpRequest();
    request.open(method, url, true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('accept', 'application/json');
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            console.log('Response received:');
            console.log(request);
            endLogEvent();
            if (typeof callback === 'function') { callback(request); }
        }
    };
    request.send(JSON.stringify(data));
}

/**
 * Opens the history page
 * @author ansel
 */
function openHistory() {
    console.log('Opening history...');
    chrome.tabs.create({url:chrome.extension.getURL('html/history.html')});
}

/**
 * Check Chrome Sync for conflicting environmental variables
 * @author ansel
 */
function validateEnvironment() {
    console.log('Validating local IDs with Chrome Sync... ');
    chrome.storage.sync.get('userGuid', function(response) {
        if (!response.userGuid) {
            console.log('Failed. Trying to fetch userGuid via oauth...');
            var oauth = ChromeExOAuth.initBackgroundPage({
                'request_url'    : 'https://www.google.com/accounts/OAuthGetRequestToken',
                'authorize_url'  : 'https://www.google.com/accounts/OAuthAuthorizeToken',
                'access_url'     : 'https://www.google.com/accounts/OAuthGetAccessToken',
                'consumer_key'   : 'anonymous', // TODO: Register app with Google
                'consumer_secret': 'anonymous', // TODO: Register app with Google
                'scope'          : 'https://www.googleapis.com/auth/userinfo.email',
                'app_name'       : 'Capstone'
            });

            console.log('Authorizing with Google...');
            oauth.authorize(function() {
                console.log('Authorized. Fetching email...');
                var url = 'https://www.googleapis.com/userinfo/email';
                var request = {
                    'method': 'GET',
                    'parameters': {'alt': 'json'}
                };
                oauth.sendSignedRequest(url, function(response) {
                    localStorage.userEmail = JSON.parse(response).data.email;
                    console.log('Email saved.');
                    requestQueue.ping();
                }, request);
            });
            return;
        } else if (response.userGuid !== userGuid) {
            userGuid = localStorage.userGuid = response.userGuid;
        }
        requestQueue.isActive = false;
    });
}

/**
 * Sends session snapshot to server to close open tabs that do not exist anymore
 * @author ansel
 */
function cleanDatastore() {
    chrome.tabs.query({}, function(tabs) {
        var snapshot = {};
        for (var i = 0, l = tabs.length; i < l; i++) {
            snapshot[tabs[i].id] = tabs[i].url;
        }
        post(SERVER + '/graphs/WhySearchTwice/vertices/' + deviceGuid + '/parsley/cleanup/closeTabs', snapshot);
    });
}

/**
 * Deletes localStorage and Chrome sync data
 * @author ansel
 */
function reset() {
    localStorage.clear();
    chrome.storage.sync.clear();
}

/**
 * Prints spacer and style divider to log
 * @author ansel
 */
function endLogEvent() {
    console.log('%c\n================================================================================\n', 'background:#999;color:#fff;');
}

