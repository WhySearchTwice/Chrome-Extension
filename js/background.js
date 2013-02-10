/**
 * Base URL of database API where all information is submitted.
 *
 * @type String
 */
var SERVER = 'http://ec2-54-234-143-192.compute-1.amazonaws.com:8182';

/**
 * A library of all known windows and the tabs they contain. Will be persisted to
 * localStorage when chrome is closed. Load from localStorage or create new.
 *
 * @type Object
 */
var session = localStorage.session || { windows: {} };

/**
 * userId must be submitted with every request. Consists of email address of user
 * and is stored to localStorage after initial retrieval. Retrieve if missing.
 *
 * @type String
 */
var userId = localStorage.userId;

/**
 * deviceId uniquely identifies this device and will be stored to localStorage after
 * initial generation. Retrieve if missing.
 *
 * @type String
 */
var deviceId = localStorage.deviceId;

// create session
(function() {
    console.log('Updating session...');
    chrome.windows.getAll({populate: true}, function(windows) {
        for (var i = 0, l = windows.length; i < l; i++) {
            for (var j = 0, m = windows[i].tabs.length; j < m; j++) {
                addToSession(windows[i].tabs[j]);
            }
        }
    });
})();

/**
 * Listen for messages from scout.js
 */
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log('Message from ' + (sender.tab ? 'scout: ' + sender.tab.url : ' extension'));
        console.log('    ' + request);
        switch (request.action) {

            case 'openHistory':
                console.log('Opening history...');
                chrome.tabs.create({url:chrome.extension.getURL('html/history.html')});
                break;

            default:
                break;

        }
    });

/**
 * Persist session data to localStorage if background page is unloaded.
 */
window.onUnload = function() {
    console.log('Background page unloading. Saving to localStorage...');
    localStorage.session = session;
};

/**
 * Event Listener - Window Closed
 * Update each tab that is contained in this window. Delete window from session
 * after complete.
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

chrome.webNavigation.onCompleted.addListener(function(details) {
    // console.log('Completed: ' + details.url);
});

chrome.webNavigation.onTabReplaced.addListener(function(details) {
    // console.log('Tab Replaced: New - ' + details.tabId + ' Old - ' + replacedTabId);
});

/**
 * Event Listener - Tab Focused
 * Called whenever a tab gains focus. Send an event with the tabID and windowId, and other
 * standard fields to write a trail of what the user is looking at.
 */
chrome.tabs.onActivated.addListener(function(activeInfo) {
    console.log('Tab focused, updating focus data...');
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

    // focus current page
    var currentTab = session.windows[activeInfo.windowId].tabs[activeInfo.tabId];
    if (!currentTab.focusHistory) {
        currentTab.focusHistory = [];
    }
    currentTab.focusHistory.push(focusStart);

    session.windows[activeInfo.windowId].focusedTab = currentTab.tabId;

    console.log('Updated focus data:');
    console.log(currentTab);
    endLogEvent();
});

/**
 * Event Listener - Tab moved to new Window
 * Listen for tabs being attached to new windows. Create a new group for the window
 * in the session if it does not exist and add this tab to it. Remove the tab from the
 * old group.
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
        parentId: tab.openerTabId ? session.windows[tab.windowId].tabs[tab.openerTabId].id : undefined,
        windowId: tab.windowId,
        pageOpenTime: (new Date()).getTime()
    };

    // Check if there is a tab with this ID already. If so, update it
    if (session.windows[tab.windowId] &&
        session.windows[tab.windowId].tabs[tab.tabId]
    ) {
        console.log(tab.tabId);
        console.log(session.windows[tab.windowId].tabs);
        console.log(session.windows[tab.windowId].tabs[tab.tabId]);
        newPage.predecessorId = session.windows[tab.windowId].tabs[tab.tabId].id;
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
 *
 * @param {Object} page The page to be validated
 */
function validatePage(page) {
    console.log('Adding userId to page object...');
    if (userId) {
        page.userId = userId;
    }
    if (deviceId) {
        page.deviceId = deviceId;
    }

    return page;
}

/**
 * Send a pageView object. Creates a closure that encapsulates the scope of the page
 * object while passing it between various functions before sending it.
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
                if (response.userGuid) {
                    userId = response.userGuid;
                }
                if (response.deviceGuid) {
                    deviceId = response.deviceGuid;
                }
                session.windows[page.windowId].tabs[page.tabId].id = response.id;
            });
        };
    })(page)();
}

/**
 * Send update to an exisitng pageView object.
 * Creates a closure that encapsulates the scope of the page object
 * while passing it between various functions before sending it.
 *
 * @param {Int} windowId Chrome's window id
 * @param {Int} tabId Chrome's tab id
 */
function updatePage(windowId, tabId) {
    // Retrieve the page
    console.log('Retrieving the page to update...');
    var page = session.windows[windowId].tabs[tabId];
    var pageUpdate = {
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
        };
    })(page)();
}

/**
 * POST data to the server. Wrapper for AJAX
 * Validates that the object contains a userId and is not a newtab page before sending.
 *
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
 *
 * @param {String} url remote target of POST
 * @param {Function} callback a function to be called on success. Will be passed the request object
 */
function get(url, callback) {
    ajax('GET', url, undefined, callback);
}

/**
 * AJAX helper function. Do not use this function directly
 *
 * @param {String} url remote target of POST
 * @param {Mixed} data String or Object to be POSTed
 * @param {Function} callback a function to be called on success. Will be passed the request object
 */
function ajax(method, url, data, callback) {
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
 * register new deviceId
 */
function registerDevice() {
    console.log('Fetching existing devices from Chrome Sync...');
    chrome.storage.sync.get('devices', function(response) {
        if (!response.devices) {
            response.devices = [];
        }
        deviceId = localStorage.deviceId = userId + response.devices.length;
        response.devices.push(deviceId);
        chrome.storage.sync.set({'devices': response.devices}, function() {
            console.log('Device registered.');
        });
    });
}

/**
 * Retrieve the email address of the user and saves to the userId and in localStorage.
 */
function retrieveUserId() {
    console.log('Trying to fetch userId from Chrome Sync...');
    chrome.storage.sync.get('userId', function(response) {
        if (typeof response.userId !== 'undefined') {
            userId = localStorage.userId = response.userId;
            console.log('Fetched userId.');
        } else {
            console.log('Failed. Trying to fetch userId via oauth...');
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
                    userId = localStorage.userId = JSON.parse(response).data.email;
                    console.log('Email saved. Syncing email...');
                    chrome.storage.sync.set({'userId': userId}, function() {
                        console.log('Email synced.');
                    });
                }, request);
            });
        }
    });
}

/**
 * Deletes localStorage and Chrome sync data
 */
function reset() {
    localStorage.clear();
    chrome.storage.sync.clear();
}

/**
 * Prints spacer and style divider to log
 */
function endLogEvent() {
    console.log('%c\n============================================================\n', 'background:#999;color:#fff;');
}