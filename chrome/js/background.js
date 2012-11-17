/**
 * Base URL of database API where all information is submitted.
 */
var SERVER = 'http://ec2-174-129-49-253.compute-1.amazonaws.com';

/**
 * A library of all known windows and the tabs they contain. Will be persisted to
 * localStorage when chrome is closed. Load from localStorage or create new.
 */
var session = localStorage.session || {
    windows: {}
};

/**
 * userId must be submitted with every request. Consists of email address of user
 * and is stored to localStorage after initial retrieval. Retrieve if missing.
 */
var userId = localStorage.userId || retrieveUserId();
if (userId === null) { retrieveUserId(); }

/**
 * guid uniquely identifies this device and will be stored to localStorage after
 * initial generation. Retrieve if missing.
 */
var guid = localStorage.guid || null;
if (guid === null) { retrieveNewGuid(); }

/**
 * Persist session data to localStorage if background page is reloaded or closed.
 */
window.onUnload = function() {
    console.log('Background page close detected, Saving to localStorage...');
    localStorage.session = session;
};

/**
 * Event Listener - Window Close
 * Submit each tab that is contained in this window. Delete window from session
 * after complete.
 */
chrome.windows.onRemoved.addListener(function(windowId) {
    console.group();
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
    } else {
        console.warn('Window not in session, no action taken');
    }
    console.groupEnd();
});

/**
 * Event Listener - Tab Updated
 * Check if the tab is our storage, if so submit it. Create an entry for the
 * new page that has been loaded and store it in the session for its containing window.
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading') {
        console.group();
        console.log('Tab loading: ' + changeInfo.url || tab.url);

        // Create an object representing the page that was just opened
        console.log('Creating new page object...');
        var newPage = {
            type: "pageView",
            tabId: tab.id,
            pageUrl: changeInfo.url || tab.url,
            windowId: tab.windowId,
            pageOpenTime: (new Date()).getTime()
        };

        // Check if there is a tab with this ID already. If so, submit it
        if (tab.windowId in session.windows &&
            tabId in session.windows[tab.windowId].tabs) {
            console.log('Calling send page...');
            sendPage(tab.windowId, tabId);
        }

        // Store this new page
        if (!(tab.windowId in session.windows)) {
            session.windows[tab.windowId] = {
                tabs: {}
            };
        }
        session.windows[tab.windowId].tabs[tab.id] = newPage;

        console.groupEnd();
    }
});

/**
 * Event Listener - Tab Attached (to a new window)
 * Listen for tabs being attached to new windows. Create a new group for the window
 * in the session if it does not exist and add this tab to it. Remove the tab from the
 * old group.
 */
chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
    console.group();
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
            if(windowId == newWindowId) {
                console.log('source windowId == destination windowId. Aboring move');
                console.groupEnd();
                return;
            }

            page = session.windows[windowId].tabs[tabId];
            page.windowId = newWindowId;

            console.log('Saving tab to new window location: window ' + newWindowId);
            session.windows[newWindowId].tabs[tabId] = page;
            delete(session.windows[windowId].tabs[tabId]);
        }
    }
    console.groupEnd();
});

/**
 * Event Listener - Tab closed
 * Listen for tabs being closed. Submit the tab and remove from the session.
 */
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    // If a window is being closed, ignore this event
    if (removeInfo.isWindowClosing) { return; }

    // else
    console.group();
    console.log('Tab ' + tabId + ' closed');
    for (var windowId in session.windows) {
        if (tabId in session.windows[windowId].tabs) {
            // Send the page
            console.log('Sending tab before close...');
            sendPage(windowId, tabId);

            // Delete the page from storage
            console.log('Deleting the page from storage');
            delete(session.windows[windowId].tabs[tabId]);

            console.groupEnd();
            return;
        }
    }

    console.warn('Tab not in session, no action taken');
    console.groupEnd();
});

/**
 * Every device must have a unique GUID. Retrieve one from the server, save
 * to the local variable and localStorage.
 */
function retrieveNewGuid() {
    console.group();
    console.log('Requesting new guid...');

    // Perform AJAX call to SERVER/guid to retrieve new GUID
    var request = new XMLHttpRequest();
        request.open('GET', SERVER + '/guid', true);
        request.setRequestHeader('Content-Type', 'text/plain');
        request.onreadystatechange = function () {
            console.log('Response received.');
            if (request.readyState == 4 && request.status == 200) {
                console.log('Retrieved guid: ' + request.responseText);

                // Store the GUID in localstorage & update local copy
                localStorage.guid = request.responseText;
                guid = request.responseText;

                console.groupEnd();
            }
        };
        request.send();
    console.groupEnd();
}

/**
 * Add required fields to the pageView object such as userId and deviceGuid
 * and pageCloseTime.
 */
function preparePageviewForSend(page) {
    console.group();
    console.log('Adding close time to page object in session...');
    page.pageCloseTime = (new Date()).getTime();

    console.log('Adding userId to page object...');
    page.userId = userId;
    page.deviceGuid = guid;

    if (page.userId == null) {
        // Attempt to reload the userId
        userId = localStorage.userId;
        page.userId = userId;

        // If still null, issue warning
        if (userId == null && /^https:\/\/accounts.google.com\/OAuthAuthorizeToken*/.test(page.url)) {
            window.location.reload();
        }
    } else if (page.deviceGuid == null) {
        console.log('deviceGuid is null! Do something!');
    }

    console.groupEnd();
    return page;
}

// Send the tab object, then remove from the session
function sendPage(windowId, tabId) {
    // Contain the scope within a closure (fuck callbacks)
    (function(windowId, tabId) {
        return function() {
            console.group();

            // Retrieve the page
            console.log('Retrieving the page to submit...');
            page = session.windows[windowId].tabs[tabId];

            // Prepare the page
            console.log('Preparing page...');
            page = preparePageviewForSend(page);

            // Send the page
            console.log('Sending page...');
            post(SERVER + '/pageview', page);

            console.groupEnd();
        };
    })(windowId, tabId)();
}

// Send the page object to the server for storage
function post(url, data, callback) {
    console.group();

    // Verify that the page is valid
    if (data.userId == null || data.deviceGuid == null) {
        console.log('UserID or DeviceGuid missing. Aborting send');
        return;
    } else if (data.pageUrl == "chrome://newtab/") {
        console.log('Ignoring a newTab pageView');
        return;
    }

    console.log('Sending: ');
    console.log(data);
    var request = new XMLHttpRequest();
        request.open('POST', url, true);
        request.setRequestHeader('Content-Type', 'text/plain');
        request.onreadystatechange = function () {
            if (request.readyState == 4 && request.status == 200) {
                console.log('Response received.');
                if (typeof callback === 'function') { callback(); }
                console.groupEnd();
            }
        };
        request.send(JSON.stringify(data));

    console.groupEnd();
}

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
                'consumer_key'   : 'anonymous',
                'consumer_secret': 'anonymous',
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
