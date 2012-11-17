// Remote data store
var SERVER = 'http://ec2-174-129-49-253.compute-1.amazonaws.com';

// Library of tabs in active session yet to be submitted
// When a page is navigated away from, the view will be submitted and removed
// Attempt to recover session data from localStorage on load
var session = localStorage.session || {
    windows: {}
};

// UserID to include with all URL submissions
var userId = localStorage.userId || null;
var guid = localStorage.guid || null;

if (userId === null) {
    // Retrieve a userId for this computer
    retrieveUserId();
}

if (guid === null) {
    // Retrieve a new GUID for this computer
    retrieveNewGuid();
}

// Persist session data to localStorage if background page is reloaded or closed
window.onUnload = function() {
    console.log('Background page close detected, Saving to localStorage...');
    localStorage.session = session;
};

// Listen for when a window is closed (submit all pages that are open in this window)
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

// Listen for a page being loaded or updated
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

// Listen for a tab being closed. Submit this tab and remove from storage
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    // If a window is being closed, ignore this event
    if (removeInfo.isWindowClosing) { return; }

    // else
    console.group();
    console.log('Tab closed');
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

function preparePageForSend(page) {
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
            page = preparePageForSend(page);

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
