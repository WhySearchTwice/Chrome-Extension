// Remote data store
var SERVER = 'http://ec2-174-129-49-253.compute-1.amazonaws.com';

// Library of tabs in active session yet to be submitted
// When a page is navigated away from, the view will be submitted and removed
// Attempt to recover session data from localStorage on load
var session = localStorage.session || {
    windows: {}
};

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
            // Send this tab and remove
            sendAndDeleteTab(windowId, tabId);
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
        var page = {
            type: "pageView",
            tabId: tab.id,
            pageUrl: changeInfo.url || tab.url,
            windowId: tab.windowId,
            pageOpenTime: (new Date()).getTime()
        };

        // Check if there is a tab with this ID already. If so, submit it
        if (tab.windowId in session.windows &&
            tabId in session.windows[tab.windowId].tabs) {
            console.log('Sending previous page...');
            sendAndDeleteTab(tab.windowId, tab.id);
        }

        // Store this new page
        if (!(tab.windowId in session.windows)) {
            session.windows[tab.windowId] = {
                tabs: {}
            };
        }
        session.windows[tab.windowId].tabs[tab.id] = page;

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
            sendAndDeleteTab(windowId, tabId);
            console.groupEnd();
            return;
        }
    }

    console.warn('Tab not in session, no action taken');
    console.groupEnd();
});

function preparePageForSend(page) {
    console.group();
    console.log('Adding close time to page object in session...');
    page.pageCloseTime = (new Date()).getTime();

    console.groupEnd();
    return page;
}

// Send the tab object, then remove from the session
function sendAndDeleteTab(windowId, tabId, callback) {
    console.group();
    // Retrieve the page
    console.log('Retrieving page...');
    page = session.windows[windowId].tabs[tabId];

    // Prepare the page
    console.log('Preparing page...');
    page = preparePageForSend(page);

    // Send the page
    console.log('Sending page...');
    post(SERVER + '/pageview', page, function() {
        // Delete the page from storage
        console.log('Deleting page from session...');
        delete session.windows[windowId].tabs[tabId];
        console.groupEnd();

        if (typeof callback === 'function') { callback(); }
    });
}

// Send the page object to the server for storage
function post(url, data, callback) {
    console.group();
    console.log('Sending: ');
    console.log(data);
    var request = new XMLHttpRequest();
        request.open('POST', url, true);
        request.setRequestHeader('Content-Type', 'text/plain');
        request.onreadystatechange = function () {
            console.log('Response received.');
            if (request.readyState == 4 && request.status == 200) {
                if (typeof callback === 'function') { callback(); }
                console.groupEnd();
            }
        };
        request.send(JSON.stringify(data));
}
