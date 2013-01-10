/* Initialize */
(function() {
    console.log('Scout loaded');
})();

/**
 * Opens history replacement page manually in a new tab with [ Alt ] + [ H ]
 */
document.addEventListener('keypress', function(event) {
    console.log(event);
    var isInput =
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.hasAttribute('contenteditable')
    ;
    console.log(isInput);
    if (event.keyCode === 72 && !isInput) {
        chrome.extension.sendMessage({ action: 'openHistory' });
    }
});