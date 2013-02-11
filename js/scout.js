/* Initialize */
(function() {
    console.log('Scout loaded');
})();

/**
 * Opens history replacement page manually in a new tab with [ Shift ] + [ H ]
 */
document.addEventListener('keypress', function(event) {
    var isInput =
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.hasAttribute('contenteditable')
    ;
    if (event.keyCode === 72 && !isInput) {
        var port = chrome.extension.connect({ name: 'scout' });
            port.postMessage({ action: 'openHistory' });
    }
});