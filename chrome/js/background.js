// Library of page views yet to be submitted
// When a page is navigated away from, the view will be submitted and removed
var pageViewStorage = {};

// Listen for when a window is closed (submit all pages that are open in this window)
chrome.windows.onRemoved.addListener(function(windowId) {
    for (var tabId in pageViewStorage.windows[windowId]) {
        // Send this tab and remove
        sendAndDeleteTab(windowId, tab);
    }

    // Remove the window from the storage
    delete pageViewStorage.windows[windowId];
});

// Listen for a page being loaded or updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == 'loading') {
        // Create an object representing the page that was just opened
        var page = {
            tabId: tab.id,
            pageUrl: changeInfo.url || tab.url,
            windowId: tab.windowId,
            pageOpenTime: (new Date).getTime();
        };

        // Check if there is a tab with this ID already. If so, submit it
        if(tabId in pageViewStorage.windows[tab.windowId]) {
            sendAndDeleteTab(tab.windowId, tab.id);
        }

        // Store this new page
        pageViewStorage[tab.windowId][tab.id] = page;
    }
});

// Listen for a tab being closed. Submit this tab and remove from storage
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    // If a window is being closed, ignore this event
    if(removeInfo[isWindowClosing]) {
        return;
    }

    // else
    for(var windowId in pageViewStorage.windows) {
        if(tabId in pageViewStorage.windows[windowId]) {
            sendAndDeleteTab(windowId, tabId);
            return;
        }
    }

    // Maybe it doesn't exist? That's weird
});

function preparePageForSend(page) {
    page.pageCloseTime = (new Date).getTime();

    return page;
}

// Send the tab object, then remove from the pageViewStorage
function sendAndDeleteTab(windowId, tabId) {
    // Retrieve the page
    page = pageViewStorage.windows[windowId][tabId];

    // Prepare the page
    page = preparePageForSend(page);

    // Send the page
    post('http://ec2-174-129-49-253.compute-1.amazonaws.com/pageview', page);

    // Delete the page from storage
}

// Send the page object to the server for storage
function post(url, data) {
    var request = new XMLHttpRequest();
        request.open('POST', url, true);
        request.setRequestHeader('Content-Type', 'text/plain');
        request.onreadystatechange = function () {
            if (request.readyState == 4 && request.status == 200) {
                console.log('Sent');
            }
        };
        request.send(JSON.stringify(data));
}
