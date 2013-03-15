angular.module('history.services', [], function($provide) {

    /**
     * background service for interacting with background.js
     * @author Ansel
     */
    $provide.factory('background', function() {
        var globals = {
            SERVER: 'http://prod.whysearchtwice.com:8182'
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
             * @param  {String} userGuid   Local user GUID
             * @param  {Int}    targetTime Unix time in middle of range
             * @param  {Object} params     Optional search arguments
             *             domain               All search results will be under this domain (ex. google.com)
             *             timeRange            Number of timeRangeUnits to search on either side of the openTime (default: 30)
             *             timeRangeUnits       hours, minutes, seconds (default: minutes)
             *             includeChildren      If true, return all children of search results along with the results (default: false)
             *             includeSuccessors    If true, return all successors of any search results along with the results (default: false)
             *
             * @return {Object}            Angular Promise
             */
            search: function(userGuid, targetTime, params) {
                var encoded = [];
                params = params || {};
                params.userGuid = userGuid;
                params.openTime = targetTime;
                for (var key in params) {
                    encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
                return $http.get(background.get('SERVER') + '/graphs/WhySearchTwice/parsley/search?' + encoded.join('&'));
            }
        };
    }]);
});