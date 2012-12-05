/**
 * Base URL of database API where all information is submitted.
 *
 * @type String
 */
var SERVER = 'http://ec2-174-129-49-253.compute-1.amazonaws.com';

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
var userId = localStorage.userId || null;
if (userId === null) { retrieveUserId(); }

/**
 * guid uniquely identifies this device and will be stored to localStorage after
 * initial generation. Retrieve if missing.
 *
 * @type String
 */
var guid = localStorage.guid || null;
if (guid === null) { retrieveNewGuid(); }

/**
 * Listen for messages from scout.js
 */
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log('Message from ' + (sender.tab ? 'scout: ' + sender.tab.url : ' extension'));
        console.log(request);
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
 * Persist session data to localStorage if background page is reloaded or closed.
 */
window.onUnload = function() {
    console.log('Background page unloading. Saving to localStorage...');
    localStorage.session = session;
};

/**
 * Event Listener - Window Close
 * Submit each tab that is contained in this window. Delete window from session
 * after complete.
 */
chrome.windows.onRemoved.addListener(function(windowId) {
    console.log('Window ' + windowId + ' closed.');
    // Check if window exists
    if (windowId in session.windows) {
        // get all tabs in window
        console.log('Sending tabs...');
        for (var tabId in session.windows[windowId].tabs) {
            // Send this tab
            sendPage(windowId, tabId);
        }
        // Remove the window from the storage
        console.log('Removing window from session');
        delete session.windows[windowId];
        endLogEvent();
    } else {
        console.warn('Window not in session, no action taken');
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
 * Event Listener - URL Committed to Tab
 * Called whenever a navigation takes place. Will attempt to add information
 * to the session about what is loading in a tab and how it was started
 */
chrome.webNavigation.onCommitted.addListener(function(details) {
    windowId = findWindowId(details.tabId);
    if (windowId === null) { return; }

    // Verify that this commit was for the page that is actually being loaded,
    // not a background page
    if (details.url == session.windows[windowId].tabs[details.tabId].pageUrl) {
        // Append information to this page object
        console.log('Updating pageView object with onCommitted information');

        page = session.windows[windowId].tabs[details.tabId];
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
 * Event Listener - Tab Gains Focus
 * Called whenever a tab gains focus. Send an even with the tabID and windowId, and other
 * standard fields to write a trail of what the user is looking at.
 */
chrome.tabs.onActivated.addListener(function(activeInfo) {
    var focusChange = {
        type: 'focusChange',
        tabId: activeInfo.tabId,
        windowId: activeInfo.windowId,
        time: (new Date()).getTime()
    };

    addToSession(activeInfo.tabId);

    // Send this page to the server
    sendFocus(focusChange);
});

/**
 * Event Listener - Tab Attached (to a new window)
 * Listen for tabs being attached to new windows. Create a new group for the window
 * in the session if it does not exist and add this tab to it. Remove the tab from the
 * old group.
 */
chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
    var newWindowId = attachInfo.newWindowId;

    // Create a new window if necessary
    if (!(newWindowId in session.windows)) {
        console.log('Creating a new window in session: window ' + newWindowId);
        session.windows[newWindowId] = {
            tabs: {}
        };
    }

    // Find the tab that is being moved
    for (var windowId in session.windows) {
        if (tabId in session.windows[windowId].tabs) {
            console.log('Found the old tab location: window ' + windowId);

            // For some reason this method is called twice. Super weird
            if (windowId == newWindowId) {
                console.log('source windowId == destination windowId. Aboring move');
                endLogEvent();
                return;
            }

            page = session.windows[windowId].tabs[tabId];
            page.windowId = newWindowId;

            console.log('Saving tab to new window location: window ' + newWindowId);
            session.windows[newWindowId].tabs[tabId] = page;
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
    console.log('Tab ' + tabId + ' closed');
    for (var windowId in session.windows) {
        if (tabId in session.windows[windowId].tabs) {
            // Send the page
            console.log('Sending tab before close...');
            sendPage(windowId, tabId);

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
 * @param Mixed tab String tabId or Tab tab
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

    // Check if there is a tab with this ID already. If so, submit it
    if (tab.windowId in session.windows &&
        tab.id in session.windows[tab.windowId].tabs) {
        console.log('Calling send page...');
        sendPage(tab.windowId, tab.id);
    } else {
        endLogEvent();
    }

    // Store this new page
    if (!(tab.windowId in session.windows)) {
        session.windows[tab.windowId] = { tabs: {} };
    }
    session.windows[tab.windowId].tabs[tab.id] = newPage;
    endLogEvent();
}

/**
 * Search through the session looking for a tab with the given tabId.
 *
 * @param Int tabId The id of a tab in question to search for
 * @return Int The windowId that contains the tabId. Null if does not exist
 */
function findWindowId(tabId) {
    for (var windowId in session.windows) {
        if (tabId in session.windows[windowId].tabs) {
            return windowId;
        }
    }
    return null;
}

/**
 * Every device must have a unique GUID. Retrieve one from the server, save
 * to the local variable and localStorage.
 */
function retrieveNewGuid() {
    console.log('Requesting new guid...');
    get(SERVER + '/guid', function(request) {
        // Store the GUID in localstorage & update local copy
        guid = localStorage.guid = request.responseText;
        console.log('Retrieved guid: ' + guid);
    });
}

/**
 * Add required fields to the pageView object such as userId and deviceGuid
 * and pageCloseTime.
 */
function preparePageviewForSend(page) {
    console.log('Adding close time to page object in session...');
    page.pageCloseTime = (new Date()).getTime();

    console.log('Adding userId to page object...');
    page.userId = userId;
    page.deviceGuid = guid;

    if (page.userId === null) {
        // Attempt to reload the userId
        userId = localStorage.userId;

        // If still null, reload extension to fetch userId
        // Make exception for userId oauth pages
        if (userId === null && /^https:\/\/accounts.google.com\/OAuthAuthorizeToken*/.test(page.url)) {
            window.location.reload();
        } else {
            page.userId = userId;
        }
    }

    if (page.deviceGuid === null) {
        if(localStorage.guid !== null) {
            guid = localStorage.guid;
            page.deviceGuid = guid;
        } else {
            console.log('deviceGuid is null! Do something!');
        }
    }

    return page;
}

/**
 * Send a pageView object. Creates a closure that encapsulates the scope of the page
 * object while passing it between various functions before sending it.
 *
 * @param Int windowId Chrome's window id
 * @param Int tabId Chrome's tab id
 */
function sendPage(windowId, tabId) {
    // Retrieve the page
    console.log('Retrieving the page to submit...');
    page = session.windows[windowId].tabs[tabId];

    // Prepare the page
    console.log('Preparing page...');
    page = preparePageviewForSend(page);

    // Send the page (use closure to keep current state of page in local scope)
    console.log('Sending page...');
    (function(page) {
        return function() { post(SERVER + '/pageview', page); };
    })(page)();
}

function sendFocus(focusChange) {
    // Prepare the focusChange
    console.log('Perparing a focus change event...');
    focusChange = preparePageviewForSend(focusChange);

    // We don't actually want the pageCloseTime
    delete(focusChange.pageCloseTime);

    // Send the focusChange
    console.log('Sending focusChange...');
    post(SERVER+ '/pageview', focusChange);
}

/**
 * POST data to the server. Wrapper for AJAX
 * Validates that the object contains a userId and is not a newtab page before sending.
 *
 * @author ansel
 *
 * @param String url remote target of POST
 * @param Mixed data String or Object to be POSTed
 * @param Function callback a function to be called on success. Will be passed the request object
 */
function post(url, data, callback) {
    // Verify that the page is valid
    if (data.userId === null || data.deviceGuid === null) {
        console.log('UserID or DeviceGuid missing. Aborting send');
        return;
    } else if (data.pageUrl == 'chrome://newtab/') {
        console.log('Ignoring a newTab pageView');
        return;
    }
    ajax('POST', url, data, callback);
}

/**
 * GET data from the server. Wrapper for AJAX
 *
 * @param String url remote target of POST
 * @param Function callback a function to be called on success. Will be passed the request object
 */
function get(url, callback) {
    ajax('GET', url, null, callback);
}

/**
 * AJAX helper function. Do not use this function directly
 *
 * @param String url remote target of POST
 * @param Mixed data String or Object to be POSTed
 * @param Function callback a function to be called on success. Will be passed the request object
 */
function ajax(method, url, data, callback) {
    console.log('Sending: ');
    console.log(data);
    var request = new XMLHttpRequest();
        request.open(method, url, true);
        request.setRequestHeader('Content-Type', 'text/plain');
        request.onreadystatechange = function () {
            if (request.readyState == 4 && request.status == 200) {
                console.log('Response received:');
                console.log(request);
                endLogEvent();
                if (typeof callback === 'function') { callback(request); }
            }
        };
        request.send(JSON.stringify(data));
}


/**
 * Retrieve the email address of the user and saves to the userId and in localStorage.
 */
function retrieveUserId() {
    console.log('Trying to fetch userId from Chrome Sync...');
    chrome.storage.sync.get('userId', function(response) {
        if (typeof response.userId !== 'undefined') {
            userId = localStorage.userId = response.userId;
        } else {
            console.log('Trying to fetch userId via oauth...');
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
 * Prints spacer and style divider to log
 */
function endLogEvent() {
    console.log('%c\n============================================================\n', 'background:#999;color:#fff;');
}