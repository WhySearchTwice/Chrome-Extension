angular.module('history.services', [], function($provide) {

    /**
     * background service for interacting with background.js
     * @author Ansel
     */
    $provide.factory('background', function() {
        var globals = {
            SERVER: 'http://prod.whysearchtwice.com:8182',
            userGuid: '78040'
        };
        return {
            get: function(global) {
                if (globals[global]) { return globals[global]; }
                else {
                    chrome.extension.sendMessage({
                        action: 'getGlobal',
                        message: global
                    }, function(response) {
                        return response;
                    });
                }
            }
        };
    });

    /**
     * rexster service for interacting with rexster endpoints
     * @author Ansel
     */
    $provide.factory('rexster', ['$http', 'background', function($http, background) {
        return {
            /**
             * Search the graph with Rexster
             * @author Ansel
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
            search: function(targetTime, params, callback) {
                var encoded = [];
                params = params || {};
                params.userGuid = params.userGuid || background.get('userGuid');
                params.openTime = targetTime;
                for (var key in params) {
                    encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
                return $http
                    .get(background.get('SERVER') + '/graphs/WhySearchTwice/parsley/search?' + encoded.join('&'))
                    .then(function(response) {
                        var results = JSON.parse(response.data.results);
                        if (typeof params === 'function') { params(results); }
                        if (typeof callback === 'function') { callback(results); }
                    })
                ;
            }
        };
    }]);
});