var capstone = {
    history: []
};

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == 'loading') {
        // Create an object representing the page that was just opened
        var page = {
            pageUrl: changeInfo.url || tab.url,
            windowId: tab.windowId,
            pageOpenTime: (new Date).getTime();
        };

        // TODO: Change this to submit the previous page the was viewed, not the page that is being opened

        capstone.history.push(page);
        console.log('Sending: ' + page.url);
        post('http://ec2-174-129-49-253.compute-1.amazonaws.com/pageview', page);
    }
});

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
