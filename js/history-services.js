angular.module('history.services', [], function($provide) {

    /**
     * background service for interacting with background.js
     * @author ansel
     */
    $provide.factory('background', function() {
        return {
            get: function(globals, callback) {
                chrome.extension.sendMessage({
                    action: 'getGlobals',
                    message: globals
                }, callback);
            }
        };
    });

    /**
     * Sends broadcast messages between scopes
     * @author ansel
     */
    $provide.factory('broadcast', function($rootScope) {
        return {
            send: function(data) {
                $rootScope.$broadcast('handleBroadcast', data);
            }
        };
    });

    /**
     * rexster service for interacting with rexster endpoints
     * @author ansel
     */
    $provide.factory('rexster', ['$http', 'background', function($http, background) {
        return {
            /**
             * Search the graph with Rexster
             * @author ansel
             *
             * @param  {Int}    targetTime Unix time in middle of range
             * @param  {Object} params     Optional search arguments
             *             userGuid             If userGuid is different than the local user
             *             domain               All search results will be under this domain (ex. google.com)
             *             timeRange            Number of timeRangeUnits to search on either side of the openTime (default: 30)
             *             timeRangeUnits       hours, minutes, seconds (default: minutes)
             *             includeChildren      If true, return all children of search results along with the results (default: false)
             *             includeSuccessors    If true, return all successors of any search results along with the results (default: false)
             * @param {Function} callback  Optional callback function
             *
             * @return {Object}            Angular Promise
             */
            search: function(openRange, closeRange, params, callback) {
                if (typeof openRange === 'function') {
                    // request for persistent tabs
                    callback = openRange;
                    var request = '/vertices/' + localStorage.deviceGuid + '/parsley/cleanup/openTabs';
                } else {
                    if (typeof params === 'function') {
                        // handle omitted params object
                        callback = params;
                        params = {};
                    }
                    if (openRange && closeRange) {
                        var encoded = [];
                        params = params || {};
                        params.userGuid = localStorage.userGuid || params.userGuid;
                        params.openRange = openRange;
                        params.closeRange = closeRange;
                        for (var key in params) {
                            encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                        }
                        var request = '/parsley/search?' + encoded.join('&');
                    }
                }

                return $http
                    .get(localStorage.SERVER + '/graphs/WhySearchTwice' + request)
                    .then(function(response) {
                        var results = response.data.results;
                        if (typeof params === 'function') { params(results); }
                        if (typeof callback === 'function') { callback(results); }
                    })
                ;
            }
        };
    }]);
});