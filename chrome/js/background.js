var capstone = {
    history: []
};

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == 'loading') {
        var page = {
            url: changeInfo.url || tab.url
        };
        capstone.history.push(page);
        console.log('Sending: ' + page.url);
        post('http://emberdb.com/capstone/pageview', page);
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